// api/orders/[id].js
// GET /api/orders/:id — returns single order
// Used by the local print bridge to fetch full order details

import { getOrder } from "../../lib/orders.js";

export default async function handler(req, res) {
  if (req.headers["x-manager-secret"] !== process.env.MANAGER_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id } = req.query;
  const order = await getOrder(id);

  if (!order) return res.status(404).json({ error: "Order not found" });
  return res.status(200).json(order);
}
