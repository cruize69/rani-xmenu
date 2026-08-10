// OrderManager.jsx — Rani Mahal Order Manager
// Architecture: Compact left-rail queue + Full right-panel ticket detail
// Matches wireframe: 35% left / 65% right split on ≥1024px

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { getManagerSecret } from "./lib/managerAuth.js";
import OrderCard from "./OrderCard.jsx";
import OrderDetailPanel from "./OrderDetailPanel.jsx";
import RefundModal from "./RefundModal.jsx";
import "./manager.css";

const API_BASE = "";

const STATUS = {
  new:      { label: "New",      color: "#F98A32", bg: "rgba(200, 96, 10, 0.15)", next: "done", nextLabel: "Mark Ready", nextColor: "#1A6B3A" },
  done:     { label: "Ready",    color: "#34D399", bg: "rgba(26, 107, 58, 0.18)", next: null,   nextLabel: null,       nextColor: null },
  refunded: { label: "Refunded", color: "#F87171", bg: "rgba(155, 38, 38, 0.18)", next: null,   nextLabel: null,       nextColor: null },
};

function getInitialTheme() {
  const stored = localStorage.getItem("rm_manager_theme");
  if (stored === "dark" || stored === "light") return stored;
  const h = new Date().getHours();
  return (h >= 7 && h < 18) ? "light" : "dark";
}

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", "x-manager-secret": getManagerSecret(), ...(opts.headers ?? {}) },
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
      gain.gain.linearRampToValueAtTime(0.25, now + i * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.35);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(now + i * 0.12); osc.stop(now + i * 0.12 + 0.4);
    });
  } catch (e) { /* ignore audio errors */ }
}

export default function OrderManager() {
  const [orders, setOrders]             = useState([]);
  const [date, setDate]                 = useState(() => new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }));
  const [filter, setFilter]             = useState("active");
  const [theme, setTheme]               = useState(getInitialTheme);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [lastRefresh, setLastRefresh]   = useState(new Date());
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [refundOrder, setRefundOrder]   = useState(null);
  const [isWide, setIsWide]             = useState(() => window.innerWidth >= 1024);
  const [newAlert, setNewAlert]         = useState(null);
  const prevIds                         = useRef(new Set());

  // Track viewport width for split-pane vs single-column
  useEffect(() => {
    const fn = () => setIsWide(window.innerWidth >= 1024);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("rm_manager_theme", next);
  };

  const load = useCallback(async (spin = true) => {
    if (spin) setLoading(true);
    try {
      const data = await apiFetch(`/api/orders?date=${date}`);
      setOrders(data.orders || []);
      setLastRefresh(new Date());
      setError(null);
    } catch (err) { setError(err.message); }
    finally { if (spin) setLoading(false); }
  }, [date]);

  // SSE real-time stream
  useEffect(() => {
    const secret = getManagerSecret();
    let es, reconnect;
    setLoading(true);

    const connect = () => {
      try {
        es = new EventSource(`/api/orders?stream=true&date=${date}&secret=${encodeURIComponent(secret)}`);
        es.onmessage = (ev) => {
          try {
            const data = JSON.parse(ev.data);
            if (data.type === "orders_update") {
              const list = data.orders || [];
              // Detect new incoming orders
              if (prevIds.current.size > 0) {
                const fresh = list.filter(o => !prevIds.current.has(o.id));
                if (fresh.length > 0) { playChime(); setNewAlert(fresh[0]); }
              }
              prevIds.current = new Set(list.map(o => o.id));
              setOrders(list);
              setLastRefresh(new Date());
              setError(null);
              setLoading(false);
            }
          } catch (e) { /* parse error */ }
        };
        es.onerror = () => { setLoading(false); if (es) es.close(); reconnect = setTimeout(connect, 3000); };
      } catch (e) { setLoading(false); }
    };
    connect();
    return () => { if (es) es.close(); clearTimeout(reconnect); };
  }, [date]);

  const handleStatus = async (id, status) => {
    // Optimistic update
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
    if (selectedOrder?.id === id) setSelectedOrder(prev => prev ? { ...prev, status } : null);
    try {
      await apiFetch("/api/orders", { method: "PATCH", body: JSON.stringify({ id, status }) });
    } catch (err) { console.error("Status update failed:", err); load(false); }
  };

  const handlePrint = async (id) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, printed: true } : o));
    if (selectedOrder?.id === id) setSelectedOrder(prev => prev ? { ...prev, printed: true } : null);
    try {
      await apiFetch("/api/orders", { method: "POST", body: JSON.stringify({ action: "reprint", id }) });
    } catch (err) { console.error("Print error:", err); }
  };

  const handleDelay = async (id, minutes) => {
    // Placeholder: extend prep time (can hook into backend later)
    console.log(`Delay order ${id} by +${minutes}m`);
  };

  // Filtered list + counts
  const { filtered, counts } = useMemo(() => {
    const nc = orders.filter(o => o.status === "new").length;
    const dc = orders.filter(o => o.status === "done").length;
    const rc = orders.filter(o => o.status === "refunded").length;
    const ac = nc; // active = new orders

    const list = orders.filter(o => {
      if (filter === "active")   return o.status !== "done" && o.status !== "refunded";
      if (filter === "done")     return o.status === "done";
      if (filter === "refunded") return o.status === "refunded";
      return true;
    });
    return { filtered: list, counts: { active: ac, done: dc, refunded: rc, all: orders.length } };
  }, [orders, filter]);

  // Auto-select first order on wide screen if nothing selected
  useEffect(() => {
    if (isWide && !selectedOrder && filtered.length > 0) setSelectedOrder(filtered[0]);
  }, [isWide, filtered, selectedOrder]);

  // Keep selected order data in sync with live order updates
  useEffect(() => {
    if (selectedOrder) {
      const updated = orders.find(o => o.id === selectedOrder.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(selectedOrder)) {
        setSelectedOrder(updated);
      }
    }
  }, [orders, selectedOrder]);

  return (
    <div className={`rm-manager-root theme-${theme}`}>

      {/* ── New Order Alert Overlay ── */}
      {newAlert && (
        <div className="rm-alert-overlay" onClick={() => { setSelectedOrder(newAlert); setNewAlert(null); }}>
          <div className="rm-alert-card">
            <div style={{ fontSize: 48, marginBottom: 8 }}>🔔</div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: "#C8600A", marginBottom: 4 }}>NEW ORDER</h2>
            <p style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{newAlert.customerName || "Guest"}</p>
            <p style={{ fontSize: 14, color: "#7A6855", marginBottom: 20 }}>
              {newAlert.items?.length || 0} items • ${Number(newAlert.total ?? 0).toFixed(2)}
            </p>
            <button
              className="rm-btn-primary"
              style={{ background: "#C8600A", color: "#FFF", width: "100%", minHeight: 52 }}
            >
              View Order
            </button>
          </div>
        </div>
      )}

      {/* ── Header Bar ── */}
      <header className="rm-header">
        <div className="rm-brand">
          <img src="/logo/apsara-logo-256.png" alt="Rani Mahal" className="rm-logo" />
          <div>
            <h1 className="rm-brand-title">Rani Mahal</h1>
            <p className="rm-brand-sub">Order Manager</p>
          </div>
        </div>
        <div className="rm-header-controls">
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div className={`rm-status-dot ${error ? "offline" : "online"}`} />
            <span style={{ fontSize: 11, color: "var(--rm-text-muted)" }}>
              {error ? "Offline" : "Online"}
            </span>
          </div>
          <button className="rm-theme-toggle" onClick={toggleTheme}>
            {theme === "dark" ? "🌙 Night" : "☀️ Day"}
          </button>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="rm-date-picker" />
          <button className="rm-icon-btn" onClick={() => load(true)} title="Refresh">↺</button>
        </div>
      </header>

      {/* ── Main Container ── */}
      <div className="rm-container">

        {/* Filter pills */}
        <div className="rm-filter-bar">
          {[
            { key: "active",   label: "Active",   count: counts.active },
            { key: "done",     label: "Done",      count: counts.done },
            { key: "refunded", label: "Refunded",  count: counts.refunded },
            { key: "all",      label: "All",       count: counts.all },
          ].map(f => (
            <button key={f.key} className={`rm-filter-pill ${filter === f.key ? "active" : ""}`} onClick={() => setFilter(f.key)}>
              {f.label} ({f.count})
              {f.key === "active" && counts.active > 0 && <span className="rm-new-badge-pill">{counts.active} NEW</span>}
            </button>
          ))}
        </div>

        {error && (
          <div style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "10px 14px", color: "#F87171", fontSize: 13, marginBottom: 12 }}>
            ⚠ Connection: {error}
          </div>
        )}

        {/* ── Split-Pane Layout ── */}
        <div className="rm-split-pane">

          {/* LEFT RAIL: Compact queue cards */}
          <div className="rm-left-rail">
            {loading && orders.length === 0 ? (
              <div className="rm-empty">Loading orders...</div>
            ) : filtered.length === 0 ? (
              <div className="rm-empty">
                {filter === "active" ? "✓ All clear — no active orders." : "No orders match this filter."}
              </div>
            ) : (
              <div className="rm-orders-stack">
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

          {/* RIGHT PANE: Full ticket detail (visible on ≥1024px) */}
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
              <div className="rm-persistent-panel">
                <div className="rm-panel-empty">
                  Select an order from the queue to view details.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Slide-Over Drawer (< 1024px, tapping a card) ── */}
      {!isWide && selectedOrder && (
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
