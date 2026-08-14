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
import { graduateLead } from "../lib/abandonedCart.js";
import { isWithinServiceWindow, getOpenStatus } from "../lib/hours.js";
import { getNYDateString } from "../lib/orders.js";
import { reportCheckoutError } from "../lib/errorAlerts.js";
import { captureServerError } from "../lib/sentry.js";
import { overLimit, clientIp } from "../lib/rateLimit.js";
import { kv } from "@vercel/kv";

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

// Stripe caps a metadata VALUE at 500 chars. The address is stored there as
// JSON, and the old code just did .slice(0, 500) — which cuts mid-JSON, so
// JSON.parse fails on the way back out in lib/syncStripe.js (inside a catch
// that swallows it) and the address silently becomes null. Verified: a ~500
// char delivery note produces a PAID delivery order whose ticket has no
// address at all. Cap each field so the encoded object always fits, and
// degrade by dropping the note rather than losing the address.
function sanitizeDeliveryAddress(a) {
  if (!a || typeof a !== "object") return null;
  const s = (v, n) => (typeof v === "string" ? v.slice(0, n).trim() : "");
  const addr = {
    street: s(a.street, 100),
    apt:    s(a.apt, 30),
    city:   s(a.city, 50),
    zip:    s(a.zip, 10),
    notes:  s(a.notes, 150),
  };
  // Belt-and-braces: if anything above still pushes the JSON over Stripe's
  // limit, shed the note (recoverable) instead of the address (not).
  if (JSON.stringify(addr).length > 480) addr.notes = "";
  return addr;
}
const STRIPE_PCT = 0.029;
const STRIPE_FLAT = 0.30;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Declared outside the try block (not `const` inside it) so the catch
  // block below can still reach it to identify the customer for an alert.
  const draftId = typeof req.body?.draftId === "string" ? req.body.draftId : null;

  // Pricing is fully server-side so there's no fraud exposure here, but this
  // is unauthenticated (guests must be able to check out) and every call
  // creates a real Stripe session plus KV writes — worth a ceiling so it
  // can't be used to burn Stripe rate limits or KV spend. Set well above
  // any plausible human retry rate.
  if (await overLimit(`checkout-rl:ip:${clientIp(req)}`, 30, 60 * 60)) {
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
    const { items, specialInstructions, guestEmail, tip: rawTip, orderMode = "pickup", deliveryAddress: rawDeliveryAddress, reorderToken, scheduledFor, utm } = req.body || {};
    // Field-capped copy — the only version allowed downstream, so nothing
    // unbounded can reach Stripe metadata (see sanitizeDeliveryAddress).
    const deliveryAddress = sanitizeDeliveryAddress(rawDeliveryAddress);
    const clerkUserId = await resolveVerifiedClerkUserId(req);

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "No items in cart" });
    }

    // Never trust a client-supplied schedule time — it must land inside a
    // real published service window, and if the restaurant is currently
    // open, an order with no scheduledFor is only valid because it's for
    // right now. If the restaurant is closed, the client is required to
    // supply a valid future window (RaniMahal.jsx enforces this in the UI;
    // this is the actual security boundary).
    let validScheduledFor = null;
    if (scheduledFor && typeof scheduledFor === "object" && typeof scheduledFor.date === "string" && typeof scheduledFor.time === "string") {
      if (!isWithinServiceWindow(scheduledFor.date, scheduledFor.time)) {
        return res.status(400).json({ error: "That time isn't during our open hours. Please pick another." });
      }
      validScheduledFor = { date: scheduledFor.date, time: scheduledFor.time };
    } else if (!getOpenStatus().isOpen) {
      return res.status(400).json({ error: "We're closed right now — please schedule your order for our next opening." });
    }

    // Validate reorder/voucher discount token if provided. Same KV shape
    // covers per-order reorder vouchers and the generic vouchers minted by
    // mintVoucherToken() (loyalty, referral, abandoned-cart recovery) — the
    // latter carry their own discountPct instead of assuming 10%.
    let hasDiscount = false;
    let discountPct = 0.10;
    if (reorderToken) {
      const rawToken = await kv.get(`reorder-token:${reorderToken}`);
      if (rawToken) {
        const tokenData = typeof rawToken === "string" ? JSON.parse(rawToken) : rawToken;
        const isUnused = tokenData.status === "unused";
        const isPendingCheckout = tokenData.status === "checkout_created" &&
          ((new Date() - new Date(tokenData.updatedAt || tokenData.createdAt)) / 3600000 >= 2); // unlock after 2 hours

        if ((isUnused || isPendingCheckout) && new Date() <= new Date(tokenData.expiresAt)) {
          // A referral voucher can't be redeemed by the person who referred —
          // otherwise a customer invites themselves with their own order's
          // token and farms a discount off every order they place. This runs
          // BEFORE the claim below so a rejected attempt doesn't leave the
          // voucher locked for 2h.
          if (tokenData.meta?.source === "referral" && tokenData.meta?.referrerOrderId) {
            const rawReferrer = await kv.get(`order:${tokenData.meta.referrerOrderId}`);
            const referrer = typeof rawReferrer === "string" ? JSON.parse(rawReferrer) : rawReferrer;
            const claimedEmail = (guestEmail ?? "").toLowerCase().trim();
            const isSelf =
              (referrer?.customerEmail && claimedEmail && referrer.customerEmail.toLowerCase().trim() === claimedEmail) ||
              (referrer?.clerkUserId && clerkUserId && referrer.clerkUserId === clerkUserId);
            if (isSelf) {
              return res.status(400).json({ error: "This invite link can't be used on your own account." });
            }
          }

          // Atomically claim the token — this must be the LAST gate, since
          // winning it commits the voucher for 2h. The read-validate-then-
          // write above is a TOCTOU window: verified that 3 of 3 concurrent
          // requests carrying the same single-use voucher all passed
          // validation and all got the discount, because none had written
          // "checkout_created" yet. A scripted customer could fire N parallel
          // checkouts off one voucher and get N discounted orders.
          //
          // set(nx) is a single atomic op, so exactly one request wins. The
          // 2h TTL reproduces the abandoned-checkout retry window that
          // isPendingCheckout was approximating non-atomically.
          const claimed = await kv.set(`reorder-claim:${reorderToken}`, "1", { nx: true, ex: 7200 });
          if (!claimed) {
            return res.status(400).json({ error: "A checkout is already in progress for this voucher. Please finish or wait a moment and try again." });
          }

          hasDiscount = true;
          discountPct = typeof tokenData.discountPct === "number" ? tokenData.discountPct : 0.10;
        } else {
          return res.status(400).json({ error: "Reorder voucher is invalid or has already been redeemed." });
        }
      } else {
        return res.status(400).json({ error: "Invalid reorder voucher token." });
      }
    }

    // Rani Royal Club, part 1: sign in before checkout and your FIRST order
    // is 10% off automatically — no separate voucher to claim, no waiting.
    // (Part 2 — 10% every 5th order after that — is handled in
    // lib/orders.js's saveOrder, once the order is actually placed.) Only
    // applies when no voucher discount is already active, so this can never
    // stack with a reorder/referral/loyalty-milestone token in one checkout.
    let welcomeDiscount = false;
    if (!hasDiscount && clerkUserId) {
      const priorOrderCount = await kv.llen(`account-orders:${clerkUserId}`);
      if (priorOrderCount === 0) {
        hasDiscount = true;
        discountPct = 0.10;
        welcomeDiscount = true;
      }
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
      const itemPrice = hasDiscount ? parseFloat((canonical.price * (1 - discountPct)).toFixed(2)) : canonical.price;
      validatedItems.push({
        baseId: raw.baseId,
        name:   canonical.name,
        price:  itemPrice,
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
        deliveryAddress:     isDelivery && deliveryAddress ? JSON.stringify(deliveryAddress) : "",
        source:              "online_ordering",
        reorderToken:        reorderToken || "",
        scheduledFor:        validScheduledFor ? JSON.stringify(validScheduledFor) : "",
        utmSource:           typeof utm?.utm_source   === "string" ? utm.utm_source.slice(0, 100)   : "",
        utmMedium:           typeof utm?.utm_medium   === "string" ? utm.utm_medium.slice(0, 100)   : "",
        utmCampaign:         typeof utm?.utm_campaign === "string" ? utm.utm_campaign.slice(0, 100) : "",
      },
      success_url: `${baseUrl}/order-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${baseUrl}`,
    }, { idempotencyKey });

    // Lock the token status in KV
    if (reorderToken && hasDiscount) {
      const tokenKey = `reorder-token:${reorderToken}`;
      const rawToken = await kv.get(tokenKey);
      if (rawToken) {
        const tData = typeof rawToken === "string" ? JSON.parse(rawToken) : rawToken;
        tData.status = "checkout_created";
        tData.stripeSessionId = session.id;
        tData.updatedAt = new Date().toISOString();
        await kv.set(tokenKey, JSON.stringify(tData), { ex: 1296000 }); // keep same 15-day TTL
      }
    }

    // Store draft cart in Vercel KV for abandoned cart analytics + recovery.
    // If this checkout carries a draftId from an earlier fulfillment-step
    // capture, graduate that lead (stops Stage-A recovery messaging) and
    // carry its phone/consent into this record for Stage-B recovery.
    try {
      let customerName = "Guest";
      if (clerkUserId) {
        try {
          const user = await clerk.users.getUser(clerkUserId);
          customerName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "Guest";
        } catch (e) {}
      }
      const lead = draftId ? await graduateLead(draftId).catch(() => null) : null;
      const draftCart = {
        id: session.id,
        items: validatedItems,
        subtotal,
        deliveryFee: serverDeliveryFee,
        tax,
        tip,
        ccFee,
        total: grossBeforeCc + ccFee,
        orderMode,
        guestEmail: guestEmail ?? "",
        clerkUserId: clerkUserId ?? "",
        customerName,
        deliveryAddress: isDelivery ? (deliveryAddress ?? null) : null,
        status: "draft",
        createdAt: new Date().toISOString(),
        // Abandoned-cart recovery fields
        phone:        lead?.phone ?? null,
        smsConsent:   !!lead?.smsConsent,
        touch1SentAt: null,
        touch2SentAt: null,
      };
      await kv.set(`draft:${session.id}`, JSON.stringify(draftCart), { ex: 2592000 }); // 30-day TTL

      // Index by day so api/analytics.js's fetchDrafts() can range-read just
      // the requested window instead of scanning the entire draft:* keyspace
      // (a real cost driver once draft volume is nonzero — see lib/orders.js
      // for the equivalent orders:date:{date} pattern this mirrors).
      const draftDate = getNYDateString();
      const dateIndexKey = `drafts:date:${draftDate}`;
      await kv.zadd(dateIndexKey, { score: Date.now(), member: session.id });
      await kv.expire(dateIndexKey, 2592000); // keep in step with the draft record's own 30-day TTL
    } catch (e) {
      console.error("Failed to save draft cart:", e);
    }

    return res.status(200).json({ url: session.url });

  } catch (err) {
    captureServerError(err, { route: "create-checkout", draftId });
    // The customer is stuck right here, mid-checkout, with money on the
    // table — if we know how to reach them, alert staff immediately so
    // they can call and finish the sale by phone instead of losing it.
    reportCheckoutError({ draftId, source: "create-checkout", message: err.message }).catch(() => {});
    return res.status(500).json({ error: "Failed to create checkout session. Please try again." });
  }
}

