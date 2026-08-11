// api/cart/save-draft.js
// POST { draftId, phone?, email?, smsConsent?, items, orderMode, deliveryAddress? }
// Best-effort capture for abandoned-cart recovery — called from the
// fulfillment sheet (phone) and the guest-checkout email step (email),
// progressively enriching the same draft record. Never blocks or affects
// the actual order/payment flow.

import { saveLead } from "../../lib/abandonedCart.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { draftId, phone, email, smsConsent, items, orderMode, deliveryAddress } = req.body || {};
    if (!draftId || typeof draftId !== "string" || draftId.length > 100) {
      return res.status(400).json({ error: "Invalid draftId" });
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
