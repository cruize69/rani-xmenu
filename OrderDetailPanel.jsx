// OrderDetailPanel.jsx — Full ticket inspection panel
// Layout: rm-detail-wrap (scrollable content) + rm-action-bar (sticky bottom)
// Used as persistent right pane (isPersistentPane=true) or slide-over drawer (false)

import { useState, useEffect, useMemo } from "react";
import { formatPhoneNumber, formatScheduledTime } from "./OrderCard.jsx";

const fmt = n => "$" + Number(n ?? 0).toFixed(2);

function detectAllergy(notes) {
  if (!notes) return false;
  const kws = ["allergy", "allergen", "nut", "peanut", "dairy", "gluten", "vegan", "celiac", "lactose", "shellfish", "soy"];
  return kws.some(k => notes.toLowerCase().includes(k));
}

function slaInfo(createdAt) {
  if (!createdAt) return { text: "—", mins: 0, color: "#22C55E" };
  const mins = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
  const color = mins <= 8 ? "#22C55E" : mins <= 15 ? "#F59E0B" : "#EF4444";
  return { text: `${mins} min elapsed`, mins, color };
}

function spiceClass(spice) {
  const s = spice?.toLowerCase() ?? "";
  if (s.includes("hot") || s.includes("desi")) return "hot";
  if (s.includes("spicy"))  return "spicy";
  if (s.includes("medium")) return "medium";
  return "mild";
}

export default function OrderDetailPanel({
  order, onClose, onStatusChange, onPrint, onDelay, onOpenRefund, statusInfo, isPersistentPane = false
}) {
  const [updating, setUpdating]               = useState(false);
  const [reprintCooldown, setReprintCooldown] = useState(0); // seconds remaining in print cooldown
  const [showReprintMenu, setShowReprintMenu] = useState(false);
  const s = statusInfo;

  const shortId    = "#" + (order.id ? order.id.slice(-6).toUpperCase() : "------");
  const isDelivery = order.orderMode === "delivery";
  const isScheduled = order.status === "scheduled";
  const scheduledTime = order.scheduledFor ? formatScheduledTime(order.scheduledFor.time) : null;
  const phone      = useMemo(() => formatPhoneNumber(order.customerPhone), [order.customerPhone]);
  // Same basis fix as OrderCard.jsx: a scheduled order's kitchen clock
  // starts at promotion (updatedAt), not at original placement (createdAt)
  // hours earlier — otherwise this reads a false, alarming elapsed time
  // the instant the cron flips it live.
  const slaBasis   = order.scheduledFor ? order.updatedAt : order.createdAt;
  const sla        = useMemo(() => slaInfo(slaBasis), [slaBasis]);
  const hasAllergy = useMemo(() => detectAllergy(order.specialInstructions), [order.specialInstructions]);
  const canRefund  = order.stripePaymentId && order.status !== "refunded";

  const addressLine = useMemo(() => {
    if (!isDelivery || !order.deliveryAddress) return null;
    const a = order.deliveryAddress;
    return `${a.street}${a.apt ? `, Apt ${a.apt}` : ""}${a.city ? `, ${a.city}` : ""}${a.zip ? ` ${a.zip}` : ""}`;
  }, [isDelivery, order.deliveryAddress]);

  // Intelligent Reprint Cooldown Timer (5 seconds)
  useEffect(() => {
    if (reprintCooldown <= 0) return;
    const timer = setInterval(() => {
      setReprintCooldown(prev => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [reprintCooldown]);

  const handlePrintClick = (ticket = "all") => {
    if (reprintCooldown > 0) return;
    onPrint(order.id, ticket);
    setReprintCooldown(5); // 5-second anti-spam cooldown
    setShowReprintMenu(false);
  };

  const handleStatus = async () => {
    if (!s?.next || updating) return;
    setUpdating(true);
    try { await onStatusChange(order.id, s.next); } finally { setUpdating(false); }
  };

  // The scrollable content section
  const scrollContent = (
    <div className="rm-detail-wrap">
      {/* Top bar: fulfillment badge + order ID + close (drawer mode) */}
      <div className="rm-detail-topbar">
        <span className={`rm-detail-badge ${isDelivery ? "delivery" : "pickup"}`}>
          {isDelivery ? "🚗 DELIVERY" : "🛍️ PICKUP"}
        </span>
        <span className="rm-detail-order-id">{shortId}</span>
        {!isPersistentPane && (
          <button className="rm-detail-close" onClick={onClose} aria-label="Close modal">✕</button>
        )}
      </div>

      {/* Requested time banner — the whole reason this order shouldn't be
          judged by "time since placed": it was deliberately scheduled
          ahead, possibly while the kitchen was closed. */}
      {scheduledTime && (
        <div
          style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "rgba(232,168,46,0.12)", border: "1px solid rgba(232,168,46,0.35)",
            borderRadius: 10, padding: "8px 12px", marginBottom: 12, fontWeight: 700,
          }}
        >
          <span>🕐</span>
          <span style={{ color: "#E8A82E" }}>
            Requested {isDelivery ? "delivery" : "pickup"} time: {scheduledTime}
          </span>
          {isScheduled && (
            <span style={{ fontWeight: 400, opacity: 0.75 }}>— enters kitchen queue automatically at that time</span>
          )}
        </div>
      )}

      {/* Customer name — 26pt bold anchor */}
      <h2 className="rm-detail-customer">{order.customerName || "Walk-in Guest"}</h2>

      {/* Contact details */}
      <div className="rm-detail-contact">
        {phone && (
          <a href={`tel:${order.customerPhone}`} className="rm-detail-phone">
            📞&nbsp;&nbsp;{phone}
          </a>
        )}
        {order.customerEmail && (
          <a href={`mailto:${order.customerEmail}`} className="rm-detail-email">
            ✉&nbsp;&nbsp;{order.customerEmail}
          </a>
        )}
      </div>

      {/* SLA timer */}
      <div className="rm-detail-sla" style={{ color: sla.color }}>
        ⏱&nbsp;&nbsp;{sla.text}
      </div>

      {/* Delivery address */}
      {addressLine && (
        <div className="rm-detail-address">
          <span>📍</span>
          <span>{addressLine}</span>
        </div>
      )}
      {isDelivery && order.deliveryAddress?.notes && (
        <div className="rm-detail-driver-note">
          🚗 Driver note: "{order.deliveryAddress.notes}"
        </div>
      )}

      <hr className="rm-detail-divider" />

      {/* Allergy alert */}
      {hasAllergy && (
        <>
          <div className="rm-allergy-banner">
            <span>⚠️</span>
            <span>ALLERGY ALERT — {order.specialInstructions}</span>
          </div>
          <hr className="rm-detail-divider" />
        </>
      )}

      {/* Itemized order list */}
      <div className="rm-detail-items">
        {order.items?.map((item, idx) => (
          <div key={idx} className="rm-item-row">
            <div className="rm-item-left">
              <span className="rm-item-qty">{item.qty}×</span>
              <div className="rm-item-info">
                <span className="rm-item-name">{item.name}</span>
                {item.spice && (
                  <span className={`rm-spice ${spiceClass(item.spice)}`}>
                    🌶 {item.spice}
                  </span>
                )}
                {item.note && <div className="rm-item-mod">↳ {item.note}</div>}
              </div>
            </div>
            <span className="rm-item-price">{fmt(item.price * item.qty)}</span>
          </div>
        ))}
      </div>

      {/* Kitchen note (non-allergy) */}
      {order.specialInstructions && !hasAllergy && (
        <div className="rm-note-box">
          📝 "{order.specialInstructions}"
        </div>
      )}

      <hr className="rm-detail-divider" />

      {/* Financial summary */}
      <div className="rm-financials">
        <div className="rm-fin-row"><span>Subtotal</span><span>{fmt(order.subtotal)}</span></div>
        {isDelivery && (
          <div className="rm-fin-row">
            <span>Delivery Fee</span>
            <span>{order.deliveryFee > 0 ? fmt(order.deliveryFee) : "FREE"}</span>
          </div>
        )}
        <div className="rm-fin-row"><span>Tax (8.375%)</span><span>{fmt(order.tax)}</span></div>
        <div className="rm-fin-total"><span>Total</span><span>{fmt(order.total)}</span></div>
        {order.refundedTotal > 0 && (
          <div className="rm-fin-row" style={{ color: "#FCA5A5", marginTop: 6 }}>
            <span>Refunded</span><span>−{fmt(order.refundedTotal)}</span>
          </div>
        )}
      </div>

      {/* Refund audit trail */}
      {order.refundHistory?.length > 0 && (
        <div className="rm-refund-log">
          <p className="rm-refund-log-title">Refund Audit Trail</p>
          {order.refundHistory.map((r, i) => (
            <div key={i} className="rm-refund-log-entry">
              {r.success ? "✓" : "✗"} {r.type} · {fmt(r.amount)} · {r.reason || "—"}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // The sticky action bar — responsive & anti-spam protected
  const actionBar = (
    <div className="rm-action-bar">
      {s?.next && (
        <div className="rm-action-chips-group">
          <button className="rm-action-chip" onClick={() => onDelay?.(order.id, 5)}>+5m</button>
          <button className="rm-action-chip" onClick={() => onDelay?.(order.id, 10)}>+10m</button>
        </div>
      )}

      <div style={{ position: "relative" }}>
        <button
          className={`rm-action-btn secondary ${reprintCooldown > 0 ? "rm-action-btn--cooldown" : ""}`}
          onClick={() => {
            if (reprintCooldown > 0) return;
            // First print (never printed yet) fires the full sequence
            // immediately — no menu. Only a REPRINT offers a choice, since
            // that's the case where blindly reprinting everything wastes
            // paper the manager didn't ask to reprint.
            if (order.printed) setShowReprintMenu(v => !v);
            else handlePrintClick("all");
          }}
          disabled={reprintCooldown > 0}
          title={reprintCooldown > 0 ? `Print job queued (${reprintCooldown}s)` : order.printed ? "Choose a ticket to reprint" : "Print receipt"}
        >
          {reprintCooldown > 0 ? `✓ QUEUED (${reprintCooldown}s)` : `🖨 ${order.printed ? "REPRINT ▾" : "PRINT"}`}
        </button>

        {showReprintMenu && (
          <>
            {/* Click-outside catcher */}
            <div style={{ position: "fixed", inset: 0, zIndex: 9 }} onClick={() => setShowReprintMenu(false)} />
            <div
              style={{
                position: "absolute", bottom: "calc(100% + 6px)", left: 0, zIndex: 10,
                background: "#1c1814", border: "1px solid rgba(250,246,239,0.14)", borderRadius: 10,
                boxShadow: "0 8px 24px rgba(0,0,0,0.4)", overflow: "hidden", minWidth: 190,
              }}
            >
              {[
                ["front", "🧾 Front (Guest Receipt)"],
                ["kitchen", "👨‍🍳 Kitchen Ticket"],
                ...(order.reorderToken ? [["qr", "🎟️ QR Voucher"]] : []),
              ].map(([ticket, label]) => (
                <button
                  key={ticket}
                  onClick={() => handlePrintClick(ticket)}
                  style={{
                    display: "block", width: "100%", textAlign: "left", padding: "10px 14px",
                    background: "transparent", border: "none", color: "#FAF6EF", fontSize: 13,
                    cursor: "pointer", fontFamily: "'Inter',sans-serif",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(232,168,46,0.12)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {canRefund && (
        <button className="rm-action-btn danger" onClick={() => onOpenRefund(order)}>
          ↩ REFUND
        </button>
      )}

      {s?.next && (
        <button
          className="rm-action-btn primary"
          style={{ background: s.nextColor || "#16A34A" }}
          onClick={handleStatus}
          disabled={updating}
        >
          {updating ? "…" : `✓ ${s.nextLabel?.toUpperCase()}`}
        </button>
      )}
    </div>
  );

  if (isPersistentPane) {
    // Right pane: scrollable content + sticky action bar at bottom
    return (
      <>
        {scrollContent}
        {actionBar}
      </>
    );
  }

  // Drawer: internal scroll + sticky bottom action bar
  return (
    <>
      <div className="rm-drawer-scroll">{scrollContent}</div>
      {actionBar}
    </>
  );
}
