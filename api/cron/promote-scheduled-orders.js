// api/cron/promote-scheduled-orders.js
// Vercel Cron target — runs every 5 minutes. Finds paid orders that were
// placed while the restaurant was closed (or deliberately scheduled ahead)
// and whose scheduled time has now arrived, flips them to "new", and pushes
// them into the kitchen print queue for the first time. Nothing about the
// order (payment, items, pricing) changes here — it was already fully paid
// and validated at checkout; this only decides *when the kitchen sees it*.

import { kv } from "../../lib/kv.js";
import { getOrder, updateOrder, ORDER_STATUS, getNYDateString, getOrdersByDate, autoResolveReadyPickupOrders } from "../../lib/orders.js";
import { isCronSecretValid } from "../../lib/auth.js";
import { sendNewOrderPush } from "../../lib/push.js";
import { recordCronRun } from "../../lib/cronStatus.js";
import { captureServerError } from "../../lib/sentry.js";
import { sendCustomerStatusEmail } from "../../lib/notifications.js";

async function sendCustomerSMS(to, body) {
  const { TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, TWILIO_FROM } = process.env;
  if (!TWILIO_API_KEY_SID) return;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${TWILIO_API_KEY_SID}:${TWILIO_API_KEY_SECRET}`).toString("base64")}`,
    },
    body: new URLSearchParams({ From: TWILIO_FROM, To: to, Body: body }),
  });
  if (!r.ok) console.error("Twilio error:", await r.text());
}

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
        // zrem itself is the atomic claim, not an afterthought — if two
        // overlapping invocations (a real scheduled tick racing a manual
        // "Run Now" from the dashboard) both zrange the same due id
        // before either acts on it, only one of them gets `1` back here;
        // the other gets `0` and skips, instead of both promoting/
        // double-printing the same order.
        const removed = await kv.zrem("scheduled-orders", id);
        if (!removed) continue;

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
        } catch (inner) {
          // We already claimed (zrem'd) this id — a failure here (KV
          // blip, transient error) must not silently strand the order in
          // "scheduled" forever with nothing left to promote it. Put it
          // back so the next tick retries instead of losing it.
          await kv.zadd("scheduled-orders", { score: now, member: id }).catch(() => {});
          throw inner;
        }
      } catch (e) {
        console.error(`Failed to promote scheduled order ${id}:`, e);
      }
    }

    // Auto-resolve pickup orders that reached the 25-minute mark
    let autoReadied = 0;
    try {
      const todayOrders = await getOrdersByDate(getNYDateString());
      await autoResolveReadyPickupOrders(todayOrders, async (updatedOrder) => {
        autoReadied++;
        const phone = updatedOrder.customerPhone;
        if (phone && updatedOrder.smsConsent) {
          const smsBody = `Rani Mahal: Your order #${updatedOrder.id.slice(-6).toUpperCase()} is READY for pickup! Come on in — we look forward to seeing you. (914) 835-9066 Reply STOP to opt out.`;
          await sendCustomerSMS(phone, smsBody).catch(err => console.error("Cron auto-ready SMS failed:", err));
        }
        await sendCustomerStatusEmail(updatedOrder).catch(err => console.error("Cron auto-ready email failed:", err));
      });
    } catch (e) {
      console.error("Cron auto-ready sweep failed:", e);
    }

    const result = { ok: true, promoted, autoReadied, checked: dueIds.length };
    await recordCronRun("promote-scheduled-orders", result);
    return res.status(200).json(result);
  } catch (err) {
    console.error("Cron promote-scheduled-orders error:", err);
    captureServerError(err, { route: "cron/promote-scheduled-orders" });
    await recordCronRun("promote-scheduled-orders", { ok: false, error: err.message || String(err) });
    return res.status(500).json({ error: "Promotion sweep failed" });
  }
}
