// api/reprint.js
// POST { id } — pushes an existing order back onto the print queue
// Called from OrderManager when staff hits "Reprint"

import { kv } from "@vercel/kv";
import { getOrder } from "../lib/orders.js";

export default async function handler(req, res) {
  if (req.headers["x-manager-secret"] !== process.env.MANAGER_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id } = req.body;
  if (!id) return res.status(400).json({ error: "Order ID required" });

  const order = await getOrder(id);
  if (!order) return res.status(404).json({ error: "Order not found" });

  // Push to front of print queue (LPUSH = left push, bridge pops from right)
  await kv.lpush("print_queue", id);
  await kv.expire("print_queue", 3600);

  return res.status(200).json({ queued: true, orderId: id });
}
