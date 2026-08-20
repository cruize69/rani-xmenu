// api/cron/newsletter-digest.js
// Vercel Cron target — runs monthly. Sends the newsletter-subscribers list
// (api/newsletter-subscribe.js) a single "stay warm" email — the list has
// existed since that endpoint shipped but nothing had ever read it back
// out beyond the immediate welcome send. No discount here on purpose: the
// welcome and never-ordered-nudge emails already carry one each; a monthly
// send that's ALWAYS a discount trains subscribers to wait for one instead
// of just being reminded the restaurant exists.
//
// Content is a rotating bestseller pulled from lib/menu.js rather than
// hand-authored per send — there's no CMS for campaign copy, and a
// deterministic monthly rotation is a reasonable default until one exists.
//
// Guarded by a single global "already sent this calendar month" flag
// (set with nx) rather than a per-subscriber dedup — this is one batch
// blast, not a per-user timed sequence, so the only thing that needs
// preventing is the whole batch firing twice if the cron somehow triggers
// more than once in the same month.

import { kv } from "../../lib/kv.js";
import { MENU_ITEMS } from "../../lib/menu.js";
import { sendEmail, newsletterDigestEmailHtml, recordCampaignSent } from "../../lib/notifications.js";
import { recordCronRun } from "../../lib/cronStatus.js";
import { isCronSecretValid } from "../../lib/auth.js";
import { captureServerError } from "../../lib/sentry.js";

const BESTSELLERS = MENU_ITEMS.filter(i => i.badge === "bestseller");

export default async function handler(req, res) {
  if (!isCronSecretValid(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const monthKey = new Date().toISOString().slice(0, 7); // "YYYY-MM"
    const claimed = await kv.set(`newsletter-digest:sent:${monthKey}`, "1", { nx: true, ex: 40 * 24 * 60 * 60 });
    if (!claimed) {
      const result = { skipped: true, reason: "already_sent_this_month" };
      await recordCronRun("newsletter-digest", result);
      return res.status(200).json({ ok: true, ...result });
    }

    const subscribers = await kv.zrange("newsletter-subscribers", 0, -1);
    if (subscribers.length === 0) {
      const result = { sent: 0, reason: "no_subscribers" };
      await recordCronRun("newsletter-digest", result);
      return res.status(200).json({ ok: true, ...result });
    }

    // Deterministic rotation, not random — the same dish for everyone in a
    // given month, and it advances predictably month to month.
    const monthIndex = new Date().getUTCMonth();
    const dish = BESTSELLERS.length ? BESTSELLERS[monthIndex % BESTSELLERS.length] : MENU_ITEMS[0];

    const html = newsletterDigestEmailHtml({ dishName: dish.name, dishDesc: dish.desc });
    await sendEmail({
      to: subscribers,
      subject: `This month from the kitchen: ${dish.name}`,
      html,
    });
    await recordCampaignSent("newsletter-digest");

    const result = { sent: subscribers.length, dish: dish.name };
    await recordCronRun("newsletter-digest", result);
    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    console.error("Newsletter digest cron failed:", e);
    captureServerError(e, { route: "cron/newsletter-digest" });
    return res.status(500).json({ error: "Cron failed" });
  }
}
