// api/cart/send-cart-link.js
// POST /api/cart/send-cart-link
// Body: { phone, draftId, items, orderMode, deliveryAddress? }
// Sends an immediate SMS with a one-tap resume link so customer can finish their order on any device.

import { saveLead } from "../../lib/abandonedCart.js";
import { sendSMS } from "../../lib/notifications.js";
import { overLimit, clientIp } from "../../lib/rateLimit.js";

const MAX_PER_IP_PER_HOUR = 15;
const MAX_PER_PHONE_PER_DAY = 3;
const BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL || "https://ranimahal.cc/order").replace(/\/$/, "");

function normalizePhone(raw) {
  if (!raw || typeof raw !== "string") return null;
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

  try {
    const { phone, draftId, items, orderMode, deliveryAddress } = req.body || {};
    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone) {
      return res.status(400).json({ error: "Please enter a valid 10-digit US mobile number." });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Cart is empty." });
    }

    const ip = clientIp(req);
    if (await overLimit(`send-cart:ip:${ip}`, MAX_PER_IP_PER_HOUR, 60 * 60)) {
      return res.status(429).json({ error: "Too many requests. Please try again in an hour." });
    }

    if (await overLimit(`send-cart:phone:${cleanPhone}`, MAX_PER_PHONE_PER_DAY, 60 * 60 * 24)) {
      return res.status(429).json({ error: "Cart link already sent to this number today." });
    }

    // 1. Save lead in KV as Stage A
    if (draftId) {
      await saveLead({
        draftId,
        phone: cleanPhone,
        smsConsent: true,
        items,
        orderMode: orderMode === "delivery" ? "delivery" : "pickup",
        deliveryAddress,
      });
    }

    // 2. Build resume URL with item payloads
    const ids = items.flatMap(i => Array(Math.max(1, i.qty || 1)).fill(i.baseId));
    const link = `${BASE_URL}/?add=${ids.map(encodeURIComponent).join(",")}`;

    const cartCount = items.reduce((s, i) => s + (i.qty || 1), 0);
    const smsText = `Rani Mahal: Your order (${cartCount} item${cartCount > 1 ? "s" : ""}) is saved! Tap here to resume anytime: ${link} Reply STOP to opt out.`;

    await sendSMS(cleanPhone, smsText);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("send-cart-link error:", err);
    return res.status(500).json({ error: "Could not send cart link. Please try again." });
  }
}
