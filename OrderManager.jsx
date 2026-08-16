// OrderManager.jsx — Rani Mahal Order Manager
// Full-viewport locked layout:
//   <header fixed> → <subheader/filter bar fixed> → <rm-body flex row (left scrolls / right locked)>

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { getManagerSecret } from "./lib/managerAuth.js";
import OrderCard from "./OrderCard.jsx";
import OrderDetailPanel from "./OrderDetailPanel.jsx";
import RefundModal from "./RefundModal.jsx";
import "./manager.css";

const API_BASE = "";

const STATUS = {
  new:       { label: "NEW",       color: "#F98A32", next: "done", nextLabel: "Mark Ready", nextColor: "#16A34A" },
  scheduled: { label: "SCHEDULED", color: "#8B5CF6", next: null, nextLabel: null, nextColor: null },
  done:      { label: "READY",     color: "#22C55E", next: null, nextLabel: null, nextColor: null },
  refunded:  { label: "REFUNDED",  color: "#EF4444", next: null, nextLabel: null, nextColor: null },
};

function getInitialTheme() {
  const s = localStorage.getItem("rm_theme");
  if (s === "dark" || s === "light") return s;
  const h = new Date().getHours();
  return (h >= 7 && h < 18) ? "light" : "dark";
}

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "x-manager-secret": getManagerSecret(),
      ...(opts.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + i * 0.12);
      gain.gain.setValueAtTime(0, now + i * 0.12);
      gain.gain.linearRampToValueAtTime(0.24, now + i * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.36);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(now + i * 0.12); osc.stop(now + i * 0.12 + 0.42);
    });
  } catch (_) {}
}

export default function OrderManager() {
  const [orders, setOrders]               = useState([]);
  const [date, setDate]                   = useState(() =>
    new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" })
  );
  const [filter, setFilter]               = useState("active");
  const [theme, setTheme]                 = useState(getInitialTheme);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [lastRefresh, setLastRefresh]     = useState(new Date());
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [refundOrder, setRefundOrder]     = useState(null);
  const [isWide, setIsWide]               = useState(() => window.innerWidth >= 1024);
  const [newAlert, setNewAlert]           = useState(null);
  const prevIds                           = useRef(new Set());
  const [pushStatus, setPushStatus]       = useState("checking"); // checking | unsupported | default | denied | subscribed
  const deepLinkOrderId                   = useRef(new URLSearchParams(window.location.search).get("order"));

  // Viewport tracking
  useEffect(() => {
    const fn = () => setIsWide(window.innerWidth >= 1024);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  // Flash the browser tab's title while a new-order alert is active and
  // the tab itself isn't the focused one — catches the case of the app
  // being open in a background TAB (a real OS push notification, added
  // separately, is what catches it being backgrounded entirely or the
  // browser closed). Stops the moment the tab regains focus or the alert
  // is dismissed, and always restores the real title on cleanup so a
  // stale "🔔 NEW ORDER" never lingers in the tab bar.
  useEffect(() => {
    if (!newAlert) return;
    const original = document.title;
    if (document.visibilityState === "visible") return;
    let on = false;
    const flash = setInterval(() => {
      on = !on;
      document.title = on ? "🔔 NEW ORDER — Rani Mahal" : original;
    }, 1000);
    const stopOnFocus = () => {
      if (document.visibilityState === "visible") {
        clearInterval(flash);
        document.title = original;
      }
    };
    document.addEventListener("visibilitychange", stopOnFocus);
    return () => {
      clearInterval(flash);
      document.title = original;
      document.removeEventListener("visibilitychange", stopOnFocus);
    };
  }, [newAlert]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("rm_theme", next);
  };

  // ── Push notifications — real OS-level alert even if this tab/app is
  // backgrounded or closed, deep-linking straight to the order (see
  // public/sw.js + lib/push.js). Opt-in only: browsers require a genuine
  // user gesture to grant Notification permission, so this can't
  // auto-subscribe on load — it re-checks silent (already-granted) state
  // on mount and otherwise waits for enablePush() from a click.
  const urlBase64ToUint8Array = (base64String) => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(base64);
    return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
  };

  const subscribeForPush = useCallback(async () => {
    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!vapidKey) { setPushStatus("unsupported"); return; }
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      const existing = await reg.pushManager.getSubscription();
      const sub = existing || await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      await apiFetch("/api/push/subscribe", { method: "POST", body: JSON.stringify({ subscription: sub.toJSON() }) });
      setPushStatus("subscribed");
    } catch (err) {
      console.error("Push subscribe failed:", err);
      setPushStatus(Notification.permission === "denied" ? "denied" : "default");
    }
  }, []);

  const enablePush = async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushStatus("unsupported");
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm !== "granted") { setPushStatus(perm === "denied" ? "denied" : "default"); return; }
    await subscribeForPush();
  };

  // Silently re-attach on mount if permission was already granted in a
  // previous visit — no permission prompt needed, since the browser
  // already has consent on file for this origin.
  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushStatus("unsupported");
      return;
    }
    if (Notification.permission === "granted") subscribeForPush();
    else setPushStatus(Notification.permission === "denied" ? "denied" : "default");
  }, [subscribeForPush]);

  // Clicking a notification while a /manager tab is ALREADY open focuses
  // that tab (see sw.js notificationclick) and posts this message rather
  // than doing a full navigation — jump straight to the order once it's
  // actually in the loaded list.
  useEffect(() => {
    const onMessage = (event) => {
      if (event.data?.type === "OPEN_ORDER" && event.data.url) {
        const id = new URL(event.data.url, window.location.origin).searchParams.get("order");
        if (id) deepLinkOrderId.current = id;
      }
    };
    navigator.serviceWorker?.addEventListener?.("message", onMessage);
    return () => navigator.serviceWorker?.removeEventListener?.("message", onMessage);
  }, []);

  // Open the deep-linked order (from a push notification click, or a
  // fresh /manager?order=ID navigation) as soon as it shows up in orders.
  useEffect(() => {
    if (!deepLinkOrderId.current) return;
    const match = orders.find(o => o.id === deepLinkOrderId.current);
    if (match) {
      setSelectedOrder(match);
      deepLinkOrderId.current = null;
      const url = new URL(window.location.href);
      url.searchParams.delete("order");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    }
  }, [orders]);

  const load = useCallback(async (spin = true) => {
    if (spin) setLoading(true);
    try {
      const data = await apiFetch(`/api/orders?date=${date}`);
      const nextOrders = data.orders || [];

      // Sound + full-screen alert for a genuinely NEW order (playChime and
      // the rm-alert-overlay markup already existed but were never wired
      // up — this is what actually triggers them). Skipped on the very
      // first load of a session (prevIds starts empty): otherwise opening
      // the app fresh at the start of a shift would treat every order
      // already sitting in "new" status as if it just came in.
      if (prevIds.current.size > 0) {
        const freshlyNew = nextOrders.find(o => o.status === "new" && !prevIds.current.has(o.id));
        if (freshlyNew) {
          playChime();
          setNewAlert(freshlyNew);
        }
      }
      prevIds.current = new Set(nextOrders.map(o => o.id));

      setOrders(nextOrders);
      setLastRefresh(new Date());
      setError(null);
      versionRef.current = data.version ?? versionRef.current;
    } catch (err) {
      setError(err.message);
    } finally {
      if (spin) setLoading(false);
    }
  }, [date]);

  // Poll a cheap version key every few seconds (1 kv.get) and only pay for
  // the full order fetch when it actually changed — avoids hammering KV with
  // the full N-order fetch from every open staff screen during a busy dinner rush.
  const versionRef = useRef(null);
  useEffect(() => {
    load(false); // Initial load without full screen spinner
    versionRef.current = null;
    const timer = setInterval(async () => {
      try {
        const { version } = await apiFetch(`/api/orders?date=${date}&versionOnly=1`);
        if (version !== versionRef.current) {
          versionRef.current = version;
          load(false);
        }
      } catch {}
    }, 4000);
    return () => clearInterval(timer);
  }, [load, date]);

  const handleStatus = async (id, status) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
    if (selectedOrder?.id === id) setSelectedOrder(p => p ? { ...p, status } : null);
    try {
      await apiFetch("/api/orders", { method: "PATCH", body: JSON.stringify({ id, status }) });
    } catch (err) { console.error(err); load(false); }
  };

  const handlePrint = async (id, ticket = "all") => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, printed: true } : o));
    if (selectedOrder?.id === id) setSelectedOrder(p => p ? { ...p, printed: true } : null);
    try {
      await apiFetch("/api/orders", { method: "POST", body: JSON.stringify({ action: "reprint", id, ticket }) });
    } catch (err) { console.error(err); }
  };

  const handleDelay = (id, mins) => {
    // Hook into backend delay API when ready
    console.log(`+${mins}m delay on order ${id}`);
  };

  // Filtered list + counts
  const { filtered, counts } = useMemo(() => {
    const nc = orders.filter(o => o.status === "new").length;
    const dc = orders.filter(o => o.status === "done").length;
    const rc = orders.filter(o => o.status === "refunded").length;
    const sc = orders.filter(o => o.status === "scheduled").length;
    const list = orders.filter(o => {
      // "scheduled" orders aren't actionable yet — a cron job promotes them
      // to "new" at their scheduled time, which is when the kitchen should
      // see them. Kept out of Active so they don't read as something to
      // prepare right now.
      if (filter === "active")    return o.status !== "done" && o.status !== "refunded" && o.status !== "scheduled";
      if (filter === "scheduled") return o.status === "scheduled";
      if (filter === "done")      return o.status === "done";
      if (filter === "refunded")  return o.status === "refunded";
      return true;
    });
    return { filtered: list, counts: { new: nc, done: dc, refunded: rc, scheduled: sc, all: orders.length } };
  }, [orders, filter]);

  // Auto-select first order on wide screens
  useEffect(() => {
    if (isWide && !selectedOrder && filtered.length > 0) setSelectedOrder(filtered[0]);
  }, [isWide, filtered, selectedOrder]);

  // Keep selected order synced with live data
  useEffect(() => {
    if (!selectedOrder) return;
    const updated = orders.find(o => o.id === selectedOrder.id);
    if (updated && JSON.stringify(updated) !== JSON.stringify(selectedOrder)) {
      setSelectedOrder(updated);
    }
  }, [orders, selectedOrder]);

  const FILTERS = [
    { key: "active",    label: "Active",    count: counts.new + (orders.filter(o => o.status === "in_progress").length) },
    { key: "scheduled", label: "Scheduled", count: counts.scheduled },
    { key: "done",      label: "Done",      count: counts.done },
    { key: "refunded",  label: "Refunded",  count: counts.refunded },
    { key: "all",       label: "All",       count: counts.all },
  ];

  return (
    <div className={`rm-manager-root theme-${theme}`}>

      {/* ── New Order Alert Overlay ── */}
      {newAlert && (
        <div className="rm-alert-overlay" onClick={() => { setSelectedOrder(newAlert); setNewAlert(null); }}>
          <div className="rm-alert-card">
            <div style={{ fontSize: 44, marginBottom: 8 }}>🔔</div>
            <h2 style={{ fontSize: 22, fontWeight: 900, color: "#C8600A", marginBottom: 4 }}>NEW ORDER</h2>
            <p style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{newAlert.customerName || "Guest"}</p>
            <p style={{ fontSize: 14, color: "#7A6855", marginBottom: 22 }}>
              {newAlert.items?.length || 0} items • ${Number(newAlert.total ?? 0).toFixed(2)}
            </p>
            <button className="rm-btn-primary" style={{ background: "#C8600A", color: "#FFF", width: "100%", minHeight: 52 }}>
              View Order →
            </button>
          </div>
        </div>
      )}

      {/* ══ FIXED HEADER ══════════════════════════════════════════ */}
      <header className="rm-header">
        <div className="rm-brand">
          <img src="/logo/apsara-logo-256.png" alt="Rani Mahal" className="rm-logo" />
          <div>
            <div className="rm-brand-name">Rani Mahal</div>
            <div className="rm-brand-sub">Order Manager</div>
          </div>
        </div>

        <div className="rm-header-controls">
          <div className="rm-connection-indicator">
            <div className={`rm-status-dot ${error ? "offline" : "online"}`} />
            <span className="rm-connection-label">{error ? "Offline" : "Live"}</span>
          </div>

          {pushStatus === "default" && (
            <button
              className="rm-theme-toggle"
              onClick={enablePush}
              title="Get a push notification (even with this tab closed) when a new order comes in"
            >
              🔔 Enable Alerts
            </button>
          )}
          {pushStatus === "subscribed" && (
            <span className="rm-connection-label" title="New-order push notifications are on for this device" style={{ display: "flex", alignItems: "center", gap: 4 }}>
              🔔 Alerts On
            </span>
          )}
          {pushStatus === "denied" && (
            <span className="rm-connection-label" title="Notifications are blocked for this site in your browser settings — enable them there to get alerts">
              🔕 Alerts Blocked
            </span>
          )}

          <button className="rm-theme-toggle" onClick={toggleTheme}>
            {theme === "dark" ? "🌙 Night" : "☀️ Day"}
          </button>

          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="rm-date-picker"
          />

          <button className="rm-icon-btn" onClick={() => load(true)} title="Refresh">↺</button>
        </div>
      </header>

      {/* ══ FIXED FILTER BAR (sub-header) ═════════════════════════ */}
      <div className="rm-subheader">
        {FILTERS.map(f => (
          <button
            key={f.key}
            className={`rm-filter-pill ${filter === f.key ? "active" : ""}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label} ({f.count})
            {f.key === "active" && counts.new > 0 && (
              <span className="rm-new-pill">{counts.new} NEW</span>
            )}
          </button>
        ))}

        {error && (
          <span style={{ fontSize: 11, color: "#FCA5A5", marginLeft: "auto", whiteSpace: "nowrap" }}>
            ⚠ {error}
          </span>
        )}
      </div>

      {/* ══ SCROLLABLE BODY ROW ════════════════════════════════════ */}
      {/* Left rail scrolls independently. Right pane is locked. */}
      <div className="rm-body">

        {/* ── LEFT RAIL: Compact queue cards (scrollable) ── */}
        <div className="rm-left-rail">
          {loading && orders.length === 0 ? (
            <div className="rm-queue-empty">Loading orders…</div>
          ) : filtered.length === 0 ? (
            <div className="rm-queue-empty">
              {filter === "active" ? "✓ All clear — no active orders." : "No orders match this filter."}
            </div>
          ) : (
            <div className="rm-queue-stack">
              {filtered.map(order => (
                <OrderCard
                  key={order.id}
                  order={order}
                  statusConfig={STATUS}
                  selected={selectedOrder?.id === order.id}
                  onSelectCard={setSelectedOrder}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── RIGHT PANE: Full ticket detail (locked, internal scroll) ── */}
        <div className="rm-right-pane">
          {selectedOrder ? (
            <OrderDetailPanel
              order={selectedOrder}
              onClose={() => setSelectedOrder(null)}
              onStatusChange={handleStatus}
              onPrint={handlePrint}
              onDelay={handleDelay}
              onOpenRefund={o => setRefundOrder(o)}
              statusInfo={STATUS[selectedOrder.status] ?? STATUS.new}
              isPersistentPane={true}
            />
          ) : (
            <div className="rm-panel-empty">
              <div className="rm-panel-empty-icon">👈</div>
              <div style={{ fontWeight: 700 }}>Select an order</div>
              <div style={{ fontSize: 12 }}>Tap any order in the queue to view ticket details</div>
            </div>
          )}
        </div>
      </div>

      {/* ── Slide-over Drawer for compact / portrait screens ── */}
      {!isWide && selectedOrder && (
        <div className="rm-drawer-backdrop" onClick={e => e.target === e.currentTarget && setSelectedOrder(null)}>
          <div className="rm-drawer">
            <OrderDetailPanel
              order={selectedOrder}
              onClose={() => setSelectedOrder(null)}
              onStatusChange={handleStatus}
              onPrint={handlePrint}
              onDelay={handleDelay}
              onOpenRefund={o => setRefundOrder(o)}
              statusInfo={STATUS[selectedOrder.status] ?? STATUS.new}
              isPersistentPane={false}
            />
          </div>
        </div>
      )}

      {/* ── Refund Modal ── */}
      {refundOrder && (
        <RefundModal
          order={refundOrder}
          onClose={() => setRefundOrder(null)}
          onSuccess={() => { setRefundOrder(null); load(false); }}
          apiFetch={apiFetch}
        />
      )}
    </div>
  );
}
