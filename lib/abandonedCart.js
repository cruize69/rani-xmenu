// ── Abandoned cart capture + recovery ──────────────────────────────
// Two-stage lifecycle, in two separate KV namespaces:
//
//   abandoned-lead:{draftId}  Stage A — captured at the fulfillment step
//                             (phone) or guest-checkout email step, BEFORE
//                             a Stripe session exists. Lower intent. Gets
//                             graduated (deleted) once checkout actually
//                             starts, so Stage A never double-messages
//                             someone who's already moved on to Stage B.
//
//   draft:{session.id}       Stage B — the EXISTING draft-cart record
//                             create-checkout.js already writes for the
//                             analytics funnel (api/analytics.js's
//                             fetchDrafts). We only ADD fields to it here
//                             (phone/smsConsent/touch*SentAt) — never
//                             remove or rename existing ones, since the
//                             funnel reporting depends on this shape.
//                             status stays "draft" until syncStripe.js's
//                             existing paid-marking flips it to "paid".
//
// Timing is mealtime-window-aware, not just elapsed-time-based — a
// recovery text at 9am about a 7pm dinner abandonment is useless.
//
// SMS only ever fires with explicit smsConsent captured at the point of
// collecting the phone number — this is borderline-promotional messaging,
// not pure order-status, so treated conservatively (TCPA). Every SMS
// includes a STOP line.

import { kv } from "@vercel/kv";
import { priceCartItems } from "./menu.js";
import { sendEmail, sendSMS } from "./notifications.js";
import { mintVoucherToken } from "./orders.js";

// Every lead/draft that actually reaches send time already has a phone or
// email on file (sendLeadTouch1/sendDraftTouch1 bail otherwise) — so this
// delay is, in practice, entirely "how fast do we reach an identifiable
// customer." Shortened from 12 to 4 min specifically so this doubles as a
// fast-ish callback path for a customer who hit a real error on Stripe's
// own hosted checkout page (declined card, etc.) — something the site
// itself has no live visibility into (see lib/errorAlerts.js for the cases
// we *can* see instantly). The sweep cron runs every 5 min, so worst case
// is roughly one cron cycle after this delay elapses, not the full 12 min.
const TOUCH1_DELAY_MIN = 4;    // friction-removal nudge, no incentive
const TOUCH2_DELAY_MIN = 40;   // Stage B only, same mealtime window only
const EXPIRE_AFTER_MIN = 180;  // stop trying — the meal moment has passed
const LEAD_TTL_SEC = 60 * 60 * 6;

const BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL || "https://ranimahal.food").replace(/\/$/, "");

function nyHourDecimal(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(date);
  const h = Number(parts.find(p => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find(p => p.type === "minute")?.value ?? 0);
  return h + m / 60;
}

const MEALTIME_WINDOWS = [
  { start: 11, end: 14.5 }, // lunch
  { start: 17, end: 21   }, // dinner
];

function mealtimeWindowFor(hour) {
  return MEALTIME_WINDOWS.find(w => hour >= w.start && hour < w.end) ?? null;
}

function isQuietHours(date = new Date()) {
  const h = nyHourDecimal(date);
  return h >= 21.5 || h < 9;
}

function parseJson(raw) {
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

function formatCartLine(items) {
  return (items ?? []).map(i => `${i.qty}x ${i.name}`).join(", ");
}

// ── Stage A: pre-checkout capture (fulfillment sheet / guest email step) ──
export async function saveLead({ draftId, phone, email, smsConsent, items, orderMode, deliveryAddress }) {
  if (!draftId) return null;
  const key = `abandoned-lead:${draftId}`;
  const existing = parseJson(await kv.get(key));
  if (existing?.graduated) return existing; // already moved on to Stage B

  const { items: pricedItems, subtotal } = priceCartItems(items);
  if (pricedItems.length === 0 && !existing) return null;

  const lead = {
    draftId,
    items:       pricedItems.length ? pricedItems : (existing?.items ?? []),
    subtotal:    pricedItems.length ? subtotal : (existing?.subtotal ?? 0),
    orderMode:   orderMode === "delivery" ? "delivery" : (orderMode ?? existing?.orderMode ?? "pickup"),
    deliveryAddress: orderMode === "delivery" ? (deliveryAddress ?? existing?.deliveryAddress ?? null) : (existing?.deliveryAddress ?? null),
    phone:       phone || existing?.phone || null,
    email:       email || existing?.email || null,
    smsConsent:  !!(smsConsent || existing?.smsConsent),
    createdAt:   existing?.createdAt ?? new Date().toISOString(),
    updatedAt:   new Date().toISOString(),
    touch1SentAt: existing?.touch1SentAt ?? null,
    graduated:   false,
  };
  await kv.set(key, JSON.stringify(lead), { ex: LEAD_TTL_SEC });
  return lead;
}

// Called from create-checkout.js right after a Stripe session is created —
// stops Stage A from messaging someone who's already reached checkout, and
// hands back phone/smsConsent so the Stage B draft record can carry them.
export async function graduateLead(draftId) {
  if (!draftId) return null;
  const key = `abandoned-lead:${draftId}`;
  const lead = parseJson(await kv.get(key));
  if (!lead) return null;
  lead.graduated = true;
  await kv.set(key, JSON.stringify(lead), { ex: 300 }); // short-lived tombstone
  return lead;
}

async function sendLeadTouch1(lead) {
  if (!(lead.phone && lead.smsConsent) && !lead.email) return;
  const cartLine = formatCartLine(lead.items);
  const link = resumeUrl(lead.items);
  if (lead.phone && lead.smsConsent) {
    await sendSMS(lead.phone, `Rani Mahal: Still there? Your order (${cartLine}) is saved — finish in one tap: ${link} Reply STOP to opt out.`);
  } else {
    await sendEmail({
      to: lead.email,
      subject: "Still hungry? Your order is saved",
      html: `<p>Your order — ${cartLine} — is still saved.</p><p><a href="${link}">Tap here to finish checkout</a></p>`,
    });
  }
}

async function sendDraftTouch1(draft) {
  if (!(draft.phone && draft.smsConsent) && !draft.guestEmail) return;
  const cartLine = formatCartLine(draft.items);
  // An abandoned Stripe Checkout Session can't be resumed once left — route
  // back into the app with the cart restored so they can check out fresh.
  const link = resumeUrl(draft.items);
  if (draft.phone && draft.smsConsent) {
    await sendSMS(draft.phone, `Rani Mahal: Your order (${cartLine}) is saved! Finish in one tap: ${link} Reply STOP to opt out.`);
  } else {
    await sendEmail({
      to: draft.guestEmail,
      subject: "You left something delicious behind",
      html: `<p>Your order — ${cartLine} — is still saved.</p><p><a href="${link}">Tap here to finish checkout</a></p>`,
    });
  }
}

async function sendDraftTouch2(draft) {
  if (!(draft.phone && draft.smsConsent) && !draft.guestEmail) return;
  const cartLine = formatCartLine(draft.items);
  // The 10% promised in this message has to actually be redeemable — mint a
  // real voucher through the same reorder-token machinery create-checkout.js
  // already validates, rather than sending a plain (undiscounted) resume link.
  const voucher = await mintVoucherToken({
    discountPct: 0.10,
    ttlDays: 1,
    items: draft.items,
    meta: { source: "abandoned-cart" },
  });
  const link = voucher.resumeUrl;
  if (draft.phone && draft.smsConsent) {
    await sendSMS(draft.phone, `Rani Mahal: Still hungry? Take 10% off (${cartLine}) if you finish now: ${link} Reply STOP to opt out.`);
  } else {
    await sendEmail({
      to: draft.guestEmail,
      subject: "10% off your saved order — today only",
      html: `<p>Your order — ${cartLine} — is still waiting. Finish now and save 10%.</p><p><a href="${link}">Resume checkout</a></p>`,
    });
  }
}

// Builds a resume link using the app's existing ?add=id,id,id deep-link
// convention (RaniMahal.jsx already restores cart contents from repeated
// baseIds in that param) — no separate restore endpoint/protocol needed.
function resumeUrl(items) {
  const ids = items.flatMap(i => Array(Math.max(1, i.qty)).fill(i.baseId));
  return `${BASE_URL}/?add=${ids.map(encodeURIComponent).join(",")}`;
}

// ── The sweep — opportunistically triggered from api/orders.js's hot path
// (staff dashboard polling, which is on constantly during business hours) ──
export async function sweepAbandonedCarts() {
  const acquired = await kv.set("abandoned-cart-sweep-lock", "1", { nx: true, ex: 55 });
  if (!acquired) return { skipped: true, reason: "throttled" };

  const now = new Date();
  if (isQuietHours(now)) return { skipped: true, reason: "quiet_hours" };

  let touch1Leads = 0, touch1Drafts = 0, touch2Drafts = 0;

  // Stage A — leads that never reached Stripe
  // kv.scan()'s cursor comes back as the number 0 (not string "0"), so a
  // strict !== "0" comparison never matches and loops forever — String()
  // both sides so numeric and string cursors compare equal.
  let cursor = "0";
  do {
    const [next, batch] = await kv.scan(cursor, { match: "abandoned-lead:*", count: 200 });
    cursor = next;
    for (const key of batch) {
      try {
        const lead = parseJson(await kv.get(key));
        if (!lead || lead.graduated || lead.touch1SentAt) continue;
        const ageMin = (now - new Date(lead.createdAt)) / 60000;
        if (ageMin > EXPIRE_AFTER_MIN) continue; // let it just TTL out
        if (ageMin >= TOUCH1_DELAY_MIN) {
          await sendLeadTouch1(lead);
          lead.touch1SentAt = now.toISOString();
          await kv.set(key, JSON.stringify(lead), { ex: LEAD_TTL_SEC });
          touch1Leads++;
        }
      } catch (e) { console.error("Abandoned-lead sweep error for", key, e); }
    }
  } while (String(cursor) !== "0");

  // Stage B — the existing draft-cart records (reached Stripe, unpaid)
  cursor = "0";
  do {
    const [next, batch] = await kv.scan(cursor, { match: "draft:*", count: 200 });
    cursor = next;
    for (const key of batch) {
      try {
        const draft = parseJson(await kv.get(key));
        if (!draft || draft.status === "paid" || draft.status === "expired") continue;
        const ageMin = (now - new Date(draft.createdAt)) / 60000;

        if (ageMin > EXPIRE_AFTER_MIN) {
          draft.status = "expired";
          await kv.set(key, JSON.stringify(draft), { ex: 60 * 60 * 24 });
          continue;
        }

        if (!draft.touch1SentAt && ageMin >= TOUCH1_DELAY_MIN) {
          await sendDraftTouch1(draft);
          draft.touch1SentAt = now.toISOString();
          await kv.set(key, JSON.stringify(draft), { ex: 60 * 60 * 24 });
          touch1Drafts++;
          continue; // one touch per sweep pass per draft
        }

        if (draft.touch1SentAt && !draft.touch2SentAt && ageMin >= TOUCH2_DELAY_MIN) {
          const createdWindow = mealtimeWindowFor(nyHourDecimal(new Date(draft.createdAt)));
          const nowWindow = mealtimeWindowFor(nyHourDecimal(now));
          if (createdWindow && nowWindow && createdWindow.start === nowWindow.start) {
            await sendDraftTouch2(draft);
            draft.touch2SentAt = now.toISOString();
            await kv.set(key, JSON.stringify(draft), { ex: 60 * 60 * 24 });
            touch2Drafts++;
          }
        }
      } catch (e) { console.error("Draft-cart sweep error for", key, e); }
    }
  } while (String(cursor) !== "0");

  return { touch1Leads, touch1Drafts, touch2Drafts };
}
