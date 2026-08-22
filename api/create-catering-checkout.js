// api/create-catering-checkout.js
// POST { itemId, guests, guestEmail, guestPhone, eventDate, orderMode, deliveryAddress, notes, tip, utm }
// Returns { url } — redirect customer to Stripe's hosted checkout page.
//
// Deliberately separate from api/create-checkout.js rather than a branch
// inside it: the retail endpoint's shape (multi-item cart, vouchers,
// welcome/member discounts, scheduled-order hours validation) doesn't apply
// to catering at all, and trying to make one endpoint cover both would mean
// either catering inheriting retail concepts it explicitly opts out of
// (catering is flat-rate — see lib/menu.js's CATERING_ITEM_IDS discount
// exclusion) or the retail endpoint growing a pile of `if (isCatering)`
// branches. A single real package line item, no cart, no vouchers — this
// endpoint is small on purpose. Tip is real here (same dollar-amount
// contract as create-checkout.js: computed client-side from a % of
// subtotal, re-clamped server-side, never trusted as-is).
//
// SECURITY: same rule as create-checkout.js — price is never trusted from
// the client. itemId is re-priced from CATERING_ITEMS every time.

import Stripe from "stripe";
import crypto from "crypto";
import { createClerkClient, verifyToken } from "@clerk/backend";
import { VALID_ITEMS, TAX_RATE, CATERING_ITEM_IDS, CATERING_MINIMUMS } from "../lib/menu.js";
import { getDeliveryZoneForZip } from "../src/utils/deliveryConfig.js";
import { reportCheckoutError } from "../lib/errorAlerts.js";
import { captureServerError } from "../lib/sentry.js";
import { overLimit, clientIp } from "../lib/rateLimit.js";
import { sanitizeDeliveryAddress, truncateToUtf8Bytes, chunkStringByBytes } from "../lib/sanitize.js";
import { recordCampaignClaimed } from "../lib/notifications.js";
import { getNYDateString } from "../lib/orders.js";
import { formatTime } from "../lib/hours.js";
import { kv } from "../lib/kv.js";

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

// Same verification pattern as create-checkout.js — a client-supplied
// clerkUserId is just a string an attacker can set to anyone's (non-secret)
// Clerk user ID, so it's only trusted after verifying it against the
// caller's own JWT.
async function resolveVerifiedClerkUserId(req) {
  const authHeader = req.headers["authorization"] ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  try {
    const payload = await verifyToken(authHeader.slice(7), { secretKey: process.env.CLERK_SECRET_KEY });
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
      eventTime: rawEventTime,
      orderMode = "pickup",
      deliveryAddress: rawDeliveryAddress,
      notes: rawNotes,
      tip: rawTip,
      utm,
      returnPath: rawReturnPath,
      reorderToken,
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

    // Event date/time is REQUIRED, not optional — a catering order with no
    // known event date is exactly the kind of thing that turns into a bad
    // same-day surprise for the kitchen. Minimum 1-day lead time is
    // enforced here, server-side (the client's <input min=""> is a UX
    // nicety only, never trusted as the real gate) — computed in NY time
    // via getNYDateString, same helper every other date comparison in this
    // app already uses, so "today"/"tomorrow" can't drift between here and
    // anywhere else that cares.
    if (typeof rawEventDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(rawEventDate)) {
      return res.status(400).json({ error: "An event date is required." });
    }
    if (typeof rawEventTime !== "string" || !/^\d{2}:\d{2}$/.test(rawEventTime)) {
      return res.status(400).json({ error: "An event time is required." });
    }
    const todayNY = getNYDateString();
    const tomorrowNY = getNYDateString(Date.now() + 24 * 60 * 60 * 1000);
    if (rawEventDate < tomorrowNY) {
      return res.status(400).json({
        error: rawEventDate <= todayNY
          ? "Same-day catering isn't available — please choose a date starting tomorrow."
          : "That date has already passed.",
      });
    }
    const eventDate = rawEventDate;
    const eventTime = rawEventTime;
    const eventDateTimeLabel = `${eventDate} at ${formatTime(eventTime)}`;
    const notes = typeof rawNotes === "string" ? rawNotes.slice(0, 300) : "";
    const clerkUserId = await resolveVerifiedClerkUserId(req);

    // A reorderToken NEVER discounts catering pricing (see the price
    // comment below) — but validating and claiming it here still matters:
    // without this, a referral link that happened to convert into a
    // catering order silently never got redeemed and the referrer was
    // never credited (lib/syncStripe.js's creditReferrer only fires off a
    // token this endpoint marks "checkout_created" and forwards in
    // metadata). Same validation this file's sibling create-checkout.js
    // runs — self-referral block, atomic single-claim — just with no
    // discountPct ever applied to price.
    let voucherClaimed = false;
    if (reorderToken) {
      const rawToken = await kv.get(`reorder-token:${reorderToken}`);
      if (!rawToken) {
        return res.status(400).json({ error: "Invalid reorder voucher token." });
      }
      const tokenData = typeof rawToken === "string" ? JSON.parse(rawToken) : rawToken;
      const isUnused = tokenData.status === "unused";
      const isPendingCheckout = tokenData.status === "checkout_created" &&
        ((new Date() - new Date(tokenData.updatedAt || tokenData.createdAt)) / 3600000 >= 2);
      if (!((isUnused || isPendingCheckout) && new Date() <= new Date(tokenData.expiresAt))) {
        return res.status(400).json({ error: "Reorder voucher is invalid or has already been redeemed." });
      }
      // Non-referral vouchers (welcome, newsletter, win-back, etc.) exist
      // to grant a discount, which catering never applies — claiming one
      // here would silently burn a real voucher for zero benefit and the
      // customer would think they'd used it. Reject up front instead.
      // Referral tokens are the one exception: they're claimed (never
      // discounted) so the referrer still gets credited — see below.
      if (tokenData.meta?.source !== "referral") {
        return res.status(400).json({ error: "This voucher can't be applied to catering orders." });
      }
      if (tokenData.meta?.source === "referral" && tokenData.meta?.referrerOrderId) {
        if (!clerkUserId) {
          return res.status(400).json({ error: "Please sign in to use an invite link — it only takes a tap." });
        }
        const rawReferrer = await kv.get(`order:${tokenData.meta.referrerOrderId}`);
        const referrer = typeof rawReferrer === "string" ? JSON.parse(rawReferrer) : rawReferrer;
        // Resolve the email from Clerk, not the request body — guestEmail
        // is client-supplied and can be set to anything even while signed
        // in, so comparing it to referrer.customerEmail was defeated by
        // simply lying about it. See api/create-checkout.js for the same fix.
        let verifiedEmail = null;
        try {
          const clerkUser = await clerk.users.getUser(clerkUserId);
          verifiedEmail = clerkUser.emailAddresses?.find(e => e.id === clerkUser.primaryEmailAddressId)?.emailAddress
            ?? clerkUser.emailAddresses?.[0]?.emailAddress ?? null;
        } catch {}
        const claimedEmail = (verifiedEmail ?? "").toLowerCase().trim();
        const isSelf =
          (referrer?.customerEmail && referrer.customerEmail.toLowerCase().trim() === claimedEmail) ||
          (referrer?.clerkUserId && referrer.clerkUserId === clerkUserId);
        if (isSelf) {
          return res.status(400).json({ error: "This invite link can't be used on your own account." });
        }
      }
      const claimed = await kv.set(`reorder-claim:${reorderToken}`, "1", { nx: true, ex: 7200 });
      if (!claimed) {
        return res.status(400).json({ error: "A checkout is already in progress for this voucher. Please finish or wait a moment and try again." });
      }
      voucherClaimed = true;
      if (tokenData.meta?.source) await recordCampaignClaimed(tokenData.meta.source);
    }

    // Catering line items are always full price — see lib/menu.js's
    // CATERING_ITEM_IDS discount-exclusion comment in create-checkout.js.
    // A voucher can be validated/claimed above (so referral credit still
    // completes), but it never discounts the price itself.
    const price = canonical.price;
    const subtotal = parseFloat((price * guests).toFixed(2));
    const serverDeliveryFee = isDelivery && subtotal < 99 ? 6.99 : 0; // structurally mirrors create-checkout.js; never actually fires given catering's own minimums
    const tax = parseFloat((subtotal * TAX_RATE).toFixed(2));
    // Same clamp as create-checkout.js — a % of subtotal computed client-side
    // (TipSelector on the catering modal), never trusted as-is: capped at 2x
    // subtotal so a manipulated request can't inflate the charge arbitrarily.
    const tip = Math.min(Math.max(0, Number(rawTip) || 0), subtotal * 2);
    const grossBeforeCc = subtotal + serverDeliveryFee + tax + tip;
    const ccFee = parseFloat((((grossBeforeCc + STRIPE_FLAT) / (1 - STRIPE_PCT)) - grossBeforeCc).toFixed(2));

    const lineItems = [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: canonical.name,
            description: `Event: ${eventDateTimeLabel}`,
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
    if (tip > 0) {
      lineItems.push({
        price_data: { currency: "usd", product_data: { name: isDelivery ? "Driver Tip" : "Staff Tip" }, unit_amount: Math.round(tip * 100) },
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
    const metaCart = {};
    if (cartByteLen <= 500) {
      metaCart.cart = cartJson;
    } else {
      const chunks = chunkStringByBytes(cartJson, 450);
      for (let i = 0; i < chunks.length; i++) {
        metaCart[`cart_${i}`] = chunks[i];
      }
    }

    const idempotencyKey = crypto
      .createHash("sha256")
      .update(JSON.stringify({ itemId, guests, guestEmail, orderMode, tip, deliveryAddress, eventDate, eventTime, reorderToken, minute: Math.floor(Date.now() / 60000) }))
      .digest("hex");

    // Catering's success/cancel redirect goes back to the marketing site's
    // OWN /catering page (not the retail ordering app's /order-success) —
    // the whole point of this endpoint is staying on-brand and distraction-
    // free through the entire flow, payment included.
    //
    // Deliberately hardcoded, never derived from req.headers.origin/referer:
    // both are attacker-controlled request headers, and trusting either lets
    // anyone stand up a lookalike page, drive a real customer through a real
    // Stripe charge, and get them redirected back to the attacker's own
    // domain carrying the real Stripe session_id in the query string — which
    // the public, unauthenticated GET /api/orders lookup then resolves into
    // the customer's full name/email/phone/delivery address. Also
    // deliberately NOT process.env.NEXT_PUBLIC_BASE_URL — that var is set to
    // the retail ordering app's own domain (ranimahal.food), not the
    // marketing site catering lives on.
    const baseUrl = "https://ranimahal.cc";

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
        specialInstructions: truncateToUtf8Bytes([`Event: ${eventDateTimeLabel}.`, notes || null].filter(Boolean).join(" "), 500),
        clerkUserId: truncateToUtf8Bytes(clerkUserId ?? "", 500),
        guestEmail: truncateToUtf8Bytes(guestEmail, 500),
        guestPhone: typeof guestPhone === "string" ? truncateToUtf8Bytes(guestPhone, 40) : "",
        tip: tip.toFixed(2),
        orderMode: isDelivery ? "delivery" : "pickup",
        deliveryFee: serverDeliveryFee.toFixed(2),
        deliveryAddress: isDelivery && deliveryAddress ? JSON.stringify(deliveryAddress) : "",
        source: "catering_direct",
        eventDate,
        eventTime,
        reorderToken: reorderToken || "",
        utmSource: typeof utm?.utm_source === "string" ? truncateToUtf8Bytes(utm.utm_source, 100) : "",
        utmMedium: typeof utm?.utm_medium === "string" ? truncateToUtf8Bytes(utm.utm_medium, 100) : "",
        utmCampaign: typeof utm?.utm_campaign === "string" ? truncateToUtf8Bytes(utm.utm_campaign, 100) : "",
        gclid: typeof utm?.gclid === "string" ? truncateToUtf8Bytes(utm.gclid, 100) : "",
        fbclid: typeof utm?.fbclid === "string" ? truncateToUtf8Bytes(utm.fbclid, 100) : "",
      },
      success_url: `${baseUrl}${returnPath}?catering_order=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}${returnPath}?catering_order=cancelled`,
    }, { idempotencyKey });

    // Lock the token status so lib/syncStripe.js's webhook handler (which
    // reads session.metadata.reorderToken) can complete the referral credit
    // once payment succeeds — mirrors create-checkout.js's equivalent block.
    if (reorderToken && voucherClaimed) {
      const tokenKey = `reorder-token:${reorderToken}`;
      const rawToken = await kv.get(tokenKey);
      if (rawToken) {
        const tData = typeof rawToken === "string" ? JSON.parse(rawToken) : rawToken;
        tData.status = "checkout_created";
        tData.stripeSessionId = session.id;
        tData.updatedAt = new Date().toISOString();
        await kv.set(tokenKey, JSON.stringify(tData), { ex: 1296000 });
      }
    }

    // Abandoned-checkout recovery — writes into the SAME draft:{session.id}
    // keyspace api/create-checkout.js uses, tagged isCatering: true, so the
    // existing sweepAbandonedCarts() cron (lib/abandonedCart.js) picks this
    // up with zero changes to its loop, and api/analytics.js's funnel
    // reporting sees catering abandonment too. Before this, a catering
    // checkout that never reached payment left no trace anywhere.
    try {
      const cartJsonForDraft = JSON.stringify([{ baseId: itemId, name: canonical.name, price, qty: guests }]);
      const draftCart = {
        items: JSON.parse(cartJsonForDraft),
        subtotal,
        orderMode: isDelivery ? "delivery" : "pickup",
        deliveryAddress: isDelivery ? (deliveryAddress ?? null) : null,
        guestEmail: guestEmail.slice(0, 500),
        status: "draft",
        createdAt: new Date().toISOString(),
        phone: typeof guestPhone === "string" ? guestPhone.slice(0, 40) : null,
        smsConsent: false, // the catering modal doesn't collect SMS consent — email-only recovery
        smsMarketingConsent: false,
        touch1SentAt: null,
        touch2SentAt: null,
        isCatering: true,
        returnPath,
      };
      await kv.set(`draft:${session.id}`, JSON.stringify(draftCart), { ex: 2592000 });

      const draftDate = getNYDateString();
      const dateIndexKey = `drafts:date:${draftDate}`;
      await kv.zadd(dateIndexKey, { score: Date.now(), member: session.id });
      await kv.expire(dateIndexKey, 2592000);
    } catch (e) {
      console.error("Failed to save catering draft:", e);
    }

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("create-catering-checkout error:", err);
    captureServerError(err, { route: "create-catering-checkout" });
    reportCheckoutError({ source: "create-catering-checkout", message: err.message, context: { itemId: req.body?.itemId } }).catch(() => {});
    return res.status(500).json({ error: "Something went wrong creating your checkout. Please try again or call (914) 835-9066." });
  }
}
