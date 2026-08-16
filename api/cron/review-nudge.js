// api/cron/review-nudge.js
// Vercel Cron target — runs every 15 minutes. Sends a single, ungated
// review request per order, timed to when the food has plausibly actually
// been eaten (see lib/orders.js's computeReviewNudgeTargetTs), not a flat
// delay from checkout and not dependent on staff ever marking an order
// "done". Every customer gets the SAME Google review link regardless of
// how they'd rate the meal — no star-based branching to a private form for
// low scores. That gating pattern is banned by Google's Business Profile
// policy and, since 2024, by the FTC's Rule on Consumer Reviews (16 CFR
// Part 465); this earns reviews the compliant way instead: better timing,
// nothing else.

import { kv } from "@vercel/kv";
import { getOrder, ORDER_STATUS } from "../../lib/orders.js";
import { sendEmail, sendSMS, reviewNudgeEmailHtml, reviewNudgeSmsBody } from "../../lib/notifications.js";
import { recordCronRun } from "../../lib/cronStatus.js";
import { isCronSecretValid } from "../../lib/auth.js";

export default async function handler(req, res) {
  if (!isCronSecretValid(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const now = Date.now();
    const dueIds = await kv.zrange("review-nudge-queue", 0, now, { byScore: true });

    let sent = 0, skipped = 0;
    for (const orderId of dueIds) {
      try {
        const order = await getOrder(orderId);
        // A refunded order didn't leave the customer with a good (or any)
        // meal to review — asking would be tone-deaf at best. Anything else
        // missing (order got deleted, whatever) just means nothing to send.
        if (order && order.status !== ORDER_STATUS.REFUNDED) {
          const jobs = [];
          if (order.customerEmail) {
            jobs.push(sendEmail({
              to: order.customerEmail,
              subject: "How was your order? 🍽",
              html: reviewNudgeEmailHtml({ customerName: order.customerName }),
            }));
          }
          // SMS only with real opt-in captured at checkout — never inferred
          // from Stripe having collected a phone number for delivery.
          if (order.customerPhone && order.smsConsent) {
            jobs.push(sendSMS(order.customerPhone, reviewNudgeSmsBody()));
          }
          if (jobs.length) {
            await Promise.all(jobs);
            sent++;
          } else {
            skipped++;
          }
        } else {
          skipped++;
        }
      } catch (e) {
        console.error(`Review nudge failed for order ${orderId}:`, e);
      }
      // Always remove after one attempt, success or failure — this is a
      // one-shot queue (each order is enqueued exactly once, at creation,
      // in saveOrder), not a retry queue. A transient send failure means a
      // missed review ask, which is recoverable; re-processing forever on
      // every 15-min run if something is structurally broken is not.
      await kv.zrem("review-nudge-queue", orderId);
    }

    const result = { sent, skipped, checked: dueIds.length };
    await recordCronRun("review-nudge", result);
    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    console.error("Review nudge cron failed:", e);
    return res.status(500).json({ error: "Cron failed" });
  }
}
