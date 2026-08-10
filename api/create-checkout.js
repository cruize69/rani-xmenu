// api/create-checkout.js
// POST { items: [...], specialInstructions: "..." }
// Returns { url } — redirect customer to Stripe hosted checkout
//
// SECURITY: never trust item.price/item.qty/ccFee from the client — a user can
// rewrite the request body in devtools before it reaches this endpoint. Every
// line item is re-priced here from VALID_ITEMS (the same canonical menu the
// storefront renders from), and totals/fees are recomputed server-side.

import Stripe from "stripe";
import crypto from "crypto";
import { createClerkClient } from "@clerk/backend";
import { VALID_ITEMS, TAX_RATE } from "../lib/menu.js";
import { getDeliveryZoneForZip } from "../src/utils/deliveryConfig.js";

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

// A client-supplied clerkUserId is just a string an attacker can set to
// anyone's (non-secret) Clerk user ID — it must never be trusted as-is.
// It's only used to link an order/saved-card to an account, so verify it
// against the caller's own JWT and ignore it entirely if that fails.
async function resolveVerifiedClerkUserId(req) {
  const authHeader = req.headers["authorization"] ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  try {
    const payload = await clerk.verifyToken(authHeader.slice(7));
    return payload.sub;
  } catch {
    return null;
  }
}

const MAX_QTY_PER_LINE = 25;
const STRIPE_PCT = 0.029;
const STRIPE_FLAT = 0.30;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY || 
                            process.env.STRIPE_LIVE_SECRET_KEY || 
                            process.env.STRIPE_KEY || 
                            process.env.STRIPE_SECRET;

    if (!stripeSecretKey) {
      console.error("Stripe Secret Key missing in process.env");
      return res.status(500).json({ error: "Stripe Secret Key is not configured. Please check server settings." });
    }

    const stripe = new Stripe(stripeSecretKey);
    const { items, specialInstructions, guestEmail, tip: rawTip, orderMode = "pickup", deliveryAddress } = req.body || {};
    const clerkUserId = await resolveVerifiedClerkUserId(req);

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "No items in cart" });
    }

    // Re-price every line item from the canonical menu — client-submitted
    // name/price/qty are never trusted.
    const validatedItems = [];
    for (const raw of items) {
      const canonical = VALID_ITEMS[raw?.baseId];
      if (!canonical) {
        return res.status(400).json({ error: `Unknown item: ${raw?.baseId ?? "(missing id)"}` });
      }
      const qty = Number.isInteger(raw.qty) ? raw.qty : Math.round(Number(raw.qty));
      if (!Number.isFinite(qty) || qty < 1 || qty > MAX_QTY_PER_LINE) {
        return res.status(400).json({ error: `Invalid quantity for ${canonical.name}` });
      }
      validatedItems.push({
        baseId: raw.baseId,
        name:   canonical.name,
        price:  canonical.price,
        qty,
        spice:  typeof raw.spice === "string" ? raw.spice.slice(0, 40)  : null,
        note:   typeof raw.note  === "string" ? raw.note.slice(0, 200)  : "",
      });
    }

    const isDelivery        = orderMode === "delivery";
    const subtotal          = validatedItems.reduce((s, i) => s + i.price * i.qty, 0);

    if (isDelivery) {
      const zone = getDeliveryZoneForZip(deliveryAddress?.zip);
      const zoneMin = zone?.minOrder || 50.00;
      if (subtotal < zoneMin) {
        return res.status(400).json({ error: `Delivery to ${deliveryAddress?.city || "your area"} requires a minimum food subtotal of $${zoneMin.toFixed(2)}.` });
      }
    }

    const serverDeliveryFee = isDelivery ? (subtotal >= 99.00 ? 0 : 6.99) : 0;
    const tax               = parseFloat((subtotal * TAX_RATE).toFixed(2));
    const tip               = Math.min(Math.max(0, Number(rawTip) || 0), subtotal * 2);
    const grossBeforeCc     = subtotal + serverDeliveryFee + tax + tip;
    const ccFee             = parseFloat((((grossBeforeCc + STRIPE_FLAT) / (1 - STRIPE_PCT)) - grossBeforeCc).toFixed(2));

    // Build Stripe line items from validated data
    const lineItems = validatedItems.map(item => ({
      price_data: {
        currency: "usd",
        product_data: {
          name: item.name,
          description: [
            item.spice ? `Spice: ${item.spice}` : null,
            item.note  ? `Note: ${item.note}`   : null,
          ].filter(Boolean).join(" · ") || undefined,
        },
        unit_amount: Math.round(item.price * 100),
      },
      quantity: item.qty,
    }));

    // Add Delivery fee if applicable
    if (serverDeliveryFee > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: "Delivery Fee" },
          unit_amount: Math.round(serverDeliveryFee * 100),
        },
        quantity: 1,
      });
    }

    // Add tax as a separate line item — it was already being folded into the
    // CC fee gross-up math below, but was never actually added to lineItems,
    // so it was computed and stored on the saved order while never actually
    // being charged to the customer.
    if (tax > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: "Tax" },
          unit_amount: Math.round(tax * 100),
        },
        quantity: 1,
      });
    }

    // Add tip as a separate line item if the customer chose one
    if (tip > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: "Tip" },
          unit_amount: Math.round(tip * 100),
        },
        quantity: 1,
      });
    }

    // Add CC processing fee as a separate line item if applicable
    if (ccFee > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: "Credit Card Processing Fee" },
          unit_amount: Math.round(ccFee * 100),
        },
        quantity: 1,
      });
    }

    // Encode cart as metadata on the session (max 500 bytes per value)
    const cartJson = JSON.stringify(validatedItems);
    const cartByteLen = Buffer.byteLength(cartJson, "utf8");
    const metaCart = cartByteLen <= 500
      ? { cart: cartJson }
      : { cart_0: cartJson.slice(0, 450), cart_1: cartJson.slice(450) };

    const idempotencyKey = crypto
      .createHash("sha256")
      .update(JSON.stringify({ cartJson, clerkUserId, guestEmail, orderMode, minute: Math.floor(Date.now() / 60000) }))
      .digest("hex");

    const reqOrigin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : null);
    const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || reqOrigin || "https://ranimahal.food").replace(/\/$/, "");

    const session = await stripe.checkout.sessions.create({
      mode:                 "payment",
      payment_method_types: ["card"],
      line_items:           lineItems,
      automatic_tax:        { enabled: false },
      phone_number_collection: { enabled: true },
      payment_intent_data:  { setup_future_usage: "off_session" },
      custom_text: {
        submit: { message: isDelivery ? "Your order will be prepared and delivered fresh." : "Your order will be prepared fresh at Rani Mahal." },
      },
      metadata: {
        ...metaCart,
        specialInstructions: (specialInstructions ?? "").slice(0, 500),
        clerkUserId:         (clerkUserId  ?? "").slice(0, 500),
        guestEmail:          (guestEmail   ?? "").slice(0, 500),
        tip:                 tip.toFixed(2),
        orderMode:           isDelivery ? "delivery" : "pickup",
        deliveryFee:         serverDeliveryFee.toFixed(2),
        deliveryAddress:     isDelivery && deliveryAddress ? JSON.stringify(deliveryAddress).slice(0, 500) : "",
        source:              "online_ordering",
      },
      success_url: `${baseUrl}/order-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${baseUrl}`,
    }, { idempotencyKey });

    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error("Checkout error:", err);
    return res.status(500).json({ error: "Failed to create checkout session. Please try again." });
  }
}
