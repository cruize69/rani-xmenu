import Stripe from "stripe";
import { kv } from "@vercel/kv";
import { buildOrder, saveOrder } from "./orders.js";

export function getStripe() {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY || 
                          process.env.STRIPE_LIVE_SECRET_KEY || 
                          process.env.STRIPE_KEY || 
                          process.env.STRIPE_SECRET;
  if (!stripeSecretKey) return null;
  return new Stripe(stripeSecretKey);
}

export async function syncStripeSessions() {
  try {
    const stripe = getStripe();
    if (!stripe) return;

    const sessions = await stripe.checkout.sessions.list({ limit: 100 });
    for (const session of sessions.data) {
      if (session.payment_status !== "paid") continue;
      
      const stripeAmt = session.amount_total ? parseFloat((session.amount_total / 100).toFixed(2)) : null;
      let orderId = await kv.get(`session:${session.id}`);

      if (!orderId) {
        let cartItems = [];
        try {
          const cartJson = session.metadata?.cart
            ?? (session.metadata?.cart_0 + (session.metadata?.cart_1 ?? ""));
          cartItems = JSON.parse(cartJson || "[]");
        } catch (e) {}

        let deliveryAddress = null;
        if (session.metadata?.deliveryAddress) {
          try { deliveryAddress = JSON.parse(session.metadata.deliveryAddress); } catch {}
        }

        let paymentIntent = null;
        if (session.payment_intent) {
          paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent).catch(() => null);
        }

        const createdAt = session.created ? new Date(session.created * 1000) : new Date();

        const order = buildOrder({
          paymentIntent,
          stripeSession:       session,
          cartItems,
          specialInstructions: session.metadata?.specialInstructions ?? "",
          tip:                 parseFloat(session.metadata?.tip ?? "0") || 0,
          orderMode:           session.metadata?.orderMode ?? "pickup",
          deliveryAddress,
          deliveryFee:         parseFloat(session.metadata?.deliveryFee ?? "0") || 0,
        });

        if (stripeAmt) order.total = stripeAmt;
        order.createdAt = createdAt.toISOString();
        order.updatedAt = createdAt.toISOString();
        order.date      = createdAt.toISOString().slice(0, 10);

        await saveOrder(order);
        await kv.set(`session:${session.id}`, order.id, { ex: 60 * 60 * 24 * 365 });
      } else if (stripeAmt) {
        const existingOrder = await kv.get(`order:${orderId}`);
        if (existingOrder && existingOrder.total !== stripeAmt) {
          existingOrder.total = stripeAmt;
          await saveOrder(existingOrder);
        }
      }
    }
  } catch (err) {
    console.error("Stripe sync error:", err);
  }
}
