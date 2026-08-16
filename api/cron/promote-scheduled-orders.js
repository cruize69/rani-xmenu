// api/cron/promote-scheduled-orders.js
// Vercel Cron target — runs every 5 minutes. Finds paid orders that were
// placed while the restaurant was closed (or deliberately scheduled ahead)
// and whose scheduled time has now arrived, flips them to "new", and pushes
// them into the kitchen print queue for the first time. Nothing about the
// order (payment, items, pricing) changes here — it was already fully paid
// and validated at checkout; this only decides *when the kitchen sees it*.

import { kv } from "@vercel/kv";
import { getOrder, updateOrder, ORDER_STATUS } from "../../lib/orders.js";
import { isCronSecretValid } from "../../lib/auth.js";
import { sendNewOrderPush } from "../../lib/push.js";

export default async function handler(req, res) {
  if (!isCronSecretValid(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const now = Date.now();
    const dueIds = await kv.zrange("scheduled-orders", 0, now, { byScore: true });

    let promoted = 0;
    for (const id of dueIds) {
      try {
        const order = await getOrder(id);
        // Only promote if it's still actually in the scheduled state — a
        // manager could have already touched it (refunded, etc.) in the
        // meantime, and re-promoting a refunded order would be wrong.
        if (order && order.status === ORDER_STATUS.SCHEDULED) {
          await updateOrder(id, { status: ORDER_STATUS.NEW });
          await kv.lpush("print_queue", JSON.stringify({ id, mode: "new" }));
          await kv.expire("print_queue", 3600);
          sendNewOrderPush({
            orderId: id,
            customerName: order.customerName,
            total: order.total,
            itemCount: (order.items || []).reduce((s, i) => s + (i.qty || 1), 0),
          }).catch(() => {});
          promoted++;
        }
        await kv.zrem("scheduled-orders", id);
      } catch (e) {
        console.error(`Failed to promote scheduled order ${id}:`, e);
      }
    }

    return res.status(200).json({ ok: true, promoted, checked: dueIds.length });
  } catch (err) {
    console.error("Cron promote-scheduled-orders error:", err);
    return res.status(500).json({ error: "Promotion sweep failed" });
  }
}
