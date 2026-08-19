// api/orders.js
// GET   /api/orders?date=YYYY-MM-DD   — list orders + daily summary (default: today)
// GET   /api/orders?id=ORDER_ID       — single order detail
// PATCH /api/orders  { id, status?, printed? }  — update an order, fires customer SMS
// POST  /api/orders  { action:"dequeue" }                              — pop next print-queue order ID
// POST  /api/orders  { action:"reprint", id }                          — push order back onto print queue
// POST  /api/orders  { action:"refund", orderId, type, amount?, reason?, itemName?, staffName? } — refund/void
//
// Consolidated from the old orders.js + orders/[id].js + update-order.js +
// refund.js + reprint.js + print-queue.js so the deployment stays under
// Vercel's Hobby-plan 12-serverless-function limit.
//
// All routes protected by MANAGER_SECRET header.

import Stripe from "stripe";
import crypto from "crypto";
import { kv } from "@vercel/kv";
import { buildOrder, saveOrder, getOrder, getOrdersByDate, updateOrder, buildDailySummary, ORDER_STATUS, getNYDateString, getOrdersVersion, publicOrderView } from "../lib/orders.js";
import { sendOrderEmail, sendCustomerReceiptEmail, sendOrderSMS, sendCustomerStatusEmail } from "../lib/notifications.js";
import { getStripe, syncStripeSessions, getOrCreateOrderForSession } from "../lib/syncStripe.js";
import { checkManagerAuth } from "../lib/auth.js";
import { reportPaidOrderBuildFailed } from "../lib/errorAlerts.js";
import { captureServerError } from "../lib/sentry.js";

const VALID_STATUSES = Object.values(ORDER_STATUS);

export default async function handler(req, res) {
  // Public customer routes on OrderSuccess page (no auth required)
  if (req.method === "GET" && (req.query.session_id || req.query.status_id)) {
    return handlePublicGet(req, res);
  }



  const auth = await checkManagerAuth(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  if (req.method === "GET")   return handleGet(req, res);
  if (req.method === "PATCH") return handleUpdate(req, res);
  if (req.method === "POST")  return handlePost(req, res);
  return res.status(405).json({ error: "Method not allowed" });
}

// ── Public GET: customer session lookup & status tracking ──────────
async function handlePublicGet(req, res) {
  const { session_id, status_id } = req.query;

  // Status polling on OrderSuccess page
  if (status_id) {
    try {
      const order = await getOrder(status_id);
      if (!order) return res.status(404).json({ error: "Order not found" });
      return res.status(200).json({
        id:        order.id,
        status:    order.status,
        updatedAt: order.updatedAt,
        createdAt: order.createdAt,
      });
    } catch (err) {
      return res.status(500).json({ error: "Server error" });
    }
  }

  // Session detail lookup on OrderSuccess page (with atomic single-order lock)
  if (session_id) {
    try {
      let orderId = await kv.get(`session:${session_id}`);
      if (orderId) {
        const order = await getOrder(orderId);
        if (order) return res.status(200).json(publicOrderView(order));
      }

      const stripe = getStripe();
      if (!stripe) return res.status(500).json({ error: "Stripe not configured" });
      const session = await stripe.checkout.sessions.retrieve(session_id);
      if (!session) return res.status(404).json({ error: "Session not found" });

      // This route is public and unauthenticated (it runs before the
      // manager-secret check above), so an unpaid session id reaching it is
      // an ordinary occurrence — a customer who abandoned Stripe and hit
      // back, or someone probing. lib/syncStripe.js refuses to build an
      // order from it either way; catching it here keeps that refusal from
      // being misreported as a paid-order-build FAILURE, which would page
      // staff (reportPaidOrderBuildFailed) every time.
      if (session.payment_status !== "paid") {
        return res.status(402).json({ error: "This order hasn't been paid yet." });
      }

      let paymentIntent = null;
      if (session.payment_intent && typeof session.payment_intent === "string") {
        paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent).catch(() => null);
      }

      const order = await getOrCreateOrderForSession(session, paymentIntent, true);
      if (!order) {
        // The customer is looking at a broken success page after already
        // paying — same urgency as the webhook path, just discovered from
        // the browser side instead.
        const err = new Error("getOrCreateOrderForSession returned null (success-page lookup)");
        captureServerError(err, { route: "orders/session-lookup", sessionId: session_id });
        reportPaidOrderBuildFailed({ session, error: err }).catch(() => {});
        return res.status(404).json({ error: "Order build failed" });
      }

      return res.status(200).json(publicOrderView(order));
    } catch (err) {
      captureServerError(err, { route: "orders/session-lookup", sessionId: session_id });
      reportPaidOrderBuildFailed({ session: { id: session_id }, error: err }).catch(() => {});
      return res.status(500).json({ error: "Server error" });
    }
  }

  return res.status(400).json({ error: "Missing session_id or status_id" });
}

async function handleGet(req, res) {
  try {

    // Auto-sync missing paid Stripe sessions into KV asynchronously (non-blocking)
    syncStripeSessions().catch(err => console.error("Async syncStripeSessions error:", err));

    if (req.query.id) {
      const order = await getOrder(req.query.id);
      if (!order) return res.status(404).json({ error: "Order not found" });
      return res.status(200).json(order);
    }

    const date = req.query.date ?? getNYDateString();

    // Cheap polling path: a single kv.get() so staff-dashboard screens can
    // check "did anything change" every few seconds without paying for the
    // full N-individual-kv.get() fetch in getOrdersByDate() each time.
    if (req.query.versionOnly) {
      const version = await getOrdersVersion(date);
      return res.status(200).json({ date, version });
    }

    const orders  = await getOrdersByDate(date);
    const summary = buildDailySummary(orders);
    const version = await getOrdersVersion(date);

    res.setHeader("Cache-Control", "private, max-age=10");
    return res.status(200).json({ orders, summary, date, version });
  } catch (err) {
    console.error("Orders fetch error:", err);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}

// ── PATCH: update status/printed, fires customer SMS on status change ──
const STATUS_SMS = {
  in_progress: (order) =>
    `Rani Mahal: Great news! Your order #${order.id.slice(-6).toUpperCase()} is now being prepared. We'll text you when it's ready. (914) 835-9066 Reply STOP to opt out.`,
  done: (order) =>
    `Rani Mahal: Your order #${order.id.slice(-6).toUpperCase()} is READY for pickup! Come on in — we look forward to seeing you. (914) 835-9066 Reply STOP to opt out.`,
};

async function handleUpdate(req, res) {
  const { id, status, printed } = req.body;
  if (!id) return res.status(400).json({ error: "Order ID required" });

  const fields = {};
  if (status !== undefined) {
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` });
    }
    fields.status = status;
  }
  if (printed !== undefined) {
    fields.printed   = true;
    fields.printedAt = new Date().toISOString();
  }

  try {
    const updated = await updateOrder(id, fields);

    // Awaited (not fire-and-forget) — Vercel can freeze/kill the function
    // before an un-awaited async call finishes once the response is sent.
    // Real order-status SMS to the customer — the actual thing the
    // "text me updates about this order" checkout checkbox promises. Must
    // gate on smsConsent: this used to fire for every order with a phone
    // number, checkbox or not — a live consent violation independent of
    // (and worse than) the TCR paperwork issue.
    if (status && STATUS_SMS[status]) {
      const phone = updated.customerPhone;
      if (phone && updated.smsConsent) {
        await sendCustomerSMS(phone, STATUS_SMS[status](updated))
          .catch(err => console.error("Customer SMS failed:", err));
      }
    }

    // Email needs no separate opt-in — customerEmail is already on the
    // order from Stripe's own checkout page. sendCustomerStatusEmail
    // no-ops on its own for statuses/orders it doesn't apply to.
    if (status) {
      await sendCustomerStatusEmail(updated)
        .catch(err => console.error("Customer status email failed:", err));
    }

    return res.status(200).json({ order: updated });
  } catch (err) {
    console.error("Update order error:", err);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}

async function sendCustomerSMS(to, body) {
  const { TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, TWILIO_FROM } = process.env;
  if (!TWILIO_API_KEY_SID) return;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${TWILIO_API_KEY_SID}:${TWILIO_API_KEY_SECRET}`).toString("base64")}`,
    },
    body: new URLSearchParams({ From: TWILIO_FROM, To: to, Body: body }),
  });
  if (!r.ok) console.error("Twilio error:", await r.text());
}

// ── POST: action-dispatched — dequeue | reprint | refund ──────────
async function handlePost(req, res) {
  const { action } = req.body ?? {};
  if (action === "dequeue")      return handleDequeue(req, res);
  if (action === "reprint")      return handleReprint(req, res);
  if (action === "refund")       return handleRefund(req, res);
  return res.status(400).json({ error: `Unknown action: ${action}` });
}

// Pops one order ID from the print queue — polled every 5s by the local print bridge
async function handleDequeue(req, res) {
  const raw = await kv.rpop("print_queue");
  if (!raw) return res.status(200).json({ orderId: null });
  // Queue values are JSON: { id, mode: "new"|"reprint", ticket? } — see
  // print-bridge.js. @vercel/kv auto-deserializes JSON on read, so `raw`
  // is usually already an object, not a string — JSON.parse-ing it
  // directly throws and was corrupting orderId. A bare orderId string is
  // the pre-ticket-selection queue format; treat it as a full "new" print
  // rather than dropping it, so nothing already queued gets lost.
  let parsed;
  if (typeof raw === "string") {
    try { parsed = JSON.parse(raw); } catch { parsed = { id: raw, mode: "new" }; }
  } else {
    parsed = raw;
  }
  return res.status(200).json({ orderId: parsed.id ?? null, mode: parsed.mode ?? "new", ticket: parsed.ticket ?? null });
}

const REPRINT_TICKETS = new Set(["all", "front", "kitchen", "qr"]);

// Pushes an existing order back onto the print queue — `ticket` scopes a
// reprint to exactly one physical ticket (front/kitchen/qr) instead of
// always reprinting everything, so a manager fixing a wrong QTY on the
// kitchen ticket doesn't also burn a guest receipt and a QR voucher.
async function handleReprint(req, res) {
  const { id, ticket = "all" } = req.body;
  if (!id) return res.status(400).json({ error: "Order ID required" });
  if (!REPRINT_TICKETS.has(ticket)) return res.status(400).json({ error: "Invalid ticket type" });

  // The UI has its own 5s cooldown, but that's client-local React state —
  // it doesn't survive a refresh and doesn't cover a second staff member
  // or a second tab hitting reprint on the same order within the same
  // window. This is the actual guard: two clicks within 5s for the same
  // order+ticket only queue one physical print.
  const reprintLockKey = `reprint-lock:${id}:${ticket}`;
  const reprintAcquired = await kv.set(reprintLockKey, "1", { nx: true, ex: 5 });
  if (!reprintAcquired) {
    return res.status(429).json({ error: "This ticket was just printed. Please wait a moment before reprinting." });
  }

  const order = await getOrder(id);
  if (!order) return res.status(404).json({ error: "Order not found" });

  // "all" (first print, or an explicit full reprint) runs the same full
  // sequence a brand-new order gets, kitchen included twice; a specific
  // ticket name reprints just that one, once.
  const mode = ticket === "all" ? "new" : "reprint";
  await kv.lpush("print_queue", JSON.stringify({ id, mode, ticket }));
  await kv.expire("print_queue", 3600);

  return res.status(200).json({ queued: true, orderId: id, ticket });
}

// Full refunds, partial refunds, item refunds, and voids — all logged to the order record
async function handleRefund(req, res) {
  const { orderId, type, amount, reason, itemName, staffName } = req.body;
  if (!orderId || !type) {
    return res.status(400).json({ error: "orderId and type required" });
  }

  // Same atomic-claim pattern used for checkout vouchers/sessions elsewhere
  // in this codebase — without it, two concurrent refund requests for the
  // same order (a slow UI double-click, two staff tabs) both read the same
  // refundedTotal, both pass the remaining-balance check below, and both
  // succeed at Stripe, cumulatively refunding more than the order's total.
  const lockKey = `refund-lock:${orderId}`;
  const acquired = await kv.set(lockKey, "1", { nx: true, ex: 15 });
  if (!acquired) {
    return res.status(429).json({ error: "A refund is already being processed for this order. Please wait a moment." });
  }

  const order = await getOrder(orderId);
  if (!order) return res.status(404).json({ error: "Order not found" });

  if (!order.stripePaymentId) {
    return res.status(400).json({ error: "No Stripe payment ID on this order" });
  }

  const stripe = getStripe();
  if (!stripe) return res.status(500).json({ error: "Stripe not configured" });

  const logEntry = {
    type,
    amount:    null,
    reason:    reason ?? "No reason given",
    itemName:  itemName ?? null,
    staffName: staffName ?? "Manager",
    timestamp: new Date().toISOString(),
    stripeRefundId: null,
    success: false,
  };

  // Validate against what's actually left on the charge, not the original
  // total — otherwise repeated partial/item refunds can cumulatively exceed
  // what's still refundable.
  const remaining = order.total - (order.refundedTotal ?? 0);

  try {
    let refundAmount = null; // in cents

    if (type === "full") {
      refundAmount = null; // omitting amount = full refund

    } else if (type === "partial") {
      if (!amount || isNaN(amount) || Number(amount) <= 0) {
        return res.status(400).json({ error: "Valid amount required for partial refund" });
      }
      if (Number(amount) > remaining + 0.01) {
        return res.status(400).json({ error: `Amount $${amount} exceeds remaining refundable balance $${remaining.toFixed(2)}` });
      }
      refundAmount = Math.round(Number(amount) * 100);

    } else if (type === "item") {
      if (!itemName) return res.status(400).json({ error: "itemName required for item refund" });
      const item = order.items.find(i => i.name === itemName);
      if (!item) return res.status(400).json({ error: `Item "${itemName}" not found in order` });
      const itemAmount = item.price * item.qty;
      if (itemAmount > remaining + 0.01) {
        return res.status(400).json({ error: `Item amount $${itemAmount.toFixed(2)} exceeds remaining refundable balance $${remaining.toFixed(2)}` });
      }
      refundAmount = Math.round(itemAmount * 100);

    } else if (type === "void") {
      const intent = await stripe.paymentIntents.cancel(order.stripePaymentId);
      logEntry.type   = "void";
      logEntry.amount = order.total;
      logEntry.stripeRefundId = intent.id;
      logEntry.success = true;

      const refundHistory = [...(order.refundHistory ?? []), logEntry];
      await updateOrder(orderId, {
        status:        "refunded",
        refundHistory,
        refundedAt:    new Date().toISOString(),
        refundedTotal: order.total,
      });

      return res.status(200).json({
        success: true,
        type:    "void",
        message: `Order voided successfully`,
        order:   await getOrder(orderId),
      });
    } else {
      return res.status(400).json({ error: `Unknown refund type: ${type}` });
    }

    const refundParams = {
      payment_intent: order.stripePaymentId,
      reason: mapReason(reason),
      metadata: {
        orderId,
        type,
        staffName: staffName ?? "Manager",
        itemName:  itemName ?? "",
        internalReason: reason ?? "",
      },
    };
    if (refundAmount) refundParams.amount = refundAmount;

    const stripeRefund = await stripe.refunds.create(refundParams);

    const amountRefunded = stripeRefund.amount / 100;
    logEntry.amount         = amountRefunded;
    logEntry.stripeRefundId = stripeRefund.id;
    logEntry.success        = true;

    const prevRefunded = order.refundedTotal ?? 0;
    const newRefunded  = prevRefunded + amountRefunded;
    const isFullyRefunded = newRefunded >= order.total - 0.01;

    const refundHistory = [...(order.refundHistory ?? []), logEntry];
    await updateOrder(orderId, {
      status:        isFullyRefunded ? "refunded" : order.status,
      refundHistory,
      refundedTotal: newRefunded,
      refundedAt:    isFullyRefunded ? new Date().toISOString() : (order.refundedAt ?? null),
    });

    return res.status(200).json({
      success:        true,
      type,
      amountRefunded,
      totalRefunded:  newRefunded,
      isFullyRefunded,
      stripeRefundId: stripeRefund.id,
      order:          await getOrder(orderId),
    });

  } catch (err) {
    logEntry.success      = false;
    logEntry.errorMessage = err.message;
    const refundHistory   = [...(order.refundHistory ?? []), logEntry];
    await updateOrder(orderId, { refundHistory });

    console.error("Refund error:", err);

    if (err.type === "StripeInvalidRequestError") {
      if (err.message.includes("already been refunded")) {
        return res.status(400).json({ error: "This charge has already been fully refunded." });
      }
      if (err.message.includes("can only refund")) {
        return res.status(400).json({ error: "Void failed — payment already settled. Use a refund instead." });
      }
    }

    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}

function mapReason(reason) {
  if (!reason) return "requested_by_customer";
  const r = reason.toLowerCase();
  if (r.includes("duplicate"))  return "duplicate";
  if (r.includes("fraud"))      return "fraudulent";
  return "requested_by_customer";
}
