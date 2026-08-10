// OrderCard.jsx — Single-column rich tablet & mobile order card

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

  return (
    <div className="rm-card" onClick={() => onSelectCard(order)}>
      {/* Left status color bar */}
      <div className="rm-card-left-stripe" style={{ backgroundColor: s.color }} />

      <div>
        {/* Top Header Row: Customer Name front & center + Badge & Elapsed Time */}
        <div className="rm-card-header">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h3 className="rm-customer-name">{order.customerName || "Walk-in Guest"}</h3>
              <span className="rm-order-id-sub">{shortId}</span>
              <span className="rm-time-elapsed">⏱ {elapsedTime}</span>
            </div>
            
            {/* Contact & Address info row */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
              {addressLine && (
                <div style={{ fontSize: 13, color: "#E8A82E", background: "rgba(200, 133, 58, 0.14)", padding: "3px 10px", borderRadius: 8, display: "inline-flex", alignItems: "center", gap: 5, border: "1px solid rgba(200, 133, 58, 0.25)", fontWeight: 600 }}>
                  <span>📍</span>
                  <span>{addressLine}</span>
                </div>
              )}
              
              {order.customerPhone && (
                <span style={{ fontSize: 12, color: "#A09080", fontWeight: 600 }}>
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

        {/* Structured Items Box (Clean, easy to read, avoiding text fatigue) */}
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
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed rgba(255,255,255,0.1)", fontSize: 12, color: "#E8A82E", fontStyle: "italic" }}>
              Note: "{order.specialInstructions}"
            </div>
          )}
        </div>
      </div>

      {/* Card Actions & Totals Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, color: "#A09080", textTransform: "uppercase", letterSpacing: "0.05em" }}>Total:</span>
          <span style={{ fontSize: 20, fontWeight: 800, color: "#FAF6EF" }}>{fmt(order.total)}</span>
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
            style={{ padding: "0 14px" }}
          >
            🖨 {order.printed ? "Reprint" : "Print"}
          </button>

          <button
            className="rm-btn-outline"
            onClick={() => onSelectCard(order)}
            style={{ padding: "0 14px" }}
          >
            Details
          </button>

          {s.next && (
            <button
              className="rm-btn-primary"
              style={{ background: s.nextColor || "#1A6B3A", color: "#FFFFFF", padding: "0 22px" }}
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
