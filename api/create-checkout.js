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
import { VALID_ITEMS, TAX_RATE } from "../lib/menu.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const MAX_QTY_PER_LINE = 25;
// Stripe's card rate: 2.9% + $0.30 — gross-up so the restaurant nets subtotal+tax exactly
const STRIPE_PCT = 0.029;
const STRIPE_FLAT = 0.30;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { items, specialInstructions, clerkUserId, guestEmail, tip: rawTip } = req.body;

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

    const subtotal = validatedItems.reduce((s, i) => s + i.price * i.qty, 0);
    const tax      = parseFloat((subtotal * TAX_RATE).toFixed(2));
    // Tip is customer-chosen but still bounded — guards against a broken/garbage
    // client value (NaN, negative, absurd) reaching Stripe. Generous cap, not a
    // meaningful business limit: nobody is tipping more than 2x their order.
    const tip      = Math.min(Math.max(0, Number(rawTip) || 0), subtotal * 2);
    // Every order here is paid by card, so the processing fee always applies.
    // Gross-up ensures Stripe's cut of the grossed-up total exactly equals the fee added.
    const ccFee    = parseFloat((((subtotal + tax + tip + STRIPE_FLAT) / (1 - STRIPE_PCT)) - (subtotal + tax + tip)).toFixed(2));

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

    // Encode cart as metadata on the session (max 500 chars per value)
    // Split into chunks if needed
    const cartJson = JSON.stringify(validatedItems);
    const metaCart = cartJson.length <= 500
      ? { cart: cartJson }
      : { cart_0: cartJson.slice(0, 500), cart_1: cartJson.slice(500) };

    // Idempotency key: same cart + customer + minute → same Stripe session,
    // so a double-click or a network retry can't create two checkout sessions.
    const idempotencyKey = crypto
      .createHash("sha256")
      .update(JSON.stringify({ cartJson, clerkUserId, guestEmail, minute: Math.floor(Date.now() / 60000) }))
      .digest("hex");

    const session = await stripe.checkout.sessions.create({
      mode:                 "payment",
      payment_method_types: ["card"],
      line_items:           lineItems,
      automatic_tax:        { enabled: false }, // we handle tax display client-side
      phone_number_collection: { enabled: true },
      custom_text: {
        submit: { message: "Your order will be prepared fresh at Rani Mahal." },
      },
      metadata: {
        ...metaCart,
        specialInstructions: (specialInstructions ?? "").slice(0, 500),
        clerkUserId:         (clerkUserId  ?? "").slice(0, 500),
        guestEmail:          (guestEmail   ?? "").slice(0, 500),
        tip:                 tip.toFixed(2),
        source: "online_ordering",
      },
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/order-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${process.env.NEXT_PUBLIC_BASE_URL}`,
    }, { idempotencyKey });

    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error("Checkout error:", err);
    return res.status(500).json({ error: err.message });
  }
}
