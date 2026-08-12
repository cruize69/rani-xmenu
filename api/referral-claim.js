// api/referral-claim.js
// GET /api/referral-claim?code=CODE
//
// CODE is any customer's own reorderToken (minted on every order, already
// shared as the friend's link on OrderSuccess.jsx: /?invite=CODE). This
// mints the VISITOR a fresh, separate 10% voucher — it never touches or
// consumes the referrer's own token. The referrer is credited their own
// reward later, server-side, only once the referred friend's order actually
// pays (lib/syncStripe.js's creditReferrer) — not just on link click, so
// this can't be farmed by repeatedly loading the link.

import { kv } from "@vercel/kv";
import { mintVoucherToken } from "../lib/orders.js";

// Deliberately tight. Each claim mints an independently-redeemable 10%
// voucher off a single order's token, so a high cap is a discount farm, not
// a growth lever — genuine word-of-mouth from one order rarely exceeds a
// handful of people in a day.
const MAX_CLAIMS_PER_CODE_PER_DAY = 5;

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { code } = req.query;
  if (!code || typeof code !== "string") {
    return res.status(400).json({ error: "Missing code parameter" });
  }

  try {
    const rawReferrerToken = await kv.get(`reorder-token:${code}`);
    if (!rawReferrerToken) {
      return res.status(404).json({ error: "Invalid invite link." });
    }
    const referrerToken = typeof rawReferrerToken === "string" ? JSON.parse(rawReferrerToken) : rawReferrerToken;
    if (!referrerToken.orderId) {
      // Not a real per-order reorder token (e.g. someone tried to chain a
      // voucher token as an invite code) — refuse rather than mint off it.
      return res.status(404).json({ error: "Invalid invite link." });
    }

    const rlKey = `referral-rl:${code}`;
    const count = await kv.incr(rlKey);
    if (count === 1) await kv.expire(rlKey, 60 * 60 * 24);
    if (count > MAX_CLAIMS_PER_CODE_PER_DAY) {
      return res.status(429).json({ error: "This invite link has reached its daily limit. Try again tomorrow." });
    }

    const voucher = await mintVoucherToken({
      discountPct: 0.10,
      ttlDays: 14,
      meta: { source: "referral", referrerOrderId: referrerToken.orderId },
    });

    return res.status(200).json({ token: voucher.token, expiresAt: voucher.expiresAt });
  } catch (err) {
    console.error("Referral claim error:", err);
    return res.status(500).json({ error: "Server error processing invite link." });
  }
}
