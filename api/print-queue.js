// api/print-queue.js
// POST — pops one order ID from the print queue (RPOP)
// Called every 5s by the local print bridge

import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  if (req.headers["x-manager-secret"] !== process.env.MANAGER_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const orderId = await kv.rpop("print_queue");
  return res.status(200).json({ orderId: orderId ?? null });
}
