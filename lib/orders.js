// ── Order schema & KV helpers ────────────────────────────────────
// Orders stored in Vercel KV (Redis) with two key patterns:
//   order:{id}          → full order object
//   orders:date:{YYYY-MM-DD} → sorted set of order IDs for that day

import { kv } from "@vercel/kv";
import { TAX_RATE } from "./menu.js";

export const ORDER_STATUS = {
  NEW:      "new",
  DONE:     "done",
  REFUNDED: "refunded",
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
export function buildOrder({ paymentIntent, stripeSession, cartItems, specialInstructions, tip = 0, orderMode = "pickup", deliveryAddress = null, deliveryFee = 0 }) {
  const id = `order_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date();
  const subtotal = cartItems.reduce((s, i) => s + i.price * i.qty, 0);
  const tax      = parseFloat((subtotal * TAX_RATE).toFixed(2));
  const parsedFee = parseFloat(Number(deliveryFee || 0).toFixed(2));

  const clerkUserId   = stripeSession?.metadata?.clerkUserId?.trim() || null;
  const customerEmail = stripeSession?.customer_details?.email?.trim() || stripeSession?.metadata?.guestEmail?.trim() || null;

  return {
    id,
    stripeSessionId:    stripeSession?.id ?? null,
    stripePaymentId:    paymentIntent?.id ?? null,
    clerkUserId:        clerkUserId,
    status:             ORDER_STATUS.NEW,
    createdAt:          now.toISOString(),
    updatedAt:          now.toISOString(),
    date:               getNYDateString(now), // YYYY-MM-DD in America/New_York
    // Customer
    customerName:       stripeSession?.customer_details?.name  ?? "Guest",
    customerEmail:      customerEmail,
    customerPhone:      stripeSession?.customer_details?.phone ?? null,
    // Order Type & Delivery Details
    orderMode:          orderMode === "delivery" ? "delivery" : "pickup",
    deliveryAddress:    orderMode === "delivery" ? deliveryAddress : null,
    deliveryFee:        parsedFee,
    estimatedTime:      orderMode === "delivery" ? "45–60 min" : "25–35 min",
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
 * Save order to KV and index by date, clerkUserId, and guest email
 */
export async function saveOrder(order) {
  await kv.set(`order:${order.id}`, JSON.stringify(order));
  // Add to daily index (sorted set, score = timestamp)
  await kv.zadd(`orders:date:${order.date}`, {
    score: Date.now(),
    member: order.id,
  });

  // Index under Clerk User ID if signed in
  if (order.clerkUserId) {
    await kv.lpush(`account-orders:${order.clerkUserId}`, order.id);
  }

  // Index under Guest Email for instant email lookup & account claiming
  if (order.customerEmail) {
    const cleanEmail = order.customerEmail.toLowerCase().trim();
    await kv.lpush(`account-orders:guest:${cleanEmail}`, order.id);
  }

  return order;
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
    totalRevenue:   active.reduce((s, o) => s + o.total, 0),
    avgOrderValue:  active.length ? active.reduce((s, o) => s + o.total, 0) / active.length : 0,
    topItems,
  };
}
