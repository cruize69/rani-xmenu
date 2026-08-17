// api/create-catering-checkout.js
// POST { itemId, guests, guestEmail, guestPhone, eventDate, orderMode, deliveryAddress, notes, utm }
// Returns { url } — redirect customer to Stripe's hosted checkout page.
//
// Deliberately separate from api/create-checkout.js rather than a branch
// inside it: the retail endpoint's shape (multi-item cart, tip, vouchers,
// welcome/member discounts, scheduled-order hours validation) doesn't apply
// to catering at all, and trying to make one endpoint cover both would mean
// either catering inheriting retail concepts it explicitly opts out of
// (catering is flat-rate — see lib/menu.js's CATERING_ITEM_IDS discount
// exclusion) or the retail endpoint growing a pile of `if (isCatering)`
// branches. A single real package line item, no cart, no vouchers, no tip —
// this endpoint is small on purpose.
//
// SECURITY: same rule as create-checkout.js — price is never trusted from
// the client. itemId is re-priced from CATERING_ITEMS every time.

import Stripe from "stripe";
import crypto from "crypto";
import { createClerkClient } from "@clerk/backend";
import { VALID_ITEMS, TAX_RATE, CATERING_ITEM_IDS, CATERING_MINIMUMS } from "../lib/menu.js";
import { getDeliveryZoneForZip } from "../src/utils/deliveryConfig.js";
import { reportCheckoutError } from "../lib/errorAlerts.js";
import { captureServerError } from "../lib/sentry.js";
import { overLimit, clientIp } from "../lib/rateLimit.js";
import { sanitizeDeliveryAddress } from "../lib/sanitize.js";

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

// Same verification pattern as create-checkout.js — a client-supplied
// clerkUserId is just a string an attacker can set to anyone's (non-secret)
// Clerk user ID, so it's only trusted after verifying it against the
// caller's own JWT.
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

// Headcount is the guest count, not a plate count — matches
// MAX_CATERING_QTY_PER_LINE in create-checkout.js/lib/menu.js.
const MAX_CATERING_GUESTS = 500;
const STRIPE_PCT = 0.029;
const STRIPE_FLAT = 0.30;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (await overLimit(`catering-checkout-rl:ip:${clientIp(req)}`, 20, 60 * 60)) {
    return res.status(429).json({ error: "Too many checkout attempts. Please wait a moment and try again." });
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

    const {
      itemId,
      guests: rawGuests,
      guestEmail,
      guestPhone,
      eventDate: rawEventDate,
      orderMode = "pickup",
      deliveryAddress: rawDeliveryAddress,
      notes: rawNotes,
      utm,
      returnPath: rawReturnPath,
    } = req.body || {};

    // Only ever redirect back to a real /catering page — a client-supplied
    // path could otherwise be used as an open redirect. Falls back to the
    // main catering page for anything that doesn't match (including a
    // missing value, or someone hitting this endpoint directly).
    const returnPath = typeof rawReturnPath === "string" && /^\/catering(\/[a-z-]+)?$/.test(rawReturnPath)
      ? rawReturnPath
      : "/catering";

    const canonical = VALID_ITEMS[itemId];
    if (!canonical || !CATERING_ITEM_IDS.has(itemId)) {
      return res.status(400).json({ error: `Unknown catering package: ${itemId ?? "(missing id)"}` });
    }

    const guests = Number.isInteger(rawGuests) ? rawGuests : Math.round(Number(rawGuests));
    const minimum = CATERING_MINIMUMS[itemId] ?? 1;
    if (!Number.isFinite(guests) || guests < minimum || guests > MAX_CATERING_GUESTS) {
      return res.status(400).json({ error: `Guest count for ${canonical.name} must be between ${minimum} and ${MAX_CATERING_GUESTS}.` });
    }

    if (typeof guestEmail !== "string" || !guestEmail.includes("@")) {
      return res.status(400).json({ error: "A valid email is required so we can send your confirmation." });
    }

    const isDelivery = orderMode === "delivery";
    const deliveryAddress = sanitizeDeliveryAddress(rawDeliveryAddress);
    if (isDelivery) {
      if (!deliveryAddress?.zip) {
        return res.status(400).json({ error: "A delivery address is required." });
      }
      // Catering's own guest minimums always clear the site's $99
      // free-delivery threshold (cheapest package: 15 guests x $19.99 =
      // $299.85), so unlike create-checkout.js there's no per-zone dollar
      // minimum to enforce here — only that the zip is somewhere we
      // actually deliver at all.
      const zone = getDeliveryZoneForZip(deliveryAddress.zip);
      if (!zone) {
        return res.status(400).json({ error: `We don't currently deliver catering to ${deliveryAddress.city || "that area"}. Pickup at 327 Mamaroneck Ave is always available.` });
      }
    }

    const eventDate = typeof rawEventDate === "string" ? rawEventDate.slice(0, 20) : "";
    const notes = typeof rawNotes === "string" ? rawNotes.slice(0, 300) : "";
    const clerkUserId = await resolveVerifiedClerkUserId(req);

    // Catering line items are always full price — see lib/menu.js's
    // CATERING_ITEM_IDS discount-exclusion comment in create-checkout.js.
    // There's no voucher/welcome/member discount path in this endpoint at
    // all (not just "skipped" — it doesn't exist here), which is the whole
    // reason this is its own file rather than a branch in the retail one.
    const price = canonical.price;
    const subtotal = parseFloat((price * guests).toFixed(2));
    const serverDeliveryFee = isDelivery && subtotal < 99 ? 6.99 : 0; // structurally mirrors create-checkout.js; never actually fires given catering's own minimums
    const tax = parseFloat((subtotal * TAX_RATE).toFixed(2));
    const grossBeforeCc = subtotal + serverDeliveryFee + tax;
    const ccFee = parseFloat((((grossBeforeCc + STRIPE_FLAT) / (1 - STRIPE_PCT)) - grossBeforeCc).toFixed(2));

    const lineItems = [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: canonical.name,
            description: eventDate ? `Event date: ${eventDate}` : undefined,
          },
          unit_amount: Math.round(price * 100),
        },
        quantity: guests,
      },
    ];
    if (serverDeliveryFee > 0) {
      lineItems.push({
        price_data: { currency: "usd", product_data: { name: "Delivery Fee" }, unit_amount: Math.round(serverDeliveryFee * 100) },
        quantity: 1,
      });
    }
    if (tax > 0) {
      lineItems.push({
        price_data: { currency: "usd", product_data: { name: "Tax" }, unit_amount: Math.round(tax * 100) },
        quantity: 1,
      });
    }
    if (ccFee > 0) {
      lineItems.push({
        price_data: { currency: "usd", product_data: { name: "Credit Card Processing Fee" }, unit_amount: Math.round(ccFee * 100) },
        quantity: 1,
      });
    }

    // Same `cart` metadata shape create-checkout.js writes — lib/syncStripe.js's
    // getOrCreateOrderForSession / buildOrder() reads this shape generically
    // regardless of which endpoint created the session, so a catering order
    // becomes a real order through the exact same webhook pipeline (shows up
    // in OrderManager, a signed-in customer's order history, etc.) with zero
    // changes needed there.
    const cartJson = JSON.stringify([{
      baseId: itemId,
      name: canonical.name,
      price,
      qty: guests,
      spice: null,
      note: notes,
    }]);
    const cartByteLen = Buffer.byteLength(cartJson, "utf8");
    const metaCart = cartByteLen <= 500 ? { cart: cartJson } : { cart_0: cartJson.slice(0, 450), cart_1: cartJson.slice(450) };

    const idempotencyKey = crypto
      .createHash("sha256")
      .update(JSON.stringify({ itemId, guests, guestEmail, orderMode, minute: Math.floor(Date.now() / 60000) }))
      .digest("hex");

    const reqOrigin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : null);
    // Catering's success/cancel redirect goes back to the marketing site's
    // OWN /catering page (not the retail ordering app's /order-success) —
    // the whole point of this endpoint is staying on-brand and distraction-
    // free through the entire flow, payment included.
    const baseUrl = (reqOrigin || "https://ranimahal.cc").replace(/\/$/, "");

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: lineItems,
      automatic_tax: { enabled: false },
      customer_email: guestEmail,
      phone_number_collection: { enabled: true },
      custom_text: {
        submit: { message: isDelivery ? "Your catering order will be prepared and delivered fresh." : "Your catering order will be ready for pickup at 327 Mamaroneck Ave." },
      },
      metadata: {
        ...metaCart,
        specialInstructions: [eventDate ? `Event date: ${eventDate}.` : null, notes || null].filter(Boolean).join(" ").slice(0, 500),
        clerkUserId: (clerkUserId ?? "").slice(0, 500),
        guestEmail: guestEmail.slice(0, 500),
        guestPhone: typeof guestPhone === "string" ? guestPhone.slice(0, 40) : "",
        tip: "0.00",
        orderMode: isDelivery ? "delivery" : "pickup",
        deliveryFee: serverDeliveryFee.toFixed(2),
        deliveryAddress: isDelivery && deliveryAddress ? JSON.stringify(deliveryAddress) : "",
        source: "catering_direct",
        eventDate,
        utmSource: typeof utm?.utm_source === "string" ? utm.utm_source.slice(0, 100) : "",
        utmMedium: typeof utm?.utm_medium === "string" ? utm.utm_medium.slice(0, 100) : "",
        utmCampaign: typeof utm?.utm_campaign === "string" ? utm.utm_campaign.slice(0, 100) : "",
        gclid: typeof utm?.gclid === "string" ? utm.gclid.slice(0, 100) : "",
        fbclid: typeof utm?.fbclid === "string" ? utm.fbclid.slice(0, 100) : "",
      },
      success_url: `${baseUrl}${returnPath}?catering_order=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}${returnPath}?catering_order=cancelled`,
    }, { idempotencyKey });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("create-catering-checkout error:", err);
    captureServerError(err, { route: "create-catering-checkout" });
    reportCheckoutError({ source: "create-catering-checkout", message: err.message, context: { itemId: req.body?.itemId } }).catch(() => {});
    return res.status(500).json({ error: "Something went wrong creating your checkout. Please try again or call (914) 835-9066." });
  }
}
