import Stripe from "stripe";
import { kv } from "@vercel/kv";
import { buildOrder, saveOrder, getOrder } from "../lib/orders.js";
import { sendOrderEmail, sendCustomerReceiptEmail, sendOrderSMS } from "../lib/notifications.js";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || 
                        process.env.STRIPE_LIVE_SECRET_KEY || 
                        process.env.STRIPE_KEY || 
                        process.env.STRIPE_SECRET;

const stripe = new Stripe(stripeSecretKey);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { session_id } = req.query;
  if (!session_id) return res.status(400).json({ error: "session_id required" });

  try {
    // Look up order ID mapped from Stripe session
    let orderId = await kv.get(`session:${session_id}`);

    if (!orderId) {
      // Fallback: search Stripe session directly & build order if webhook hasn't processed yet
      const session = await stripe.checkout.sessions.retrieve(session_id);
      if (!session) return res.status(404).json({ error: "Session not found" });

      let cartItems = [];
      try {
        const cartJson = session.metadata?.cart
          ?? (session.metadata?.cart_0 + (session.metadata?.cart_1 ?? ""));
        cartItems = JSON.parse(cartJson || "[]");
      } catch (e) {
        console.error("Fallback cart parse error:", e);
      }

      let deliveryAddress = null;
      if (session.metadata?.deliveryAddress) {
        try { deliveryAddress = JSON.parse(session.metadata.deliveryAddress); } catch {}
      }

      let paymentIntent = null;
      if (session.payment_intent) {
        paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent).catch(() => null);
      }

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

      // Save order to KV & fire customer + staff email notifications
      await Promise.allSettled([
        saveOrder(order),
        kv.set(`session:${session.id}`, order.id, { ex: 60 * 60 * 24 * 7 }),
        sendOrderEmail(order),
        sendCustomerReceiptEmail(order),
        sendOrderSMS(order),
      ]);

      return res.status(200).json(order);
    }

    const order = await getOrder(orderId);
    if (!order) return res.status(404).json({ error: "Order not found" });

    return res.status(200).json(order);

  } catch (err) {
    console.error("order-by-session error:", err);
    return res.status(500).json({ error: err.message });
  }
}
