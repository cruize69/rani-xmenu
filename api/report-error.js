// api/report-error.js
// POST { draftId, source, message, context? }
//
// Client-side and server-side checkout-critical errors funnel through here.
// Public/unauthenticated by necessity (fires from an anonymous browsing
// session that hasn't checked out) — kept safe by capping payload size and
// the per-customer cooldown inside reportCheckoutError.

import { reportCheckoutError } from "../lib/errorAlerts.js";
import { overLimit, clientIp } from "../lib/rateLimit.js";

// The per-customer cooldown inside reportCheckoutError bounds alerts for one
// *victim*, but not the number of distinct victims one caller can invent —
// each unique lead is a fresh staff SMS + email. Cap the caller too.
const MAX_PER_IP_PER_HOUR = 10;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { draftId, source, message, context } = req.body || {};
    if (typeof draftId !== "string" || draftId.length > 100) {
      return res.status(400).json({ error: "Invalid draftId" });
    }

    if (await overLimit(`report-err-rl:ip:${clientIp(req)}`, MAX_PER_IP_PER_HOUR, 60 * 60)) {
      return res.status(200).json({ success: false }); // 200: reporting failures must stay invisible to the customer
    }

    const safeContext = context && typeof context === "object"
      ? Object.fromEntries(Object.entries(context).slice(0, 10).map(([k, v]) => [String(k).slice(0, 60), String(v).slice(0, 300)]))
      : {};

    await reportCheckoutError({
      draftId,
      source: typeof source === "string" ? source.slice(0, 60) : "unknown",
      message: typeof message === "string" ? message : "Unknown error",
      context: safeContext,
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    // Never let error reporting itself become a customer-visible failure.
    console.error("report-error endpoint failed:", err);
    return res.status(200).json({ success: false });
  }
}
