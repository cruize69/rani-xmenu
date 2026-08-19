// api/push/subscribe.js
// POST { subscription }  — register this device for new-order push notifications
// DELETE { endpoint }     — unregister (e.g. staff turned notifications off)
// Manager-secret gated — same boundary as every other staff-only endpoint.

import { checkManagerAuth } from "../../lib/auth.js";
import { saveSubscription, removeSubscriptionByEndpoint } from "../../lib/push.js";
import { captureServerError } from "../../lib/sentry.js";

export default async function handler(req, res) {
  const auth = await checkManagerAuth(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  if (req.method === "POST") {
    const { subscription } = req.body || {};
    if (!subscription?.endpoint) return res.status(400).json({ error: "subscription required" });
    try {
      await saveSubscription(subscription);
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error("push/subscribe save failed:", err);
      captureServerError(err, { route: "push/subscribe" });
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === "DELETE") {
    const { endpoint } = req.body || {};
    if (!endpoint) return res.status(400).json({ error: "endpoint required" });
    await removeSubscriptionByEndpoint(endpoint);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
