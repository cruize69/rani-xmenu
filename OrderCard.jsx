// OrderCard.jsx — Compact left-rail queue card
// 3-row structure: [status dot + label + timer + ID + badge] → [customer name] → [meta + total]
// ALL detail (items, phone, address, allergy) lives exclusively in the right panel.

import { useMemo } from "react";

const fmt = n => "$" + Number(n ?? 0).toFixed(2);

// Format phone as (XXX) XXX-XXXX
export function formatPhoneNumber(raw) {
  if (!raw) return null;
  const d = raw.replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
  if (d.length === 11 && d.startsWith("1")) return `(${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7)}`;
  return raw;
}

// SLA elapsed time → color
function timerColor(mins) {
  if (mins <= 8)  return "#22C55E";  // green
  if (mins <= 15) return "#F59E0B";  // amber
  return "#EF4444";                  // red
}

export default function OrderCard({ order, statusConfig, selected, onSelectCard }) {
  const s = statusConfig[order.status] ?? statusConfig.new;
  const isDelivery = order.orderMode === "delivery";

  const shortId = useMemo(() => {
    return order.id ? "#" + order.id.slice(-6).toUpperCase() : "#------";
  }, [order.id]);

  const elapsed = useMemo(() => {
    if (!order.createdAt) return { text: "0m", mins: 0 };
    const mins = Math.max(0, Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000));
    return { text: `${mins}m`, mins };
  }, [order.createdAt]);

  const itemCount = order.items?.length || 0;

  return (
    <div
      className={`rm-queue-card ${selected ? "selected" : ""}`}
      onClick={() => onSelectCard(order)}
      role="button"
      tabIndex={0}
      onKeyDown={e => (e.key === "Enter" || e.key === " ") && onSelectCard(order)}
    >
      {/* Left status stripe */}
      <div className="rm-stripe" style={{ backgroundColor: s.color }} />

      {/* Row 1: status + timer + ID + badge */}
      <div className="rm-card-row1">
        <div className="rm-card-status-group">
          <span className="rm-status-pip" style={{ backgroundColor: s.color, boxShadow: `0 0 7px ${s.color}` }} />
          <span className="rm-card-status-label" style={{ color: s.color }}>{s.label}</span>
          <span className="rm-card-timer" style={{ color: timerColor(elapsed.mins) }}>({elapsed.text})</span>
          <span className="rm-card-id">{shortId}</span>
        </div>
        <span className={`rm-badge ${isDelivery ? "delivery" : "pickup"}`}>
          {isDelivery ? "DELIVERY" : "PICKUP"}
        </span>
      </div>

      {/* Row 2: customer name — large */}
      <div className="rm-card-name">{order.customerName || "Walk-in Guest"}</div>

      {/* Row 3: meta + total */}
      <div className="rm-card-row3">
        <span className="rm-card-meta">{itemCount} {itemCount === 1 ? "item" : "items"}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {!order.printed && order.status !== "refunded" && (
            <span className="rm-unprinted-chip">UNPRINTED</span>
          )}
          <span className="rm-card-total">{fmt(order.total)}</span>
        </div>
      </div>
    </div>
  );
}
