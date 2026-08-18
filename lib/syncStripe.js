import Stripe from "stripe";
import { kv } from "@vercel/kv";
import { buildOrder, saveOrder, getOrder, getNYDateString, mintVoucherToken } from "./orders.js";
import { sendOrderEmail, sendCustomerReceiptEmail, sendOrderSMS, sendEmail, recordCampaignConverted } from "./notifications.js";
import { sendNewOrderPush } from "./push.js";

const BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL || "https://ranimahal.cc/order").replace(/\/$/, "");

/**
 * A referred friend's order just completed — mint the referrer their own
 * 10% thank-you voucher and email it. Best-effort: never blocks or affects
 * the friend's order that's already been created.
 */
async function creditReferrer(referrerOrderId, referredOrder) {
  const referrerOrder = await getOrder(referrerOrderId);
  if (!referrerOrder?.customerEmail) return;

  // Refuse to reward a self-referral. Without this, a customer can invite
  // themselves with their own order's token, get 10% off, AND be credited
  // another 10% voucher for it — then repeat off the new order's token,
  // compounding into a permanent discount. Match on either identity.
  const sameEmail = referrerOrder.customerEmail && referredOrder.customerEmail &&
    referrerOrder.customerEmail.toLowerCase().trim() === referredOrder.customerEmail.toLowerCase().trim();
  const sameAccount = referrerOrder.clerkUserId && referredOrder.clerkUserId &&
    referrerOrder.clerkUserId === referredOrder.clerkUserId;
  if (sameEmail || sameAccount) {
    console.warn(`[referral] self-referral blocked: order ${referredOrder.id} referred by own order ${referrerOrderId}`);
    return;
  }

  const voucher = await mintVoucherToken({
    discountPct: 0.10,
    ttlDays: 30,
    meta: { source: "referral-reward", referredOrderId: referredOrder.id },
  });

  const link = `${BASE_URL}/?reorder=${voucher.token}`;
  const name = referrerOrder.customerName && referrerOrder.customerName !== "Guest" ? referrerOrder.customerName : "there";
  await sendEmail({
    to: referrerOrder.customerEmail,
    subject: "🎉 Your friend just ordered — here's your 10% off",
    html: `
    <div style="font-family:'Inter',sans-serif;background:#080706;padding:32px 16px;color:#FAF6EF;">
      <div style="max-width:480px;margin:0 auto;background:#12100e;border:1px solid rgba(232,168,46,0.35);border-radius:18px;padding:32px 24px;text-align:center;">
        <p style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#E8A82E;font-weight:700;margin:0 0 12px;">Referral Reward</p>
        <h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 14px;">Thanks for spreading the word, ${name}!</h1>
        <p style="font-size:14px;color:#B8A995;line-height:1.6;margin:0 0 24px;">A friend you invited just placed their first order. As a thank-you, here's 10% off your next one.</p>
        <a href="${link}" style="display:inline-block;background:#E8A82E;color:#080706;font-weight:700;padding:14px 28px;border-radius:24px;text-decoration:none;font-size:14px;">Redeem 10% Off →</a>
        <p style="font-size:11px;color:#8A7560;margin:20px 0 0;">Valid for 30 days · one-time use</p>
      </div>
    </div>`,
  });
}

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

  // NEVER create an order for a session that hasn't actually been paid.
  //
  // This is the single chokepoint every caller funnels through (the Stripe
  // webhook, the success-page lookup in api/orders.js, and
  // syncStripeSessions below), so the guard belongs here rather than in any
  // one caller. Without it, the PUBLIC, UNAUTHENTICATED success-page path
  // (api/orders.js's handlePublicGet, which runs BEFORE the manager-secret
  // check) would build a real order from any session id it was handed —
  // and with shouldNotify=true that means a kitchen ticket pushed to
  // print_queue, a staff SMS, and a customer receipt, all for food nobody
  // paid for. A session id is trivially obtainable without paying:
  // POST /api/create-checkout returns { url }, and the Stripe checkout URL
  // embeds the session id.
  //
  // Only "paid" is accepted. Checkout Sessions for card payments are marked
  // paid before the customer is redirected to success_url, so the legitimate
  // flow is unaffected; "no_payment_required" is deliberately NOT allowed
  // since a zero-total order should never reach the kitchen either.
  if (session.payment_status !== "paid") {
    console.warn(`[syncStripe] Refusing to create order for unpaid session ${session.id} (payment_status=${session.payment_status})`);
    return null;
  }

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
    // Lock-holder still hasn't finished after the poll window — do not fall
    // through to creating a second order for this session. Bail and let the
    // caller (webhook retry, or the next background sync pass) try again.
    return null;
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

  let scheduledFor = null;
  if (session.metadata?.scheduledFor) {
    try { scheduledFor = JSON.parse(session.metadata.scheduledFor); } catch {}
  }

  const createdAt = session.created ? new Date(session.created * 1000) : new Date();

  // SMS marketing consent was captured (if at all) before this session
  // existed — at the fulfillment-sheet phone step — and lives on the
  // draft:{session.id} record create-checkout.js already writes for
  // abandoned-cart recovery (see api/create-checkout.js's draftCart).
  // Stripe's own metadata has no room for it (it wasn't known yet when the
  // session was created), so read it from the same draft record this
  // function is about to mark "paid" a few lines down. Best-effort: a
  // missing/expired draft just means no consent on file, which is the
  // correct fail-safe default for anything that will later gate SMS sends.
  let draftForConsent = null;
  try {
    const rawDraft = await kv.get(`draft:${session.id}`);
    draftForConsent = typeof rawDraft === "string" ? JSON.parse(rawDraft) : rawDraft;
  } catch {}

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
    scheduledFor,
    smsConsent:          !!draftForConsent?.smsConsent,
    smsMarketingConsent: !!draftForConsent?.smsMarketingConsent,
  });

  // Stripe's actual charged amount includes the CC processing fee line item,
  // which buildOrder() has no knowledge of — capture the gap as order.ccFee
  // so receipts/printouts can show a breakdown that actually sums to total.
  const stripeAmt = session.amount_total ? parseFloat((session.amount_total / 100).toFixed(2)) : null;
  if (stripeAmt) {
    const preFeeTotal = order.subtotal + order.deliveryFee + order.tax + order.tip;
    const ccFee = parseFloat((stripeAmt - preFeeTotal).toFixed(2));
    order.ccFee = ccFee > 0 ? ccFee : 0;
    order.total = stripeAmt;
  }
  order.createdAt = createdAt.toISOString();
  order.updatedAt = createdAt.toISOString();
  order.date      = getNYDateString(createdAt);

  // 6. Save order & register session ID atomically
  await Promise.all([
    saveOrder(order),
    kv.set(`session:${session.id}`, order.id, { ex: 60 * 60 * 24 * 365 }),
  ]);
  console.log(`[Order Lock] Single Order Created & Saved: ${order.id} for session ${session.id}`);

  // Mark reorder/voucher token as used, and credit the referrer if this was
  // a referral-sourced voucher (fires exactly once — this block only runs
  // when the order is first created for this session).
  if (session.metadata?.reorderToken) {
    try {
      const tokenKey = `reorder-token:${session.metadata.reorderToken}`;
      const rawToken = await kv.get(tokenKey);
      if (rawToken) {
        const tData = typeof rawToken === "string" ? JSON.parse(rawToken) : rawToken;
        tData.status = "used";
        tData.redeemedAt = new Date().toISOString();
        tData.redeemedByOrderId = order.id;
        await kv.set(tokenKey, JSON.stringify(tData), { ex: 1296000 }); // keep same 15-day TTL

        if (tData.meta?.source) {
          await recordCampaignConverted(tData.meta.source, order.total).catch(e =>
            console.error("Failed to record campaign conversion:", e));
        }

        if (tData.meta?.source === "referral" && tData.meta?.referrerOrderId) {
          await creditReferrer(tData.meta.referrerOrderId, order).catch(e =>
            console.error("Failed to credit referrer:", e));
        }
      }
    } catch (e) {
      console.error("Failed to mark reorder token as used:", e);
    }
  }

  // Mark corresponding draft cart as paid
  try {
    const draftStr = await kv.get(`draft:${session.id}`);
    if (draftStr) {
      const draft = typeof draftStr === "string" ? JSON.parse(draftStr) : draftStr;
      draft.status = "paid";
      if (session.customer_details?.name) draft.customerName = session.customer_details.name;
      draft.customerPhone = session.customer_details?.phone ?? null;
      await kv.set(`draft:${session.id}`, JSON.stringify(draft), { ex: 2592000 });
    }
  } catch (e) {
    console.error("Failed to update draft cart to paid:", e);
  }

  // 7. Dispatch notifications once if requested. Staff/customer emails and
  // the staff SMS still fire immediately for a scheduled order (everyone
  // should know it exists right away) — only the kitchen print ticket is
  // held back, since printing it now would have the kitchen firing a lunch
  // order at breakfast. The print happens when the cron job promotes the
  // order to "new" at its scheduled time (api/cron/promote-scheduled-orders.js).
  if (shouldNotify) {
    const jobs = [sendOrderEmail(order), sendCustomerReceiptEmail(order), sendOrderSMS(order)];
    if (order.status !== "scheduled") {
      jobs.push(notifyPrintQueue(order.id));
      jobs.push(sendNewOrderPush({
        orderId: order.id,
        customerName: order.customerName,
        total: order.total,
        itemCount: (order.items || []).reduce((s, i) => s + (i.qty || 1), 0),
      }));
    }
    const results = await Promise.allSettled(jobs);
    results.forEach((r, i) => {
      if (r.status === "rejected") console.error(`[Notification Error ${i}]:`, r.reason);
    });
  }

  return order;
}

async function notifyPrintQueue(orderId) {
  try {
    // JSON, not a bare id — print-bridge.js's queue entries carry a mode
    // so a manager's later reprint request can target one specific ticket
    // (see api/orders.js handleReprint). A fresh order is always the full
    // "new" sequence (front + kitchen x2 + qr).
    await kv.lpush("print_queue", JSON.stringify({ id: orderId, mode: "new" }));
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
