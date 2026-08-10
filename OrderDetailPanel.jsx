// OrderDetailPanel.jsx — Slide-over drawer for order details

import { useState } from "react";

const fmt = n => "$" + Number(n ?? 0).toFixed(2);
const fmtFull = iso => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

export default function OrderDetailPanel({ order, onClose, onStatusChange, onPrint, onOpenRefund, statusInfo }) {
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

  return (
    <div className="rm-panel-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="rm-panel">
        {/* Header */}
        <div className="rm-panel-header">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h2 className="rm-panel-title">{order.customerName || "Customer"}</h2>
              <span className="rm-badge" style={{ background: s?.bg, color: s?.color, border: `1px solid ${s?.color}` }}>
                {s?.label || order.status}
              </span>
            </div>
            <p style={{ fontSize: 13, color: "#7A6855", marginTop: 4, fontWeight: 600 }}>
              Order {shortId} • {new Date(order.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          <button className="rm-panel-close" onClick={onClose}>✕</button>
        </div>

        {/* Body Content */}
        <div className="rm-panel-body">
          {/* Customer & Fulfillment Badge */}
          <div style={{ background: "#FFFFFF", padding: "14px 16px", borderRadius: 14, marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#8A7560", letterSpacing: "0.08em", textTransform: "uppercase" }}>Fulfillment</span>
              <span className={`rm-badge ${order.orderMode === "delivery" ? "rm-badge-delivery" : "rm-badge-pickup"}`}>
                {order.orderMode === "delivery" ? "🚗 DELIVERY" : "📦 PICKUP"}
              </span>
            </div>

            {/* Contact details */}
            <div style={{ fontSize: 13, color: "#332211", display: "flex", flexDirection: "column", gap: 4 }}>
              {order.customerPhone && (
                <a href={`tel:${order.customerPhone}`} style={{ color: "#C8853A", textDecoration: "none", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  📞 {order.customerPhone}
                </a>
              )}
              {order.customerEmail && (
                <a href={`mailto:${order.customerEmail}`} style={{ color: "#7A6855", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  ✉ {order.customerEmail}
                </a>
              )}
            </div>

            {/* Delivery address if delivery */}
            {order.orderMode === "delivery" && order.deliveryAddress && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed rgba(0,0,0,0.1)", fontSize: 13, color: "#443322" }}>
                <strong>Address: </strong>
                {order.deliveryAddress.street}{order.deliveryAddress.apt ? `, Apt ${order.deliveryAddress.apt}` : ""},{" "}
                {order.deliveryAddress.city} {order.deliveryAddress.zip || ""}
                {order.deliveryAddress.notes && (
                  <div style={{ marginTop: 4, background: "#FFF8EC", padding: "6px 10px", borderRadius: 8, fontSize: 12, color: "#C8600A" }}>
                    <em>Note for driver: "{order.deliveryAddress.notes}"</em>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Items Section */}
          <div style={{ background: "#FFFFFF", padding: "16px", borderRadius: 14, marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.06)" }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: "#8A7560", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
              Items Ordered ({order.items?.length || 0})
            </h3>

            {order.items?.map((item, idx) => (
              <div key={idx} className="rm-item-row">
                <div style={{ display: "flex", alignItems: "flex-start", flex: 1 }}>
                  <span className="rm-qty-bubble">{item.qty}</span>
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#0F0800" }}>{item.name}</span>
                    {item.spice && <span style={{ fontSize: 12, color: "#C8853A", marginLeft: 6, fontWeight: 700 }}>🌶 {item.spice}</span>}
                    {item.note && <div style={{ fontSize: 12, color: "#8A7560", marginTop: 2 }}>↳ {item.note}</div>}
                  </div>
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#0F0800", marginLeft: 12 }}>
                  {fmt(item.price * item.qty)}
                </span>
              </div>
            ))}
          </div>

          {/* Financial Breakdown */}
          <div style={{ background: "#FFFFFF", padding: "16px", borderRadius: 14, marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#7A6855", marginBottom: 6 }}>
              <span>Subtotal</span><span>{fmt(order.subtotal)}</span>
            </div>
            {order.orderMode === "delivery" && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#C8600A", marginBottom: 6, fontWeight: 600 }}>
                <span>Delivery Fee</span><span>{order.deliveryFee > 0 ? fmt(order.deliveryFee) : "FREE"}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#7A6855", marginBottom: 8 }}>
              <span>Tax (8.375%)</span><span>{fmt(order.tax)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 800, color: "#0F0800", paddingTop: 8, borderTop: "1px solid rgba(0,0,0,0.1)" }}>
              <span>Total Paid</span><span style={{ color: "#C8853A" }}>{fmt(order.total)}</span>
            </div>

            {order.refundedTotal > 0 && (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed rgba(155,38,38,0.2)", color: "#9B2626", fontSize: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Refunded</span><span>−{fmt(order.refundedTotal)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, marginTop: 4, color: "#0F0800" }}>
                  <span>Net Revenue</span><span style={{ color: "#1A6B3A" }}>{fmt(order.total - order.refundedTotal)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Special Instructions if any */}
          {order.specialInstructions && (
            <div style={{ background: "#FEF3E8", borderLeft: "4px solid #C8600A", padding: "12px 14px", borderRadius: "0 10px 10px 0", marginBottom: 16, fontSize: 13, color: "#332211" }}>
              <strong>Special Instructions:</strong> {order.specialInstructions}
            </div>
          )}

          {/* Refund History if any */}
          {order.refundHistory?.length > 0 && (
            <div style={{ background: "#FEF0F0", border: "1px solid rgba(155,38,38,0.2)", padding: "12px", borderRadius: 12, marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#9B2626", marginBottom: 6 }}>Refund History</p>
              {order.refundHistory.map((r, i) => (
                <div key={i} style={{ fontSize: 12, color: "#331111", marginBottom: 4 }}>
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
                style={{ flex: 1, borderColor: "rgba(0,0,0,0.2)", color: "#0F0800", minHeight: 48 }}
              >
                🖨 {order.printed ? "Reprint Receipt" : "Print Receipt"}
              </button>

              {canRefund && (
                <button
                  onClick={() => onOpenRefund(order)}
                  className="rm-btn-outline"
                  style={{ flex: 1, borderColor: "#9B2626", color: "#9B2626", minHeight: 48 }}
                >
                  ↩ Refund / Void
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
