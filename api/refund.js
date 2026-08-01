// api/refund.js
// POST /api/refund
// Handles full refunds, partial refunds, item refunds, and voids
// All actions logged to the order record in KV

import Stripe from "stripe";
import { getOrder, updateOrder } from "../lib/orders.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.headers["x-manager-secret"] !== process.env.MANAGER_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { orderId, type, amount, reason, itemName, staffName } = req.body;
  // type: "full" | "partial" | "item" | "void"

  if (!orderId || !type) {
    return res.status(400).json({ error: "orderId and type required" });
  }

  const order = await getOrder(orderId);
  if (!order) return res.status(404).json({ error: "Order not found" });

  if (!order.stripePaymentId) {
    return res.status(400).json({ error: "No Stripe payment ID on this order" });
  }

  // Build audit log entry
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
      // Full refund — Stripe refunds total charge
      refundAmount = null; // omitting amount = full refund

    } else if (type === "partial") {
      // Partial refund — specific dollar amount
      if (!amount || isNaN(amount) || Number(amount) <= 0) {
        return res.status(400).json({ error: "Valid amount required for partial refund" });
      }
      if (Number(amount) > order.total) {
        return res.status(400).json({ error: `Amount $${amount} exceeds order total $${order.total.toFixed(2)}` });
      }
      refundAmount = Math.round(Number(amount) * 100); // convert to cents

    } else if (type === "item") {
      // Item-level refund — refund the price of a specific item
      if (!itemName) return res.status(400).json({ error: "itemName required for item refund" });
      const item = order.items.find(i => i.name === itemName);
      if (!item) return res.status(400).json({ error: `Item "${itemName}" not found in order` });
      refundAmount = Math.round(item.price * item.qty * 100);

    } else if (type === "void") {
      // Void — cancel payment intent before settlement
      // Only works if payment is not yet captured/settled
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

    // Execute Stripe refund
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

    // Calculate total refunded so far
    const prevRefunded = order.refundedTotal ?? 0;
    const newRefunded  = prevRefunded + amountRefunded;
    const isFullyRefunded = newRefunded >= order.total - 0.01; // allow for rounding

    // Update order record
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
    // Log failed attempt
    logEntry.success      = false;
    logEntry.errorMessage = err.message;
    const refundHistory   = [...(order.refundHistory ?? []), logEntry];
    await updateOrder(orderId, { refundHistory });

    console.error("Refund error:", err);

    // Stripe-specific error messages
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

// Map internal reason strings to Stripe's accepted enum values
function mapReason(reason) {
  if (!reason) return "requested_by_customer";
  const r = reason.toLowerCase();
  if (r.includes("duplicate"))  return "duplicate";
  if (r.includes("fraud"))      return "fraudulent";
  return "requested_by_customer";
}
