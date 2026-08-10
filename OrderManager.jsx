// OrderManager.jsx — Rani Mahal order + charge management dashboard (Dual Theme & Glassmorphism)

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

// Helper: auto-detect theme based on time of day (7 AM – 6 PM = Light Day, 6 PM – 7 AM = Dark Night)
function getInitialTheme() {
  const stored = localStorage.getItem("rm_manager_theme");
  if (stored === "dark" || stored === "light") return stored;
  const hour = new Date().getHours();
  return (hour >= 7 && hour < 18) ? "light" : "dark";
}

// ── API helpers ──────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", "x-manager-secret": getManagerSecret(), ...(options.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

// ── Main App ─────────────────────────────────────────────────────
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
  const [newOrderIds, setNewOrderIds]   = useState(new Set());
  const prevOrderIds                    = useRef(new Set());

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

  // Server-Sent Events (SSE) stream for real-time manager updates
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
                const newIds = new Set(fetchedOrders.map(o => o.id).filter(id => !prevOrderIds.current.has(id)));
                setNewOrderIds(newIds);
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

  return (
    <div className={`rm-manager-root theme-${theme}`}>
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
          {/* Ambient Theme Switcher */}
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

      {/* Main Content Area */}
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

        {/* Connection Alert */}
        {error && (
          <div style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: 12, padding: "12px 16px", color: "#F87171", fontSize: 13, marginBottom: 14 }}>
            ⚠ Connection alert: {error}
          </div>
        )}

        {/* Orders Single Column Stack */}
        {loading && orders.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--rm-text-muted)" }}>Loading orders...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--rm-text-muted)", background: "var(--rm-card-bg)", borderRadius: 20, border: "1px solid var(--rm-card-border)" }}>
            {filter === "active" ? "✓ All clear! No active orders waiting." : "No orders match this filter."}
          </div>
        ) : (
          <div className="rm-orders-grid">
            {filtered.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                statusConfig={STATUS}
                onSelectCard={setSelectedOrder}
                onStatusChange={handleStatusChange}
                onPrint={handlePrint}
              />
            ))}
          </div>
        )}
      </div>

      {/* Slide-Over Order Detail Drawer */}
      {selectedOrder && (
        <OrderDetailPanel
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onStatusChange={handleStatusChange}
          onPrint={handlePrint}
          onOpenRefund={orderToRefund => setRefundOrder(orderToRefund)}
          statusInfo={STATUS[selectedOrder.status] ?? STATUS.new}
        />
      )}

      {/* Secure Refund Modal */}
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
