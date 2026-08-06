// ── Notifications: Email (Resend) + SMS (Twilio) ─────────────────

/**
 * Send order confirmation email via Resend
 * https://resend.com — free tier: 3,000 emails/month
 */
export async function sendOrderEmail(order) {
  const { RESEND_API_KEY, RESTAURANT_EMAIL } = process.env;
  if (!RESEND_API_KEY) { console.warn("RESEND_API_KEY not set, skipping email"); return; }

  // RESTAURANT_EMAIL is a comma-separated list so alerts can go to more than
  // one inbox (e.g. while there's no shared Workspace inbox yet) without
  // another code change — just edit the env var.
  const recipients = (RESTAURANT_EMAIL ?? "orders@ranimahal.food").split(",").map(s => s.trim()).filter(Boolean);

  const itemsHtml = order.items.map(i =>
    `<tr>
      <td style="padding:6px 0;border-bottom:1px solid #f0e8dc">${i.name}${i.spice ? ` <span style="color:#8A7560;font-size:12px">(${i.spice})</span>` : ""}</td>
      <td style="padding:6px 0;border-bottom:1px solid #f0e8dc;text-align:center">${i.qty}</td>
      <td style="padding:6px 0;border-bottom:1px solid #f0e8dc;text-align:right">$${(i.price * i.qty).toFixed(2)}</td>
    </tr>`
  ).join("");

  const html = `
    <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;background:#fffdf9;border:1px solid #f0e8dc;border-radius:8px;overflow:hidden">
      <div style="background:#0F0800;padding:24px;text-align:center">
        <h1 style="color:#F5E6C8;font-size:28px;margin:0">Rani Mahal</h1>
        <p style="color:#C8853A;font-size:12px;letter-spacing:2px;margin:4px 0 0">NEW ORDER — #${order.id.slice(-6).toUpperCase()}</p>
      </div>
      <div style="padding:24px">
        <p style="color:#8A7560;font-size:13px;margin:0 0 16px">
          <strong>${order.customerName}</strong> · ${new Date(order.createdAt).toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit" })}
        </p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <thead>
            <tr style="color:#8A7560;font-size:11px;text-transform:uppercase;letter-spacing:1px">
              <th style="text-align:left;padding-bottom:8px">Item</th>
              <th style="text-align:center;padding-bottom:8px">Qty</th>
              <th style="text-align:right;padding-bottom:8px">Price</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <div style="border-top:2px solid #0F0800;margin-top:16px;padding-top:12px">
          <div style="display:flex;justify-content:space-between;color:#8A7560;font-size:13px">
            <span>Subtotal</span><span>$${order.subtotal.toFixed(2)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;color:#8A7560;font-size:13px;margin-top:4px">
            <span>Tax</span><span>$${order.tax.toFixed(2)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:bold;margin-top:8px">
            <span>Total</span><span style="color:#C8853A">$${order.total.toFixed(2)}</span>
          </div>
        </div>
        ${order.specialInstructions ? `<div style="margin-top:16px;padding:12px;background:#f5f0e8;border-radius:6px;font-size:13px;color:#0F0800"><strong>Special instructions:</strong> ${order.specialInstructions}</div>` : ""}
      </div>
    </div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({
      from:    "orders@ranimahal.food",
      to:      recipients,
      subject: `🍽 New Order #${order.id.slice(-6).toUpperCase()} — $${order.total.toFixed(2)}`,
      html,
    }),
  });

  if (!res.ok) console.error("Resend error:", await res.text());
}

/**
 * Send SMS via Twilio
 * https://twilio.com — ~$0.008/SMS
 */
export async function sendOrderSMS(order) {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM, RESTAURANT_PHONE } = process.env;
  if (!TWILIO_ACCOUNT_SID) { console.warn("Twilio not configured, skipping SMS"); return; }

  const items = order.items.map(i => `${i.qty}x ${i.name}${i.spice ? ` (${i.spice})` : ""}`).join(", ");
  const body = `🍽 Rani Mahal — New Order #${order.id.slice(-6).toUpperCase()}\n${items}\nTotal: $${order.total.toFixed(2)}\n${new Date(order.createdAt).toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit" })}`;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64")}`,
    },
    body: new URLSearchParams({ From: TWILIO_FROM, To: RESTAURANT_PHONE, Body: body }),
  });

  if (!res.ok) console.error("Twilio error:", await res.text());
}
