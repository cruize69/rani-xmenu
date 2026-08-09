// ── Notifications: Email (Resend) + SMS (Twilio) ─────────────────
// Luxury, high-end HTML email template designed to match Rani Mahal's brand aesthetics.

const FROM = "orders@ranimahal.food";

async function sendEmail({ to, subject, html }) {
  const { RESEND_API_KEY } = process.env;
  if (!RESEND_API_KEY) { console.warn("RESEND_API_KEY not set in environment variables, skipping email"); return; }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });

  if (!res.ok) console.error("Resend send error:", await res.text());
}

function itemsTable(items) {
  return items.map(i => {
    const spiceMarkup = i.spice
      ? `<span style="display:inline-block;margin-left:6px;padding:1px 6px;background:rgba(232,168,46,0.12);color:#E8A82E;border:0.5px solid rgba(232,168,46,0.3);border-radius:4px;font-size:10px;font-family:'Inter',sans-serif;letter-spacing:0.04em;">${i.spice}</span>`
      : "";
    const noteMarkup = i.note
      ? `<div style="font-size:12px;color:#B8A995;font-style:italic;margin-top:3px;font-family:'Inter',sans-serif;">Note: "${i.note}"</div>`
      : "";

    return `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid rgba(250,246,239,0.08);">
          <div style="font-family:'Fraunces',Georgia,serif;font-size:15px;color:#FAF6EF;font-weight:500;line-height:1.3;">
            ${i.name} ${spiceMarkup}
          </div>
          ${noteMarkup}
        </td>
        <td style="padding:12px 0;border-bottom:1px solid rgba(250,246,239,0.08);text-align:center;font-family:'Inter',sans-serif;font-size:13px;color:#FAF6EF;">
          <span style="display:inline-block;padding:2px 8px;background:#1c1814;border:1px solid rgba(250,246,239,0.12);border-radius:12px;font-size:12px;font-weight:600;color:#E8A82E;">${i.qty}</span>
        </td>
        <td style="padding:12px 0;border-bottom:1px solid rgba(250,246,239,0.08);text-align:right;font-family:'Inter',sans-serif;font-size:14px;font-weight:600;color:#FAF6EF;">
          $${(i.price * i.qty).toFixed(2)}
        </td>
      </tr>`;
  }).join("");
}

/**
 * High-End Luxury Email Template Shell matching Rani Mahal Branding
 */
function orderEmailShell({ eyebrow, heading, bodyBefore = "", bodyAfter = "", order }) {
  const shortId = order.id.slice(-6).toUpperCase();

  const isDone = order.status === "done";
  const isInProgress = order.status === "in_progress";
  const isDelivery = order.orderMode === "delivery";
  const addr = order.deliveryAddress || {};

  const step1Color = "#E8A82E";
  const step2Color = isInProgress || isDone ? "#E8A82E" : "#342820";
  const step3Color = isDone ? "#E8A82E" : "#342820";

  const line1Color = isInProgress || isDone ? "#E8A82E" : "#342820";
  const line2Color = isDone ? "#E8A82E" : "#342820";

  const step3Label = isDelivery ? (isDone ? "Delivered" : "Delivery") : "Ready";

  const mapQuery = isDelivery && addr.street 
    ? encodeURIComponent(`${addr.street}, ${addr.city}, ${addr.zip || ''}`)
    : "Rani+Mahal+327+Mamaroneck+Ave+Mamaroneck+NY+10543";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <title>Rani Mahal Order #${shortId}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..600;1,9..144,400&family=Great+Vibes&family=Inter:wght@400;500;600;700&display=swap');
    @media only screen and (max-width: 520px) {
      .email-container { width: 100% !important; padding: 12px !important; }
      .mobile-padding { padding: 20px 16px !important; }
      .mobile-btn { display: block !important; width: 100% !important; margin-bottom: 8px !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#080706;font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;-webkit-font-smoothing:antialiased;color:#FAF6EF;">

  <!-- Main Wrapper -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#080706;padding:20px 0;">
    <tr>
      <td align="center">
        <!-- Mobile-First 520px Container -->
        <table role="presentation" class="email-container" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;background-color:#12100e;border:1px solid rgba(232,168,46,0.3);border-radius:16px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,0.8);">

          <!-- BRAND HEADER -->
          <tr>
            <td style="background-color:#080706;padding:28px 20px 20px;text-align:center;border-bottom:2px solid #E8A82E;">
              <div style="margin-bottom:10px;">
                <img src="https://ranimahal.food/logo/apsara-square.png" alt="Rani Mahal Logo" width="60" height="60" style="display:block;margin:0 auto;border:0;outline:none;border-radius:50%;box-shadow:0 0 16px rgba(232,168,46,0.4);" />
              </div>
              <h1 style="font-family:'Great Vibes',cursive,Georgia,serif;font-size:36px;font-weight:400;color:#FAF6EF;margin:0 0 2px;line-height:1;">Rani Mahal</h1>
              <p style="font-family:'Inter',sans-serif;font-size:10px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;color:#E8A82E;margin:0;">Fine Indian Cuisine · Mamaroneck, NY</p>
            </td>
          </tr>

          <!-- STATUS & ORDER # BAR -->
          <tr>
            <td style="background-color:#1c1814;padding:16px 20px;border-bottom:1px solid rgba(250,246,239,0.08);">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="font-family:'Inter',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#E8A82E;">
                    ${eyebrow}
                  </td>
                  <td align="right">
                    <span style="display:inline-block;padding:4px 10px;background:#12100e;border:1px solid rgba(232,168,46,0.35);border-radius:16px;font-family:'Inter',sans-serif;font-size:11px;font-weight:700;color:#FAF6EF;">
                      ORDER #${shortId}
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Mobile Step Tracker -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:16px;margin-bottom:4px;">
                <tr>
                  <td align="center" style="vertical-align:middle;width:20px;">
                    <div style="width:12px;height:12px;border-radius:50%;background-color:${step1Color};box-shadow:0 0 8px ${step1Color};margin:0 auto;"></div>
                  </td>
                  <td style="vertical-align:middle;padding:0 2px;">
                    <div style="height:3px;background-color:${line1Color};border-radius:2px;"></div>
                  </td>
                  <td align="center" style="vertical-align:middle;width:20px;">
                    <div style="width:12px;height:12px;border-radius:50%;background-color:${step2Color};${isInProgress || isDone ? "box-shadow:0 0 8px #E8A82E;" : ""}margin:0 auto;"></div>
                  </td>
                  <td style="vertical-align:middle;padding:0 2px;">
                    <div style="height:3px;background-color:${line2Color};border-radius:2px;"></div>
                  </td>
                  <td align="center" style="vertical-align:middle;width:20px;">
                    <div style="width:12px;height:12px;border-radius:50%;background-color:${step3Color};${isDone ? "box-shadow:0 0 8px #E8A82E;" : ""}margin:0 auto;"></div>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top:6px;"><span style="font-size:9px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#E8A82E;">Received</span></td>
                  <td></td>
                  <td align="center" style="padding-top:6px;"><span style="font-size:9px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${isInProgress || isDone ? "#E8A82E" : "#B8A995"};">Preparing</span></td>
                  <td></td>
                  <td align="center" style="padding-top:6px;"><span style="font-size:9px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${isDone ? "#E8A82E" : "#B8A995"};">${step3Label}</span></td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- MAIN CONTENT BODY -->
          <tr>
            <td class="mobile-padding" style="padding:24px 20px;">
              ${heading ? `<h2 style="font-family:'Fraunces',Georgia,serif;font-size:20px;font-weight:500;color:#FAF6EF;margin:0 0 16px;line-height:1.3;">${heading}</h2>` : ""}
              ${bodyBefore}

              <!-- MOBILE FULFILLMENT CARD (No map dependencies) -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#1c1814;border:1px solid rgba(232,168,46,0.25);border-radius:12px;margin-bottom:20px;">
                <tr>
                  <td style="padding:16px;">
                    <p style="font-family:'Inter',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#E8A82E;margin:0 0 6px;">
                      ${isDelivery ? "🚗 Delivery Destination" : "🛍️ Pickup Location"}
                    </p>
                    ${isDelivery ? `
                      <p style="font-family:'Fraunces',Georgia,serif;font-size:15px;color:#FAF6EF;margin:0 0 4px;font-weight:500;line-height:1.3;">
                        ${addr.street || "Delivery Order"}${addr.apt ? `, ${addr.apt}` : ""}
                      </p>
                      <p style="font-family:'Inter',sans-serif;font-size:12px;color:#B8A995;margin:0 0 14px;line-height:1.5;">
                        ${addr.city || "Mamaroneck"}, NY ${addr.zip || ""}<br/>
                        Estimated arrival: <strong style="color:#FAF6EF;">45–60 mins</strong>
                        ${addr.notes ? `<br/><span style="color:#E8A82E;font-style:italic;">Driver Note: "${addr.notes}"</span>` : ""}
                      </p>
                    ` : `
                      <p style="font-family:'Fraunces',Georgia,serif;font-size:15px;color:#FAF6EF;margin:0 0 4px;font-weight:500;line-height:1.3;">
                        327 Mamaroneck Ave &amp; 320–322 Phillips Park Rd
                      </p>
                      <p style="font-family:'Inter',sans-serif;font-size:12px;color:#B8A995;margin:0 0 14px;line-height:1.5;">
                        Mamaroneck, NY 10543<br/>
                        Estimated fulfillment: <strong style="color:#FAF6EF;">25–35 mins</strong>
                      </p>
                    `}

                    <!-- ACTION BUTTONS -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td align="left">
                          <a href="https://maps.google.com/?q=${mapQuery}" target="_blank" class="mobile-btn" style="display:inline-block;padding:9px 16px;background-color:#E8A82E;color:#080706;border-radius:20px;font-family:'Inter',sans-serif;font-size:11px;font-weight:700;text-decoration:none;margin-right:6px;">
                            ${isDelivery ? "Open Map →" : "Get Directions →"}
                          </a>
                          <a href="tel:9148359066" class="mobile-btn" style="display:inline-block;padding:8px 14px;background-color:transparent;color:#FAF6EF;border:1px solid rgba(250,246,239,0.25);border-radius:20px;font-family:'Inter',sans-serif;font-size:11px;font-weight:600;text-decoration:none;">
                            Call (914) 835-9066
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- ITEMIZED ORDER SUMMARY -->
              <p style="font-family:'Inter',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#E8A82E;margin:0 0 10px;">Itemized Summary</p>
              
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:20px;">
                <thead>
                  <tr style="border-bottom:1px solid rgba(232,168,46,0.3);">
                    <th align="left" style="padding-bottom:8px;font-family:'Inter',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#B8A995;">Item</th>
                    <th align="center" style="padding-bottom:8px;font-family:'Inter',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#B8A995;">Qty</th>
                    <th align="right" style="padding-bottom:8px;font-family:'Inter',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#B8A995;">Price</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsTable(order.items)}
                </tbody>
              </table>

              <!-- FINANCIAL BREAKDOWN -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#1c1814;border-radius:12px;padding:16px;margin-bottom:20px;">
                <tr>
                  <td style="font-family:'Inter',sans-serif;font-size:13px;color:#B8A995;padding:4px 0;">Subtotal</td>
                  <td align="right" style="font-family:'Inter',sans-serif;font-size:13px;color:#FAF6EF;padding:4px 0;">$${order.subtotal.toFixed(2)}</td>
                </tr>
                ${isDelivery ? `
                <tr>
                  <td style="font-family:'Inter',sans-serif;font-size:13px;color:#B8A995;padding:4px 0;">Delivery Fee</td>
                  <td align="right" style="font-family:'Inter',sans-serif;font-size:13px;color:#FAF6EF;padding:4px 0;">${(order.deliveryFee || 0) === 0 ? '<strong style="color:#E8A82E;">FREE</strong>' : `$${(order.deliveryFee || 0).toFixed(2)}`}</td>
                </tr>` : ""}
                <tr>
                  <td style="font-family:'Inter',sans-serif;font-size:13px;color:#B8A995;padding:4px 0;">Tax (est. 8.375%)</td>
                  <td align="right" style="font-family:'Inter',sans-serif;font-size:13px;color:#FAF6EF;padding:4px 0;">$${order.tax.toFixed(2)}</td>
                </tr>
                ${order.tip > 0 ? `
                <tr>
                  <td style="font-family:'Inter',sans-serif;font-size:13px;color:#B8A995;padding:4px 0;">Tip</td>
                  <td align="right" style="font-family:'Inter',sans-serif;font-size:13px;color:#FAF6EF;padding:4px 0;">$${order.tip.toFixed(2)}</td>
                </tr>` : ""}
                <tr>
                  <td style="border-top:1px solid rgba(250,246,239,0.12);padding-top:10px;font-family:'Fraunces',Georgia,serif;font-size:16px;font-weight:600;color:#FAF6EF;">Total Charged</td>
                  <td align="right" style="border-top:1px solid rgba(250,246,239,0.12);padding-top:10px;font-family:'Inter',sans-serif;font-size:19px;font-weight:700;color:#E8A82E;">$${order.total.toFixed(2)}</td>
                </tr>
              </table>

              <!-- SPECIAL INSTRUCTIONS -->
              ${order.specialInstructions ? `
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#1c1814;border-left:3px solid #E8A82E;border-radius:0 8px 8px 0;padding:12px 14px;margin-bottom:20px;">
                <tr>
                  <td style="font-family:'Inter',sans-serif;font-size:13px;color:#FAF6EF;line-height:1.5;">
                    <strong style="color:#E8A82E;text-transform:uppercase;font-size:11px;letter-spacing:0.1em;display:block;margin-bottom:2px;">Special Instructions:</strong>
                    ${order.specialInstructions}
                  </td>
                </tr>
              </table>` : ""}

              ${bodyAfter}
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background-color:#080706;padding:20px;text-align:center;border-top:1px solid rgba(250,246,239,0.08);">
              <p style="font-family:'Inter',sans-serif;font-size:12px;color:#B8A995;margin:0 0 10px;">
                <a href="https://ranimahal.food" target="_blank" style="color:#E8A82E;text-decoration:none;font-weight:600;">Online Menu</a> &nbsp;·&nbsp;
                <a href="https://ranimahalny.instagift.com/" target="_blank" style="color:#E8A82E;text-decoration:none;font-weight:600;">Gift Cards</a>
              </p>

              <p style="font-family:'Inter',sans-serif;font-size:11px;color:#B8A995;margin:0;line-height:1.5;">
                <strong style="color:#FAF6EF;">Rani Mahal Fine Indian Cuisine</strong><br/>
                327 Mamaroneck Ave &amp; 320–322 Phillips Park Rd<br/>
                Mamaroneck, NY 10543
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
}

/**
 * Staff-facing new-order alert — sent to the restaurant.
 */
export async function sendOrderEmail(order) {
  const { RESTAURANT_EMAIL } = process.env;
  const recipients = (RESTAURANT_EMAIL ?? "orders@ranimahal.food").split(",").map(s => s.trim()).filter(Boolean);

  const html = orderEmailShell({
    eyebrow: "NEW ORDER ALERT",
    heading: `Incoming Order from <strong>${order.customerName}</strong>`,
    order,
  });

  await sendEmail({
    to: recipients,
    subject: `🍽 New Order #${order.id.slice(-6).toUpperCase()} — $${order.total.toFixed(2)}`,
    html,
  });
}

/**
 * Customer-facing receipt — sent upon checkout payment success.
 */
export async function sendCustomerReceiptEmail(order) {
  if (!order.customerEmail) return;

  const html = orderEmailShell({
    eyebrow: "ORDER CONFIRMED",
    heading: `Thank you, ${order.customerName === "Guest" ? "you" : order.customerName}! We've received your order.`,
    order,
  });

  await sendEmail({
    to: [order.customerEmail],
    subject: `Your Rani Mahal order is confirmed — #${order.id.slice(-6).toUpperCase()}`,
    html,
  });
}

const STATUS_EMAIL = {
  in_progress: order => ({
    heading: "Your order is being prepared in our kitchen 👨‍🍳",
    subject: `Being prepared — order #${order.id.slice(-6).toUpperCase()}`,
    note: "Our chefs are preparing your dishes fresh in the tandoor and kitchen. We'll update you as soon as it's ready for pickup.",
  }),
  done: order => ({
    heading: "Your order is ready for pickup! 🎉",
    subject: `Ready for pickup — order #${order.id.slice(-6).toUpperCase()}`,
    note: "Your order is packed fresh and waiting for you at 327 Mamaroneck Ave. Come on in!",
  }),
};

/**
 * Status-change email — "in progress" / "ready for pickup".
 */
export async function sendCustomerStatusEmail(order) {
  const build = STATUS_EMAIL[order.status];
  if (!build || !order.customerEmail) return;

  const { heading, subject, note } = build(order);
  const html = orderEmailShell({
    eyebrow: "ORDER UPDATE",
    heading,
    bodyBefore: `
      <p style="font-family:'Inter',sans-serif;font-size:14px;color:#FAF6EF;line-height:1.6;margin-bottom:20px;background:#1c1814;padding:14px;border-radius:8px;border-left:3px solid #E8A82E;">
        ${note}
      </p>`,
    order,
  });

  await sendEmail({ to: [order.customerEmail], subject, html });
}

/**
 * Send SMS via Twilio
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
