// OrderCard.jsx — Single-column rich glassmorphism tablet & mobile order card

import { useMemo } from "react";

const fmt = n => "$" + Number(n ?? 0).toFixed(2);

export default function OrderCard({ order, statusConfig, onSelectCard, onStatusChange, onPrint }) {
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

  const addressLine = useMemo(() => {
    if (!isDelivery || !order.deliveryAddress) return null;
    const { street, apt, city, zip } = order.deliveryAddress;
    return `${street}${apt ? `, Apt ${apt}` : ""}${city ? `, ${city}` : ""}${zip ? ` ${zip}` : ""}`;
  }, [isDelivery, order.deliveryAddress]);

  const handleQuickStatus = (e) => {
    e.stopPropagation();
    if (s.next) {
      onStatusChange(order.id, s.next);
    }
  };

  const handleQuickPrint = (e) => {
    e.stopPropagation();
    onPrint(order.id);
  };

  const glowStyle = useMemo(() => {
    if (order.status === "new") return { boxShadow: "0 0 16px rgba(249, 138, 50, 0.22)", borderColor: "rgba(249, 138, 50, 0.4)" };
    if (order.status === "done") return { boxShadow: "0 0 16px rgba(52, 211, 153, 0.22)", borderColor: "rgba(52, 211, 153, 0.4)" };
    return {};
  }, [order.status]);

  return (
    <div className="rm-card" style={glowStyle} onClick={() => onSelectCard(order)}>
      {/* Left status color bar */}
      <div className="rm-card-left-stripe" style={{ backgroundColor: s.color }} />

      <div>
        {/* Top Header Row: Customer Name (Extra Large 24px bold) front & center */}
        <div className="rm-card-header">
          <div>
            <h2 className="rm-customer-name">{order.customerName || "Walk-in Guest"}</h2>
            
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
              <span className="rm-order-id-sub">{shortId}</span>
              <span className="rm-time-elapsed">⏱ {elapsedTime}</span>
            </div>
            
            {/* Contact & Address info row */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
              {addressLine && (
                <div style={{ fontSize: 13, color: "#E8A82E", background: "rgba(200, 133, 58, 0.14)", padding: "4px 12px", borderRadius: 8, display: "inline-flex", alignItems: "center", gap: 5, border: "1px solid rgba(200, 133, 58, 0.3)", fontWeight: 600 }}>
                  <span>📍</span>
                  <span>{addressLine}</span>
                </div>
              )}
              
              {order.customerPhone && (
                <span style={{ fontSize: 13, color: "var(--rm-text-muted)", fontWeight: 600 }}>
                  📞 {order.customerPhone}
                </span>
              )}
            </div>
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            <span className={`rm-badge ${isDelivery ? "rm-badge-delivery" : "rm-badge-pickup"}`}>
              {isDelivery ? "🚗 DELIVERY" : "📦 PICKUP"}
            </span>
            
            {!order.printed && order.status !== "refunded" && (
              <span className="rm-unprinted-tag">UNPRINTED</span>
            )}
          </div>
        </div>

        {/* Structured Items Box (Clean, high contrast, zero fatigue) */}
        <div className="rm-card-items-box">
          {order.items?.map((item, idx) => (
            <div key={idx} className="rm-card-item-row">
              <div style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}>
                <span className="rm-card-qty">{item.qty}</span>
                <span className="rm-card-item-name" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.name}
                </span>
                {item.spice && (
                  <span style={{ fontSize: 11, color: "#E8A82E", marginLeft: 6, fontWeight: 700, flexShrink: 0 }}>
                    🌶 {item.spice}
                  </span>
                )}
              </div>
              <span className="rm-card-item-price">{fmt(item.price * item.qty)}</span>
            </div>
          ))}

          {/* Special instructions box if present */}
          {order.specialInstructions && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed rgba(200,133,58,0.2)", fontSize: 13, color: "#E8A82E", fontStyle: "italic", fontWeight: 600 }}>
              Note: "{order.specialInstructions}"
            </div>
          )}
        </div>
      </div>

      {/* Card Actions & Totals Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, color: "var(--rm-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Total:</span>
          <span style={{ fontSize: 22, fontWeight: 800, color: "var(--rm-text-title)" }}>{fmt(order.total)}</span>
          {order.refundedTotal > 0 && (
            <span style={{ color: "#F87171", fontSize: 12, fontWeight: 700 }}>
              ({order.refundedTotal >= order.total - 0.01 ? "Refunded" : `−${fmt(order.refundedTotal)}`})
            </span>
          )}
        </div>

        <div className="rm-card-actions" onClick={e => e.stopPropagation()}>
          <button
            className="rm-btn-outline"
            onClick={handleQuickPrint}
            title="Print receipt"
          >
            🖨 {order.printed ? "Reprint" : "Print"}
          </button>

          <button
            className="rm-btn-outline"
            onClick={() => onSelectCard(order)}
          >
            Details
          </button>

          {s.next && (
            <button
              className="rm-btn-primary"
              style={{ background: s.nextColor || "#1A6B3A", color: "#FFFFFF" }}
              onClick={handleQuickStatus}
            >
              ✓ {s.nextLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
