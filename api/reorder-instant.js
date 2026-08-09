// api/reorder-instant.js
// POST /api/reorder-instant — 1-tap reorder using vaulted Stripe PaymentMethod
//
// PCI-DSS COMPLIANT: Uses Stripe PaymentIntents API with off_session=true and
// vaulted payment_method tokens. No cardholder data ever touches server storage.

import { createClerkClient } from "@clerk/backend";
import { kv } from "@vercel/kv";
import { VALID_ITEMS, TAX_RATE } from "../lib/menu.js";
import { buildOrder, saveOrder } from "../lib/orders.js";
import { sendOrderEmail, sendOrderSMS, sendCustomerReceiptEmail } from "../lib/notifications.js";
import { getStripe } from "../lib/syncStripe.js";

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

const STRIPE_PCT = 0.029;
const STRIPE_FLAT = 0.30;

async function resolveIdentity(req) {
  const authHeader = req.headers["authorization"] ?? "";
  if (authHeader.startsWith("Bearer ")) {
    try {
      const token = authHeader.slice(7);
      const payload = await clerk.verifyToken(token);
      return { type: "user", userId: payload.sub };
    } catch {
      return null;
    }
  }

  const email = req.body?.email ?? req.query?.email;
  if (email) return { type: "guest", email: email.toLowerCase().trim() };
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const identity = await resolveIdentity(req);
    if (!identity) return res.status(401).json({ error: "Unauthorized" });

    const accountId = identity.type === "user" ? identity.userId : `guest:${identity.email}`;
    const { orderId } = req.body;

    if (!orderId) return res.status(400).json({ error: "Missing orderId" });

    // Fetch original order
    const rawOrder = await kv.get(`order:${orderId}`);
    if (!rawOrder) return res.status(404).json({ error: "Original order not found" });

    const originalOrder = typeof rawOrder === "string" ? JSON.parse(rawOrder) : rawOrder;

    // Retrieve vaulted card metadata
    const rawCard = await kv.get(`saved-card:${accountId}`);
    if (!rawCard) {
      return res.status(400).json({ error: "No saved payment method found. Complete a checkout to save a card for 1-tap reordering." });
    }
    const savedCard = typeof rawCard === "string" ? JSON.parse(rawCard) : rawCard;

    // Re-price items from canonical menu
    const validatedItems = [];
    for (const raw of originalOrder.items ?? []) {
      const canonical = VALID_ITEMS[raw.baseId];
      if (canonical) {
        validatedItems.push({
          baseId: raw.baseId,
          name:   canonical.name,
          price:  canonical.price,
          qty:    raw.qty,
          spice:  raw.spice ?? null,
          note:   raw.note  ?? "",
        });
      }
    }

    if (!validatedItems.length) {
      return res.status(400).json({ error: "None of the items from that order are currently available on the menu." });
    }

    const isDelivery        = originalOrder.orderMode === "delivery";
    const subtotal          = validatedItems.reduce((s, i) => s + i.price * i.qty, 0);
    const serverDeliveryFee = isDelivery ? (subtotal >= 99.00 ? 0 : 6.99) : 0;
    const tax               = parseFloat((subtotal * TAX_RATE).toFixed(2));
    const tip               = Number(originalOrder.tip ?? 0);
    const grossBeforeCc     = subtotal + serverDeliveryFee + tax + tip;
    const ccFee             = parseFloat((((grossBeforeCc + STRIPE_FLAT) / (1 - STRIPE_PCT)) - grossBeforeCc).toFixed(2));
    const finalTotal        = grossBeforeCc + ccFee;

    const stripe = getStripe();
    if (!stripe) return res.status(500).json({ error: "Stripe not configured" });

    // Execute off-session PaymentIntent charge
    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create({
        amount:         Math.round(finalTotal * 100),
        currency:       "usd",
        customer:       savedCard.stripeCustomerId ?? undefined,
        payment_method: savedCard.paymentMethodId,
        off_session:    true,
        confirm:        true,
        metadata: {
          orderMode:       isDelivery ? "delivery" : "pickup",
          source:          "1_tap_reorder",
          originalOrderId: orderId,
        },
      });
    } catch (stripeErr) {
      console.error("1-tap reorder payment failed:", stripeErr);
      return res.status(402).json({ error: stripeErr.message || "Payment authentication required. Please check out using Stripe." });
    }

    if (paymentIntent.status !== "succeeded") {
      return res.status(402).json({ error: "Payment was not approved. Please check out using Stripe." });
    }

    // Build new order object
    const newOrder = buildOrder({
      paymentIntent,
      cartItems:           validatedItems,
      specialInstructions: originalOrder.specialInstructions ?? "",
      tip,
      orderMode:           isDelivery ? "delivery" : "pickup",
      deliveryAddress:     originalOrder.deliveryAddress ?? null,
      deliveryFee:         serverDeliveryFee,
    });

    await saveOrder(newOrder);

    // Awaited (not fire-and-forget) — Vercel can freeze/kill the function
    // before an un-awaited async call finishes once the response is sent.
    await Promise.allSettled([
      sendOrderEmail(newOrder),
      sendCustomerReceiptEmail(newOrder),
      sendOrderSMS(newOrder),
      kv.lpush("print_queue", newOrder.id),
    ]);

    return res.status(200).json({ success: true, orderId: newOrder.id, total: newOrder.total });

  } catch (err) {
    console.error("1-tap reorder error:", err);
    return res.status(500).json({ error: err.message });
  }
}
