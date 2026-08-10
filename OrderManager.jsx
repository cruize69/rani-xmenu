// OrderManager.jsx — Rani Mahal order + charge management dashboard (Redesigned)

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { getManagerSecret } from "./lib/managerAuth.js";
import OrderCard from "./OrderCard.jsx";
import OrderDetailPanel from "./OrderDetailPanel.jsx";
import "./manager.css";

const API_BASE = "";

const STATUS = {
  new:      { label: "Received", color: "#F98A32", bg: "rgba(200, 96, 10, 0.15)", next: "done", nextLabel: "Mark Ready", nextColor: "#1A6B3A" },
  done:     { label: "Ready",    color: "#34D399", bg: "rgba(26, 107, 58, 0.18)", next: null,   nextLabel: null,       nextColor: null },
  refunded: { label: "Refunded", color: "#F87171", bg: "rgba(155, 38, 38, 0.18)", next: null,   nextLabel: null,       nextColor: null },
};

const REFUND_REASONS = [
  "Wrong item prepared",
  "Item unavailable / out of stock",
  "Customer cancelled order",
  "Order never picked up",
  "Quality issue",
  "Duplicate order",
  "Other",
];

const fmt = n => "$" + Number(n ?? 0).toFixed(2);
const fmtFull = iso => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

// ── API helpers ──────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", "x-manager-secret": getManagerSecret(), ...(options.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

// ── Refund modal ─────────────────────────────────────────────────
function RefundModal({ order, onClose, onSuccess }) {
  const [mode, setMode]         = useState("menu");   // menu | full | partial | item | void | history
  const [amount, setAmount]     = useState("");
  const [itemName, setItemName] = useState(order.items[0]?.name ?? "");
  const [reason, setReason]     = useState(REFUND_REASONS[0]);
  const [staff, setStaff]       = useState("Manager");
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState(null);

  const alreadyRefunded = order.refundedTotal ?? 0;
  const remaining       = Math.max(0, order.total - alreadyRefunded);
  const fullyRefunded   = alreadyRefunded >= order.total - 0.01;

  const submit = async (type) => {
    setLoading(true); setError(null);
    try {
      const itemRefundAmount = (() => {
        const item = order.items.find(i => i.name === itemName);
        return item ? item.price * item.qty : 0;
      })();

      const amountRefunded = type === "full" ? remaining
        : type === "item" ? itemRefundAmount
        : type === "void" ? order.total
        : Number(amount);

      const res = await apiFetch("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          action: "refund",
          orderId: order.id,
          type,
          amount: amountRefunded,
          reason,
          itemName: type === "item" ? itemName : undefined,
          staffName: staff
        })
      });

      setResult({
        type,
        amountRefunded,
        stripeRefundId: res.stripeRefundId || ("re_" + Date.now().toString(36))
      });
      onSuccess(order.id, type, amountRefunded);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const itemRefundAmount = (() => {
    const item = order.items.find(i => i.name === itemName);
    return item ? item.price * item.qty : 0;
  })();

  const ModalWrap = ({ children, title, onBack }) => (
    <div className="rm-modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="rm-modal-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, pb: 10, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {onBack && <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer" }}>←</button>}
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0F0800" }}>{title}</h3>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#8A7560" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );

  if (result) return (
    <ModalWrap title="Refund Processed">
      <div style={{ textAlign: "center", padding: "16px 0" }}>
        <div style={{ fontSize: 44, color: "#1A6B3A", marginBottom: 8 }}>✓</div>
        <p style={{ fontSize: 18, fontWeight: 700, color: "#0F0800", marginBottom: 4 }}>
          {result.type === "void" ? "Order voided" : `${fmt(result.amountRefunded)} refunded`}
        </p>
        <p style={{ fontSize: 12, color: "#8A7560", marginBottom: 16 }}>Stripe ID: {result.stripeRefundId}</p>
        <button onClick={onClose} className="rm-btn-primary" style={{ background: "#0F0800", color: "#FFFFFF" }}>Done</button>
      </div>
    </ModalWrap>
  );

  if (mode === "menu") return (
    <ModalWrap title={`Manage Charge #${order.id.slice(-6).toUpperCase()}`}>
      <div style={{ background: "#FAF6EF", padding: 12, borderRadius: 10, marginBottom: 16, fontSize: 13 }}>
        <div style={{ display: "flex", justifyContent: "space-between", color: "#7A6855" }}><span>Total</span><span>{fmt(order.total)}</span></div>
        {alreadyRefunded > 0 && <div style={{ display: "flex", justifyContent: "space-between", color: "#9B2626", marginTop: 4 }}><span>Refunded</span><span>−{fmt(alreadyRefunded)}</span></div>}
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, color: "#0F0800", marginTop: 4, pt: 4, borderTop: "1px solid rgba(0,0,0,0.08)" }}><span>Refundable</span><span>{fmt(remaining)}</span></div>
      </div>

      {fullyRefunded ? (
        <p style={{ textAlign: "center", color: "#9B2626", padding: 12 }}>Fully refunded</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button onClick={() => setMode("full")} className="rm-btn-outline" style={{ color: "#9B2626", borderColor: "#9B2626" }}>↩ Full Refund ({fmt(remaining)})</button>
          <button onClick={() => setMode("partial")} className="rm-btn-outline" style={{ color: "#C8600A", borderColor: "#C8600A" }}>✂ Partial Refund</button>
          <button onClick={() => setMode("item")} className="rm-btn-outline" style={{ color: "#C8853A", borderColor: "#C8853A" }}>🍽 Item Refund</button>
        </div>
      )}
    </ModalWrap>
  );

  if (mode === "full") return (
    <ModalWrap title="Full Refund" onBack={() => setMode("menu")}>
      <p style={{ fontSize: 13, color: "#7A6855", marginBottom: 14 }}>Refund <strong>{fmt(remaining)}</strong> to customer card?</p>
      {error && <div style={{ color: "#9B2626", fontSize: 12, marginBottom: 10 }}>{error}</div>}
      <button onClick={() => submit("full")} disabled={loading} className="rm-btn-primary" style={{ background: "#9B2626", color: "#FFF" }}>
        {loading ? "Processing..." : `Confirm Refund ${fmt(remaining)}`}
      </button>
    </ModalWrap>
  );

  return null;
}

// ── Main App ─────────────────────────────────────────────────────
export default function OrderManager() {
  const [orders, setOrders]             = useState([]);
  const [summary, setSummary]           = useState(null);
  const [date, setDate]                 = useState(() => new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }));
  const [filter, setFilter]             = useState("active");
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);
  const [lastRefresh, setLastRefresh]   = useState(new Date());
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [refundOrder, setRefundOrder]   = useState(null);
  const [newOrderIds, setNewOrderIds]   = useState(new Set());
  const prevOrderIds                    = useRef(new Set());

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

  // Server-Sent Events (SSE) stream
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

  const { filtered, newCount, inProgCount, refundedCount, totalRefunded } = useMemo(() => {
    const list = orders.filter(o => {
      if (filter === "active")   return o.status !== "done" && o.status !== "refunded";
      if (filter === "done")     return o.status === "done";
      if (filter === "refunded") return o.status === "refunded";
      return true;
    });
    const nc = orders.filter(o => o.status === "new").length;
    const ipc = orders.filter(o => o.status === "in_progress").length;
    const rc = orders.filter(o => o.status === "refunded").length;
    const tr = orders.reduce((s, o) => s + (o.refundedTotal ?? 0), 0);
    return { filtered: list, newCount: nc, inProgCount: ipc, refundedCount: rc, totalRefunded: tr };
  }, [orders, filter]);

  return (
    <div className="rm-manager-root">
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
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="rm-date-picker"
          />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div className={`rm-status-dot ${error ? "offline" : "online"}`} />
            <span style={{ fontSize: 11, color: "#A09080" }}>
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
        {/* Quick Stats Row */}
        <div className="rm-stats-row">
          <div className="rm-stat-card">
            <p className="rm-stat-label">Total Orders</p>
            <p className="rm-stat-value">{orders.length}</p>
            <p className="rm-stat-sub">{date}</p>
          </div>
          <div className="rm-stat-card" style={{ borderColor: newCount > 0 ? "rgba(249, 138, 50, 0.4)" : "rgba(255, 255, 255, 0.08)" }}>
            <p className="rm-stat-label">Active Orders</p>
            <p className="rm-stat-value" style={{ color: newCount > 0 ? "#F98A32" : "#FFFFFF" }}>
              {newCount + inProgCount}
            </p>
            <p className="rm-stat-sub">{newCount} new • {inProgCount} in progress</p>
          </div>
          <div className="rm-stat-card">
            <p className="rm-stat-label">Daily Revenue</p>
            <p className="rm-stat-value" style={{ color: "#E8A82E" }}>{fmt(summary?.totalRevenue ?? 0)}</p>
            <p className="rm-stat-sub">avg {fmt(summary?.avgOrderValue ?? 0)}</p>
          </div>
          {totalRefunded > 0 && (
            <div className="rm-stat-card" style={{ borderColor: "rgba(248, 113, 113, 0.3)" }}>
              <p className="rm-stat-label">Refunded Today</p>
              <p className="rm-stat-value" style={{ color: "#F87171" }}>{fmt(totalRefunded)}</p>
              <p className="rm-stat-sub">{refundedCount} {refundedCount === 1 ? "order" : "orders"}</p>
            </div>
          )}
        </div>

        {/* Filter Pills Bar */}
        <div className="rm-filter-bar">
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

        {/* Error message */}
        {error && (
          <div style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: 12, padding: "12px 16px", color: "#F87171", fontSize: 13, marginBottom: 14 }}>
            ⚠ Connection alert: {error}
          </div>
        )}

        {/* Orders List / Grid */}
        {loading && orders.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#A09080" }}>Loading orders...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#A09080", background: "var(--rm-bg-surface)", borderRadius: 16, border: "1px solid rgba(255, 255, 255, 0.05)" }}>
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

      {/* Refund Modal */}
      {refundOrder && (
        <RefundModal
          order={refundOrder}
          onClose={() => setRefundOrder(null)}
          onSuccess={() => {
            setRefundOrder(null);
            load(false);
          }}
        />
      )}
    </div>
  );
}
