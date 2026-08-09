// api/webhook.js
// Receives Stripe webhook events
// Vercel config: { api: { bodyParser: false } } required for signature verification

import Stripe from "stripe";
import { buffer } from "micro";
import { kv } from "@vercel/kv";
import { getOrCreateOrderForSession } from "../lib/syncStripe.js";

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

  // Retrieve payment intent for payment method metadata
  let paymentIntent = null;
  if (session.payment_intent) {
    try {
      paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent);
    } catch (e) {}
  }

  // Atomic Single Order Creation (guarantees single order even if redirect lands at same millisecond)
  const order = await getOrCreateOrderForSession(session, paymentIntent, true);
  if (!order) {
    return res.status(200).json({ received: true, error: "Order build failed" });
  }

  // Link order to customer account (Clerk user or guest email)
  const accountId = session.metadata?.clerkUserId ?? null;
  const guestEmail = session.customer_details?.email ?? null;
  const linkId = accountId ?? (guestEmail ? `guest:${guestEmail.toLowerCase()}` : null);
  if (linkId) {
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
