// OrderDetailPanel.jsx — Full ticket inspection panel (right pane / slide-over drawer)
// This is where ALL detail lives: fulfillment badge, customer, phone, SLA timer,
// address, allergy alerts, full itemized list, financials, action bar.

import { useState, useMemo } from "react";
import { formatPhoneNumber } from "./OrderCard.jsx";

const fmt = n => "$" + Number(n ?? 0).toFixed(2);

// Check special instructions for allergy keywords
function detectAllergy(notes) {
  if (!notes) return null;
  const lower = notes.toLowerCase();
  const kws = ["allergy", "allergies", "allergen", "nut", "peanut", "dairy", "gluten", "vegan", "celiac", "lactose", "shellfish", "soy"];
  return kws.some(k => lower.includes(k)) ? notes : null;
}

// SLA timer helper
function slaInfo(createdAt) {
  if (!createdAt) return { text: "—", mins: 0, color: "#34D399" };
  const mins = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
  const color = mins <= 8 ? "#34D399" : mins <= 15 ? "#F59E0B" : "#EF4444";
  return { text: `${mins} min elapsed`, mins, color };
}

export default function OrderDetailPanel({ order, onClose, onStatusChange, onPrint, onOpenRefund, onDelay, statusInfo, isPersistentPane = false }) {
  const [updating, setUpdating] = useState(false);
  const s = statusInfo;

  const shortId = "#" + (order.id ? order.id.slice(-6).toUpperCase() : "------");
  const isDelivery = order.orderMode === "delivery";
  const phone = useMemo(() => formatPhoneNumber(order.customerPhone), [order.customerPhone]);
  const sla = useMemo(() => slaInfo(order.createdAt), [order.createdAt]);
  const allergyNote = useMemo(() => detectAllergy(order.specialInstructions), [order.specialInstructions]);
  const canRefund = order.stripePaymentId && order.status !== "refunded";

  const handleStatus = async () => {
    if (!s?.next || updating) return;
    setUpdating(true);
    try { await onStatusChange(order.id, s.next); } finally { setUpdating(false); }
  };

  const handleDelay = (minutes) => {
    if (onDelay) onDelay(order.id, minutes);
  };

  const addressLine = useMemo(() => {
    if (!isDelivery || !order.deliveryAddress) return null;
    const a = order.deliveryAddress;
    return `${a.street}${a.apt ? `, Apt ${a.apt}` : ""}${a.city ? `, ${a.city}` : ""}${a.zip ? ` ${a.zip}` : ""}`;
  }, [isDelivery, order.deliveryAddress]);

  const content = (
    <div className="rm-detail">
      {/* Top: Fulfillment badge + Order ID */}
      <div className="rm-detail-topbar">
        <span className={`rm-fulfillment-badge ${isDelivery ? "delivery" : "pickup"}`}>
          {isDelivery ? "🚗 DELIVERY" : "🛍️ PICKUP"}
        </span>
        <span className="rm-detail-id">{shortId}</span>
        {!isPersistentPane && (
          <button className="rm-detail-close" onClick={onClose} aria-label="Close">✕</button>
        )}
      </div>

      {/* Customer name — 24pt bold anchor */}
      <h2 className="rm-detail-customer">{order.customerName || "Walk-in Guest"}</h2>

      {/* Phone — formatted (XXX) XXX-XXXX with generous spacing */}
      {phone && (
        <a href={`tel:${order.customerPhone}`} className="rm-detail-phone">
          📞&nbsp;&nbsp;{phone}
        </a>
      )}

      {/* Email */}
      {order.customerEmail && (
        <a href={`mailto:${order.customerEmail}`} className="rm-detail-email">
          ✉&nbsp;&nbsp;{order.customerEmail}
        </a>
      )}

      {/* SLA Timer */}
      <div className="rm-detail-sla" style={{ color: sla.color }}>
        ⏱&nbsp;&nbsp;{sla.text}
      </div>

      {/* Delivery address */}
      {addressLine && (
        <div className="rm-detail-address">
          📍&nbsp;&nbsp;{addressLine}
        </div>
      )}

      {/* Driver notes */}
      {isDelivery && order.deliveryAddress?.notes && (
        <div className="rm-detail-driver-note">
          🚗 Driver Note: "{order.deliveryAddress.notes}"
        </div>
      )}

      <hr className="rm-detail-divider" />

      {/* Allergy alert banner */}
      {allergyNote && (
        <>
          <div className="rm-allergy-banner">
            <span>⚠️</span>
            <span>ALLERGY ALERT: {allergyNote}</span>
          </div>
          <hr className="rm-detail-divider" />
        </>
      )}

      {/* Itemized order list */}
      <div className="rm-detail-items">
        {order.items?.map((item, idx) => (
          <div key={idx} className="rm-detail-item-row">
            <div className="rm-detail-item-left">
              <span className="rm-detail-qty">{item.qty}×</span>
              <div className="rm-detail-item-info">
                <span className="rm-detail-item-name">{item.name}</span>
                {item.spice && (
                  <span className={`rm-spice-chip ${
                    item.spice.toLowerCase().includes("mild") ? "rm-spice-mild" :
                    item.spice.toLowerCase().includes("medium") ? "rm-spice-medium" :
                    item.spice.toLowerCase().includes("hot") ? "rm-spice-hot" : "rm-spice-spicy"
                  }`}>
                    🌶 {item.spice}
                  </span>
                )}
                {item.note && <div className="rm-detail-item-mod">↳ {item.note}</div>}
              </div>
            </div>
            <span className="rm-detail-item-price">{fmt(item.price * item.qty)}</span>
          </div>
        ))}
      </div>

      {/* Special instructions (non-allergy) */}
      {order.specialInstructions && !allergyNote && (
        <div className="rm-detail-note-box">
          📝 "{order.specialInstructions}"
        </div>
      )}

      <hr className="rm-detail-divider" />

      {/* Financial summary */}
      <div className="rm-detail-financials">
        <div className="rm-detail-fin-row">
          <span>Subtotal</span><span>{fmt(order.subtotal)}</span>
        </div>
        {isDelivery && (
          <div className="rm-detail-fin-row">
            <span>Delivery Fee</span><span>{order.deliveryFee > 0 ? fmt(order.deliveryFee) : "FREE"}</span>
          </div>
        )}
        <div className="rm-detail-fin-row">
          <span>Tax (8.375%)</span><span>{fmt(order.tax)}</span>
        </div>
        <div className="rm-detail-fin-total">
          <span>Total</span><span>{fmt(order.total)}</span>
        </div>
        {order.refundedTotal > 0 && (
          <div className="rm-detail-fin-row" style={{ color: "#F87171", marginTop: 6 }}>
            <span>Refunded</span><span>−{fmt(order.refundedTotal)}</span>
          </div>
        )}
      </div>

      {/* Refund audit trail */}
      {order.refundHistory?.length > 0 && (
        <div className="rm-detail-refund-log">
          <p className="rm-detail-refund-log-title">Refund Audit Trail</p>
          {order.refundHistory.map((r, i) => (
            <div key={i} className="rm-detail-refund-log-entry">
              {r.success ? "✓" : "✗"} {r.type} • {fmt(r.amount)} • {r.reason || "—"}
            </div>
          ))}
        </div>
      )}

      <hr className="rm-detail-divider" />

      {/* ACTION BAR — matches wireframe: [+5m Delay] [🖨 PRINT] [✓ STATUS] */}
      <div className="rm-detail-actions">
        {s?.next && (
          <>
            <button className="rm-action-chip" onClick={() => handleDelay(5)}>+5m</button>
            <button className="rm-action-chip" onClick={() => handleDelay(10)}>+10m</button>
          </>
        )}
        <button className="rm-action-btn rm-action-btn--secondary" onClick={() => onPrint(order.id)}>
          🖨 {order.printed ? "REPRINT" : "PRINT"}
        </button>
        {canRefund && (
          <button className="rm-action-btn rm-action-btn--ghost" onClick={() => onOpenRefund(order)}>
            ↩ REFUND
          </button>
        )}
        {s?.next && (
          <button
            className="rm-action-btn rm-action-btn--primary"
            style={{ background: s.nextColor || "#1A6B3A" }}
            onClick={handleStatus}
            disabled={updating}
          >
            {updating ? "..." : `✓ ${s.nextLabel?.toUpperCase()}`}
          </button>
        )}
      </div>
    </div>
  );

  if (isPersistentPane) {
    return <div className="rm-persistent-panel">{content}</div>;
  }

  // Slide-over drawer for compact / portrait screens
  return (
    <div className="rm-drawer-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="rm-drawer">{content}</div>
    </div>
  );
}
