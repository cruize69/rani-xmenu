// api/webhook.js
// Receives Stripe webhook events
// Vercel config: { api: { bodyParser: false } } required for signature verification

import Stripe from "stripe";
import { buffer } from "micro";
import { kv } from "@vercel/kv";
import { buildOrder, saveOrder } from "../lib/orders.js";
import { sendOrderEmail, sendOrderSMS, sendCustomerReceiptEmail } from "../lib/notifications.js";

export const config = { api: { bodyParser: false } };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  // Verify Stripe signature
  const sig  = req.headers["stripe-signature"];
  const body = await buffer(req);
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Only handle successful checkouts
  if (event.type !== "checkout.session.completed") {
    return res.status(200).json({ received: true, skipped: event.type });
  }

  const session = event.data.object;

  // ── Idempotency guard — Stripe may retry webhooks on network failures ──
  const dedupKey = `webhook-processed:${session.id}`;
  const alreadyProcessed = await kv.get(dedupKey);
  if (alreadyProcessed) {
    console.log(`Duplicate webhook for session ${session.id} — skipping.`);
    return res.status(200).json({ received: true, duplicate: true });
  }
  // Claim the key immediately before doing any work (24h TTL)
  await kv.set(dedupKey, "1", { ex: 60 * 60 * 24 });

  // Reconstruct cart from metadata
  let cartItems = [];
  try {
    const cartJson = session.metadata.cart
      ?? (session.metadata.cart_0 + (session.metadata.cart_1 ?? ""));
    cartItems = JSON.parse(cartJson);
  } catch (err) {
    console.error("Failed to parse cart from metadata:", err);
    return res.status(200).json({ received: true, error: "cart parse failed" });
  }

  let deliveryAddress = null;
  if (session.metadata?.deliveryAddress) {
    try { deliveryAddress = JSON.parse(session.metadata.deliveryAddress); } catch {}
  }

  // Build and save order — paymentIntent declared here so saved-card block can reference it
  const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent);
  const order = buildOrder({
    paymentIntent,
    stripeSession:       session,
    cartItems,
    specialInstructions: session.metadata?.specialInstructions ?? "",
    tip:                 parseFloat(session.metadata?.tip ?? "0") || 0,
    orderMode:           session.metadata?.orderMode ?? "pickup",
    deliveryAddress:     deliveryAddress,
    deliveryFee:         parseFloat(session.metadata?.deliveryFee ?? "0") || 0,
  });

  // Batch core KV writes for performance — session lookup + order save
  await Promise.all([
    saveOrder(order),
    kv.set(`session:${session.id}`, order.id, { ex: 60 * 60 * 24 * 7 }), // 7 days
  ]);
  console.log(`Order saved: ${order.id}`);

  // Link order to customer account (Clerk user or guest email)
  const accountId = session.metadata?.clerkUserId ?? null;
  const guestEmail = session.customer_details?.email ?? null;
  const linkId = accountId ?? (guestEmail ? `guest:${guestEmail.toLowerCase()}` : null);
  if (linkId) {
    // Batch account linking KV writes
    await Promise.all([
      kv.lpush(`account-orders:${linkId}`, order.id),
      kv.ltrim(`account-orders:${linkId}`, 0, 99),
    ]);

    // Save vaulted payment method metadata (non-sensitive: brand, last4, pm token)
    if (paymentIntent?.payment_method) {
      try {
        const pm = typeof paymentIntent.payment_method === "string"
          ? await stripe.paymentMethods.retrieve(paymentIntent.payment_method)
          : paymentIntent.payment_method;
        if (pm?.card) {
          const cardMetadata = {
            paymentMethodId:  pm.id,
            stripeCustomerId: session.customer ?? null,
            brand:            pm.card.brand,
            last4:            pm.card.last4,
            expMonth:         pm.card.exp_month,
            expYear:          pm.card.exp_year,
            updatedAt:        new Date().toISOString(),
          };
          await kv.set(`saved-card:${linkId}`, JSON.stringify(cardMetadata));
        }
      } catch (e) {
        console.error("Failed to save vaulted payment method metadata:", e);
      }
    }
  }

  // Fire notifications concurrently — awaited so Vercel doesn't freeze/kill
  // the function before the Resend/Twilio requests finish (background work
  // after the response is sent is not guaranteed to complete on Vercel).
  const results = await Promise.allSettled([
    sendOrderEmail(order),
    sendCustomerReceiptEmail(order),
    sendOrderSMS(order),
    notifyPrintQueue(order.id),
  ]);
  results.forEach((r, i) => {
    if (r.status === "rejected") console.error(`Notification ${i} failed:`, r.reason);
  });

  return res.status(200).json({ received: true, orderId: order.id });
}

/**
 * Push order ID to a print queue list in KV.
 * The local print bridge polls this list every 5 seconds.
 */
async function notifyPrintQueue(orderId) {
  await kv.lpush("print_queue", orderId);
  // Expire after 1 hour (in case bridge is offline, don't build up forever)
  await kv.expire("print_queue", 3600);
}
