// OrderCard.jsx — Rani Mahal tablet order card

import { useMemo } from "react";

const fmt = n => "$" + Number(n ?? 0).toFixed(2);

// Utility: Format phone numbers cleanly as (XXX) XXX-XXXX
export function formatPhoneNumber(str) {
  if (!str) return null;
  const digits = str.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return str; // Return raw if non-standard length
}

// Utility: Check if special instructions contain allergy flags
function checkAllergies(notes) {
  if (!notes) return null;
  const lower = notes.toLowerCase();
  const keywords = ["allergy", "allergies", "nut", "peanut", "dairy", "gluten", "vegan", "celiac"];
  const matched = keywords.filter(k => lower.includes(k));
  return matched.length > 0 ? notes : null;
}

export default function OrderCard({ order, statusConfig, selected, onSelectCard, onStatusChange, onPrint }) {
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
  const formattedPhone = useMemo(() => formatPhoneNumber(order.customerPhone), [order.customerPhone]);
  const allergyNote = useMemo(() => checkAllergies(order.specialInstructions), [order.specialInstructions]);

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

  const borderStyle = useMemo(() => {
    if (selected) return { borderColor: "var(--rm-gold-primary)", boxShadow: "0 0 20px var(--rm-gold-glow)" };
    if (order.status === "new") return { boxShadow: "0 0 16px rgba(249, 138, 50, 0.25)", borderColor: "rgba(249, 138, 50, 0.4)" };
    if (order.status === "done") return { boxShadow: "0 0 16px rgba(52, 211, 153, 0.25)", borderColor: "rgba(52, 211, 153, 0.4)" };
    return {};
  }, [selected, order.status]);

  return (
    <div className={`rm-card ${selected ? "selected" : ""}`} style={borderStyle} onClick={() => onSelectCard(order)}>
      {/* Left status color stripe */}
      <div className="rm-card-left-stripe" style={{ backgroundColor: s.color }} />

      <div>
        {/* Top Header Row: 24pt Bold Customer Name + Clean Badge (ONLY Pickup or Delivery) */}
        <div className="rm-card-header">
          <div>
            <h2 className="rm-customer-name">{order.customerName || "Walk-in Guest"}</h2>
            
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
              <span className="rm-order-id-sub">{shortId}</span>
              <span className="rm-time-elapsed">⏱ {elapsedTime}</span>
            </div>
            
            {/* Phone & Address row (Clean spacing, formatted phone) */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8, flexWrap: "wrap" }}>
              {addressLine && (
                <div style={{ fontSize: 13, color: "#E8A82E", background: "rgba(200, 133, 58, 0.14)", padding: "4px 12px", borderRadius: 8, display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid rgba(200, 133, 58, 0.3)", fontWeight: 600 }}>
                  <span>📍</span>
                  <span>{addressLine}</span>
                </div>
              )}
              
              {formattedPhone && (
                <span style={{ fontSize: 13, color: "var(--rm-text-muted)", fontWeight: 700, letterSpacing: "0.02em" }}>
                  📞 {formattedPhone}
                </span>
              )}
            </div>
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            {/* Clean Fulfillment Badges (ONLY 2 modes: DELIVERY or PICKUP) */}
            <span className={`rm-fulfillment-badge ${isDelivery ? "delivery" : "pickup"}`}>
              {isDelivery ? "🚗 DELIVERY" : "🛍️ PICKUP"}
            </span>
            
            {!order.printed && order.status !== "refunded" && (
              <span className="rm-unprinted-tag">UNPRINTED</span>
            )}
          </div>
        </div>

        {/* Allergy Warning Banner if detected */}
        {allergyNote && (
          <div className="rm-allergy-banner">
            <span>⚠️</span>
            <span>ALLERGY ALERT: "{allergyNote}"</span>
          </div>
        )}

        {/* Inset Structured Items Box */}
        <div className="rm-card-items-box">
          {order.items?.map((item, idx) => (
            <div key={idx} className="rm-card-item-row">
              <div style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}>
                <span className="rm-card-qty">{item.qty}</span>
                <span className="rm-card-item-name" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.name}
                </span>
                
                {/* Spice Badges */}
                {item.spice && (
                  <span className={`rm-spice-badge ${
                    item.spice.toLowerCase().includes("mild") ? "rm-spice-mild" :
                    item.spice.toLowerCase().includes("medium") ? "rm-spice-medium" :
                    item.spice.toLowerCase().includes("hot") ? "rm-spice-hot" : "rm-spice-spicy"
                  }`}>
                    🌶 {item.spice}
                  </span>
                )}
              </div>
              <span className="rm-card-item-price">{fmt(item.price * item.qty)}</span>
            </div>
          ))}

          {/* Kitchen instructions callout if present */}
          {order.specialInstructions && !allergyNote && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed rgba(200,133,58,0.2)", fontSize: 13, color: "#E8A82E", fontStyle: "italic", fontWeight: 600 }}>
              Note: "{order.specialInstructions}"
            </div>
          )}
        </div>
      </div>

      {/* Card Footer Bar */}
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
