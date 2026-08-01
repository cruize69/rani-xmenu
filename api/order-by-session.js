// api/order-by-session.js
// GET /api/order-by-session?session_id=cs_xxx
// Called by OrderSuccess page on load to retrieve full order details
// Uses the Stripe session ID from the success URL redirect

import Stripe from "stripe";
import { kv } from "@vercel/kv";
import { getOrder } from "../lib/orders.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { session_id } = req.query;
  if (!session_id) return res.status(400).json({ error: "session_id required" });

  try {
    // Look up order ID mapped from Stripe session
    // Stored by webhook when order is created
    const orderId = await kv.get(`session:${session_id}`);

    if (!orderId) {
      // Fallback: search Stripe session directly (slower, use as last resort)
      const session = await stripe.checkout.sessions.retrieve(session_id);
      if (!session) return res.status(404).json({ error: "Session not found" });

      // The webhook may still be processing — return minimal data from Stripe
      return res.status(200).json({
        id:            session.id,
        customerName:  session.customer_details?.name  ?? "Guest",
        customerEmail: session.customer_details?.email ?? null,
        createdAt:     new Date(session.created * 1000).toISOString(),
        status:        "new",
        items:         JSON.parse(session.metadata?.cart ?? "[]"),
        specialInstructions: session.metadata?.specialInstructions ?? "",
        subtotal:      (session.amount_subtotal ?? 0) / 100,
        tax:           (session.total_details?.amount_tax ?? 0) / 100,
        total:         (session.amount_total ?? 0) / 100,
      });
    }

    const order = await getOrder(orderId);
    if (!order) return res.status(404).json({ error: "Order not found" });

    return res.status(200).json(order);

  } catch (err) {
    console.error("order-by-session error:", err);
    return res.status(500).json({ error: err.message });
  }
}
