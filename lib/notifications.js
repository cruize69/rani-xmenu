// ── Notifications: Email (Resend) + SMS (Twilio) ─────────────────
// Luxury, high-end HTML email template designed to match Rani Mahal's brand aesthetics.

const FROM = "orders@ranimahal.food";

export async function sendEmail({ to, subject, html }) {
  const { RESEND_API_KEY } = process.env;
  if (!RESEND_API_KEY) { console.warn("RESEND_API_KEY not set in environment variables, skipping email"); return; }

  const recipientList = Array.isArray(to) ? to : [to];

  await Promise.all(
    recipientList.map(recipient =>
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({ from: FROM, to: recipient, subject, html }),
      }).then(async res => {
        if (!res.ok) console.error(`Resend send error for ${recipient}:`, await res.text());
      }).catch(err => console.error(`Resend error for ${recipient}:`, err))
    )
  );
}

// Generic customer-facing SMS sender (distinct from sendOrderSMS below,
// which notifies the restaurant's own phone about a new order).
export async function sendSMS(to, body) {
  // API Key (scoped, revocable) rather than the master Account SID + Auth
  // Token — Account SID is still needed in the URL to identify the account,
  // but the credential itself is the API Key SID/Secret pair.
  const { TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, TWILIO_FROM } = process.env;
  if (!TWILIO_API_KEY_SID || !to) { if (!TWILIO_API_KEY_SID) console.warn("Twilio not configured, skipping SMS"); return; }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${TWILIO_API_KEY_SID}:${TWILIO_API_KEY_SECRET}`).toString("base64")}`,
    },
    body: new URLSearchParams({ From: TWILIO_FROM, To: to, Body: body }),
  });
  if (!res.ok) console.error("Twilio error:", await res.text());
}

function itemsTable(items) {
  return items.map(i => {
    const spiceMarkup = i.spice
      ? `<span style="display:inline-block;margin-left:6px;padding:2px 7px;background:rgba(232,168,46,0.15);color:#E8A82E;border:1px solid rgba(232,168,46,0.4);border-radius:6px;font-size:10px;font-weight:600;font-family:'Inter',sans-serif;letter-spacing:0.04em;">${i.spice}</span>`
      : "";
    const noteMarkup = i.note
      ? `<div style="font-size:12px;color:#B8A995;font-style:italic;margin-top:4px;font-family:'Inter',sans-serif;line-height:1.4;">Note: "${i.note}"</div>`
      : "";

    return `
      <tr>
        <td width="62%" style="padding:14px 0;border-bottom:1px solid rgba(250,246,239,0.08);vertical-align:top;">
          <div style="font-family:'Fraunces',Georgia,serif;font-size:15px;color:#FAF6EF;font-weight:500;line-height:1.35;">
            ${i.name} ${spiceMarkup}
          </div>
          ${noteMarkup}
        </td>
        <td width="15%" align="center" style="padding:14px 0;border-bottom:1px solid rgba(250,246,239,0.08);vertical-align:top;">
          <span style="display:inline-block;padding:3px 9px;background:#1c1814;border:1px solid rgba(232,168,46,0.3);border-radius:12px;font-family:'Inter',sans-serif;font-size:12px;font-weight:700;color:#E8A82E;">${i.qty}</span>
        </td>
        <td width="23%" align="right" style="padding:14px 0;border-bottom:1px solid rgba(250,246,239,0.08);vertical-align:top;font-family:'Inter',sans-serif;font-size:14px;font-weight:700;color:#FAF6EF;">
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
  const isDelivery = order.orderMode === "delivery";
  const addr = order.deliveryAddress || {};

  const step2Label = isDelivery ? (isDone ? "Delivered" : "Delivery") : "Ready";

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
      .email-container { width: 100% !important; padding: 0 !important; }
      .mobile-padding { padding: 20px 16px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#080706;font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;-webkit-font-smoothing:antialiased;color:#FAF6EF;">

  <!-- Main Canvas Wrapper -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#080706;padding:24px 8px 48px;">
    <tr>
      <td align="center">
        <!-- Mobile 520px Outer Card -->
        <table role="presentation" class="email-container" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;background-color:#12100e;border:1px solid rgba(232,168,46,0.35);border-radius:18px;overflow:hidden;box-shadow:0 16px 48px rgba(0,0,0,0.85);">

          <!-- 👑 BRAND HEADER -->
          <tr>
            <td style="background-color:#0d0c0a;padding:32px 20px 22px;text-align:center;border-bottom:2px solid #E8A82E;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center">
                    <img src="https://ranimahal.food/logo/apsara-logo-256.png" alt="Rani Mahal Logo" width="64" height="64" style="display:block;margin:0 auto 10px;border:0;outline:none;border-radius:50%;box-shadow:0 0 18px rgba(232,168,46,0.45);" />
                    <h1 style="font-family:'Great Vibes',cursive,Georgia,serif;font-size:38px;font-weight:400;color:#FAF6EF;margin:0 0 2px;line-height:1;">Rani Mahal</h1>
                    <p style="font-family:'Inter',sans-serif;font-size:10px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#E8A82E;margin:0;">Fine Indian Cuisine · Mamaroneck, NY</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 📊 STATUS BAR & ORDER # -->
          <tr>
            <td style="background-color:#1a1612;padding:18px 20px;border-bottom:1px solid rgba(250,246,239,0.08);">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:16px;">
                <tr>
                  <td style="font-family:'Inter',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#E8A82E;">
                    ${eyebrow}
                  </td>
                  <td align="right">
                    <span style="display:inline-block;padding:5px 12px;background:#12100e;border:1px solid rgba(232,168,46,0.4);border-radius:16px;font-family:'Inter',sans-serif;font-size:11px;font-weight:700;color:#FAF6EF;letter-spacing:0.04em;">
                      ORDER #${shortId}
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Connected 2-Step Progress Light Tracker -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <!-- Step 1 Node -->
                  <td width="20" align="center" style="vertical-align:middle;">
                    <div style="width:14px;height:14px;border-radius:50%;background-color:#E8A82E;box-shadow:0 0 10px #E8A82E;"></div>
                  </td>
                  <!-- Connecting Line -->
                  <td style="vertical-align:middle;padding:0 6px;">
                    <div style="height:3px;background-color:${isDone ? "#E8A82E" : "#342820"};border-radius:2px;"></div>
                  </td>
                  <!-- Step 2 Node -->
                  <td width="20" align="center" style="vertical-align:middle;">
                    <div style="width:14px;height:14px;border-radius:50%;background-color:${isDone ? "#E8A82E" : "#1e1812"};border:2px solid ${isDone ? "#E8A82E" : "#4a3c2e"};${isDone ? "box-shadow:0 0 10px #E8A82E;" : ""}"></div>
                  </td>
                </tr>
                <tr>
                  <td align="left" style="padding-top:8px;" colspan="2">
                    <span style="font-family:'Inter',sans-serif;font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#E8A82E;">Received</span>
                  </td>
                  <td align="right" style="padding-top:8px;">
                    <span style="font-family:'Inter',sans-serif;font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${isDone ? "#E8A82E" : "#8A7560"};">${step2Label}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 📝 MAIN BODY CONTENT -->
          <tr>
            <td class="mobile-padding" style="padding:26px 20px;">
              ${heading ? `<h2 style="font-family:'Fraunces',Georgia,serif;font-size:21px;font-weight:500;color:#FAF6EF;margin:0 0 18px;line-height:1.35;">${heading}</h2>` : ""}
              ${bodyBefore}

              <!-- 🚗 / 🛍️ FULFILLMENT CARD (Perfectly Spaced & Mobile Optimized) -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#1a1612;border:1px solid rgba(232,168,46,0.25);border-radius:14px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px 18px;">
                    <p style="font-family:'Inter',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#E8A82E;margin:0 0 8px;">
                      ${isDelivery ? "DELIVERY DESTINATION" : "PICKUP LOCATION"}
                    </p>

                    <p style="font-family:'Fraunces',Georgia,serif;font-size:16px;color:#FAF6EF;margin:0 0 4px;font-weight:500;line-height:1.35;">
                      ${isDelivery ? `${addr.street || "Delivery Order"}${addr.apt ? `, ${addr.apt}` : ""}` : "327 Mamaroneck Ave &amp; 320–322 Phillips Park Rd"}
                    </p>
                    <p style="font-family:'Inter',sans-serif;font-size:13px;color:#B8A995;margin:0 0 ${addr.notes ? '12px' : '18px'};line-height:1.5;">
                      ${isDelivery ? `${addr.city || "Mamaroneck"}, NY ${addr.zip || ""}` : "Mamaroneck, NY 10543"}<br/>
                      Estimated ${isDelivery ? "arrival" : "fulfillment"}: <strong style="color:#FAF6EF;">${isDelivery ? "45–60 mins" : "25–35 mins"}</strong>
                    </p>

                    ${addr.notes ? `
                    <!-- Driver Note Badge -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:rgba(232,168,46,0.08);border-left:3px solid #E8A82E;border-radius:0 8px 8px 0;margin-bottom:18px;">
                      <tr>
                        <td style="padding:10px 12px;">
                          <span style="font-family:'Inter',sans-serif;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#E8A82E;display:block;margin-bottom:2px;">DRIVER NOTE</span>
                          <span style="font-family:'Inter',sans-serif;font-size:12px;color:#FAF6EF;font-style:italic;line-height:1.4;display:block;">"${addr.notes}"</span>
                        </td>
                      </tr>
                    </table>` : ""}

                    <!-- Robust Table-Cell Full-Width Action Buttons -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td align="center" style="background-color:#E8A82E;border-radius:22px;padding:12px 0;">
                          <a href="https://maps.google.com/?q=${mapQuery}" target="_blank" style="display:block;font-family:'Inter',sans-serif;font-size:13px;font-weight:700;color:#080706;text-decoration:none;text-align:center;width:100%;">
                            ${isDelivery ? "Open Map →" : "Get Directions →"}
                          </a>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-top:10px;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                            <tr>
                              <td align="center" style="background-color:transparent;border:1px solid rgba(250,246,239,0.3);border-radius:22px;padding:11px 0;">
                                <a href="tel:9148359066" style="display:block;font-family:'Inter',sans-serif;font-size:13px;font-weight:600;color:#FAF6EF;text-decoration:none;text-align:center;width:100%;">
                                  Call (914) 835-9066
                                </a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- 📋 ITEMIZED ORDER SUMMARY -->
              <p style="font-family:'Inter',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#E8A82E;margin:0 0 12px;">ITEMIZED SUMMARY</p>
              
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:24px;">
                <thead>
                  <tr style="border-bottom:1px solid rgba(232,168,46,0.35);">
                    <th width="62%" align="left" style="padding-bottom:10px;font-family:'Inter',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#B8A995;">ITEM</th>
                    <th width="15%" align="center" style="padding-bottom:10px;font-family:'Inter',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#B8A995;">QTY</th>
                    <th width="23%" align="right" style="padding-bottom:10px;font-family:'Inter',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#B8A995;">PRICE</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsTable(order.items)}
                </tbody>
              </table>

              <!-- 💵 FINANCIAL BREAKDOWN -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#1a1612;border-radius:14px;padding:18px;margin-bottom:24px;border:1px solid rgba(250,246,239,0.06);">
                <tr>
                  <td style="font-family:'Inter',sans-serif;font-size:13px;color:#B8A995;padding:5px 0;">Subtotal</td>
                  <td align="right" style="font-family:'Inter',sans-serif;font-size:13px;color:#FAF6EF;padding:5px 0;">$${order.subtotal.toFixed(2)}</td>
                </tr>
                ${isDelivery ? `
                <tr>
                  <td style="font-family:'Inter',sans-serif;font-size:13px;color:#B8A995;padding:5px 0;">Delivery Fee</td>
                  <td align="right" style="font-family:'Inter',sans-serif;font-size:13px;color:#FAF6EF;padding:5px 0;">${(order.deliveryFee || 0) === 0 ? '<strong style="color:#E8A82E;">FREE</strong>' : `$${(order.deliveryFee || 0).toFixed(2)}`}</td>
                </tr>` : ""}
                <tr>
                  <td style="font-family:'Inter',sans-serif;font-size:13px;color:#B8A995;padding:5px 0;">Tax (est. 8.375%)</td>
                  <td align="right" style="font-family:'Inter',sans-serif;font-size:13px;color:#FAF6EF;padding:5px 0;">$${order.tax.toFixed(2)}</td>
                </tr>
                ${order.tip > 0 ? `
                <tr>
                  <td style="font-family:'Inter',sans-serif;font-size:13px;color:#B8A995;padding:5px 0;">Tip</td>
                  <td align="right" style="font-family:'Inter',sans-serif;font-size:13px;color:#FAF6EF;padding:5px 0;">$${order.tip.toFixed(2)}</td>
                </tr>` : ""}
                ${order.ccFee > 0 ? `
                <tr>
                  <td style="font-family:'Inter',sans-serif;font-size:13px;color:#B8A995;padding:5px 0;">Credit Card Processing Fee</td>
                  <td align="right" style="font-family:'Inter',sans-serif;font-size:13px;color:#FAF6EF;padding:5px 0;">$${order.ccFee.toFixed(2)}</td>
                </tr>` : ""}
                <tr>
                  <td style="border-top:1px solid rgba(250,246,239,0.12);padding-top:12px;font-family:'Fraunces',Georgia,serif;font-size:16px;font-weight:600;color:#FAF6EF;">Total Charged</td>
                  <td align="right" style="border-top:1px solid rgba(250,246,239,0.12);padding-top:12px;font-family:'Inter',sans-serif;font-size:20px;font-weight:700;color:#E8A82E;">$${order.total.toFixed(2)}</td>
                </tr>
              </table>

              <!-- SPECIAL INSTRUCTIONS -->
              ${order.specialInstructions ? `
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#1a1612;border-left:3px solid #E8A82E;border-radius:0 10px 10px 0;padding:14px 16px;margin-bottom:24px;">
                <tr>
                  <td style="font-family:'Inter',sans-serif;font-size:13px;color:#FAF6EF;line-height:1.5;">
                    <strong style="color:#E8A82E;text-transform:uppercase;font-size:11px;letter-spacing:0.1em;display:block;margin-bottom:3px;">Special Instructions:</strong>
                    ${order.specialInstructions}
                  </td>
                </tr>
              </table>` : ""}

              ${bodyAfter}
            </td>
          </tr>

          <!-- 🔻 FOOTER -->
          <tr>
            <td style="background-color:#0d0c0a;padding:24px 20px 28px;text-align:center;border-top:1px solid rgba(250,246,239,0.08);">
              <p style="font-family:'Inter',sans-serif;font-size:12px;color:#B8A995;margin:0 0 12px;line-height:1.8;">
                <a href="https://ranimahal.food" target="_blank" style="color:#E8A82E;text-decoration:none;font-weight:600;">Online Menu</a> &nbsp;·&nbsp;
                <a href="https://ranimahalny.instagift.com/" target="_blank" style="color:#E8A82E;text-decoration:none;font-weight:600;">Gift Cards</a>
              </p>

              <p style="font-family:'Inter',sans-serif;font-size:11px;color:#B8A995;margin:0;line-height:1.6;">
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
 * Staff-facing new-order alert — sent to staff (ranimahal327@gmail.com, riyadhjuwel@gmail.com, ajalil001@gmail.com).
 */
export async function sendOrderEmail(order) {
  const { RESTAURANT_EMAIL } = process.env;
  const hardcodedStaff = ["ranimahal327@gmail.com", "riyadhjuwel@gmail.com", "ajalil001@gmail.com"];
  const envStaff = (RESTAURANT_EMAIL || "").split(",").map(s => s.trim()).filter(Boolean);
  const recipients = Array.from(new Set([...hardcodedStaff, ...envStaff]));

  const isDelivery = order.orderMode === "delivery";
  const shortId = order.id.slice(-6).toUpperCase();
  const townName = order.deliveryAddress?.city?.trim() || "Westchester";
  const modeLabel = isDelivery ? `DELIVERY [${townName}]` : "PICKUP";

  const subject = `${modeLabel} — ${order.customerName} (#${shortId}) — $${order.total.toFixed(2)}`;

  const html = orderEmailShell({
    eyebrow: isDelivery ? `NEW DELIVERY ORDER · ${townName.toUpperCase()}` : "NEW PICKUP ORDER",
    heading: `Incoming ${isDelivery ? `Delivery (${townName})` : "Pickup"} Order from <strong>${order.customerName}</strong>`,
    order,
  });

  await sendEmail({
    to: recipients,
    subject,
    html,
  });
}

function reorderVoucherBlock(order) {
  if (!order.reorderToken) return "";
  const link = `https://ranimahal.food/?reorder=${order.reorderToken}`;
  return `
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#1a1612;border:1px dashed rgba(232,168,46,0.5);border-radius:14px;margin-bottom:24px;">
                <tr>
                  <td style="padding:18px;text-align:center;">
                    <p style="font-family:'Inter',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#E8A82E;margin:0 0 6px;">Your Next Order</p>
                    <p style="font-family:'Fraunces',Georgia,serif;font-size:16px;color:#FAF6EF;margin:0 0 12px;">Take <strong style="color:#E8A82E;">10% off</strong> anytime in the next 14 days.</p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td align="center" style="background-color:transparent;border:1.5px solid #E8A82E;border-radius:22px;padding:11px 0;">
                          <a href="${link}" style="display:block;font-family:'Inter',sans-serif;font-size:13px;font-weight:700;color:#E8A82E;text-decoration:none;text-align:center;width:100%;">
                            Reorder & Save 10% →
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>`;
}

/**
 * Customer-facing receipt — sent upon checkout payment success.
 */
export async function sendCustomerReceiptEmail(order) {
  if (!order.customerEmail) return;

  const html = orderEmailShell({
    eyebrow: "ORDER CONFIRMED",
    heading: `Thank you, ${order.customerName === "Guest" ? "you" : order.customerName}! We've received your order.`,
    bodyAfter: reorderVoucherBlock(order),
    order,
  });

  await sendEmail({
    to: [order.customerEmail],
    subject: `Your Rani Mahal order is confirmed — #${order.id.slice(-6).toUpperCase()}`,
    html,
  });
}

const GOOGLE_WRITE_REVIEW_URL = "https://search.google.com/local/writereview?placeid=ChIJ-e8g42CPwkARJ8x0N64s04E";

const STATUS_EMAIL = {
  done: order => ({
    heading: order.orderMode === "delivery" ? "Your order is completed! 🚗" : "Your order is ready for pickup! 🎉",
    subject: order.orderMode === "delivery"
      ? `Order completed — #${order.id.slice(-6).toUpperCase()}`
      : `Ready for pickup — order #${order.id.slice(-6).toUpperCase()}`,
    note: order.orderMode === "delivery"
      ? "Your order has been completed and dispatched for delivery. Enjoy your meal!"
      : "Your order is packed fresh and waiting for you at 327 Mamaroneck Ave. Come on in!",
    // Delivery "done" means it's actually in the customer's hands; pickup
    // "done" just means it's bagged and waiting — asking for a review before
    // they've picked up or tasted anything would be premature, so only
    // delivery gets the ask here.
    showReviewAsk: order.orderMode === "delivery",
  }),
};

function reviewAskBlock() {
  return `
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:24px;">
                <tr>
                  <td align="center" style="padding-top:4px;">
                    <p style="font-family:'Inter',sans-serif;font-size:13px;color:#B8A995;margin:0 0 10px;">Enjoying your meal? A quick review helps us more than you'd think.</p>
                    <a href="${GOOGLE_WRITE_REVIEW_URL}" target="_blank" style="display:inline-block;font-family:'Inter',sans-serif;font-size:12.5px;font-weight:700;color:#E8A82E;text-decoration:none;border:1px solid rgba(232,168,46,0.4);border-radius:20px;padding:9px 20px;">
                    ⭐ Leave a Google Review
                    </a>
                  </td>
                </tr>
              </table>`;
}

/**
 * Status-change email — "in progress" / "ready for pickup".
 */
export async function sendCustomerStatusEmail(order) {
  const build = STATUS_EMAIL[order.status];
  if (!build || !order.customerEmail) return;

  const { heading, subject, note, showReviewAsk } = build(order);
  const html = orderEmailShell({
    eyebrow: "ORDER UPDATE",
    bodyAfter: showReviewAsk ? reviewAskBlock() : "",
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
 * Send an operational/staff SMS (new order, checkout-error alert, etc.) to
 * every number in RESTAURANT_PHONE — comma-separated, same convention as
 * RESTAURANT_EMAIL above. A single number works too (no comma needed).
 */
export async function sendStaffSMS(body) {
  const { TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, TWILIO_FROM, RESTAURANT_PHONE } = process.env;
  if (!TWILIO_API_KEY_SID) { console.warn("Twilio not configured, skipping SMS"); return; }

  const numbers = (RESTAURANT_PHONE || "").split(",").map(s => s.trim()).filter(Boolean);
  if (numbers.length === 0) { console.warn("RESTAURANT_PHONE not set, skipping staff SMS"); return; }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  await Promise.all(numbers.map(async to => {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${TWILIO_API_KEY_SID}:${TWILIO_API_KEY_SECRET}`).toString("base64")}`,
      },
      body: new URLSearchParams({ From: TWILIO_FROM, To: to, Body: body }),
    });
    if (!res.ok) console.error(`Twilio error sending to ${to}:`, await res.text());
  }));
}

/**
 * Send SMS via Twilio — staff-facing new-order alert.
 */
export async function sendOrderSMS(order) {
  const items = order.items.map(i => `${i.qty}x ${i.name}${i.spice ? ` (${i.spice})` : ""}`).join(", ");
  const body = `🍽 Rani Mahal — New Order #${order.id.slice(-6).toUpperCase()}\n${items}\nTotal: $${order.total.toFixed(2)}\n${new Date(order.createdAt).toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit" })}`;
  await sendStaffSMS(body);
}
