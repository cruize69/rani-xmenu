// sw.js — minimal service worker, ONLY for the manager's new-order push
// notifications. Registered exclusively from OrderManager.jsx (see
// registerPush() there) — never on any customer-facing page, so this has
// zero effect on the ordering flow. No caching/offline behavior here on
// purpose: this app is dynamic (live orders), and a caching service worker
// is exactly the kind of thing that causes "why am I seeing yesterday's
// menu" bugs if added without real need.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* non-JSON payload — ignore */ }

  const title = data.title || "Rani Mahal";
  const options = {
    body: data.body || "New order received",
    icon: "/logo/apsara-logo-256.png",
    badge: "/logo/apsara-logo-256.png",
    // Vibration + requireInteraction: this is a working kitchen/front-desk
    // alert, not a marketing notification — it should be hard to miss and
    // shouldn't auto-dismiss after a few seconds like a typical toast.
    vibrate: [200, 100, 200],
    requireInteraction: true,
    data: { url: data.url || "/manager", orderId: data.orderId || null },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Clicking the notification focuses an already-open manager tab if one
// exists (and navigates it to the order) rather than always opening a new
// tab — a front desk realistically has /manager open all shift already.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/manager";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes("/manager") && "focus" in client) {
          client.postMessage({ type: "OPEN_ORDER", url: targetUrl });
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
