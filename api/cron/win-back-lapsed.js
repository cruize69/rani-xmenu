// api/cron/win-back-lapsed.js
// Vercel Cron target — runs once daily. Finds customers (signed-in members
// AND guests, keyed uniformly by customerKeyForOrder) whose last order was
// 30+ days ago and haven't already been sent a win-back for this lapse
// episode, mints each a 10% voucher, and emails/texts it.
//
// Rate is deliberately 10% for BOTH segments, never more: a signed-in
// member already gets 5% off every order forever (api/create-checkout.js),
// so a win-back that paid more than the one-time welcome rate would make
// lapsing pay better than staying active — exactly backwards. 10% once
// keeps this a genuine nudge, not a training program for churn.
//
// "Already sent for this lapse episode" is tracked by winback:sent:{key},
// which lib/orders.js's saveOrder() clears the moment that customer places
// a new order — so a customer who returns and lapses again later is
// eligible for a fresh win-back, but someone who ignores this message
// entirely won't be re-texted every day the cron runs.

import { kv } from "@vercel/kv";
import { getOrder, mintVoucherToken } from "../../lib/orders.js";
import { sendEmail, sendSMS, winBackEmailHtml, winBackSmsBody } from "../../lib/notifications.js";

const LAPSE_DAYS = 30;
// Bounds one run's work — a large backlog (e.g. the first run after this
// feature ships) just gets picked up across subsequent daily runs, since
// dedup means nobody gets double-messaged and nobody gets skipped forever.
const MAX_PER_RUN = 200;
// Safety-net TTL on the dedup flag. The normal reset path is a new order
// (saveOrder deletes this key immediately), so this only matters for a
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

export default async function handler(req, res) {
  if (process.env.CRON_SECRET) {
    const auth = req.headers["authorization"] ?? "";
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  try {
    const cutoff = Date.now() - LAPSE_DAYS * 24 * 60 * 60 * 1000;
    const candidates = await kv.zrange("customers:last-order", 0, cutoff, { byScore: true });

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

        await kv.set(`winback:sent:${customerKey}`, "1", { ex: DEDUP_TTL_SEC });
        sent++;
      } catch (e) {
        console.error(`Win-back failed for ${customerKey}:`, e);
      }
    }

    return res.status(200).json({ ok: true, sent, skipped, candidates: candidates.length });
  } catch (e) {
    console.error("Win-back cron failed:", e);
    return res.status(500).json({ error: "Cron failed" });
  }
}
