// api/order-status.js
// GET /api/order-status?id=order_xxx
// PUBLIC endpoint — returns only status fields, no sensitive data
// Polled every 5s by the customer's order success page

import { getOrder } from "../lib/orders.js";
import { sendCustomerReceiptEmail } from "../lib/notifications.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id, test_email } = req.query;

  if (test_email) {
    const testOrder = {
      id: "test_" + Date.now().toString(36).toUpperCase(),
      customerName: "Riyadh Juwel",
      customerEmail: test_email,
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
        message: `Test order email sent to ${test_email}`,
        orderId: testOrder.id,
        from: "orders@ranimahal.food"
      });
    } catch (err) {
      console.error("Test email error:", err);
      return res.status(500).json({ error: err.message });
    }
  }

  if (!id) return res.status(400).json({ error: "Order ID required" });

  try {
    const order = await getOrder(id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    // Return only what the customer needs — no prices, no contact details
    return res.status(200).json({
      id:        order.id,
      status:    order.status,   // new | in_progress | done
      updatedAt: order.updatedAt,
      createdAt: order.createdAt,
    });

  } catch (err) {
    console.error("order-status error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
