// api/test-email.js
// Temporary test endpoint to trigger a test order receipt email directly to riyadhjuwel@gmail.com

import { sendCustomerReceiptEmail } from "../lib/notifications.js";

export default async function handler(req, res) {
  const email = req.query.email || "riyadhjuwel@gmail.com";

  const testOrder = {
    id: "test_" + Date.now().toString(36).toUpperCase(),
    customerName: "Riyadh Juwel",
    customerEmail: email,
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

  try {
    await sendCustomerReceiptEmail(testOrder);
    return res.status(200).json({
      success: true,
      message: `Test order confirmation email sent to ${email}`,
      orderId: testOrder.id,
      from: "orders@ranimahal.food"
    });
  } catch (err) {
    console.error("Test email error:", err);
    return res.status(500).json({ error: err.message });
  }
}
