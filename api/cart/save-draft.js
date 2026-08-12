// api/cart/save-draft.js
// POST { draftId, phone?, email?, smsConsent?, items, orderMode, deliveryAddress? }
// Best-effort capture for abandoned-cart recovery — called from the
// fulfillment sheet (phone) and the guest-checkout email step (email),
// progressively enriching the same draft record. Never blocks or affects
// the actual order/payment flow.

import { kv } from "@vercel/kv";
import { saveLead } from "../../lib/abandonedCart.js";

// This endpoint is unauthenticated by necessity (it runs before checkout,
// where no customer identity exists yet) and the phone/email it stores are
// later messaged by the recovery sweep. Without a cap that makes it a free
// "send an SMS/email to any address" primitive billed to the restaurant's
// Twilio/Resend accounts — and an unbounded KV-write amplifier. Cap both
// the caller and the destination, mirroring api/notify-subscribe.js.
const MAX_PER_IP_PER_HOUR = 20;
const MAX_PER_DEST_PER_DAY = 5;

async function overLimit(key, max, ttlSec) {
  const count = await kv.incr(key);
  if (count === 1) await kv.expire(key, ttlSec);
  return count > max;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { draftId, phone, email, smsConsent, items, orderMode, deliveryAddress } = req.body || {};
    if (!draftId || typeof draftId !== "string" || draftId.length > 100) {
      return res.status(400).json({ error: "Invalid draftId" });
    }

    const ip = (req.headers["x-forwarded-for"] ?? "").split(",")[0].trim() || "unknown";
    if (await overLimit(`draft-rl:ip:${ip}`, MAX_PER_IP_PER_HOUR, 60 * 60)) {
      return res.status(429).json({ error: "Too many requests" });
    }

    // Only count against the destination cap when a new contact point is
    // actually being attached — repeated cart edits on one draft shouldn't
    // burn a customer's own quota.
    const dest = (typeof phone === "string" && phone) || (typeof email === "string" && email) || null;
    if (dest && await overLimit(`draft-rl:dest:${dest.toLowerCase().slice(0, 200)}`, MAX_PER_DEST_PER_DAY, 60 * 60 * 24)) {
      return res.status(429).json({ error: "Too many requests" });
    }

    await saveLead({
      draftId,
      phone: typeof phone === "string" ? phone.slice(0, 20) : null,
      email: typeof email === "string" ? email.slice(0, 200) : null,
      smsConsent: !!smsConsent,
      items,
      orderMode,
      deliveryAddress,
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("save-draft error:", err);
    // Best-effort — never surface this as a hard failure to the customer.
    return res.status(200).json({ success: false });
  }
}
