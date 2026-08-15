// api/cron/second-order-push.js
// Vercel Cron target — runs once daily. Two touches to any customer sitting
// at EXACTLY one lifetime order: a plain nudge ~3 days after that order,
// and a closing push ~7 days after it if they still haven't ordered again.
//
// This targets the single highest-attrition point in a restaurant's
// lifecycle — most first-time customers never place a second order at
// all — and it's the one stage of the lifecycle that previously had zero
// automation: a first-timer got a receipt, a review nudge, then silence
// until the 30-day win-back.
//
// Reuses the same customers:last-order sorted set win-back-lapsed.js reads
// (populated by every order in lib/orders.js's saveOrder — no new index
// needed), filtered down to customers whose order count is still exactly
// 1 at send time. That filter is what makes this self-correcting: anyone
// who actually places a second order between being enqueued and the cron
// running is simply excluded, with no separate cancellation logic needed.

import { kv } from "@vercel/kv";
import { getOrder, mintVoucherToken } from "../../lib/orders.js";
import {
  sendEmail, sendSMS,
  secondOrderTouch1EmailHtml, secondOrderTouch1SmsBody,
  secondOrderTouch2EmailHtml, secondOrderTouch2SmsBody,
} from "../../lib/notifications.js";

const DAY_MS = 24 * 60 * 60 * 1000;
// Windows are deliberately a full day wide (not a single instant) so a
// missed or delayed cron run still catches everyone due — the per-customer
// dedup key is what actually prevents a double-send, not window precision.
const TOUCH1_MIN_DAYS = 2, TOUCH1_MAX_DAYS = 4;
const TOUCH2_MIN_DAYS = 6, TOUCH2_MAX_DAYS = 9;
const MAX_PER_RUN = 200;
// Long safety-net TTL — the real backstop against re-messaging is the
// order-count===1 filter (once they order again, they're excluded
// permanently regardless of this key), so this only matters for someone
// who never returns at all.
const DEDUP_TTL_SEC = 180 * 24 * 60 * 60;

async function resolveCandidate(customerKey) {
  const isMember = customerKey.startsWith("clerk:");
  const listKey = isMember
    ? `account-orders:${customerKey.slice(6)}`
    : `account-orders:guest:${customerKey.slice(6)}`;

  // Order count === 1 is the actual eligibility gate. For members, the
  // monotonic account-order-count counter is correct at any count (see
  // lib/orders.js — llen on the list is NOT, since that list is ltrim'd at
  // 200, though that ceiling is irrelevant at count 1 either way). Using
  // the same counter members' loyalty math already relies on keeps this
  // consistent with the rest of the app rather than introducing a second
  // way to count the same thing.
  const orderCount = isMember
    ? Number((await kv.get(`account-order-count:${customerKey.slice(6)}`)) || 0)
    : await kv.llen(listKey);
  if (orderCount !== 1) return null;

  const [onlyOrderId] = await kv.lrange(listKey, 0, 0);
  if (!onlyOrderId) return null;
  const order = await getOrder(onlyOrderId);
  if (!order?.customerEmail) return null;

  return {
    isMember,
    email: order.customerEmail,
    phone: order.customerPhone || null,
    smsConsent: !!order.smsConsent,
    customerName: order.customerName || "Guest",
  };
}

async function runTouch({ touchName, minDays, maxDays, buildEmail, buildSms, mintIncentive }) {
  const now = Date.now();
  const windowMax = now - minDays * DAY_MS;
  const windowMin = now - maxDays * DAY_MS;
  const candidates = await kv.zrange("customers:last-order", windowMin, windowMax, { byScore: true });

  let sent = 0, skipped = 0;
  for (const customerKey of candidates.slice(0, MAX_PER_RUN)) {
    try {
      const dedupKey = `second-order:${touchName}:sent:${customerKey}`;
      if (await kv.get(dedupKey)) { skipped++; continue; }

      const contact = await resolveCandidate(customerKey);
      if (!contact) { skipped++; continue; }

      // Members never get an incentive here — they already carry a
      // standing 5% on every order automatically, so a voucher would just
      // be a redundant second discount. Only guests get one, and only on
      // touch 2, capped at the welcome rate for the same reason every
      // other discount in this app is (see win-back-lapsed.js).
      let link = null;
      if (mintIncentive && !contact.isMember) {
        const voucher = await mintVoucherToken({
          discountPct: 0.10,
          ttlDays: 14,
          meta: { source: "second-order-push", customerKey },
        });
        link = voucher.resumeUrl;
      }

      const jobs = [
        sendEmail({
          to: contact.email,
          subject: touchName === "touch1" ? "How was your first order?" : "Come back for round two?",
          html: buildEmail({ customerName: contact.customerName, isMember: contact.isMember, link }),
        }),
      ];
      if (contact.phone && contact.smsConsent) {
        jobs.push(sendSMS(contact.phone, buildSms({ isMember: contact.isMember, link })));
      }
      await Promise.all(jobs);

      await kv.set(dedupKey, "1", { ex: DEDUP_TTL_SEC });
      sent++;
    } catch (e) {
      console.error(`Second-order ${touchName} failed for ${customerKey}:`, e);
    }
  }
  return { sent, skipped, candidates: candidates.length };
}

export default async function handler(req, res) {
  if (process.env.CRON_SECRET) {
    const auth = req.headers["authorization"] ?? "";
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  try {
    const touch1 = await runTouch({
      touchName: "touch1", minDays: TOUCH1_MIN_DAYS, maxDays: TOUCH1_MAX_DAYS,
      buildEmail: secondOrderTouch1EmailHtml, buildSms: secondOrderTouch1SmsBody,
      mintIncentive: false,
    });
    const touch2 = await runTouch({
      touchName: "touch2", minDays: TOUCH2_MIN_DAYS, maxDays: TOUCH2_MAX_DAYS,
      buildEmail: secondOrderTouch2EmailHtml, buildSms: secondOrderTouch2SmsBody,
      mintIncentive: true,
    });

    return res.status(200).json({ ok: true, touch1, touch2 });
  } catch (e) {
    console.error("Second-order push cron failed:", e);
    return res.status(500).json({ error: "Cron failed" });
  }
}
