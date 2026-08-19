// api/reorder-claim.js
// GET /api/reorder-claim?token=TOKEN
// Validates a one-time 10% reorder token and returns items to preload.

import { kv } from "@vercel/kv";
import { overLimit, clientIp } from "../lib/rateLimit.js";
import { captureServerError } from "../lib/sentry.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { token } = req.query;

  if (typeof token !== "string" || !/^[a-f0-9]{12}$/i.test(token)) {
    return res.status(400).json({ error: "Missing token parameter" });
  }

  if (await overLimit(`reorder-claim-rl:ip:${clientIp(req)}`, 30, 3600)) {
    return res.status(429).json({ error: "Too many requests. Please try again later." });
  }

  try {
    const rawToken = await kv.get(`reorder-token:${token}`);
    if (!rawToken) {
      return res.status(404).json({ error: "Invalid reorder voucher." });
    }

    const tokenData = typeof rawToken === "string" ? JSON.parse(rawToken) : rawToken;

    if (tokenData.status === "used") {
      return res.status(400).json({ error: "This reorder voucher has already been redeemed." });
    }

    if (tokenData.status === "checkout_created") {
      // If a checkout session was created but didn't finish, let's check its time.
      // We allow re-claim if the session is older than 2 hours to prevent lockouts.
      const lastCheck = new Date(tokenData.updatedAt || tokenData.createdAt || 0);
      const diffHrs = (new Date() - lastCheck) / (1000 * 60 * 60);
      if (diffHrs < 2) {
        return res.status(400).json({ error: "A checkout session is currently active for this voucher. Try again in 2 hours." });
      }
    }

    // Check expiration (14 days)
    if (new Date() > new Date(tokenData.expiresAt)) {
      return res.status(400).json({ error: "This reorder voucher has expired (valid for 14 days)." });
    }

    // Valid and unused! Return the original items list (real per-order
    // reorder tokens) AND the discount rate — every current voucher type
    // happens to mint at 10%, but the client should never have to assume
    // that. Returning it here is what lets the UI announce the actual
    // rate instead of a hardcoded guess that could silently diverge from
    // what checkout actually charges.
    return res.status(200).json({
      orderId: tokenData.orderId,
      items: tokenData.items,
      discountPct: typeof tokenData.discountPct === "number" ? tokenData.discountPct : 0.10,
      expiresAt: tokenData.expiresAt,
    });

  } catch (err) {
    console.error("Reorder claim error:", err);
    captureServerError(err, { route: "reorder-claim" });
    return res.status(500).json({ error: "Server error checking voucher." });
  }
}
