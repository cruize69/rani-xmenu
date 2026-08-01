// api/account/link-order.js
// POST /api/account/link-order
// Called by webhook after payment — links order ID to the customer's account
// Body: { orderId, accountId }  (accountId = Clerk userId or "guest:email")
//
// Also called client-side after successful guest checkout
// with { orderId, email } so guests can see their order

import { kv } from "@vercel/kv";

const orderIdsKey = (id) => `account-orders:${id}`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { orderId, accountId, email } = req.body;

  if (!orderId) return res.status(400).json({ error: "orderId required" });

  // Resolve account ID — prefer explicit accountId, fall back to guest email
  const resolvedId = accountId
    ?? (email ? `guest:${email.toLowerCase().trim()}` : null);

  if (!resolvedId) return res.status(400).json({ error: "accountId or email required" });

  // Push order ID to front of account's order list (newest first)
  await kv.lpush(orderIdsKey(resolvedId), orderId);

  // Cap list at 100 orders per account
  await kv.ltrim(orderIdsKey(resolvedId), 0, 99);

  return res.status(200).json({ success: true, accountId: resolvedId, orderId });
}
