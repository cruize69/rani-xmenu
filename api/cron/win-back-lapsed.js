// api/cron/win-back-lapsed.js
// Vercel Cron target — runs once daily. Finds customers (signed-in members
// AND guests, keyed uniformly by customerKeyForOrder) whose last order was
// 30+ days ago and haven't already been sent a win-back for this lapse
// episode, mints each a 10% voucher, and emails/texts it. A second "last
// call" touch fires ~15 days after the first, only for customers who are
// still lapsed and never came back — previously this was a one-shot design
// with no follow-up at all until the 180-day dedup TTL quietly reset.
//
// Rate is deliberately 10% for BOTH segments, never more, on BOTH touches:
// a signed-in member already gets 5% off every order forever
// (api/create-checkout.js), so a win-back that paid more than the one-time
// welcome rate would make lapsing pay better than staying active — exactly
// backwards. 10%, at most twice, keeps this a genuine nudge, not a training
// program for churn.
//
// "Already sent for this lapse episode" is tracked by winback:sent:{key}
// (touch 1) and winback:touch2:sent:{key} (touch 2), both cleared the
// moment that customer places a new order (lib/orders.js's saveOrder) — so
// a customer who returns and lapses again later is eligible for a fresh
// pair of touches, but someone who ignores both won't be re-messaged every
// day the cron runs.

import { kv } from "@vercel/kv";
import { getOrder, mintVoucherToken } from "../../lib/orders.js";
import { sendEmail, sendSMS, recordCampaignSent, winBackEmailHtml, winBackSmsBody, winBackTouch2EmailHtml, winBackTouch2SmsBody } from "../../lib/notifications.js";
import { recordCronRun } from "../../lib/cronStatus.js";
import { isCronSecretValid } from "../../lib/auth.js";

const LAPSE_DAYS = 30;
const TOUCH2_LAPSE_DAYS = 45;
// Bounds one run's work — a large backlog (e.g. the first run after this
// feature ships) just gets picked up across subsequent daily runs, since
// dedup means nobody gets double-messaged and nobody gets skipped forever.
const MAX_PER_RUN = 200;
// Safety-net TTL on the dedup flags. The normal reset path is a new order
// (saveOrder deletes both keys immediately), so this only matters for a
// customer who never comes back at all — re-eligible for one more attempt
// roughly twice a year rather than being suppressed permanently by a single
// ignored message.
const DEDUP_TTL_SEC = 180 * 24 * 60 * 60;

/**
 * Resolve contact info + display name for a customer key from their most
 * recent order — avoids a separate Clerk API round-trip in a cron that may
 * process hundreds of candidates, and every field we need (email, phone,
 * smsConsent, name) already lives on that order.
 */
async function resolveContact(customerKey) {
  const isMember = customerKey.startsWith("clerk:");
  const listKey = isMember
    ? `account-orders:${customerKey.slice(6)}`
    : `account-orders:guest:${customerKey.slice(6)}`;
  const [mostRecentId] = await kv.lrange(listKey, 0, 0);
  if (!mostRecentId) return null;
  const order = await getOrder(mostRecentId);
  if (!order) return null;
  return {
    isMember,
    email: order.customerEmail || null,
    phone: order.customerPhone || null,
    smsConsent: !!order.smsConsent,
    customerName: order.customerName || "Guest",
  };
}

async function runTouch1(candidates) {
  let sent = 0, skipped = 0;
  for (const customerKey of candidates.slice(0, MAX_PER_RUN)) {
    try {
      const alreadySent = await kv.get(`winback:sent:${customerKey}`);
      if (alreadySent) { skipped++; continue; }

      const contact = await resolveContact(customerKey);
      if (!contact?.email) { skipped++; continue; }

      const voucher = await mintVoucherToken({
        discountPct: 0.10,
        ttlDays: 14,
        meta: { source: "winback", customerKey },
      });

      const jobs = [
        sendEmail({
          to: contact.email,
          subject: "We miss cooking for you — 10% off",
          html: winBackEmailHtml({ customerName: contact.customerName, link: voucher.resumeUrl, isMember: contact.isMember }),
        }),
      ];
      if (contact.phone && contact.smsConsent) {
        jobs.push(sendSMS(contact.phone, winBackSmsBody({ link: voucher.resumeUrl, isMember: contact.isMember })));
      }
      await Promise.all(jobs);
      await recordCampaignSent("winback");

      await kv.set(`winback:sent:${customerKey}`, "1", { ex: DEDUP_TTL_SEC });
      sent++;
    } catch (e) {
      console.error(`Win-back touch 1 failed for ${customerKey}:`, e);
    }
  }
  return { sent, skipped };
}

async function runTouch2(candidates) {
  let sent = 0, skipped = 0;
  for (const customerKey of candidates.slice(0, MAX_PER_RUN)) {
    try {
      // Touch 2 requires touch 1 to have actually gone out — this is a
      // follow-up, not an independent trigger. Someone whose touch 1
      // resolveContact() bailed (no email on file) never got a touch 1
      // dedup flag either, so they're correctly excluded here too.
      const touch1Sent = await kv.get(`winback:sent:${customerKey}`);
      if (!touch1Sent) { skipped++; continue; }
      const touch2Sent = await kv.get(`winback:touch2:sent:${customerKey}`);
      if (touch2Sent) { skipped++; continue; }

      const contact = await resolveContact(customerKey);
      if (!contact?.email) { skipped++; continue; }

      const voucher = await mintVoucherToken({
        discountPct: 0.10,
        ttlDays: 14,
        meta: { source: "winback-touch2", customerKey },
      });

      const jobs = [
        sendEmail({
          to: contact.email,
          subject: "Last call — 10% off expires soon",
          html: winBackTouch2EmailHtml({ customerName: contact.customerName, link: voucher.resumeUrl, isMember: contact.isMember }),
        }),
      ];
      if (contact.phone && contact.smsConsent) {
        jobs.push(sendSMS(contact.phone, winBackTouch2SmsBody({ link: voucher.resumeUrl, isMember: contact.isMember })));
      }
      await Promise.all(jobs);
      await recordCampaignSent("winback-touch2");

      await kv.set(`winback:touch2:sent:${customerKey}`, "1", { ex: DEDUP_TTL_SEC });
      sent++;
    } catch (e) {
      console.error(`Win-back touch 2 failed for ${customerKey}:`, e);
    }
  }
  return { sent, skipped };
}

export default async function handler(req, res) {
  if (!isCronSecretValid(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const cutoff1 = Date.now() - LAPSE_DAYS * 24 * 60 * 60 * 1000;
    const cutoff2 = Date.now() - TOUCH2_LAPSE_DAYS * 24 * 60 * 60 * 1000;
    const candidates1 = await kv.zrange("customers:last-order", 0, cutoff1, { byScore: true });
    const candidates2 = await kv.zrange("customers:last-order", 0, cutoff2, { byScore: true });

    const touch1 = await runTouch1(candidates1);
    const touch2 = await runTouch2(candidates2);

    const result = { touch1: { ...touch1, candidates: candidates1.length }, touch2: { ...touch2, candidates: candidates2.length } };
    await recordCronRun("win-back-lapsed", result);
    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    console.error("Win-back cron failed:", e);
    return res.status(500).json({ error: "Cron failed" });
  }
}
