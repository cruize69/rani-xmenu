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

// Every value below that originates from a customer (item notes, spice text,
// delivery notes, special instructions, the name Stripe collected) is escaped
// before it reaches this HTML. Without it a customer can inject arbitrary
// markup into the staff order email — verified: a live phishing <a>, a fake
// "REFUND ISSUED" heading that broke out of its container, and a spoofed
// "card declined, call this number" banner all rendered. Staff email is a
// trusted internal channel; treat every order field as hostile input.
export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ── Shared branded shell for every lifecycle/marketing email ─────────
// Every marketing email below (review nudge, win-back, second-order push,
// newsletter, never-ordered, catering cross-sell) previously rendered as a
// standalone styled div with no actual header or footer — no logo image,
// no restaurant name/address, nothing a mail client's spam heuristics or a
// human skimming their inbox could recognize as "this is Rani Mahal, the
// same place I ordered from." lib/abandonedCart.js's own templates were
// worse still: plain unstyled <p> tags, zero branding at all. This wraps
// every one of them in the same logo/name header and address/links footer,
// so repeated exposure actually builds the brand recognition that keeps
// these out of spam over time — the exact problem being fixed.
function marketingEmailShell(innerHtml) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <title>Rani Mahal</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Great+Vibes&family=Inter:wght@400;500;600;700&display=swap');
  </style>
</head>
<body style="margin:0;padding:0;background-color:#080706;font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#080706;padding:28px 8px 40px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:480px;">
          <tr>
            <td style="text-align:center;padding:4px 0 22px;">
              <img src="https://ranimahal.food/logo/apsara-logo-256.png" alt="Rani Mahal" width="56" height="56" style="display:block;margin:0 auto 10px;border:0;outline:none;border-radius:50%;box-shadow:0 0 18px rgba(232,168,46,0.4);" />
              <div style="font-family:'Great Vibes',cursive,Georgia,serif;font-size:34px;font-weight:400;color:#FAF6EF;line-height:1;">Rani Mahal</div>
              <div style="font-family:'Inter',sans-serif;font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#E8A82E;margin-top:5px;">Fine Indian Cuisine · Mamaroneck, NY</div>
            </td>
          </tr>
          <tr><td>${innerHtml}</td></tr>
          <tr>
            <td style="text-align:center;padding:24px 0 0;">
              <p style="font-family:'Inter',sans-serif;font-size:12px;color:#B8A995;margin:0 0 12px;line-height:1.8;">
                <a href="https://ranimahal.food" target="_blank" style="color:#E8A82E;text-decoration:none;font-weight:600;">Online Menu</a> &nbsp;·&nbsp;
                <a href="https://ranimahal.food/rewards" target="_blank" style="color:#E8A82E;text-decoration:none;font-weight:600;">Rani Royal Club</a>
              </p>
              <p style="font-family:'Inter',sans-serif;font-size:11px;color:#8A7560;margin:0;line-height:1.6;">
                <strong style="color:#B8A995;">Rani Mahal Fine Indian Cuisine</strong><br/>
                327 Mamaroneck Ave &amp; 320–322 Phillips Park Rd, Mamaroneck, NY 10543<br/>
                (914) 835-9066
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

function itemsTable(items) {
  return items.map(i => {
    const spiceMarkup = i.spice
      ? `<span style="display:inline-block;margin-left:6px;padding:2px 7px;background:rgba(232,168,46,0.15);color:#E8A82E;border:1px solid rgba(232,168,46,0.4);border-radius:6px;font-size:10px;font-weight:600;font-family:'Inter',sans-serif;letter-spacing:0.04em;">${escapeHtml(i.spice)}</span>`
      : "";
    const noteMarkup = i.note
      ? `<div style="font-size:12px;color:#B8A995;font-style:italic;margin-top:4px;font-family:'Inter',sans-serif;line-height:1.4;">Note: "${escapeHtml(i.note)}"</div>`
      : "";

    return `
      <tr>
        <td width="62%" style="padding:14px 0;border-bottom:1px solid rgba(250,246,239,0.08);vertical-align:top;">
          <div style="font-family:'Fraunces',Georgia,serif;font-size:15px;color:#FAF6EF;font-weight:500;line-height:1.35;">
            ${escapeHtml(i.name)} ${spiceMarkup}
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
                      ${isDelivery ? `${escapeHtml(addr.street || "Delivery Order")}${addr.apt ? `, ${escapeHtml(addr.apt)}` : ""}` : "327 Mamaroneck Ave &amp; 320–322 Phillips Park Rd"}
                    </p>
                    <p style="font-family:'Inter',sans-serif;font-size:13px;color:#B8A995;margin:0 0 ${addr.notes ? '12px' : '18px'};line-height:1.5;">
                      ${isDelivery ? `${escapeHtml(addr.city || "Mamaroneck")}, NY ${escapeHtml(addr.zip || "")}` : "Mamaroneck, NY 10543"}<br/>
                      Estimated ${isDelivery ? "arrival" : "fulfillment"}: <strong style="color:#FAF6EF;">${escapeHtml(order.estimatedTime || (isDelivery ? "45–60 min" : "25–35 min"))}</strong>
                    </p>

                    ${addr.notes ? `
                    <!-- Driver Note Badge -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:rgba(232,168,46,0.08);border-left:3px solid #E8A82E;border-radius:0 8px 8px 0;margin-bottom:18px;">
                      <tr>
                        <td style="padding:10px 12px;">
                          <span style="font-family:'Inter',sans-serif;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#E8A82E;display:block;margin-bottom:2px;">DRIVER NOTE</span>
                          <span style="font-family:'Inter',sans-serif;font-size:12px;color:#FAF6EF;font-style:italic;line-height:1.4;display:block;">"${escapeHtml(addr.notes)}"</span>
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
                    ${escapeHtml(order.specialInstructions)}
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
                <a href="https://ranimahal.food/rewards" target="_blank" style="color:#E8A82E;text-decoration:none;font-weight:600;">Rani Royal Club</a> &nbsp;·&nbsp;
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
    eyebrow: isDelivery ? `NEW DELIVERY ORDER · ${escapeHtml(townName.toUpperCase())}` : "NEW PICKUP ORDER",
    heading: `Incoming ${isDelivery ? `Delivery (${escapeHtml(townName)})` : "Pickup"} Order from <strong>${escapeHtml(order.customerName)}</strong>`,
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
    heading: `Thank you, ${order.customerName === "Guest" ? "you" : escapeHtml(order.customerName)}! We've received your order.`,
    bodyAfter: reorderVoucherBlock(order),
    order,
  });

  await sendEmail({
    to: [order.customerEmail],
    subject: `Your Rani Mahal order is confirmed — #${order.id.slice(-6).toUpperCase()}`,
    html,
  });
}

// Real "Ask for reviews" short link, straight from Google Business
// Profile — lands directly in the review composer, one tap. Replaces the
// old writereview?placeid=... link (404'd) and the Maps-search fallback
// used in between (worked, but cost an extra tap).
const GOOGLE_WRITE_REVIEW_URL = "https://g.page/r/CXNevQ8KoPZSEBM/review";

// The review ask used to live here (delivery orders only, since pickup
// "done" just means bagged-and-waiting, not eaten). It's been replaced by
// api/cron/review-nudge.js, which asks BOTH pickup and delivery customers —
// timed off the real per-zone ETA plus an eating buffer instead of
// "whenever staff happen to flip the status," and dependent on nothing but
// the order having been placed. Keeping a second ask here would double-ask
// every delivery customer, so this status email is purely transactional now.
const STATUS_EMAIL = {
  done: order => ({
    heading: order.orderMode === "delivery" ? "Your order is completed! 🚗" : "Your order is ready for pickup! 🎉",
    subject: order.orderMode === "delivery"
      ? `Order completed — #${order.id.slice(-6).toUpperCase()}`
      : `Ready for pickup — order #${order.id.slice(-6).toUpperCase()}`,
    note: order.orderMode === "delivery"
      ? "Your order has been completed and dispatched for delivery. Enjoy your meal!"
      : "Your order is packed fresh and waiting for you at 327 Mamaroneck Ave. Come on in!",
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

// ── Review nudge (api/cron/review-nudge.js) ──────────────────────────
// Deliberately the SAME link and copy for every rating, sent to every
// customer — no branching by score, no incentive attached. Google's
// Business Profile policy and the FTC's 2024 Rule on Consumer Reviews (16
// CFR Part 465) both prohibit routing negative feedback away from public
// review sites while fast-tracking positive ones ("review gating"), and
// incentivized reviews carry their own disclosure problems. This earns
// trust the honest way instead: better timing than a blanket post-checkout
// ask, nothing else.
export function reviewNudgeEmailHtml({ customerName }) {
  const name = escapeHtml(customerName && customerName !== "Guest" ? customerName : "there");
  return marketingEmailShell(`
    <div style="background:#12100e;border:1px solid rgba(232,168,46,0.35);border-radius:18px;padding:32px 24px;text-align:center;color:#FAF6EF;">
      <h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 14px;">How was dinner, ${name}?</h1>
      <p style="font-size:14px;color:#B8A995;line-height:1.6;margin:0 0 24px;">We hope you enjoyed it. If you have a minute, a review helps other neighbors find us more than you'd think.</p>
      <a href="${GOOGLE_WRITE_REVIEW_URL}" style="display:inline-block;background:#E8A82E;color:#080706;font-weight:700;padding:14px 28px;border-radius:24px;text-decoration:none;font-size:14px;">⭐ Leave a Google Review</a>
    </div>`);
}

// No name interpolation here (unlike the email) — the review URL alone is
// 79 characters, and GSM-7 SMS segments are billed in 160-char blocks.
// Personalizing this specific message would push most sends into a second
// segment (2x Twilio cost) for a greeting the customer barely registers in
// a text; the email keeps the personal touch where it doesn't cost anything.
export function reviewNudgeSmsBody() {
  return `Rani Mahal: Thanks for ordering! A review helps a lot: ${GOOGLE_WRITE_REVIEW_URL} Reply STOP to opt out.`;
}

// ── Win-back (api/cron/win-back-lapsed.js) ───────────────────────────
// One rate for both segments — 10%, matching the first-order welcome rate,
// never exceeding it. A signed-in member already gets 5% on every order
// forever; if a lapsed-member win-back paid MORE than that, staying active
// would be worse than leaving and coming back, which is exactly backwards.
// 10% once, on a 14-day voucher, is generous without teaching that trick —
// a member ordering even twice in a normal month already nets more from
// the standing 5% than a single 10% comeback bump.
export function winBackEmailHtml({ customerName, link, isMember }) {
  const name = escapeHtml(customerName && customerName !== "Guest" ? customerName : "there");
  return marketingEmailShell(`
    <div style="background:#12100e;border:1px solid rgba(232,168,46,0.35);border-radius:18px;padding:32px 24px;text-align:center;color:#FAF6EF;">
      <p style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#E8A82E;font-weight:700;margin:0 0 12px;">Rani Royal Club</p>
      <h1 style="font-family:Georgia,serif;font-size:24px;margin:0 0 14px;">We miss cooking for you, ${name}</h1>
      <p style="font-size:14px;color:#B8A995;line-height:1.6;margin:0 0 24px;">It's been a while — here's 10% off to bring you back.${isMember ? " Your regular 5% member discount picks right back up on every order after this one." : " Sign in when you use it and you'll also lock in 5% off every order after."}</p>
      <a href="${link}" style="display:inline-block;background:#E8A82E;color:#080706;font-weight:700;padding:14px 28px;border-radius:24px;text-decoration:none;font-size:14px;">Redeem 10% Off →</a>
      <p style="font-size:11px;color:#8A7560;margin:20px 0 0;">Valid for 14 days · one-time use</p>
    </div>`);
}

export function winBackSmsBody({ link, isMember }) {
  const tail = isMember ? "" : " Sign in for 5% off every order after.";
  return `Rani Mahal: We miss you! 10% off your next order: ${link}${tail} Reply STOP to opt out.`;
}

// ── Second-order push (api/cron/second-order-push.js) ────────────────
// The single highest-attrition point in a restaurant's lifecycle is right
// here — most first-time customers never come back at all. Two touches,
// day ~3 and day ~7, ONLY to customers still sitting at exactly one
// lifetime order (a real second order removes them from candidacy
// entirely, so nobody who already converted gets these).
//
// Deliberately asymmetric by segment, matching the same never-exceed-the-
// welcome-rate discipline as win-back:
// - MEMBERS already carry a standing 5% on every order automatically — a
//   second discount here would be redundant and start stacking incentives
//   for no reason. Both touches are plain, no voucher, no link to mint.
// - GUESTS have no discount unless they sign in or hold a voucher. Touch 1
//   stays plain (a bare discount pitch this early reads as desperate,
//   plus it's genuinely the same welcome-rate story the checkout already
//   told them once). Touch 2, only if they still haven't ordered again by
//   day 7, carries a real one-time 10% voucher — the closing push — capped
//   at the welcome rate for the same reason every other discount here is.
export function secondOrderTouch1EmailHtml({ customerName, isMember }) {
  const name = escapeHtml(customerName && customerName !== "Guest" ? customerName : "there");
  const body = isMember
    ? "Your 5% member discount is already waiting on whatever you order next — no code, no signing in again."
    : "Sign in next time and 5% off every order kicks in automatically, starting with the very next one.";
  return marketingEmailShell(`
    <div style="background:#12100e;border:1px solid rgba(232,168,46,0.35);border-radius:18px;padding:32px 24px;text-align:center;color:#FAF6EF;">
      <h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 14px;">How was your first order, ${name}?</h1>
      <p style="font-size:14px;color:#B8A995;line-height:1.6;margin:0 0 24px;">${body}</p>
      <a href="https://ranimahal.food" style="display:inline-block;background:#E8A82E;color:#080706;font-weight:700;padding:14px 28px;border-radius:24px;text-decoration:none;font-size:14px;">See the Menu →</a>
    </div>`);
}

export function secondOrderTouch1SmsBody({ isMember }) {
  const tail = isMember ? "Your 5% member discount is already on for next time." : "Sign in next time for 5% off every order.";
  return `Rani Mahal: How was your first order? ${tail} https://ranimahal.food Reply STOP to opt out.`;
}

export function secondOrderTouch2EmailHtml({ customerName, isMember, link }) {
  const name = escapeHtml(customerName && customerName !== "Guest" ? customerName : "there");
  return marketingEmailShell(`
    <div style="background:#12100e;border:1px solid rgba(232,168,46,0.35);border-radius:18px;padding:32px 24px;text-align:center;color:#FAF6EF;">
      <h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 14px;">Come back for round two, ${name}?</h1>
      <p style="font-size:14px;color:#B8A995;line-height:1.6;margin:0 0 24px;">${isMember
        ? "Your 5% member discount is ready whenever you are — no code needed."
        : "Here's 10% off your next order. Sign in when you use it and 5% off every order after kicks in automatically."}</p>
      <a href="${isMember ? "https://ranimahal.food" : link}" style="display:inline-block;background:#E8A82E;color:#080706;font-weight:700;padding:14px 28px;border-radius:24px;text-decoration:none;font-size:14px;">${isMember ? "See the Menu →" : "Redeem 10% Off →"}</a>
      ${isMember ? "" : `<p style="font-size:11px;color:#8A7560;margin:20px 0 0;">Valid for 14 days · one-time use</p>`}
    </div>`);
}

export function secondOrderTouch2SmsBody({ isMember, link }) {
  return isMember
    ? `Rani Mahal: Come back for round two? Your 5% member discount is ready whenever you are: https://ranimahal.food Reply STOP to opt out.`
    : `Rani Mahal: 10% off your next order: ${link} Sign in for 5% off every order after. Reply STOP to opt out.`;
}

// ── Win-back touch 2 / "last call" (api/cron/win-back-lapsed.js) ─────
// Touch 1 (above) was a one-shot design — a customer who ignores it got
// nothing else until the 180-day dedup TTL quietly reset. This is the
// second and final attempt, ~15 days after touch 1, gated on still being
// lapsed AND touch 1 having actually gone out (not a substitute for it).
// Same 10% ceiling as every other voucher here — the difference is framing
// (closing/urgency) and channel priority, not rate.
export function winBackTouch2EmailHtml({ customerName, link, isMember }) {
  const name = escapeHtml(customerName && customerName !== "Guest" ? customerName : "there");
  return marketingEmailShell(`
    <div style="background:#12100e;border:1px solid rgba(232,168,46,0.35);border-radius:18px;padding:32px 24px;text-align:center;color:#FAF6EF;">
      <p style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#E8A82E;font-weight:700;margin:0 0 12px;">Last Call</p>
      <h1 style="font-family:Georgia,serif;font-size:24px;margin:0 0 14px;">Still there, ${name}?</h1>
      <p style="font-size:14px;color:#B8A995;line-height:1.6;margin:0 0 24px;">This 10% offer expires soon and we won't send another reminder after this one.${isMember ? " Your 5% member rate keeps going on every order after you use it." : " Sign in when you use it and 5% off every order after locks in automatically."}</p>
      <a href="${link}" style="display:inline-block;background:#E8A82E;color:#080706;font-weight:700;padding:14px 28px;border-radius:24px;text-decoration:none;font-size:14px;">Redeem 10% Off →</a>
      <p style="font-size:11px;color:#8A7560;margin:20px 0 0;">Valid for 14 days · one-time use</p>
    </div>`);
}

export function winBackTouch2SmsBody({ link, isMember }) {
  const tail = isMember ? "" : " Sign in for 5% off every order after.";
  return `Rani Mahal: Last call — 10% off expires soon: ${link}${tail} Reply STOP to opt out.`;
}

// ── Newsletter welcome (api/newsletter-subscribe.js) ─────────────────
// The newsletter form previously wrote an email into KV and did nothing
// else with it — no send ever went back out. This is the immediate reply
// to signing up: same 10% ceiling as the checkout welcome rate, since a
// newsletter subscriber is functionally the same "never ordered" prospect
// as a first-time checkout, just captured earlier in the funnel.
export function newsletterWelcomeEmailHtml({ link }) {
  return marketingEmailShell(`
    <div style="background:#12100e;border:1px solid rgba(232,168,46,0.35);border-radius:18px;padding:32px 24px;text-align:center;color:#FAF6EF;">
      <p style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#E8A82E;font-weight:700;margin:0 0 12px;">Welcome</p>
      <h1 style="font-family:Georgia,serif;font-size:24px;margin:0 0 14px;">You're on the list</h1>
      <p style="font-size:14px;color:#B8A995;line-height:1.6;margin:0 0 24px;">Menu updates, seasonal dishes, and the occasional offer — nothing more. Here's 10% off to start with, whenever you're ready.</p>
      <a href="${link}" style="display:inline-block;background:#E8A82E;color:#080706;font-weight:700;padding:14px 28px;border-radius:24px;text-decoration:none;font-size:14px;">Redeem 10% Off →</a>
      <p style="font-size:11px;color:#8A7560;margin:20px 0 0;">Valid for 14 days · one-time use</p>
    </div>`);
}

// ── Never-ordered nudge (api/cron/never-ordered-nudge.js) ────────────
// Targets newsletter subscribers (or anyone captured pre-purchase) who
// still have zero completed orders days after signing up — a segment the
// existing lifecycle crons structurally can't reach, since win-back and
// second-order-push both key off customers:last-order, which only exists
// once someone has actually ordered.
export function neverOrderedNudgeEmailHtml({ link }) {
  return marketingEmailShell(`
    <div style="background:#12100e;border:1px solid rgba(232,168,46,0.35);border-radius:18px;padding:32px 24px;text-align:center;color:#FAF6EF;">
      <h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 14px;">Haven't tried us yet?</h1>
      <p style="font-size:14px;color:#B8A995;line-height:1.6;margin:0 0 24px;">Your 10% welcome offer is still sitting there unused. Whole spices ground in-house, bread fired to order past 900°F — take a look at the menu.</p>
      <a href="${link}" style="display:inline-block;background:#E8A82E;color:#080706;font-weight:700;padding:14px 28px;border-radius:24px;text-decoration:none;font-size:14px;">Order & Save 10% →</a>
      <p style="font-size:11px;color:#8A7560;margin:20px 0 0;">Valid for 14 days · one-time use</p>
    </div>`);
}

// ── Newsletter digest (api/cron/newsletter-digest.js) ────────────────
// Monthly, evergreen — features one rotating bestseller from lib/menu.js
// rather than hand-authored content, since there's no CMS for campaign
// copy. Deliberately no discount attached: this is the "stay warm" send,
// distinct from the welcome/never-ordered nudges that already carry one.
export function newsletterDigestEmailHtml({ dishName, dishDesc }) {
  return marketingEmailShell(`
    <div style="background:#12100e;border:1px solid rgba(232,168,46,0.35);border-radius:18px;padding:32px 24px;text-align:center;color:#FAF6EF;">
      <p style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#E8A82E;font-weight:700;margin:0 0 12px;">From the Kitchen</p>
      <h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 10px;">${escapeHtml(dishName)}</h1>
      <p style="font-size:14px;color:#B8A995;line-height:1.6;margin:0 0 24px;">${escapeHtml(dishDesc)}</p>
      <a href="https://ranimahal.food" style="display:inline-block;background:#E8A82E;color:#080706;font-weight:700;padding:14px 28px;border-radius:24px;text-decoration:none;font-size:14px;">See the Full Menu →</a>
    </div>`);
}

// ── Catering cross-sell (api/cron/catering-cross-sell.js) ────────────
// One-shot, sent once a signed-in member crosses a real order-frequency
// threshold — a repeat customer is a stronger catering lead than a cold
// visitor, but nothing previously ever pointed an existing customer at
// the catering funnel.
export function cateringCrossSellEmailHtml({ customerName }) {
  const name = escapeHtml(customerName && customerName !== "Guest" ? customerName : "there");
  return marketingEmailShell(`
    <div style="background:#12100e;border:1px solid rgba(232,168,46,0.35);border-radius:18px;padding:32px 24px;text-align:center;color:#FAF6EF;">
      <h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 14px;">Planning something bigger, ${name}?</h1>
      <p style="font-size:14px;color:#B8A995;line-height:1.6;margin:0 0 24px;">You've ordered from us enough times that we figured we'd mention it: we cater office lunches, parties, and events too. No self-serve checkout — just tell us what you need.</p>
      <a href="https://ranimahal.cc/catering" style="display:inline-block;background:#E8A82E;color:#080706;font-weight:700;padding:14px 28px;border-radius:24px;text-decoration:none;font-size:14px;">Get a Catering Quote →</a>
    </div>`);
}

export function cateringCrossSellSmsBody() {
  return `Rani Mahal: Planning something bigger? We cater office lunches, parties & events too: https://ranimahal.cc/catering Reply STOP to opt out.`;
}

// ── Abandoned-cart recovery (lib/abandonedCart.js) ────────────────────
// These three previously built raw, unstyled `<p>` HTML inline at the call
// site — no logo, no card, no branding of any kind, the most spam-looking
// email in the whole system despite being one of the highest-volume sends.
// Moved here and run through the same marketingEmailShell as everything
// else for consistency.
export function abandonedLeadEmailHtml({ cartLine, link }) {
  return marketingEmailShell(`
    <div style="background:#12100e;border:1px solid rgba(232,168,46,0.35);border-radius:18px;padding:32px 24px;text-align:center;color:#FAF6EF;">
      <h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 14px;">Still hungry?</h1>
      <p style="font-size:14px;color:#B8A995;line-height:1.6;margin:0 0 20px;">Your order is still saved:</p>
      <p style="font-size:14px;color:#FAF6EF;font-weight:600;margin:0 0 24px;">${escapeHtml(cartLine)}</p>
      <a href="${link}" style="display:inline-block;background:#E8A82E;color:#080706;font-weight:700;padding:14px 28px;border-radius:24px;text-decoration:none;font-size:14px;">Finish Checkout →</a>
    </div>`);
}

export function abandonedDraftTouch1EmailHtml({ cartLine, link }) {
  return marketingEmailShell(`
    <div style="background:#12100e;border:1px solid rgba(232,168,46,0.35);border-radius:18px;padding:32px 24px;text-align:center;color:#FAF6EF;">
      <h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 14px;">You left something delicious behind</h1>
      <p style="font-size:14px;color:#B8A995;line-height:1.6;margin:0 0 20px;">Your order is still saved:</p>
      <p style="font-size:14px;color:#FAF6EF;font-weight:600;margin:0 0 24px;">${escapeHtml(cartLine)}</p>
      <a href="${link}" style="display:inline-block;background:#E8A82E;color:#080706;font-weight:700;padding:14px 28px;border-radius:24px;text-decoration:none;font-size:14px;">Finish Checkout →</a>
    </div>`);
}

export function abandonedDraftTouch2EmailHtml({ cartLine, link }) {
  return marketingEmailShell(`
    <div style="background:#12100e;border:1px solid rgba(232,168,46,0.35);border-radius:18px;padding:32px 24px;text-align:center;color:#FAF6EF;">
      <p style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#E8A82E;font-weight:700;margin:0 0 12px;">Today Only</p>
      <h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 14px;">10% off your saved order</h1>
      <p style="font-size:14px;color:#B8A995;line-height:1.6;margin:0 0 20px;">Still waiting for you:</p>
      <p style="font-size:14px;color:#FAF6EF;font-weight:600;margin:0 0 24px;">${escapeHtml(cartLine)}</p>
      <a href="${link}" style="display:inline-block;background:#E8A82E;color:#080706;font-weight:700;padding:14px 28px;border-radius:24px;text-decoration:none;font-size:14px;">Finish & Save 10% →</a>
    </div>`);
}

// ── Campaign send/claim counters (api/campaign-stats.js) ─────────────
// Fire-and-forget instrumentation for every voucher-based lifecycle send
// above — none of these crons previously tracked whether anyone actually
// used what was sent. "Claimed" means a checkout session was started with
// that voucher (api/create-checkout.js's atomic claim), not that the order
// was ultimately paid — good enough to compare touches against each other,
// not a substitute for real revenue attribution.
export async function recordCampaignSent(source) {
  if (!source) return;
  try {
    const { kv } = await import("@vercel/kv");
    await kv.incr(`campaign-stats:${source}:sent`);
  } catch (e) { console.error(`recordCampaignSent(${source}) failed:`, e); }
}

// Called from api/create-checkout.js the moment a voucher is actually
// claimed into a checkout session — "claimed" here means a session was
// started with it, not that the order was ultimately paid (Stripe sessions
// can still be abandoned after this point). Good enough to compare touches
// against each other; not a substitute for real revenue attribution.
export async function recordCampaignClaimed(source) {
  if (!source) return;
  try {
    const { kv } = await import("@vercel/kv");
    await kv.incr(`campaign-stats:${source}:claimed`);
  } catch (e) { console.error(`recordCampaignClaimed(${source}) failed:`, e); }
}

// Called from lib/syncStripe.js the moment a voucher-carrying order is
// actually marked paid — this is the real number "claimed" (session
// started) can't give you, since a session can still be abandoned after
// that point. Paired with the order's own total so revenue actually
// attributable to each lifecycle touch is visible, not just a raw count.
export async function recordCampaignConverted(source, orderTotal) {
  if (!source) return;
  try {
    const { kv } = await import("@vercel/kv");
    await Promise.all([
      kv.incr(`campaign-stats:${source}:converted`),
      kv.incrbyfloat(`campaign-stats:${source}:revenue`, Number(orderTotal) || 0),
    ]);
  } catch (e) { console.error(`recordCampaignConverted(${source}) failed:`, e); }
}
