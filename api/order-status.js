// api/order-status.js
// GET /api/order-status?id=order_xxx
// PUBLIC endpoint — returns only status fields, no sensitive data
// Polled every 5s by the customer's order success page

import { getOrder } from "../lib/orders.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "Order ID required" });

  try {
    const order = await getOrder(id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    // Return only what the customer needs — no prices, no contact details
    return res.status(200).json({
      id:        order.id,
      status:    order.status,   // new | in_progress | done
      updatedAt: order.updatedAt,
      createdAt: order.createdAt,
    });

  } catch (err) {
    console.error("order-status error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
