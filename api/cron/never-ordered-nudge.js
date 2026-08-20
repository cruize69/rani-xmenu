// api/cron/never-ordered-nudge.js
// Vercel Cron target — runs once daily. Targets newsletter subscribers who
// signed up 5+ days ago and still have zero completed orders under that
// email — a segment win-back-lapsed.js and second-order-push.js structurally
// can't reach, since both key off customers:last-order, which only gets an
// entry once someone has actually ordered. A newsletter signup that never
// converts currently gets nothing else, ever, after the immediate welcome
// email (see api/newsletter-subscribe.js).
//
// "Never ordered" is checked via customerKeyForOrder's guest:{email} form
// against customers:last-order — a best-effort check (someone who later
// signed in with a Clerk account under a different flow wouldn't show up
// here), not a guarantee, but consistent with how every other guest-keyed
// index in this app already works.
//
// One-shot per email, forever — there's no "reset on new interest" signal
// the way win-back has "reset on new order," so this only ever fires once.

import { kv } from "../../lib/kv.js";
import { mintVoucherToken } from "../../lib/orders.js";
import { sendEmail, neverOrderedNudgeEmailHtml, recordCampaignSent } from "../../lib/notifications.js";
import { recordCronRun } from "../../lib/cronStatus.js";
import { isCronSecretValid } from "../../lib/auth.js";
import { captureServerError } from "../../lib/sentry.js";

const MIN_AGE_DAYS = 5;
const MAX_PER_RUN = 200;
// Effectively permanent — one-shot, no reset path.
const DEDUP_TTL_SEC = 2 * 365 * 24 * 60 * 60;

export default async function handler(req, res) {
  if (!isCronSecretValid(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const cutoff = Date.now() - MIN_AGE_DAYS * 24 * 60 * 60 * 1000;
    const candidates = await kv.zrange("newsletter-subscribers", 0, cutoff, { byScore: true });

    let sent = 0, skipped = 0;
    for (const email of candidates.slice(0, MAX_PER_RUN)) {
      try {
        const dedupKey = `never-ordered:sent:${email}`;
        if (await kv.get(dedupKey)) { skipped++; continue; }

        const hasOrdered = await kv.zscore("customers:last-order", `guest:${email}`);
        if (hasOrdered) {
          // They converted since subscribing — mark done so we never
          // re-check this email again, and they're already covered by
          // win-back-lapsed.js / second-order-push.js going forward.
          await kv.set(dedupKey, "1", { ex: DEDUP_TTL_SEC });
          skipped++;
          continue;
        }

        const voucher = await mintVoucherToken({
          discountPct: 0.10,
          ttlDays: 14,
          meta: { source: "never-ordered" },
        });

        await sendEmail({
          to: email,
          subject: "Haven't tried us yet? 10% off your first order",
          html: neverOrderedNudgeEmailHtml({ link: voucher.resumeUrl }),
        });
        await recordCampaignSent("never-ordered");

        await kv.set(dedupKey, "1", { ex: DEDUP_TTL_SEC });
        sent++;
      } catch (e) {
        console.error(`Never-ordered nudge failed for ${email}:`, e);
      }
    }

    const result = { sent, skipped, candidates: candidates.length };
    await recordCronRun("never-ordered-nudge", result);
    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    console.error("Never-ordered nudge cron failed:", e);
    captureServerError(e, { route: "cron/never-ordered-nudge" });
    return res.status(500).json({ error: "Cron failed" });
  }
}
