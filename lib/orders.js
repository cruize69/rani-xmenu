// ── Order schema & KV helpers ────────────────────────────────────
// Orders stored in Vercel KV (Redis) with two key patterns:
//   order:{id}          → full order object
//   orders:date:{YYYY-MM-DD} → sorted set of order IDs for that day

import { kv } from "@vercel/kv";
import { TAX_RATE } from "./menu.js";
import crypto from "crypto";
import { nyDateTimeToUtcMs } from "./hours.js";
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
export function buildOrder({ paymentIntent, stripeSession, cartItems, specialInstructions, tip = 0, orderMode = "pickup", deliveryAddress = null, deliveryFee = 0, scheduledFor = null }) {
  const id = `order_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date();
  const subtotal = cartItems.reduce((s, i) => s + i.price * i.qty, 0);
  const tax      = parseFloat((subtotal * TAX_RATE).toFixed(2));
  const parsedFee = parseFloat(Number(deliveryFee || 0).toFixed(2));

  const clerkUserId   = stripeSession?.metadata?.clerkUserId?.trim() || null;
  const welcomeDiscount = stripeSession?.metadata?.welcomeDiscount === "1";
  const customerEmail = stripeSession?.customer_details?.email?.trim() || stripeSession?.metadata?.guestEmail?.trim() || null;
  const reorderToken  = crypto.randomBytes(6).toString("hex"); // secure 12-char token — a real spendable 10%-off voucher, must stay secret (email only, never the public API)
  const shareCode     = crypto.randomBytes(6).toString("hex"); // separate, public-safe identifier for the referral link — carries no value on its own

  // scheduledFor is { date: "YYYY-MM-DD", time: "HH:MM" } NY-local — already
  // validated against real service-window hours by the caller (never trust
  // it blindly here; see api/create-checkout.js's isWithinServiceWindow check).
  const scheduledAtMs = scheduledFor ? nyDateTimeToUtcMs(scheduledFor.date, scheduledFor.time) : null;

  return {
    id,
    reorderToken,
    shareCode,
    stripeSessionId:    stripeSession?.id ?? null,
    stripePaymentId:    paymentIntent?.id ?? null,
    clerkUserId:        clerkUserId,
    welcomeDiscount:    welcomeDiscount,
    status:             scheduledFor ? ORDER_STATUS.SCHEDULED : ORDER_STATUS.NEW,
    createdAt:          now.toISOString(),
    updatedAt:          now.toISOString(),
    date:               getNYDateString(now), // YYYY-MM-DD in America/New_York
    scheduledFor:       scheduledFor ?? null,
    scheduledAtMs:       scheduledAtMs,
    // Marketing attribution — which ranimahal.cc link (if any) sent this
    // customer here. Empty string means direct/unknown, not "failed".
    utmSource:          stripeSession?.metadata?.utmSource   || null,
    utmMedium:          stripeSession?.metadata?.utmMedium   || null,
    utmCampaign:        stripeSession?.metadata?.utmCampaign || null,
    // Customer
    customerName:       stripeSession?.customer_details?.name  ?? "Guest",
    customerEmail:      customerEmail,
    customerPhone:      stripeSession?.customer_details?.phone ?? null,
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
    utmSource, utmMedium, utmCampaign,
    printed, printedAt, scheduledAtMs,
    ...safe
  } = order;
  return safe;
}

export async function getOrdersVersion(date) {
  const targetDate = date ?? getNYDateString();
  return (await kv.get(`orders:version:${targetDate}`)) ?? 0;
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
  if (order.status === ORDER_STATUS.SCHEDULED && order.scheduledAtMs) {
    writes.push(kv.zadd("scheduled-orders", { score: order.scheduledAtMs, member: order.id }));
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

const BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL || "https://ranimahal.food").replace(/\/$/, "");

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
