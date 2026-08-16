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

import { kv } from "@vercel/kv";
import { getOrder } from "../../lib/orders.js";
import { sendEmail, sendSMS, recordCampaignSent, cateringCrossSellEmailHtml, cateringCrossSellSmsBody } from "../../lib/notifications.js";

const ORDER_COUNT_THRESHOLD = 5;
const MAX_PER_RUN = 200;
// One-shot, forever — no reset path (unlike win-back, there's no "lapsed
// again" episode concept for a catering pitch).
const DEDUP_TTL_SEC = 2 * 365 * 24 * 60 * 60;

export default async function handler(req, res) {
  if (process.env.CRON_SECRET) {
    const auth = req.headers["authorization"] ?? "";
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
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

          const [mostRecentId] = await kv.lrange(`account-orders:${clerkUserId}`, 0, 0);
          if (!mostRecentId) { skipped++; continue; }
          const order = await getOrder(mostRecentId);
          if (!order?.customerEmail) { skipped++; continue; }

          const jobs = [
            sendEmail({
              to: order.customerEmail,
              subject: "Planning something bigger? We cater too",
              html: cateringCrossSellEmailHtml({ customerName: order.customerName }),
            }),
          ];
          if (order.customerPhone && order.smsConsent) {
            jobs.push(sendSMS(order.customerPhone, cateringCrossSellSmsBody()));
          }
          await Promise.all(jobs);
          await recordCampaignSent("catering-cross-sell");

          await kv.set(dedupKey, "1", { ex: DEDUP_TTL_SEC });
          sent++;
        } catch (e) {
          console.error(`Catering cross-sell failed for ${key}:`, e);
        }
      }
    } while (String(cursor) !== "0" && scanned < MAX_PER_RUN);

    return res.status(200).json({ ok: true, sent, skipped, scanned });
  } catch (e) {
    console.error("Catering cross-sell cron failed:", e);
    return res.status(500).json({ error: "Cron failed" });
  }
}
