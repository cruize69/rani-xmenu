// api/newsletter-subscribe.js
// POST /api/newsletter-subscribe
// Body: { email }
//
// The only door onto this app's email list has always been a completed
// purchase — every account-orders/guest index in lib/orders.js is written
// at checkout, nothing earlier. Anyone who browsed, considered catering,
// or just wasn't hungry yet was unreachable and lost for good. This is a
// separate, deliberately minimal namespace (newsletter:{email}) for that
// audience — no order required, no PII beyond the email itself.

import { kv } from "../lib/kv.js";
import { overLimit, clientIp } from "../lib/rateLimit.js";
import { mintVoucherToken } from "../lib/orders.js";
import { sendEmail, newsletterWelcomeEmailHtml, recordCampaignSent } from "../lib/notifications.js";
import { captureServerError } from "../lib/sentry.js";

function isValidEmail(v) {
  return typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email } = req.body || {};
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }
  const clean = email.trim().toLowerCase();

  // No account/order to key a limit on — same tradeoff as the catering and
  // catering endpoints, which face the identical problem of being
  // reachable by a stranger with no prior relationship to the site.
  if (await overLimit(`newsletter-rl:ip:${clientIp(req)}`, 10, 60 * 60)) {
    return res.status(429).json({ error: "Too many requests. Please try again later." });
  }

  try {
    const existing = await kv.get(`newsletter:${clean}`);
    if (!existing) {
      // Global cap independent of the per-IP limit above — bounds worst-case
      // voucher-minting cost even against a distributed/botnet attempt that
      // isn't stopped by IP throttling alone (mirrors referral-claim.js's
      // per-code caps for the same reason: an unverified-email signup with
      // an immediate spendable voucher is the one flow here with no
      // "already has a real relationship with us" gate behind it).
      if (await overLimit("newsletter-vouchers:daily", 200, 24 * 60 * 60)) {
        return res.status(429).json({ error: "Too many signups right now. Please try again later." });
      }

      await kv.set(`newsletter:${clean}`, JSON.stringify({ email: clean, subscribedAt: new Date().toISOString() }));
      await kv.zadd("newsletter-subscribers", { score: Date.now(), member: clean });

      // Previously this was the entire feature — an email landed in KV and
      // nothing ever sent to it. A newsletter subscriber is functionally
      // the same "hasn't ordered yet" prospect as a first-time checkout, so
      // it gets the same welcome-rate voucher, immediately, instead of
      // sitting silent until (if ever) a future campaign reads the list.
      const voucher = await mintVoucherToken({
        discountPct: 0.10,
        ttlDays: 14,
        meta: { source: "newsletter-welcome" },
      });
      await sendEmail({
        to: clean,
        subject: "Welcome — 10% off your first order",
        html: newsletterWelcomeEmailHtml({ link: voucher.resumeUrl }),
      });
      await recordCampaignSent("newsletter-welcome");
    }
    // Already-subscribed is not an error — re-submitting the same email
    // (e.g. a second visit) should feel like success, not a rejection.
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("Newsletter subscribe failed:", e);
    captureServerError(e, { route: "newsletter-subscribe" });
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}
