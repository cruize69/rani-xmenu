// api/referral-claim.js
// GET /api/referral-claim?code=CODE
//
// CODE is an order's shareCode — a dedicated public-safe identifier minted
// alongside (but separate from) that order's reorderToken. shareCode carries
// no value by itself: it only points at an orderId, used here purely to
// credit a referral. It is NOT the customer's own redeemable voucher (that's
// reorderToken, which stays private in the receipt email and is deliberately
// never exposed by the public order API — see lib/orders.js's
// publicOrderView). This mints the VISITOR a fresh, separate 10% voucher and
// never touches or consumes anything belonging to the referrer. The referrer
// is credited their own reward later, server-side, only once the referred
// friend's order actually pays (lib/syncStripe.js's creditReferrer) — not
// just on link click, so this can't be farmed by repeatedly loading the link.

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
    const rawSource = await kv.get(`referral-source:${code}`);
    if (!rawSource) {
      return res.status(404).json({ error: "Invalid invite link." });
    }
    const source = typeof rawSource === "string" ? JSON.parse(rawSource) : rawSource;
    if (!source.orderId) {
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
      meta: { source: "referral", referrerOrderId: source.orderId },
    });

    return res.status(200).json({ token: voucher.token, discountPct: 0.10, expiresAt: voucher.expiresAt });
  } catch (err) {
    console.error("Referral claim error:", err);
    return res.status(500).json({ error: "Server error processing invite link." });
  }
}
