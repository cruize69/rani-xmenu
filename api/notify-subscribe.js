// api/notify-subscribe.js
// POST /api/notify-subscribe
// Body: { orderId, phone }
// Customer opts in to SMS updates for a specific order.
// Stores { phone, orderId } in KV so webhook can send updates on status change.
//
// Phone validation: E.164 format required (+12125551234)
// We strip non-digits and prepend +1 if 10 digits (US numbers)

import { kv } from "@vercel/kv";
import { getOrder } from "../lib/orders.js";
import { overLimit, clientIp } from "../lib/rateLimit.js";

// How recently an order must have been placed to still accept a new SMS
// subscriber. The notify:{orderId} key this endpoint writes already expires
// in 24h, so anything older can't receive status updates anyway — but
// without this check a single valid order id stays a usable credential
// forever, which is exactly what makes the abuse below cheap.
const MAX_ORDER_AGE_MS = 24 * 60 * 60 * 1000;

function normalizePhone(raw) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (raw.startsWith("+") && digits.length >= 10) return `+${digits}`;
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { orderId, phone } = req.body;

  if (!orderId) return res.status(400).json({ error: "orderId required" });
  if (!phone)   return res.status(400).json({ error: "phone required" });

  const normalized = normalizePhone(phone);
  if (!normalized) {
    return res.status(400).json({ error: "Invalid phone number. Please use a US mobile number." });
  }

  // Must reference a real order — otherwise this endpoint is just a free,
  // unauthenticated "send an SMS to anyone" primitive.
  const order = await getOrder(orderId);
  if (!order) return res.status(404).json({ error: "Order not found" });

  // An order id is a bearer credential here (there's no auth — guests
  // aren't logged in at checkout), so bound how long one stays usable.
  // Without this, anyone who has ever placed a single order keeps a
  // permanently valid id to replay against this endpoint.
  const orderAgeMs = Date.now() - new Date(order.createdAt).getTime();
  if (!Number.isFinite(orderAgeMs) || orderAgeMs > MAX_ORDER_AGE_MS) {
    return res.status(410).json({ error: "This order is no longer accepting update notifications." });
  }

  // Two independent limits, because they stop different attacks.
  //
  // Per-phone (existing) caps how many texts land on ONE victim's handset.
  // On its own it did NOT bound the attacker at all: the counter is keyed
  // on the number being SUBSCRIBED, so somebody replaying one legitimate
  // order id of their own could enroll unlimited DIFFERENT numbers, three
  // unsolicited texts each, on the restaurant's Twilio bill. Per-IP closes
  // that by bounding one caller's total reach regardless of how many
  // distinct victims they target. 10/hr is far above real use (a customer
  // subscribes once per order) while making bulk enrollment pointless.
  if (await overLimit(`notify-rl:ip:${clientIp(req)}`, 10, 60 * 60)) {
    return res.status(429).json({ error: "Too many requests. Please try again later." });
  }

  const rlKey = `notify-rl:${normalized}`;
  const count = await kv.incr(rlKey);
  if (count === 1) await kv.expire(rlKey, 60 * 60);
  if (count > 3) {
    return res.status(429).json({ error: "Too many requests for this number. Please try again later." });
  }

  // Store subscriber: key = notify:{orderId}  value = { phone, subscribedAt }
  // Expire after 24 hours — order will be done by then
  await kv.set(
    `notify:${orderId}`,
    JSON.stringify({ phone: normalized, subscribedAt: new Date().toISOString() }),
    { ex: 60 * 60 * 24 }
  );

  // Separately, persist to a standing marketing list — the 24h key above is
  // purely for order-status delivery and was previously the only place this
  // number was kept, so every subscriber was silently discarded a day later.
  // This opt-in is for order-update SMS specifically; it is not itself
  // consent for promotional SMS (that's the separate, explicit checkbox at
  // the fulfillment step — see FulfillmentSheet.jsx), so this list is kept
  // distinct from lib/abandonedCart.js's marketing-consent leads.
  await kv.sadd("sms-subscribers", normalized);
  await kv.hset(`sms-subscriber:${normalized}`, {
    phone: normalized,
    firstOrderId: orderId,
    subscribedAt: new Date().toISOString(),
  });

  // Send immediate confirmation SMS
  await sendSMS(normalized,
    `Rani Mahal: You're signed up for order updates! We'll text you when your order is being prepared and when it's ready. Reply STOP to unsubscribe.`
  );

  return res.status(200).json({ success: true, phone: normalized });
}

async function sendSMS(to, body) {
  const { TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, TWILIO_FROM } = process.env;
  if (!TWILIO_API_KEY_SID) return;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${TWILIO_API_KEY_SID}:${TWILIO_API_KEY_SECRET}`).toString("base64")}`,
    },
    body: new URLSearchParams({ From: TWILIO_FROM, To: to, Body: body }),
  });
  if (!res.ok) console.error("Twilio confirmation SMS error:", await res.text());
}
