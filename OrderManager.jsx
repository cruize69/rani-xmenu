// OrderManager.jsx — Rani Mahal Order Manager (Adaptive Master-Detail & Single Stack)

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { getManagerSecret } from "./lib/managerAuth.js";
import OrderCard from "./OrderCard.jsx";
import OrderDetailPanel from "./OrderDetailPanel.jsx";
import RefundModal from "./RefundModal.jsx";
import "./manager.css";

const API_BASE = "";

const STATUS = {
  new:      { label: "Received", color: "#F98A32", bg: "rgba(200, 96, 10, 0.15)", next: "done", nextLabel: "Mark Ready", nextColor: "#1A6B3A" },
  done:     { label: "Ready",    color: "#34D399", bg: "rgba(26, 107, 58, 0.18)", next: null,   nextLabel: null,       nextColor: null },
  refunded: { label: "Refunded", color: "#F87171", bg: "rgba(155, 38, 38, 0.18)", next: null,   nextLabel: null,       nextColor: null },
};

function getInitialTheme() {
  const stored = localStorage.getItem("rm_manager_theme");
  if (stored === "dark" || stored === "light") return stored;
  const hour = new Date().getHours();
  return (hour >= 7 && hour < 18) ? "light" : "dark";
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", "x-manager-secret": getManagerSecret(), ...(options.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

// Synthesize 3-tone Web Audio chime for new order arrival
function playOrderChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    const tones = [523.25, 659.25, 783.99]; // C5, E5, G5 major triad
    tones.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + i * 0.12);
      gain.gain.setValueAtTime(0, now + i * 0.12);
      gain.gain.linearRampToValueAtTime(0.25, now + i * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.4);
    });
  } catch (e) {}
}

export default function OrderManager() {
  const [orders, setOrders]             = useState([]);
  const [summary, setSummary]           = useState(null);
  const [date, setDate]                 = useState(() => new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }));
  const [filter, setFilter]             = useState("active");
  const [theme, setTheme]               = useState(getInitialTheme);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);
  const [lastRefresh, setLastRefresh]   = useState(new Date());
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [refundOrder, setRefundOrder]   = useState(null);
  const [isWideScreen, setIsWideScreen] = useState(() => window.innerWidth >= 1024);
  const [newOrderAlert, setNewOrderAlert] = useState(null);
  const prevOrderIds                    = useRef(new Set());

  // Listen to viewport resize for Master-Detail split pane vs single column
  useEffect(() => {
    const handleResize = () => setIsWideScreen(window.innerWidth >= 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("rm_manager_theme", next);
  };

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const data = await apiFetch(`/api/orders?date=${date}`);
      const fetchedOrders = data.orders || [];
      setOrders(fetchedOrders);
      setSummary(data.summary || null);
      setLastRefresh(new Date());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [date]);

  // Real-time SSE Stream
  useEffect(() => {
    const secret = getManagerSecret();
    const streamUrl = `/api/orders?stream=true&date=${date}&secret=${encodeURIComponent(secret)}`;
    
    let es;
    let reconnectTimer;
    setLoading(true);

    const connectSSE = () => {
      try {
        es = new EventSource(streamUrl);

        es.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "orders_update") {
              const fetchedOrders = data.orders || [];
              
              if (prevOrderIds.current.size > 0) {
                const incomingNew = fetchedOrders.filter(o => !prevOrderIds.current.has(o.id));
                if (incomingNew.length > 0) {
                  playOrderChime();
                  setNewOrderAlert(incomingNew[0]);
                }
              }
              prevOrderIds.current = new Set(fetchedOrders.map(o => o.id));
              
              setOrders(fetchedOrders);
              setSummary(data.summary || null);
              setLastRefresh(new Date());
              setError(null);
              setLoading(false);
            }
          } catch (e) {}
        };

        es.onerror = () => {
          setLoading(false);
          if (es) es.close();
          reconnectTimer = setTimeout(connectSSE, 3000);
        };
      } catch (e) {
        setLoading(false);
      }
    };

    connectSSE();

    return () => {
      if (es) es.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [date]);

  const handleStatusChange = async (id, status) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
    if (selectedOrder?.id === id) {
      setSelectedOrder(prev => prev ? { ...prev, status } : null);
    }
    try {
      await apiFetch("/api/orders", {
        method: "PATCH",
        body: JSON.stringify({ id, status }),
      });
    } catch (err) {
      console.error("Status update error:", err);
      load(false);
    }
  };

  const handlePrint = async (id) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, printed: true } : o));
    if (selectedOrder?.id === id) {
      setSelectedOrder(prev => prev ? { ...prev, printed: true } : null);
    }
    try {
      await apiFetch("/api/orders", {
        method: "POST",
        body: JSON.stringify({ action: "reprint", id }),
      });
    } catch (err) {
      console.error("Print queue error:", err);
    }
  };

  const { filtered, newCount, inProgCount, refundedCount } = useMemo(() => {
    const list = orders.filter(o => {
      if (filter === "active")   return o.status !== "done" && o.status !== "refunded";
      if (filter === "done")     return o.status === "done";
      if (filter === "refunded") return o.status === "refunded";
      return true;
    });
    const nc = orders.filter(o => o.status === "new").length;
    const ipc = orders.filter(o => o.status === "in_progress").length;
    const rc = orders.filter(o => o.status === "refunded").length;
    return { filtered: list, newCount: nc, inProgCount: ipc, refundedCount: rc };
  }, [orders, filter]);

  // Auto-select first active order on landscape split-pane if none selected
  useEffect(() => {
    if (isWideScreen && !selectedOrder && filtered.length > 0) {
      setSelectedOrder(filtered[0]);
    }
  }, [isWideScreen, filtered, selectedOrder]);

  return (
    <div className={`rm-manager-root theme-${theme}`}>
      {/* Incoming Order Flash Overlay */}
      {newOrderAlert && (
        <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(200, 96, 10, 0.85)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={() => setNewOrderAlert(null)}>
          <div style={{ background: "#FFFFFF", color: "#0F0800", borderRadius: 24, padding: 32, maxWidth: 440, width: "100%", textAlign: "center", boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🔔</div>
            <h2 style={{ fontSize: 26, fontWeight: 800, color: "#C8600A", marginBottom: 4 }}>NEW ORDER RECEIVED!</h2>
            <p style={{ fontSize: 20, fontWeight: 800, color: "#0F0800", marginBottom: 4 }}>{newOrderAlert.customerName || "Walk-in Guest"}</p>
            <p style={{ fontSize: 14, color: "#7A6855", marginBottom: 20 }}>
              Order #{newOrderAlert.id?.slice(-6).toUpperCase()} • {newOrderAlert.items?.length || 0} items
            </p>
            <button className="rm-btn-primary" style={{ background: "#C8600A", color: "#FFFFFF", width: "100%", height: 54, fontSize: 16 }}>
              Acknowledge & View Order
            </button>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <header className="rm-header">
        <div className="rm-brand">
          <img src="/logo/apsara-logo-256.png" alt="Rani Mahal Logo" className="rm-logo" />
          <div>
            <h1 className="rm-brand-title">Rani Mahal</h1>
            <p className="rm-brand-sub">Order Manager</p>
          </div>
        </div>

        <div className="rm-header-controls">
          <button className="rm-theme-toggle" onClick={toggleTheme} title="Switch Ambient Theme (Day / Night)">
            {theme === "dark" ? "🌙 Night" : "☀️ Day"}
          </button>

          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="rm-date-picker"
          />

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div className={`rm-status-dot ${error ? "offline" : "online"}`} />
            <span style={{ fontSize: 11, color: "var(--rm-text-muted)" }}>
              {error ? "Offline" : lastRefresh.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>

          <button className="rm-icon-btn" onClick={() => load(true)} title="Refresh orders">
            ↺
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="rm-container">
        {/* Filter Pills Bar */}
        <div className="rm-filter-bar" style={{ marginTop: 8 }}>
          <button
            className={`rm-filter-pill ${filter === "active" ? "active" : ""}`}
            onClick={() => setFilter("active")}
          >
            Active ({newCount + inProgCount})
            {newCount > 0 && <span className="rm-new-badge-pill">{newCount} NEW</span>}
          </button>
          <button
            className={`rm-filter-pill ${filter === "done" ? "active" : ""}`}
            onClick={() => setFilter("done")}
          >
            Done ({orders.filter(o => o.status === "done").length})
          </button>
          <button
            className={`rm-filter-pill ${filter === "refunded" ? "active" : ""}`}
            onClick={() => setFilter("refunded")}
          >
            Refunded ({refundedCount})
          </button>
          <button
            className={`rm-filter-pill ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >
            All ({orders.length})
          </button>
        </div>

        {error && (
          <div style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: 12, padding: "12px 16px", color: "#F87171", fontSize: 13, marginBottom: 14 }}>
            ⚠ Connection alert: {error}
          </div>
        )}

        {/* Master-Detail Adaptive Split Pane vs Single Column Stack */}
        <div className="rm-split-pane-layout">
          {/* Left Column Queue Stream */}
          <div className="rm-left-stream-col">
            {loading && orders.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "var(--rm-text-muted)" }}>Loading orders...</div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "var(--rm-text-muted)", background: "var(--rm-card-bg)", borderRadius: 20, border: "1px solid var(--rm-card-border)" }}>
                {filter === "active" ? "✓ All clear! No active orders waiting." : "No orders match this filter."}
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
                    onStatusChange={handleStatusChange}
                    onPrint={handlePrint}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right Column Persistent Inspection Panel (on Landscape Tablets >=1024px) */}
          {isWideScreen && selectedOrder && (
            <div className="rm-right-detail-col">
              <OrderDetailPanel
                order={selectedOrder}
                onClose={() => setSelectedOrder(null)}
                onStatusChange={handleStatusChange}
                onPrint={handlePrint}
                onOpenRefund={orderToRefund => setRefundOrder(orderToRefund)}
                statusInfo={STATUS[selectedOrder.status] ?? STATUS.new}
                isPersistentPane={true}
              />
            </div>
          )}
        </div>
      </div>

      {/* Slide-Over Drawer on Compact/Portrait Screens (<1024px) */}
      {!isWideScreen && selectedOrder && (
        <OrderDetailPanel
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onStatusChange={handleStatusChange}
          onPrint={handlePrint}
          onOpenRefund={orderToRefund => setRefundOrder(orderToRefund)}
          statusInfo={STATUS[selectedOrder.status] ?? STATUS.new}
          isPersistentPane={false}
        />
      )}

      {/* Streamlined Refund Modal (No dollar presets) */}
      {refundOrder && (
        <RefundModal
          order={refundOrder}
          onClose={() => setRefundOrder(null)}
          onSuccess={() => {
            setRefundOrder(null);
            load(false);
          }}
          apiFetch={apiFetch}
        />
      )}
    </div>
  );
}
