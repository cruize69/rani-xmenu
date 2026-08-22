// ── Order schema & KV helpers ────────────────────────────────────
// Orders stored in Vercel KV (Redis) with two key patterns:
//   order:{id}          → full order object
//   orders:date:{YYYY-MM-DD} → sorted set of order IDs for that day

import { kv } from "./kv.js";
import { TAX_RATE, VALID_ITEMS } from "./menu.js";
import crypto from "crypto";
import { nyDateTimeToUtcMs, getKitchenPrintTriggerMs } from "./hours.js";
import { getEtaFor } from "../src/utils/deliveryConfig.js";

export const ORDER_STATUS = {
  NEW:       "new",
  SCHEDULED: "scheduled", // paid, but held until scheduledFor — see api/cron/promote-scheduled-orders.js
  DONE:      "done",
  REFUNDED:  "refunded",
};

/**
 * Helper to get YYYY-MM-DD in America/New_York timezone (restaurant local time)
 */
export function getNYDateString(date = new Date()) {
  try {
    const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
    return d.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  } catch (e) {
    return new Date().toISOString().slice(0, 10);
  }
}

/**
 * Build a clean order object from a Stripe PaymentIntent + metadata
 */
export function buildOrder({ paymentIntent, stripeSession, cartItems, specialInstructions, tip = 0, orderMode = "pickup", deliveryAddress = null, deliveryFee = 0, scheduledFor = null, smsConsent = false, smsMarketingConsent = false }) {
  const id = `order_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date();
  const subtotal = cartItems.reduce((s, i) => s + i.price * i.qty, 0);
  const tax      = parseFloat((subtotal * TAX_RATE).toFixed(2));
  const parsedFee = parseFloat(Number(deliveryFee || 0).toFixed(2));

  const clerkUserId   = stripeSession?.metadata?.clerkUserId?.trim() || null;
  const welcomeDiscount = stripeSession?.metadata?.welcomeDiscount === "1";
  const memberDiscount  = stripeSession?.metadata?.memberDiscount === "1";
  const customerEmail = stripeSession?.customer_details?.email?.trim() || stripeSession?.metadata?.guestEmail?.trim() || null;
  const reorderToken  = crypto.randomBytes(6).toString("hex"); // secure 12-char token — a real spendable 10%-off voucher, must stay secret (email only, never the public API)
  const shareCode     = crypto.randomBytes(6).toString("hex"); // separate, public-safe identifier for the referral link — carries no value on its own

  const canonicalSubtotal = cartItems.reduce((s, i) => s + (i.originalPrice ?? VALID_ITEMS[i.baseId]?.price ?? i.price) * i.qty, 0);
  const rawDiscountAmt = parseFloat(stripeSession?.metadata?.discountAmount ?? "0");
  const discountAmount = Number.isFinite(rawDiscountAmt) && rawDiscountAmt > 0
    ? rawDiscountAmt
    : (canonicalSubtotal > subtotal ? parseFloat((canonicalSubtotal - subtotal).toFixed(2)) : 0);

  const discountPct = parseFloat(stripeSession?.metadata?.discountPct ?? "0") || (canonicalSubtotal > 0 && discountAmount > 0 ? parseFloat((discountAmount / canonicalSubtotal).toFixed(2)) : 0);
  const rawDiscountType = stripeSession?.metadata?.discountType;
  const discountType = rawDiscountType || (welcomeDiscount ? "welcome" : memberDiscount ? "member" : discountAmount > 0 ? "voucher" : null);

  const discountLabel = discountType === "welcome"
    ? "Rani Royal Club (10% Welcome Discount)"
    : discountType === "member"
      ? "Rani Royal Club (5% Member Discount)"
      : discountType === "voucher"
        ? `Special Voucher (${Math.round((discountPct || 0.10) * 100)}% Off)`
        : (discountAmount > 0 ? `Discount (${Math.round(discountPct * 100)}% Off)` : null);

  // scheduledFor is { date: "YYYY-MM-DD", time: "HH:MM" } NY-local — already
  // validated against real service-window hours by the caller (never trust
  // it blindly here; see api/create-checkout.js's isWithinServiceWindow check).
  const scheduledAtMs = scheduledFor ? nyDateTimeToUtcMs(scheduledFor.date, scheduledFor.time) : null;
  // Distinct from scheduledAtMs: when the kitchen ticket actually prints.
  // Normally the same instant, but an early-dinner slot pulls this earlier
  // to when staff return from the afternoon gap — see
  // getKitchenPrintTriggerMs. scheduledAtMs itself stays the true
  // requested time everywhere else (display, review-nudge timing).
  const printAtMs = scheduledFor ? getKitchenPrintTriggerMs(scheduledFor.date, scheduledFor.time) : null;
  // A customer can pick a scheduledFor slot that's already past its own
  // print trigger by the time checkout actually completes (e.g. the
  // earliest slot the UI offered was minutes away, or checkout itself took
  // a few minutes) — printAtMs already <= now at creation. Holding that as
  // "scheduled" anyway means it only prints on promote-scheduled-orders.js's
  // next 5-minute cron tick instead of immediately, a needless delay for an
  // order the kitchen should already be treating as live. Only orders whose
  // trigger is still genuinely in the future go through the scheduled hold;
  // scheduledFor/scheduledAtMs stay populated either way so the true
  // requested time still displays everywhere (dashboard, receipt, etc.).
  const isGenuinelyFuture = scheduledFor && printAtMs > now.getTime();

  return {
    id,
    reorderToken,
    shareCode,
    stripeSessionId:    stripeSession?.id ?? null,
    stripePaymentId:    paymentIntent?.id ?? null,
    clerkUserId:        clerkUserId,
    welcomeDiscount:    welcomeDiscount,
    status:             isGenuinelyFuture ? ORDER_STATUS.SCHEDULED : ORDER_STATUS.NEW,
    createdAt:          now.toISOString(),
    updatedAt:          now.toISOString(),
    date:               getNYDateString(now), // YYYY-MM-DD in America/New_York
    scheduledFor:       scheduledFor ?? null,
    scheduledAtMs:       scheduledAtMs,
    printAtMs:           printAtMs,
    // Marketing attribution — which ranimahal.cc link (if any) sent this
    // customer here. Empty string means direct/unknown, not "failed".
    utmSource:          stripeSession?.metadata?.utmSource   || null,
    utmMedium:          stripeSession?.metadata?.utmMedium   || null,
    utmCampaign:        stripeSession?.metadata?.utmCampaign || null,
    gclid:              stripeSession?.metadata?.gclid       || null,
    fbclid:             stripeSession?.metadata?.fbclid      || null,
    // Customer
    customerName:       stripeSession?.customer_details?.name  ?? "Guest",
    customerEmail:      customerEmail,
    customerPhone:      stripeSession?.customer_details?.phone ?? null,
    // Real opt-in captured at the fulfillment-sheet phone step, NOT implied
    // by Stripe collecting a phone number for delivery/contact purposes —
    // those are different things under TCPA. Anything that texts a
    // customer outside pure order-status updates (review nudges, win-back
    // offers) must gate on this being true, never on customerPhone alone.
    smsConsent:         !!smsConsent,
    // Distinct, separately-collected consent — required by carrier/TCR
    // review (10DLC campaigns get rejected if marketing consent is bundled
    // with any other consent). Gates the marketing crons (win-back,
    // second-order-push, catering-cross-sell, cultural-calendar,
    // review-nudge) and abandoned-cart SMS; smsConsent alone only covers
    // order-status texts for THIS order. See FulfillmentSheet.jsx for the
    // two separate checkboxes that set these.
    smsMarketingConsent: !!smsMarketingConsent,
    // Order Type & Delivery Details
    orderMode:          orderMode === "delivery" ? "delivery" : "pickup",
    deliveryAddress:    orderMode === "delivery" ? deliveryAddress : null,
    deliveryFee:        parsedFee,
    // Real per-zone window, not a flat guess — the receipt email and the
    // kitchen ticket both read this field, so a wrong value here becomes a
    // written promise we can't keep.
    estimatedTime:      getEtaFor(orderMode, deliveryAddress?.zip),
    // Order
    items:              cartItems,           // [{ name, price, qty, spice, note }]
    specialInstructions: specialInstructions ?? "",
    // Financials
    subtotal:           subtotal,
    originalSubtotal:   parseFloat(canonicalSubtotal.toFixed(2)),
    discountAmount:     discountAmount,
    discountPct:        discountPct,
    discountType:       discountType,
    discountLabel:      discountLabel,
    welcomeDiscount:    welcomeDiscount,
    memberDiscount:     memberDiscount,
    tax:                tax,
    tip:                parseFloat(tip.toFixed(2)),
    total:              parseFloat((subtotal + parsedFee + tax + tip).toFixed(2)),
    // Printer
    printed:            false,
    printedAt:          null,
  };
}

/**
 * Cheap "has anything changed" signal for a given date, so pollers can skip
 * the expensive N-individual-kv.get() fetch in getOrdersByDate() when nothing
 * changed since their last check. Touched by every order mutation below.
 */
export async function touchOrdersVersion(date) {
  try {
    await kv.set(`orders:version:${date}`, Date.now());
  } catch (e) {}
}

/**
 * Trimmed view of an order for the PUBLIC (unauthenticated) success-page
 * lookup. That route is a capability URL — anyone holding the Stripe
 * session_id gets the response — and session_ids leak through browser
 * history, referrer headers, and shared "here's my order" links.
 *
 * So it returns only what OrderSuccess.jsx actually renders, and drops the
 * internal identifiers it never reads: stripePaymentId (the handle used for
 * refunds), clerkUserId, stripeSessionId, UTM attribution, and print state.
 *
 * reorderToken is dropped too — it's a real, spendable 10%-off voucher
 * (redeemable with no ownership check via /api/reorder-claim), so exposing
 * it here let anyone who obtained a session_id steal that customer's own
 * discount. It's delivered instead through the receipt email, which only
 * the customer receives. shareCode stays: it's a separate identifier minted
 * specifically to be public — it carries no value by itself, only a
 * pointer used to credit a referral, so leaking it just means someone can
 * do what the referral feature already lets anyone do with the real link.
 */
export function publicOrderView(order) {
  if (!order) return order;
  const {
    reorderToken,
    stripePaymentId, clerkUserId, stripeSessionId,
    utmSource, utmMedium, utmCampaign, gclid, fbclid,
    printed, printedAt, scheduledAtMs, printAtMs,
    ...safe
  } = order;
  return safe;
}

export async function getOrdersVersion(date) {
  const targetDate = date ?? getNYDateString();
  return (await kv.get(`orders:version:${targetDate}`)) ?? 0;
}

// ── Shared identity key for lapsed-customer tracking ─────────────────
// One customer, one key, whether they're signed in or a guest — used to
// index "when did this person last order" (customers:last-order, below)
// and to dedupe win-back sends (winback:sent:{key} in the cron). A signed-in
// account is the stronger identity (survives email changes); guests are
// keyed by email since that's all we have.
export function customerKeyForOrder(order) {
  if (order.clerkUserId) return `clerk:${order.clerkUserId}`;
  if (order.customerEmail) return `guest:${order.customerEmail.toLowerCase().trim()}`;
  return null;
}

// Same NY-local-hour check abandonedCart.js already uses for mealtime
// windows — duplicated in miniature here rather than shared, since it's
// five lines and the two callers have no other coupling.
function nyHourDecimal(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(date);
  const h = Number(parts.find(p => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find(p => p.type === "minute")?.value ?? 0);
  return h + m / 60;
}

// "30–40 min" / "50–65 min" → 40 / 65. Takes the upper (worst-case) bound
// so the review nudge never fires while a slow order is still plausibly in
// transit — better to ask a little late than while the food hasn't arrived.
function parseEtaUpperBoundMinutes(etaStr) {
  const nums = String(etaStr || "").match(/\d+/g);
  if (!nums || !nums.length) return 45;
  return Number(nums[nums.length - 1]);
}

// When to ask for a review: worst-case fulfillment time, plus an hour to
// actually eat. Too early and the ask lands mid-meal or mid-drive (low
// reply rate, feels presumptuous); too late and the specific dinner has
// faded from memory. An hour past "food is plausibly in hand" is the
// standard post-meal review-request window. Never lands late at night —
// pushed to 10 AM the next day so a 9 PM order doesn't page someone at
// midnight about how their curry was.
export function computeReviewNudgeTargetTs(order) {
  const upperBoundMin = parseEtaUpperBoundMinutes(order.estimatedTime);
  const eatingBufferMin = 60;
  // A scheduled (order-ahead) order can be PAID for hours or a full day
  // before it's actually made — anchoring to createdAt would fire the
  // review nudge while the food doesn't exist yet. scheduledAtMs is when
  // the kitchen actually starts on it; that's the correct anchor whenever
  // it's set.
  const baseMs = order.scheduledAtMs ?? new Date(order.createdAt).getTime();
  const rawMs = baseMs + (upperBoundMin + eatingBufferMin) * 60000;

  const targetHour = nyHourDecimal(new Date(rawMs));
  if (targetHour >= 21.5 || targetHour < 9) {
    // Roll to 10 AM NY local — using nyDateTimeToUtcMs (already relied on
    // for scheduledAtMs) rather than hand-rolled UTC-hour math, which got
    // this wrong on the first pass: setUTCHours(10) is 10 AM UTC, i.e.
    // 5-6 AM NY depending on DST, not 10 AM NY. Land on today's NY date if
    // the overrun was the "before 9 AM" case (order placed very late
    // last night), otherwise tomorrow's.
    const rollDate = new Date(rawMs);
    if (targetHour >= 21.5) rollDate.setDate(rollDate.getDate() + 1);
    return nyDateTimeToUtcMs(getNYDateString(rollDate), "10:00");
  }
  return rawMs;
}

/**
 * Save order to KV and index by date, clerkUserId, and guest email
 */
export async function saveOrder(order) {
  // These writes are independent of each other, so they go out in one
  // parallel batch rather than ~8 serial round-trips. This runs inside the
  // Stripe webhook, where every serialized hop is latency against Stripe's
  // own timeout (and a retry means the kitchen waits).
  const writes = [
    kv.set(`order:${order.id}`, JSON.stringify(order)),
    // Daily index (sorted set, score = timestamp)
    kv.zadd(`orders:date:${order.date}`, { score: Date.now(), member: order.id }),
  ];

  // Index scheduled (held) orders by their promotion time, so the cron job
  // can cheaply find only the ones due now instead of scanning every order.
  // Scored by printAtMs, not scheduledAtMs — usually identical, but an
  // early-dinner slot promotes/prints earlier (see getKitchenPrintTriggerMs)
  // while still DISPLAYING the true requested scheduledAtMs everywhere else.
  if (order.status === ORDER_STATUS.SCHEDULED && (order.printAtMs ?? order.scheduledAtMs)) {
    writes.push(kv.zadd("scheduled-orders", { score: order.printAtMs ?? order.scheduledAtMs, member: order.id }));
  }

  // Index under Clerk User ID if signed in (capped so the list can't grow
  // unbounded). lpush→ltrim must stay ordered relative to each other, but
  // the pair as a whole is independent of everything else here.
  if (order.clerkUserId) {
    const key = `account-orders:${order.clerkUserId}`;
    writes.push((async () => { await kv.lpush(key, order.id); await kv.ltrim(key, 0, 199); })());
  }

  // Index under Guest Email for instant email lookup & account claiming
  if (order.customerEmail) {
    const key = `account-orders:guest:${order.customerEmail.toLowerCase().trim()}`;
    writes.push((async () => { await kv.lpush(key, order.id); await kv.ltrim(key, 0, 199); })());
  }

  // Last-order-date index for the win-back cron (api/cron/win-back-lapsed.js)
  // — a sorted set scored by this order's timestamp lets that cron do a
  // single cheap ZRANGEBYSCORE for "everyone whose last order was 30+ days
  // ago" instead of scanning every order ever placed. Also clears this
  // customer's win-back dedup flag: placing a new order ends their current
  // "lapsed" episode, so a FUTURE lapse should be able to trigger a fresh
  // win-back rather than staying permanently suppressed by an old send.
  const custKey = customerKeyForOrder(order);
  if (custKey) {
    writes.push(kv.zadd("customers:last-order", { score: Date.now(), member: custKey }));
    writes.push(kv.del(`winback:sent:${custKey}`));
    writes.push(kv.del(`winback:touch2:sent:${custKey}`));
  }

  // Review-nudge queue (api/cron/review-nudge.js) — scored by the computed
  // send time so that cron does one cheap ZRANGEBYSCORE for "everything due
  // now" instead of inspecting every order to recompute timing on each run.
  writes.push(kv.zadd("review-nudge-queue", { score: computeReviewNudgeTargetTs(order), member: order.id }));

  // Store 10% reorder token state in KV
  if (order.reorderToken) {
    const tokenData = {
      orderId: order.id,
      items: (order.items || []).map(i => ({
        baseId: i.baseId ?? i.id,
        name: i.name,
        price: i.price,
        qty: i.qty,
        spice: i.spice ?? null,
        note: i.note ?? null
      })),
      status: "unused",
      createdAt: order.createdAt,
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    };
    writes.push(kv.set(`reorder-token:${order.reorderToken}`, JSON.stringify(tokenData), { ex: 1296000 })); // 15 days TTL
  }

  // Separate namespace from reorder-token above — this record has no
  // spendable value, only an orderId pointer, so it's safe for
  // publicOrderView() to expose shareCode in the public success-page API
  // without also exposing the customer's actual redeemable voucher.
  if (order.shareCode) {
    writes.push(kv.set(`referral-source:${order.shareCode}`, JSON.stringify({ orderId: order.id }), { ex: 1296000 })); // 15 days, matches reorder-token
  }

  await Promise.all(writes);

  // Deliberately AFTER the batch above: staff dashboards poll this version
  // key and refetch when it changes. Bumping it before the order row is
  // durably written would let a poll land in the gap, fetch without the new
  // order, and then sit idle until the *next* unrelated change.
  await touchOrdersVersion(order.date);

  // Rani Royal Club lifetime order counter. The milestone voucher this used
  // to mint (10% off every 3rd order) is gone — members now get a standing
  // 5% on EVERY order, applied directly in api/create-checkout.js, so there
  // is nothing to mint, email, or redeem. The counter stays because the
  // account portal reports it and it costs one INCR.
  //
  // Still deliberately NOT llen(account-orders:*) — that list is ltrim'd to
  // 200, so llen pins at 200 forever and undercounts every long-term regular.
  if (order.clerkUserId) {
    try {
      await kv.incr(`account-order-count:${order.clerkUserId}`);
    } catch (e) {
      console.error("Loyalty counter increment failed:", e);
    }
  }

  return order;
}

const BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL || "https://ranimahal.cc/order").replace(/\/$/, "");

/**
 * Generic single-use discount voucher — same KV shape and namespace as the
 * per-order reorderToken above (`reorder-token:{token}`), so it's already
 * fully compatible with api/create-checkout.js's validation, api/reorder-
 * claim.js's redemption, and the ?reorder= apply flow in RaniMahal.jsx.
 * Used for loyalty rewards, referral credits, and abandoned-cart recovery
 * incentives — anywhere that needs "10% off, once, before it expires"
 * without being tied to re-ordering a specific past order.
 */
export async function mintVoucherToken({ discountPct = 0.10, ttlDays = 14, items = [], meta = {} } = {}) {
  const token = crypto.randomBytes(6).toString("hex");
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();
  const tokenData = {
    orderId: null,
    items,
    discountPct,
    status: "unused",
    createdAt: new Date().toISOString(),
    expiresAt,
    meta,
  };
  await kv.set(`reorder-token:${token}`, JSON.stringify(tokenData), { ex: ttlDays * 24 * 60 * 60 });
  return { token, expiresAt, resumeUrl: `${BASE_URL}/?reorder=${token}` };
}

/**
 * Get a single order by ID
 */
export async function getOrder(id) {
  return (await kv.get(`order:${id}`)) ?? null;
}

/**
 * Update order fields
 */
export async function updateOrder(id, fields) {
  const order = await getOrder(id);
  if (!order) throw new Error(`Order ${id} not found`);
  const updated = { ...order, ...fields, updatedAt: new Date().toISOString() };
  await kv.set(`order:${id}`, JSON.stringify(updated));
  await touchOrdersVersion(updated.date);
  return updated;
}

/**
 * Get all orders for a date (default today NY time).
 * Optionally includes active orders from yesterday if includeYesterday is true.
 */
export async function getOrdersByDate(date, includeYesterday = false) {
  const targetDate = date ?? getNYDateString();
  const ids = (await kv.zrange(`orders:date:${targetDate}`, 0, -1)) || [];

  let allIds = ids;
  if (includeYesterday) {
    const refDate = new Date(targetDate + "T12:00:00-04:00");
    const prevDate = new Date(refDate);
    prevDate.setDate(prevDate.getDate() - 1);
    const prevStr = getNYDateString(prevDate);
    const prevIds = (await kv.zrange(`orders:date:${prevStr}`, 0, -1)) || [];
    allIds = Array.from(new Set([...ids, ...prevIds]));
  }

  if (allIds.length === 0) return [];
  const orders = await Promise.all(allIds.map(id => getOrder(id)));
  return orders
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Daily summary stats
 */
export function buildDailySummary(orders) {
  const active = orders.filter(o => o.status !== ORDER_STATUS.REFUNDED);
  const done   = orders.filter(o => o.status === ORDER_STATUS.DONE);

  // Item frequency
  const itemCounts = {};
  active.forEach(o => {
    o.items.forEach(item => {
      itemCounts[item.name] = (itemCounts[item.name] ?? 0) + item.qty;
    });
  });
  const topItems = Object.entries(itemCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, qty]) => ({ name, qty }));

  return {
    totalOrders:    active.length,
    completedOrders:done.length,
    pendingOrders:  active.filter(o => o.status !== ORDER_STATUS.DONE).length,
    // Exclude the pass-through CC processing fee — it's not restaurant revenue.
    totalRevenue:   active.reduce((s, o) => s + o.total - (o.ccFee || 0), 0),
    avgOrderValue:  active.length ? active.reduce((s, o) => s + o.total - (o.ccFee || 0), 0) / active.length : 0,
    topItems,
  };
}

export const PICKUP_AUTO_READY_MINUTES = 25;

/**
 * Checks if a pickup order has passed its 25-minute prep threshold (or scheduled time)
 * and should automatically transition to DONE / READY.
 */
export function isPickupOrderReadyForAutoDone(order, nowMs = Date.now()) {
  if (!order || order.orderMode !== "pickup") return false;
  if (order.status !== ORDER_STATUS.NEW && order.status !== "in_progress") return false;

  let readyTargetMs;
  if (order.scheduledAtMs) {
    // If order was scheduled for a specific time, it becomes ready at that scheduled time
    readyTargetMs = order.scheduledAtMs;
  } else {
    // Standard order: 25 minutes after creation
    const createdMs = new Date(order.createdAt).getTime();
    if (isNaN(createdMs)) return false;
    readyTargetMs = createdMs + PICKUP_AUTO_READY_MINUTES * 60 * 1000;
  }

  // Account for any manual delay added by staff (e.g. +5m, +10m)
  if (typeof order.delayedMinutes === "number" && order.delayedMinutes > 0) {
    readyTargetMs += order.delayedMinutes * 60 * 1000;
  }

  return nowMs >= readyTargetMs;
}

/**
 * Sweeps a list of orders and automatically transitions any pickup order older than
 * 25 minutes to DONE, firing notifications.
 */
export async function autoResolveReadyPickupOrders(orders, notifyCallback = null) {
  if (!Array.isArray(orders) || orders.length === 0) return orders;

  const nowMs = Date.now();

  for (let i = 0; i < orders.length; i++) {
    const order = orders[i];
    if (isPickupOrderReadyForAutoDone(order, nowMs)) {
      try {
        const updated = await updateOrder(order.id, {
          status: ORDER_STATUS.DONE,
          autoReady: true,
          readyAt: new Date(nowMs).toISOString(),
        });
        orders[i] = updated;

        if (notifyCallback && typeof notifyCallback === "function") {
          await notifyCallback(updated).catch(e => console.error("Auto-ready notification callback error:", e));
        }
      } catch (e) {
        console.error(`Failed to auto-resolve pickup order ${order.id}:`, e);
      }
    }
  }

  return orders;
}

