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

  // Build and save order
  const order = buildOrder({
    paymentIntent:       await stripe.paymentIntents.retrieve(session.payment_intent),
    stripeSession:       session,
    cartItems,
    specialInstructions: session.metadata?.specialInstructions ?? "",
    tip:                 parseFloat(session.metadata?.tip ?? "0") || 0,
    orderMode:           session.metadata?.orderMode ?? "pickup",
    deliveryAddress:     deliveryAddress,
    deliveryFee:         parseFloat(session.metadata?.deliveryFee ?? "0") || 0,
  });

  await saveOrder(order);
  // Map session ID → order ID so OrderSuccess page can retrieve by session_id
  await kv.set(`session:${session.id}`, order.id, { ex: 60 * 60 * 24 * 7 }); // 7 days
  console.log(`Order saved: ${order.id}`);

  // Link order to customer account (Clerk user or guest email)
  const accountId = session.metadata?.clerkUserId ?? null;
  const guestEmail = session.customer_details?.email ?? null;
  const linkId = accountId ?? (guestEmail ? `guest:${guestEmail.toLowerCase()}` : null);
  if (linkId) {
    await kv.lpush(`account-orders:${linkId}`, order.id);
    await kv.ltrim(`account-orders:${linkId}`, 0, 99);

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

  // Fire notifications concurrently — don't block webhook response
  Promise.allSettled([
    sendOrderEmail(order),
    sendCustomerReceiptEmail(order),
    sendOrderSMS(order),
    notifyPrintQueue(order.id),
  ]).then(results => {
    results.forEach((r, i) => {
      if (r.status === "rejected") console.error(`Notification ${i} failed:`, r.reason);
    });
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
