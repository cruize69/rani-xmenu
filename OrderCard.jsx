// OrderCard.jsx — Touch-optimized card for tablet and mobile order manager

import { useMemo } from "react";

const fmt = n => "$" + Number(n ?? 0).toFixed(2);

export default function OrderCard({ order, statusConfig, onSelectCard, onStatusChange }) {
  const s = statusConfig[order.status] ?? statusConfig.new;

  const shortId = useMemo(() => {
    return order.id ? "#" + order.id.slice(-6).toUpperCase() : "#------";
  }, [order.id]);

  const elapsedTime = useMemo(() => {
    if (!order.createdAt) return "";
    const mins = Math.max(0, Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000));
    if (mins === 0) return "Just now";
    return `${mins} min ago`;
  }, [order.createdAt]);

  const isDelivery = order.orderMode === "delivery";

  const handleQuickStatus = (e) => {
    e.stopPropagation();
    if (s.next) {
      onStatusChange(order.id, s.next);
    }
  };

  return (
    <div className="rm-card" onClick={() => onSelectCard(order)}>
      {/* Left status color bar */}
      <div className="rm-card-left-stripe" style={{ backgroundColor: s.color }} />

      <div>
        {/* Top Header Row: Customer Name front and center + Pickup/Delivery Badge */}
        <div className="rm-card-header">
          <div>
            <h3 className="rm-customer-name">{order.customerName || "Walk-in Guest"}</h3>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
              <span className="rm-order-id-sub">{shortId}</span>
              <span className="rm-time-elapsed">⏱ {elapsedTime}</span>
            </div>
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <span className={`rm-badge ${isDelivery ? "rm-badge-delivery" : "rm-badge-pickup"}`}>
              {isDelivery ? "🚗 DELIVERY" : "📦 PICKUP"}
            </span>
            
            {!order.printed && order.status !== "refunded" && (
              <span className="rm-unprinted-tag">UNPRINTED</span>
            )}
          </div>
        </div>

        {/* Middle Section: Items Summary & Price */}
        <div className="rm-card-middle">
          <div className="rm-card-summary-line">
            <span>{order.items?.length || 0} {order.items?.length === 1 ? "item" : "items"}</span>
            <span>•</span>
            <span className="rm-card-price">{fmt(order.total)}</span>
            {order.refundedTotal > 0 && (
              <span style={{ color: "#F87171", fontSize: 11 }}>
                ({order.refundedTotal >= order.total - 0.01 ? "Refunded" : `−${fmt(order.refundedTotal)}`})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Touch Action Buttons */}
      <div className="rm-card-actions" onClick={e => e.stopPropagation()}>
        <button
          className="rm-btn-outline"
          onClick={() => onSelectCard(order)}
        >
          View
        </button>

        {s.next && (
          <button
            className="rm-btn-primary"
            style={{ background: s.nextColor || "#1A6B3A", color: "#FFFFFF" }}
            onClick={handleQuickStatus}
          >
            {s.nextLabel}
          </button>
        )}
      </div>
    </div>
  );
}
