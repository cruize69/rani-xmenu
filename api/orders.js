// api/orders.js
// GET /api/orders?date=YYYY-MM-DD
// Returns orders + daily summary
// Protected by MANAGER_SECRET header

import { getOrdersByDate, buildDailySummary } from "../lib/orders.js";

export default async function handler(req, res) {
  // Simple shared-secret auth — replace with proper auth in production
  const secret = req.headers["x-manager-secret"];
  if (secret !== process.env.MANAGER_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const date   = req.query.date ?? new Date().toISOString().slice(0, 10);
    const orders = await getOrdersByDate(date);
    const summary = buildDailySummary(orders);

    // Set cache headers — 10 second max-age so manager app stays fresh
    res.setHeader("Cache-Control", "private, max-age=10");

    return res.status(200).json({ orders, summary, date });
  } catch (err) {
    console.error("Orders fetch error:", err);
    return res.status(500).json({ error: err.message });
  }
}
