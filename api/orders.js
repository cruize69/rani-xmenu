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
import { kv } from "@vercel/kv";
import { getOrder, getOrdersByDate, updateOrder, buildDailySummary, ORDER_STATUS } from "../lib/orders.js";
import { sendCustomerStatusEmail } from "../lib/notifications.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const VALID_STATUSES = Object.values(ORDER_STATUS);

export default async function handler(req, res) {
  if (req.headers["x-manager-secret"] !== process.env.MANAGER_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method === "GET")   return handleGet(req, res);
  if (req.method === "PATCH") return handleUpdate(req, res);
  if (req.method === "POST")  return handlePost(req, res);
  return res.status(405).json({ error: "Method not allowed" });
}

// ── GET: list-by-date, or single order via ?id= ───────────────────
async function handleGet(req, res) {
  try {
    if (req.query.id) {
      const order = await getOrder(req.query.id);
      if (!order) return res.status(404).json({ error: "Order not found" });
      return res.status(200).json(order);
    }

    const date    = req.query.date ?? new Date().toISOString().slice(0, 10);
    const orders  = await getOrdersByDate(date);
    const summary = buildDailySummary(orders);

    res.setHeader("Cache-Control", "private, max-age=10");
    return res.status(200).json({ orders, summary, date });
  } catch (err) {
    console.error("Orders fetch error:", err);
    return res.status(500).json({ error: err.message });
  }
}

// ── PATCH: update status/printed, fires customer SMS on status change ──
const STATUS_SMS = {
  in_progress: (order) =>
    `Rani Mahal: Great news! Your order #${order.id.slice(-6).toUpperCase()} is now being prepared. We'll text you when it's ready. (914) 835-9066`,
  done: (order) =>
    `Rani Mahal: Your order #${order.id.slice(-6).toUpperCase()} is READY for pickup! Come on in — we look forward to seeing you. (914) 835-9066`,
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
    if (status && STATUS_SMS[status]) {
      const raw = await kv.get(`notify:${id}`).catch(() => null);
      if (raw) {
        const { phone } = typeof raw === "string" ? JSON.parse(raw) : raw;
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
    return res.status(404).json({ error: err.message });
  }
}

async function sendCustomerSMS(to, body) {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM } = process.env;
  if (!TWILIO_ACCOUNT_SID) return;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64")}`,
    },
    body: new URLSearchParams({ From: TWILIO_FROM, To: to, Body: body }),
  });
  if (!r.ok) console.error("Twilio error:", await r.text());
}

// ── POST: action-dispatched — dequeue | reprint | refund ──────────
async function handlePost(req, res) {
  const { action } = req.body ?? {};
  if (action === "dequeue") return handleDequeue(req, res);
  if (action === "reprint") return handleReprint(req, res);
  if (action === "refund")  return handleRefund(req, res);
  return res.status(400).json({ error: `Unknown action: ${action}` });
}

// Pops one order ID from the print queue — polled every 5s by the local print bridge
async function handleDequeue(req, res) {
  const orderId = await kv.rpop("print_queue");
  return res.status(200).json({ orderId: orderId ?? null });
}

// Pushes an existing order back onto the print queue
async function handleReprint(req, res) {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: "Order ID required" });

  const order = await getOrder(id);
  if (!order) return res.status(404).json({ error: "Order not found" });

  await kv.lpush("print_queue", id);
  await kv.expire("print_queue", 3600);

  return res.status(200).json({ queued: true, orderId: id });
}

// Full refunds, partial refunds, item refunds, and voids — all logged to the order record
async function handleRefund(req, res) {
  const { orderId, type, amount, reason, itemName, staffName } = req.body;
  if (!orderId || !type) {
    return res.status(400).json({ error: "orderId and type required" });
  }

  const order = await getOrder(orderId);
  if (!order) return res.status(404).json({ error: "Order not found" });

  if (!order.stripePaymentId) {
    return res.status(400).json({ error: "No Stripe payment ID on this order" });
  }

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

  try {
    let refundAmount = null; // in cents

    if (type === "full") {
      refundAmount = null; // omitting amount = full refund

    } else if (type === "partial") {
      if (!amount || isNaN(amount) || Number(amount) <= 0) {
        return res.status(400).json({ error: "Valid amount required for partial refund" });
      }
      if (Number(amount) > order.total) {
        return res.status(400).json({ error: `Amount $${amount} exceeds order total $${order.total.toFixed(2)}` });
      }
      refundAmount = Math.round(Number(amount) * 100);

    } else if (type === "item") {
      if (!itemName) return res.status(400).json({ error: "itemName required for item refund" });
      const item = order.items.find(i => i.name === itemName);
      if (!item) return res.status(400).json({ error: `Item "${itemName}" not found in order` });
      refundAmount = Math.round(item.price * item.qty * 100);

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

    return res.status(500).json({ error: err.message });
  }
}

function mapReason(reason) {
  if (!reason) return "requested_by_customer";
  const r = reason.toLowerCase();
  if (r.includes("duplicate"))  return "duplicate";
  if (r.includes("fraud"))      return "fraudulent";
  return "requested_by_customer";
}
