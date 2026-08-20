// api/cron/catering-cross-sell.js
// Vercel Cron target — runs once daily. One-shot pitch to signed-in members
// who've crossed a real order-frequency threshold, pointing them at the
// catering funnel (Catering.jsx / ranimahal.cc/catering) — a repeat
// customer is a stronger catering lead than a cold visitor, but nothing
// previously ever connected the two: catering was a standalone lead form
// with no link back to the app's own customer base.
//
// Members only, not guests — account-order-count:{clerkUserId} (the same
// counter api/create-checkout.js's loyalty math already relies on) is the
// only reliable order-frequency index in this app. Guest order counts
// aren't tracked anywhere precise enough to threshold on (see
// second-order-push.js's own comment on this same limitation for the
// order-count===1 case). Scanned via kv.scan on the key pattern rather than
// a maintained list, since this only needs to run once daily over a
// bounded key space.

import { kv } from "../../lib/kv.js";
import { getOrder } from "../../lib/orders.js";
import { sendEmail, sendSMS, recordCampaignSent, cateringCrossSellEmailHtml, cateringCrossSellSmsBody } from "../../lib/notifications.js";
import { recordCronRun } from "../../lib/cronStatus.js";
import { isCronSecretValid } from "../../lib/auth.js";
import { isCateringOrder } from "../../lib/menu.js";
import { captureServerError } from "../../lib/sentry.js";

const ORDER_COUNT_THRESHOLD = 5;
const MAX_PER_RUN = 200;
// How far back to check for an existing catering order before pitching
// "we cater too" — bounded, not full history, same reasoning as
// win-back-lapsed.js's HISTORY_LOOKBACK (this only needs to answer "have
// they already used this," not build a complete catering history).
const CATERING_HISTORY_CHECK = 20;
// One-shot, forever — no reset path (unlike win-back, there's no "lapsed
// again" episode concept for a catering pitch).
const DEDUP_TTL_SEC = 2 * 365 * 24 * 60 * 60;

export default async function handler(req, res) {
  if (!isCronSecretValid(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    let sent = 0, skipped = 0, scanned = 0;
    let cursor = "0";
    do {
      const [next, batch] = await kv.scan(cursor, { match: "account-order-count:*", count: 200 });
      cursor = next;
      for (const key of batch) {
        if (scanned >= MAX_PER_RUN) break;
        scanned++;
        try {
          const clerkUserId = key.slice("account-order-count:".length);
          const dedupKey = `catering-pitch:sent:${clerkUserId}`;
          if (await kv.get(dedupKey)) { skipped++; continue; }

          const count = Number(await kv.get(key)) || 0;
          if (count < ORDER_COUNT_THRESHOLD) { skipped++; continue; }

          const listKey = `account-orders:${clerkUserId}`;
          const [mostRecentId] = await kv.lrange(listKey, 0, 0);
          if (!mostRecentId) { skipped++; continue; }
          const order = await getOrder(mostRecentId);
          if (!order?.customerEmail) { skipped++; continue; }

          // Don't pitch "we cater too" to someone who's already a catering
          // customer — pointless at best, and reads as not knowing your own
          // customer at worst. Checks recent history, not just the most
          // recent order, since their latest order could easily be a
          // regular one placed after catering with us once already.
          const recentIds = await kv.lrange(listKey, 0, CATERING_HISTORY_CHECK - 1);
          const recentOrders = await Promise.all(recentIds.map(getOrder));
          if (recentOrders.some(o => o && isCateringOrder(o))) { skipped++; continue; }

          // Atomic claim right before the actual send — the plain kv.get
          // above is just a cheap early-exit (this candidate needs to be
          // re-checked every run until they cross ORDER_COUNT_THRESHOLD,
          // so the claim can't happen any earlier than this without wrongly
          // excluding someone who simply isn't eligible yet). This is what
          // actually closes the crash/concurrent-run double-send race.
          const claimed = await kv.set(dedupKey, "1", { nx: true, ex: DEDUP_TTL_SEC });
          if (!claimed) { skipped++; continue; }

          const jobs = [
            sendEmail({
              to: order.customerEmail,
              subject: "Planning something bigger? We cater too",
              html: cateringCrossSellEmailHtml({ customerName: order.customerName }),
            }),
          ];
          if (order.customerPhone && order.smsMarketingConsent) {
            jobs.push(sendSMS(order.customerPhone, cateringCrossSellSmsBody()));
          }
          await Promise.all(jobs);
          await recordCampaignSent("catering-cross-sell");
          sent++;
        } catch (e) {
          console.error(`Catering cross-sell failed for ${key}:`, e);
        }
      }
    } while (String(cursor) !== "0" && scanned < MAX_PER_RUN);

    const result = { sent, skipped, scanned };
    await recordCronRun("catering-cross-sell", result);
    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    console.error("Catering cross-sell cron failed:", e);
    captureServerError(e, { route: "cron/catering-cross-sell" });
    return res.status(500).json({ error: "Cron failed" });
  }
}
