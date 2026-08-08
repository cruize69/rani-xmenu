// ── Order schema & KV helpers ────────────────────────────────────
// Orders stored in Vercel KV (Redis) with two key patterns:
//   order:{id}          → full order object
//   orders:date:{YYYY-MM-DD} → sorted set of order IDs for that day

import { kv } from "@vercel/kv";
import { TAX_RATE } from "./menu.js";

export const ORDER_STATUS = {
  NEW:         "new",
  IN_PROGRESS: "in_progress",
  DONE:        "done",
  REFUNDED:    "refunded",
};

/**
 * Build a clean order object from a Stripe PaymentIntent + metadata
 */
export function buildOrder({ paymentIntent, stripeSession, cartItems, specialInstructions, tip = 0, orderMode = "pickup", deliveryAddress = null, deliveryFee = 0 }) {
  const id = `order_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date();
  const subtotal = cartItems.reduce((s, i) => s + i.price * i.qty, 0);
  const tax      = parseFloat((subtotal * TAX_RATE).toFixed(2));
  const parsedFee = parseFloat(Number(deliveryFee || 0).toFixed(2));

  return {
    id,
    stripeSessionId:    stripeSession?.id ?? null,
    stripePaymentId:    paymentIntent?.id ?? null,
    status:             ORDER_STATUS.NEW,
    createdAt:          now.toISOString(),
    updatedAt:          now.toISOString(),
    date:               now.toISOString().slice(0, 10), // YYYY-MM-DD
    // Customer
    customerName:       stripeSession?.customer_details?.name  ?? "Guest",
    customerEmail:      stripeSession?.customer_details?.email ?? null,
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
 * Save order to KV and index by date
 */
export async function saveOrder(order) {
  await kv.set(`order:${order.id}`, JSON.stringify(order));
  // Add to daily index (sorted set, score = timestamp)
  await kv.zadd(`orders:date:${order.date}`, {
    score: Date.now(),
    member: order.id,
  });
  return order;
}

/**
 * Get a single order by ID
 */
export async function getOrder(id) {
  const raw = await kv.get(`order:${id}`);
  return raw ? JSON.parse(raw) : null;
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
 * Get all orders for a date (default today)
 */
export async function getOrdersByDate(date) {
  const d = date ?? new Date().toISOString().slice(0, 10);
  const ids = await kv.zrange(`orders:date:${d}`, 0, -1);
  if (!ids || ids.length === 0) return [];
  const orders = await Promise.all(ids.map(id => getOrder(id)));
  return orders.filter(Boolean).sort((a, b) =>
    new Date(b.createdAt) - new Date(a.createdAt)
  );
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
