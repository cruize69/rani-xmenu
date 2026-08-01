// api/update-order.js
// PATCH /api/update-order
// Body: { id, status } or { id, printed: true }
// On status change to in_progress or done, fires customer SMS if subscribed

import { updateOrder, ORDER_STATUS } from "../lib/orders.js";
import { kv } from "@vercel/kv";

const VALID_STATUSES = Object.values(ORDER_STATUS);

const STATUS_SMS = {
  in_progress: (order) =>
    `Rani Mahal: Great news! Your order #${order.id.slice(-6).toUpperCase()} is now being prepared. We'll text you when it's ready. (914) 835-9066`,
  done: (order) =>
    `Rani Mahal: Your order #${order.id.slice(-6).toUpperCase()} is READY for pickup! Come on in — we look forward to seeing you. (914) 835-9066`,
};

export default async function handler(req, res) {
  const secret = req.headers["x-manager-secret"];
  if (secret !== process.env.MANAGER_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id, status, printed } = req.body;
  if (!id) return res.status(400).json({ error: "Order ID required" });

  const fields = {};
  if (status !== undefined) {
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` });
    }
    fields.status = status;
  }
  if (printed !== undefined) {
    fields.printed   = true;
    fields.printedAt = new Date().toISOString();
  }

  try {
    const updated = await updateOrder(id, fields);

    // Fire customer SMS on meaningful status changes
    if (status && STATUS_SMS[status]) {
      const raw = await kv.get(`notify:${id}`).catch(() => null);
      if (raw) {
        const { phone } = JSON.parse(raw);
        sendCustomerSMS(phone, STATUS_SMS[status](updated))
          .catch(err => console.error("Customer SMS failed:", err));
      }
    }

    return res.status(200).json({ order: updated });
  } catch (err) {
    console.error("Update order error:", err);
    return res.status(404).json({ error: err.message });
  }
}

async function sendCustomerSMS(to, body) {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM } = process.env;
  if (!TWILIO_ACCOUNT_SID) return;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64")}`,
    },
    body: new URLSearchParams({ From: TWILIO_FROM, To: to, Body: body }),
  });
  if (!r.ok) console.error("Twilio error:", await r.text());
}
