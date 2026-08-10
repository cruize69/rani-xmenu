// OrderDetailPanel.jsx — Rani Mahal Order Detail Panel / Persistent Pane

import { useState, useMemo } from "react";
import { formatPhoneNumber } from "./OrderCard.jsx";

const fmt = n => "$" + Number(n ?? 0).toFixed(2);
const fmtFull = iso => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

export default function OrderDetailPanel({ order, onClose, onStatusChange, onPrint, onOpenRefund, statusInfo, isPersistentPane = false }) {
  const [updating, setUpdating] = useState(false);
  const s = statusInfo;

  const handleStatus = async () => {
    if (!s?.next || updating) return;
    setUpdating(true);
    try {
      await onStatusChange(order.id, s.next);
    } finally {
      setUpdating(false);
    }
  };

  const canRefund = order.stripePaymentId && order.status !== "refunded";
  const shortId = "#" + (order.id ? order.id.slice(-6).toUpperCase() : "");
  const formattedPhone = useMemo(() => formatPhoneNumber(order.customerPhone), [order.customerPhone]);
  const isDelivery = order.orderMode === "delivery";

  const content = (
    <div>
      {/* Header Bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, pb: 12, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: "var(--rm-panel-text)" }}>{order.customerName || "Customer"}</h2>
            <span className="rm-badge" style={{ background: s?.bg, color: s?.color, border: `1px solid ${s?.color}` }}>
              {s?.label || order.status}
            </span>
          </div>
          <p style={{ fontSize: 13, color: "var(--rm-panel-subtext)", marginTop: 4, fontWeight: 700 }}>
            Order {shortId} • {new Date(order.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        {!isPersistentPane && (
          <button className="rm-panel-close" onClick={onClose}>✕</button>
        )}
      </div>

      {/* Fulfillment & Contact Card (Formatted phone & email) */}
      <div style={{ background: "var(--rm-inset-bg)", padding: "16px", borderRadius: 16, marginBottom: 16, border: "1px solid var(--rm-inset-border)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: "var(--rm-panel-subtext)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Fulfillment Mode</span>
          <span className={`rm-fulfillment-badge ${isDelivery ? "delivery" : "pickup"}`}>
            {isDelivery ? "🚗 DELIVERY" : "🛍️ PICKUP"}
          </span>
        </div>

        {/* Contact details with formatted phone (XXX) XXX-XXXX */}
        <div style={{ fontSize: 14, display: "flex", flexDirection: "column", gap: 6 }}>
          {formattedPhone && (
            <a href={`tel:${order.customerPhone}`} style={{ color: "var(--rm-gold-primary)", textDecoration: "none", fontWeight: 800, fontSize: 16, display: "inline-flex", alignItems: "center", gap: 8 }}>
              📞 {formattedPhone}
            </a>
          )}
          {order.customerEmail && (
            <a href={`mailto:${order.customerEmail}`} style={{ color: "var(--rm-panel-subtext)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600 }}>
              ✉ {order.customerEmail}
            </a>
          )}
        </div>

        {/* Delivery Address */}
        {isDelivery && order.deliveryAddress && (
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px dashed rgba(200,133,58,0.2)", fontSize: 13, color: "var(--rm-panel-text)" }}>
            <strong>Delivery Address: </strong>
            {order.deliveryAddress.street}{order.deliveryAddress.apt ? `, Apt ${order.deliveryAddress.apt}` : ""},{" "}
            {order.deliveryAddress.city} {order.deliveryAddress.zip || ""}
            {order.deliveryAddress.notes && (
              <div style={{ marginTop: 6, background: "rgba(200,133,58,0.15)", padding: "8px 12px", borderRadius: 8, fontSize: 12, color: "#E8A82E", fontStyle: "italic", fontWeight: 600 }}>
                Driver Note: "{order.deliveryAddress.notes}"
              </div>
            )}
          </div>
        )}
      </div>

      {/* Itemized Order Breakdown */}
      <div style={{ background: "var(--rm-inset-bg)", padding: "16px", borderRadius: 16, marginBottom: 16, border: "1px solid var(--rm-inset-border)" }}>
        <h3 style={{ fontSize: 12, fontWeight: 800, color: "var(--rm-panel-subtext)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
          Order Items ({order.items?.length || 0})
        </h3>

        {order.items?.map((item, idx) => (
          <div key={idx} className="rm-item-row">
            <div style={{ display: "flex", alignItems: "flex-start", flex: 1 }}>
              <span className="rm-qty-bubble">{item.qty}</span>
              <div>
                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--rm-panel-text)" }}>{item.name}</span>
                {item.spice && <span className="rm-spice-badge rm-spice-spicy" style={{ marginLeft: 8 }}>🌶 {item.spice}</span>}
                {item.note && <div style={{ fontSize: 12, color: "var(--rm-panel-subtext)", marginTop: 2 }}>↳ {item.note}</div>}
              </div>
            </div>
            <span style={{ fontSize: 15, fontWeight: 800, color: "var(--rm-panel-text)", marginLeft: 12 }}>
              {fmt(item.price * item.qty)}
            </span>
          </div>
        ))}
      </div>

      {/* Financial Breakdown */}
      <div style={{ background: "var(--rm-inset-bg)", padding: "16px", borderRadius: 16, marginBottom: 16, border: "1px solid var(--rm-inset-border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--rm-panel-subtext)", marginBottom: 6 }}>
          <span>Subtotal</span><span>{fmt(order.subtotal)}</span>
        </div>
        {isDelivery && (
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--rm-gold-primary)", marginBottom: 6, fontWeight: 600 }}>
            <span>Delivery Fee</span><span>{order.deliveryFee > 0 ? fmt(order.deliveryFee) : "FREE"}</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--rm-panel-subtext)", marginBottom: 8 }}>
          <span>Tax (8.375%)</span><span>{fmt(order.tax)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 800, color: "var(--rm-panel-text)", paddingTop: 8, borderTop: "1px solid rgba(0,0,0,0.1)" }}>
          <span>Total Charged</span><span style={{ color: "var(--rm-gold-primary)" }}>{fmt(order.total)}</span>
        </div>

        {order.refundedTotal > 0 && (
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px dashed rgba(248,113,113,0.3)", color: "#F87171", fontSize: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Total Refunded</span><span>−{fmt(order.refundedTotal)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, marginTop: 4, color: "var(--rm-panel-text)" }}>
              <span>Net Revenue</span><span style={{ color: "#34D399" }}>{fmt(order.total - order.refundedTotal)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Special Instructions */}
      {order.specialInstructions && (
        <div style={{ background: "rgba(200,133,58,0.15)", borderLeft: "4px solid var(--rm-gold-primary)", padding: "12px 14px", borderRadius: "0 10px 10px 0", marginBottom: 16, fontSize: 13, color: "#E8A82E", fontWeight: 600 }}>
          <strong>Special Instructions:</strong> "{order.specialInstructions}"
        </div>
      )}

      {/* Refund History Logs */}
      {order.refundHistory?.length > 0 && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", padding: "12px", borderRadius: 12, marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#F87171", marginBottom: 6 }}>Refund Audit Trail</p>
          {order.refundHistory.map((r, i) => (
            <div key={i} style={{ fontSize: 12, color: "var(--rm-panel-text)", marginBottom: 4 }}>
              {r.success ? "✓" : "✗"} {r.type} • {fmt(r.amount)} • {r.reason || "Refund"} ({fmtFull(r.timestamp)})
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20 }}>
        {s?.next && (
          <button
            onClick={handleStatus}
            disabled={updating}
            className="rm-btn-primary"
            style={{ background: s.nextColor || "#1A6B3A", color: "#FFFFFF" }}
          >
            {updating ? "Updating..." : `✓ ${s.nextLabel}`}
          </button>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => onPrint(order.id)}
            className="rm-btn-outline"
            style={{ flex: 1 }}
          >
            🖨 {order.printed ? "Reprint Receipt" : "Print Receipt"}
          </button>

          {canRefund && (
            <button
              onClick={() => onOpenRefund(order)}
              className="rm-btn-outline"
              style={{ flex: 1, borderColor: "#9B2626", color: "#F87171" }}
            >
              ↩ Refund / Void
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (isPersistentPane) {
    return <div className="rm-persistent-panel">{content}</div>;
  }

  return (
    <div className="rm-panel-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="rm-panel">
        <div className="rm-panel-body">{content}</div>
      </div>
    </div>
  );
}
