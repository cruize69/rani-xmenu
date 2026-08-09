import Stripe from "stripe";
import { kv } from "@vercel/kv";
import { buildOrder, saveOrder, getOrder } from "./orders.js";
import { sendOrderEmail, sendCustomerReceiptEmail, sendOrderSMS } from "./notifications.js";

export function getStripe() {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY || 
                          process.env.STRIPE_LIVE_SECRET_KEY || 
                          process.env.STRIPE_KEY || 
                          process.env.STRIPE_SECRET;
  if (!stripeSecretKey) return null;
  return new Stripe(stripeSecretKey);
}

/**
 * Atomic Single Source of Truth for Order Creation from a Stripe Session.
 * Prevents duplicate orders across Webhooks, Redirects, and Background Sync.
 */
export async function getOrCreateOrderForSession(session, paymentIntent = null, shouldNotify = true) {
  if (!session?.id) return null;

  // 1. Check if order already exists for this session
  let orderId = await kv.get(`session:${session.id}`);
  if (orderId) {
    const existing = await getOrder(orderId);
    if (existing) return existing;
  }

  // 2. Atomic lock attempt (15s TTL)
  const lockKey = `session-lock:${session.id}`;
  const acquired = await kv.set(lockKey, "1", { nx: true, ex: 15 });

  if (!acquired) {
    // Another worker/webhook is currently creating this order. Wait for it to finish.
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 250));
      orderId = await kv.get(`session:${session.id}`);
      if (orderId) {
        const order = await getOrder(orderId);
        if (order) return order;
      }
    }
  }

  // 3. Final check after lock wait
  orderId = await kv.get(`session:${session.id}`);
  if (orderId) {
    const order = await getOrder(orderId);
    if (order) return order;
  }

  // 4. Parse items & delivery details
  let cartItems = [];
  try {
    const cartJson = session.metadata?.cart
      ?? (session.metadata?.cart_0 + (session.metadata?.cart_1 ?? ""));
    cartItems = JSON.parse(cartJson || "[]");
  } catch (e) {}

  let deliveryAddress = null;
  if (session.metadata?.deliveryAddress) {
    try { deliveryAddress = JSON.parse(session.metadata.deliveryAddress); } catch {}
  }

  const createdAt = session.created ? new Date(session.created * 1000) : new Date();

  // 5. Build order object
  const order = buildOrder({
    paymentIntent,
    stripeSession:       session,
    cartItems,
    specialInstructions: session.metadata?.specialInstructions ?? "",
    tip:                 parseFloat(session.metadata?.tip ?? "0") || 0,
    orderMode:           session.metadata?.orderMode ?? "pickup",
    deliveryAddress,
    deliveryFee:         parseFloat(session.metadata?.deliveryFee ?? "0") || 0,
  });

  const stripeAmt = session.amount_total ? parseFloat((session.amount_total / 100).toFixed(2)) : null;
  if (stripeAmt) order.total = stripeAmt;
  order.createdAt = createdAt.toISOString();
  order.updatedAt = createdAt.toISOString();
  order.date      = createdAt.toISOString().slice(0, 10);

  // 6. Save order & register session ID atomically
  await Promise.all([
    saveOrder(order),
    kv.set(`session:${session.id}`, order.id, { ex: 60 * 60 * 24 * 365 }),
  ]);
  console.log(`[Order Lock] Single Order Created & Saved: ${order.id} for session ${session.id}`);

  // 7. Dispatch notifications once if requested
  if (shouldNotify) {
    const results = await Promise.allSettled([
      sendOrderEmail(order),
      sendCustomerReceiptEmail(order),
      sendOrderSMS(order),
      notifyPrintQueue(order.id),
    ]);
    results.forEach((r, i) => {
      if (r.status === "rejected") console.error(`[Notification Error ${i}]:`, r.reason);
    });
  }

  return order;
}

async function notifyPrintQueue(orderId) {
  try {
    await kv.lpush("print_queue", orderId);
    await kv.expire("print_queue", 3600);
  } catch (e) {}
}

export async function syncStripeSessions() {
  try {
    const stripe = getStripe();
    if (!stripe) return;

    const sessions = await stripe.checkout.sessions.list({ limit: 100 });
    for (const session of sessions.data) {
      if (session.payment_status !== "paid") continue;
      
      let paymentIntent = null;
      if (session.payment_intent && typeof session.payment_intent === "string") {
        paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent).catch(() => null);
      }
      
      await getOrCreateOrderForSession(session, paymentIntent, false);
    }
  } catch (err) {
    console.error("Stripe sync error:", err);
  }
}
