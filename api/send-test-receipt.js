// api/send-test-receipt.js
// Diagnostic endpoint to test Resend API key and domain status directly from Vercel

import { sendCustomerReceiptEmail, sendOrderEmail } from "../lib/notifications.js";

export default async function handler(req, res) {
  const targetEmail = req.query.email || "riyadhjuwel@gmail.com";
  const { RESEND_API_KEY, RESTAURANT_EMAIL, STRIPE_WEBHOOK_SECRET } = process.env;

  const resendKeyPresent = !!RESEND_API_KEY;
  const resendKeyPrefix  = RESEND_API_KEY ? RESEND_API_KEY.slice(0, 7) + "..." : "MISSING";
  const webhookSecretPresent = !!STRIPE_WEBHOOK_SECRET;

  const testOrder = {
    id: "test_" + Date.now().toString(36).toUpperCase(),
    customerName: "Riyadh Juwel",
    customerEmail: targetEmail,
    orderMode: "pickup",
    status: "new",
    items: [
      { name: "Chicken Tikka Masala", price: 19.95, qty: 1, spice: "Medium", note: "Extra sauce please" },
      { name: "Garlic Naan", price: 4.95, qty: 2 }
    ],
    subtotal: 29.85,
    tax: 2.50,
    tip: 5.00,
    total: 37.35,
    createdAt: new Date().toISOString()
  };

  // Test direct Resend API call to capture full raw output
  let rawResendResult = null;
  let resendHttpStatus = null;
  if (RESEND_API_KEY) {
    try {
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({
          from: "orders@ranimahal.food",
          to: [targetEmail],
          subject: `Test Email from Rani Mahal — #${testOrder.id.slice(-6)}`,
          html: `<h1 style="color:#E8A82E;">Rani Mahal Test Email</h1><p>Testing Resend API from Vercel production environment.</p>`
        }),
      });
      resendHttpStatus = resendRes.status;
      rawResendResult = await resendRes.json().catch(() => null);
    } catch (e) {
      rawResendResult = { exception: e.message };
    }
  }

  return res.status(200).json({
    diagnostics: {
      resendKeyPresent,
      resendKeyPrefix,
      webhookSecretPresent,
      restaurantEmail: RESTAURANT_EMAIL || "orders@ranimahal.food (default)",
    },
    testEmailSend: {
      targetEmail,
      resendHttpStatus,
      resendResponse: rawResendResult,
    }
  });
}
