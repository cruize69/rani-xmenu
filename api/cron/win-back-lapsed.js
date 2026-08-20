// api/cron/win-back-lapsed.js
// Vercel Cron target — runs once daily. Finds customers (signed-in members
// AND guests, keyed uniformly by customerKeyForOrder) who've gone quiet
// relative to THEIR OWN normal ordering cadence, mints each a 10% voucher,
// and emails/texts it. A second "last call" touch fires ~15 days after the
// first, only for customers who are still lapsed and never came back.
//
// A flat "30 days since last order" threshold treats a weekly regular and
// an occasional once-a-month diner identically — by the time a weekly
// regular hits 30 days quiet, they've actually been gone 4x their normal
// gap, which is far too late to catch a real churn signal. Instead, each
// repeat customer's median gap between their last few orders (capped
// lookback, not full history — this only needs to be "their usual") sets
// a PERSONAL threshold: 1.5x their own median gap, bounded to [14, 45]
// days so a very-frequent orderer isn't nagged after under 2 weeks and a
// very-occasional one isn't ignored for months. A customer with fewer
// than 2 orders on file (no cadence to compute) falls back to the old
// flat 30-day default — second-order-push.js already owns the day-3/7
// window for genuine first-timers, so this fallback only matters for
// someone whose 2nd order never got readable history for some reason.
//
// The 1.5x multiplier and [14, 45] bounds are a starting point, not a
// final answer — worth revisiting once there's enough real order history
// to see how well this actually predicts genuine churn vs. false alarms.
//
// Rate is deliberately 10% for BOTH segments, never more, on BOTH touches:
// a signed-in member already gets 5% off every order forever
// (api/create-checkout.js), so a win-back that paid more than the one-time
// welcome rate would make lapsing pay better than staying active — exactly
// backwards. 10%, at most twice, keeps this a genuine nudge, not a training
// program for churn.
//
// "Already sent for this lapse episode" is tracked by winback:sent:{key}
// (touch 1, value = the epoch ms it was sent) and winback:touch2:sent:{key}
// (touch 2), both cleared the moment that customer places a new order
// (lib/orders.js's saveOrder) — so a customer who returns and lapses again
// later is eligible for a fresh pair of touches, but someone who ignores
// both won't be re-messaged every day the cron runs.

import { kv } from "../../lib/kv.js";
import { getOrder, mintVoucherToken } from "../../lib/orders.js";
import { sendEmail, sendSMS, recordCampaignSent, winBackEmailHtml, winBackSmsBody, winBackTouch2EmailHtml, winBackTouch2SmsBody } from "../../lib/notifications.js";
import { recordCronRun } from "../../lib/cronStatus.js";
import { isCronSecretValid } from "../../lib/auth.js";
import { isCateringOrder } from "../../lib/menu.js";
import { captureServerError } from "../../lib/sentry.js";

const DAY_MS = 24 * 60 * 60 * 1000;

const MIN_LAPSE_DAYS = 14;      // floor — never trigger sooner than this, however frequent the customer
const MAX_LAPSE_DAYS = 45;      // ceiling — never wait longer than this, however infrequent the customer
const FALLBACK_LAPSE_DAYS = 30; // used when cadence can't be computed (fewer than 2 orders on file)
const CADENCE_MULTIPLIER = 1.5;
const TOUCH2_DELAY_DAYS = 15;   // days after touch 1 was actually sent, not after the original last order
const HISTORY_LOOKBACK = 10;    // orders sampled for both cadence and favorite-dish personalization

// Bounds one run's work — a large backlog just gets picked up across
// subsequent daily runs, since dedup means nobody gets double-messaged and
// nobody gets skipped forever.
const MAX_PER_RUN = 200;
// Safety-net TTL on the dedup flags. The normal reset path is a new order
// (saveOrder deletes both keys immediately), so this only matters for a
// customer who never comes back at all — re-eligible for one more attempt
// roughly twice a year rather than being suppressed permanently by a single
// ignored message.
const DEDUP_TTL_SEC = 180 * 24 * 60 * 60;

function deriveListKey(customerKey) {
  const isMember = customerKey.startsWith("clerk:");
  const listKey = isMember
    ? `account-orders:${customerKey.slice(6)}`
    : `account-orders:guest:${customerKey.slice(6)}`;
  return { isMember, listKey };
}

// Catering orders are deliberately excluded here — a single catering line
// (qty: 50+ guests, a one-off package name) would dominate both the
// cadence math (catering doesn't happen on a normal weekly/monthly rhythm)
// and the favorite-dish tally (a 50-qty package outweighs any 1-2x a-la-
// carte dish), producing copy like "Your Deluxe Party Package is waiting —
// 10% off" sent to someone who catered one event eight months ago. This
// cron is about a-la-carte ordering rhythm specifically; catering
// customers still get win-back messaging, just based on their actual
// regular-menu history (or the generic fallback copy if they have none).
async function fetchRecentOrders(listKey) {
  const orderIds = await kv.lrange(listKey, 0, HISTORY_LOOKBACK - 1);
  if (!orderIds.length) return [];
  const orders = await Promise.all(orderIds.map(getOrder));
  return orders.filter(Boolean).filter(o => !isCateringOrder(o));
}

/**
 * Resolve contact info + display name for a customer from their most
 * recent order — avoids a separate Clerk API round-trip in a cron that may
 * process hundreds of candidates, and every field we need (email, phone,
 * smsMarketingConsent, name) already lives on that order.
 */
async function resolveContact(listKey) {
  const [mostRecentId] = await kv.lrange(listKey, 0, 0);
  if (!mostRecentId) return null;
  const order = await getOrder(mostRecentId);
  if (!order) return null;
  return {
    email: order.customerEmail || null,
    phone: order.customerPhone || null,
    smsMarketingConsent: !!order.smsMarketingConsent,
    customerName: order.customerName || "Guest",
  };
}

// Median gap (in days) between this customer's last few orders. Median,
// not mean, so one unusually long gap (e.g. a single lapse in the past)
// doesn't skew the "normal" cadence used to judge whether they're lapsed
// NOW. Returns null when there's not enough history to say anything.
function medianCadenceDays(orders) {
  if (orders.length < 2) return null;
  const timestamps = orders
    .map(o => new Date(o.createdAt).getTime())
    .filter(t => !Number.isNaN(t))
    .sort((a, b) => b - a);
  if (timestamps.length < 2) return null;
  const gaps = [];
  for (let i = 0; i < timestamps.length - 1; i++) {
    gaps.push((timestamps[i] - timestamps[i + 1]) / DAY_MS);
  }
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)];
}

function personalLapseThreshold(cadenceDays) {
  if (cadenceDays == null) return FALLBACK_LAPSE_DAYS;
  return Math.min(MAX_LAPSE_DAYS, Math.max(MIN_LAPSE_DAYS, cadenceDays * CADENCE_MULTIPLIER));
}

// Whichever dish this customer has ordered most by quantity across their
// sampled history — swapping the generic "we miss you" copy for their
// actual go-to dish is what the win-back email/SMS use this for. Null
// just falls back to the existing generic copy.
function favoriteDishFromOrders(orders) {
  const tally = new Map();
  for (const order of orders) {
    for (const item of order?.items ?? []) {
      if (!item?.name) continue;
      tally.set(item.name, (tally.get(item.name) || 0) + (item.qty || 1));
    }
  }
  if (!tally.size) return null;
  return [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

export default async function handler(req, res) {
  if (!isCronSecretValid(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const now = Date.now();
    // Loose floor — nobody could trigger touch 1 sooner than MIN_LAPSE_DAYS
    // regardless of their personal cadence, so there's no need to even
    // fetch anyone more recent than that. The real per-customer decision
    // happens inside the loop below.
    const broadCutoff = now - MIN_LAPSE_DAYS * DAY_MS;
    const candidates = await kv.zrange("customers:last-order", 0, broadCutoff, { byScore: true });

    let touch1Sent = 0, touch1Skipped = 0, touch2Sent = 0, touch2Skipped = 0;

    for (const customerKey of candidates.slice(0, MAX_PER_RUN)) {
      try {
        const { isMember, listKey } = deriveListKey(customerKey);
        const lastOrderAtMs = await kv.zscore("customers:last-order", customerKey);
        if (lastOrderAtMs == null) { touch1Skipped++; continue; }
        const daysSinceLastOrder = (now - lastOrderAtMs) / DAY_MS;

        const orders = await fetchRecentOrders(listKey);
        const threshold = personalLapseThreshold(medianCadenceDays(orders));

        const touch1Key = `winback:sent:${customerKey}`;
        const touch1SentAt = await kv.get(touch1Key);

        if (!touch1SentAt) {
          if (daysSinceLastOrder < threshold) { touch1Skipped++; continue; }

          // Claim BEFORE sending, atomically (nx) — not after. If this
          // function gets killed (timeout) between send and the old
          // after-the-fact kv.set, or two overlapping runs both reach this
          // point, the previous order let both/either send twice. Claiming
          // first means a failed send just means this customer waits for
          // the next cycle rather than getting the same offer twice — the
          // safer direction for a marketing message.
          const claimed = await kv.set(touch1Key, String(now), { nx: true, ex: DEDUP_TTL_SEC });
          if (!claimed) { touch1Skipped++; continue; }

          const contact = await resolveContact(listKey);
          if (!contact?.email) { touch1Skipped++; continue; }
          const favoriteDish = favoriteDishFromOrders(orders);

          const voucher = await mintVoucherToken({
            discountPct: 0.10,
            ttlDays: 14,
            meta: { source: "winback", customerKey },
          });

          const jobs = [
            sendEmail({
              to: contact.email,
              subject: favoriteDish ? `Your ${favoriteDish} is waiting — 10% off` : "We miss cooking for you — 10% off",
              html: winBackEmailHtml({ customerName: contact.customerName, link: voucher.resumeUrl, isMember, favoriteDish }),
            }),
          ];
          if (contact.phone && contact.smsMarketingConsent) {
            jobs.push(sendSMS(contact.phone, winBackSmsBody({ link: voucher.resumeUrl, isMember, favoriteDish })));
          }
          await Promise.all(jobs);
          await recordCampaignSent("winback");
          touch1Sent++;
        } else {
          const touch2Key = `winback:touch2:sent:${customerKey}`;

          const daysSinceTouch1 = (now - Number(touch1SentAt)) / DAY_MS;
          if (daysSinceTouch1 < TOUCH2_DELAY_DAYS) { touch2Skipped++; continue; }

          const claimed = await kv.set(touch2Key, String(now), { nx: true, ex: DEDUP_TTL_SEC });
          if (!claimed) { touch2Skipped++; continue; }

          const contact = await resolveContact(listKey);
          if (!contact?.email) { touch2Skipped++; continue; }
          const favoriteDish = favoriteDishFromOrders(orders);

          const voucher = await mintVoucherToken({
            discountPct: 0.10,
            ttlDays: 14,
            meta: { source: "winback-touch2", customerKey },
          });

          const jobs = [
            sendEmail({
              to: contact.email,
              subject: "Last call — 10% off expires soon",
              html: winBackTouch2EmailHtml({ customerName: contact.customerName, link: voucher.resumeUrl, isMember, favoriteDish }),
            }),
          ];
          if (contact.phone && contact.smsMarketingConsent) {
            jobs.push(sendSMS(contact.phone, winBackTouch2SmsBody({ link: voucher.resumeUrl, isMember, favoriteDish })));
          }
          await Promise.all(jobs);
          await recordCampaignSent("winback-touch2");
          touch2Sent++;
        }
      } catch (e) {
        console.error(`Win-back processing failed for ${customerKey}:`, e);
      }
    }

    const result = {
      candidates: candidates.length,
      touch1: { sent: touch1Sent, skipped: touch1Skipped },
      touch2: { sent: touch2Sent, skipped: touch2Skipped },
    };
    await recordCronRun("win-back-lapsed", result);
    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    console.error("Win-back cron failed:", e);
    captureServerError(e, { route: "cron/win-back-lapsed" });
    return res.status(500).json({ error: "Cron failed" });
  }
}
