// ── Web Push — manager new-order notifications ──────────────────────
// Lets a staff member's phone/laptop get a real OS-level push notification
// (works even if the browser/app is backgrounded or closed, unlike the
// in-page sound/overlay alert in OrderManager.jsx, which only fires while
// that tab is actually open) when a new order comes in, with a deep link
// straight to that order.
//
// Subscriptions are stored in KV as a set of JSON strings under
// "push-subscriptions" — small, staff-only fan-out (a handful of devices,
// not customer-scale), so no pagination/indexing beyond a single set is
// needed. Endpoint URL itself is what identifies+dedupes a subscription
// (the browser returns the same one for the same device+origin until it
// expires or the user resets permissions), so we key removal on it too.

import { kv } from "./kv.js";
import webpush from "web-push";

const SUBS_KEY = "push-subscriptions";

let configured = false;
function ensureConfigured() {
  if (configured) return true;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(VAPID_SUBJECT || "mailto:orders@ranimahal.cc", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  configured = true;
  return true;
}

export async function saveSubscription(subscription) {
  if (!subscription?.endpoint) throw new Error("Invalid subscription");
  await kv.sadd(SUBS_KEY, JSON.stringify(subscription));
}

export async function removeSubscriptionByEndpoint(endpoint) {
  const all = await kv.smembers(SUBS_KEY);
  for (const raw of all) {
    try {
      if (JSON.parse(raw).endpoint === endpoint) await kv.srem(SUBS_KEY, raw);
    } catch { /* malformed entry — leave it, harmless */ }
  }
}

// Fans a payload out to every registered device. Best-effort: one device's
// expired/invalid subscription (410 Gone / 404, the standard push-service
// response once a browser drops a subscription) is pruned and doesn't
// block delivery to the others. Never throws — a push failure should never
// take down the order-creation path that triggers it.
export async function sendNewOrderPush({ orderId, customerName, total, itemCount }) {
  try {
    if (!ensureConfigured()) return; // no-op until VAPID env vars are set
    const raw = await kv.smembers(SUBS_KEY);
    if (!raw?.length) return;

    const payload = JSON.stringify({
      title: `🔔 New order — ${customerName || "Guest"}`,
      body: `${itemCount ?? "?"} item${itemCount === 1 ? "" : "s"} • $${Number(total ?? 0).toFixed(2)}`,
      url: `/manager?order=${orderId}`,
      orderId,
    });

    await Promise.all(raw.map(async (subJson) => {
      let sub;
      try { sub = JSON.parse(subJson); } catch { return; }
      try {
        await webpush.sendNotification(sub, payload);
      } catch (err) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await kv.srem(SUBS_KEY, subJson); // subscription is dead — drop it
        } else {
          console.error("Push send failed:", err?.message || err);
        }
      }
    }));
  } catch (err) {
    console.error("sendNewOrderPush failed:", err?.message || err);
  }
}
