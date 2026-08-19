// api/order-lookup.js
// GET /api/order-lookup?q=<order id / email / phone / name>
// Staff-only search across order history — for verifying a specific past
// order (a customer dispute, a "did I actually order X" call) rather than
// browsing a single day the way Order Manager does.
//
// Three real lookup strategies, cheapest first:
//   1. Exact full order id (rare — internal only, customers never see it,
//      but harmless to support) — a single kv.get.
//   2. Email — already indexed (account-orders:guest:{email}, written for
//      every order with an email, signed-in or not) — a single list fetch
//      plus a batch getOrder.
//   3. Everything else (phone digits, the short #A1B2C3 id customers
//      actually see on receipts/texts, or a customer name) — no index
//      exists for any of these, so this scans orders:date:{date} day by
//      day, most recent first, stopping early once enough matches are
//      found. Bounded to LOOKBACK_DAYS so a rare very-old lookup can't
//      turn into an unbounded scan; a real dispute call is realistically
//      about something recent.

import { kv } from "@vercel/kv";
import { getOrder, getNYDateString } from "../lib/orders.js";
import { checkManagerAuth } from "../lib/auth.js";
import { overLimit, clientIp } from "../lib/rateLimit.js";

const LOOKBACK_DAYS = 90;
const MAX_MATCHES = 25;

function addDaysToDateStr(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

function digitsOnly(s) {
  return String(s ?? "").replace(/\D/g, "");
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await checkManagerAuth(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  // A name/phone search can scan up to 90 days of orders in one call — cap
  // how often that can be triggered so a stuck UI retry loop or a
  // compromised session can't turn this into a KV cost/latency problem.
  if (await overLimit(`order-lookup-rl:ip:${clientIp(req)}`, 30, 60 * 60)) {
    return res.status(429).json({ error: "Too many searches. Please wait a moment and try again." });
  }

  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!q || q.length < 3) {
    return res.status(400).json({ error: "Enter at least 3 characters to search." });
  }

  try {
    // Strategy 1 — exact full order id (starts with "order_", the only
    // shape real order ids take; anything else can't possibly match one).
    if (q.startsWith("order_")) {
      const order = await getOrder(q);
      return res.status(200).json({ orders: order ? [order] : [], strategy: "id", scannedDays: 0 });
    }

    // Strategy 2 — email (fast, indexed).
    if (q.includes("@")) {
      const email = q.toLowerCase();
      const ids = (await kv.lrange(`account-orders:guest:${email}`, 0, MAX_MATCHES - 1)) || [];
      const orders = (await Promise.all(ids.map(getOrder))).filter(Boolean);
      orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return res.status(200).json({ orders, strategy: "email", scannedDays: 0 });
    }

    // Strategy 3 — phone digits, short order id (#A1B2C3 as shown on
    // receipts/texts), or a name substring. No index for any of these, so
    // scan day-by-day, most recent first, stopping once we have enough
    // matches or run out of lookback window.
    const qDigits = digitsOnly(q);
    const qLower = q.toLowerCase();
    const isPhoneQuery = qDigits.length >= 7;
    const isShortIdQuery = /^[a-f0-9]{4,6}$/i.test(q);

    const matches = [];
    let today = getNYDateString();
    let scannedDays = 0;

    for (let i = 0; i < LOOKBACK_DAYS && matches.length < MAX_MATCHES; i++) {
      const dateStr = i === 0 ? today : addDaysToDateStr(today, -i);
      scannedDays++;
      const ids = (await kv.zrange(`orders:date:${dateStr}`, 0, -1)) || [];
      if (ids.length === 0) continue;

      const dayOrders = (await Promise.all(ids.map(getOrder))).filter(Boolean);
      for (const order of dayOrders) {
        if (matches.length >= MAX_MATCHES) break;
        const shortId = (order.id || "").slice(-6).toLowerCase();
        const phoneDigits = digitsOnly(order.customerPhone);
        const nameLower = (order.customerName || "").toLowerCase();

        const hit =
          (isShortIdQuery && shortId === qLower) ||
          (isPhoneQuery && phoneDigits && phoneDigits.endsWith(qDigits)) ||
          (!isPhoneQuery && !isShortIdQuery && nameLower.includes(qLower));

        if (hit) matches.push(order);
      }
    }

    matches.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.status(200).json({
      orders: matches,
      strategy: isPhoneQuery ? "phone" : isShortIdQuery ? "shortId" : "name",
      scannedDays,
      truncated: matches.length >= MAX_MATCHES,
    });
  } catch (err) {
    console.error("Order lookup error:", err);
    return res.status(500).json({ error: "Search failed. Please try again." });
  }
}
