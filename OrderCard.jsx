// OrderCard.jsx — Compact left-rail queue card
// Matches wireframe: status dot + timer + ID + badge → name → items • total
// ALL detail (items, phone, address, allergy) lives in the right panel only.

import { useMemo } from "react";

const fmt = n => "$" + Number(n ?? 0).toFixed(2);

// Format phone as (XXX) XXX-XXXX
export function formatPhoneNumber(str) {
  if (!str) return null;
  const digits = str.replace(/\D/g, "");
  if (digits.length === 10) return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits.startsWith("1")) return `(${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`;
  return str;
}

// SLA timer color: green > amber > red
function timerColor(mins) {
  if (mins <= 8) return "#34D399";   // green — on pace
  if (mins <= 15) return "#F59E0B";  // amber — attention
  return "#EF4444";                  // red   — overdue
}

export default function OrderCard({ order, statusConfig, selected, onSelectCard }) {
  const s = statusConfig[order.status] ?? statusConfig.new;

  const shortId = useMemo(() => {
    return order.id ? "#" + order.id.slice(-6).toUpperCase() : "#------";
  }, [order.id]);

  const elapsed = useMemo(() => {
    if (!order.createdAt) return { text: "0m", mins: 0 };
    const mins = Math.max(0, Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000));
    return { text: `${mins}m`, mins };
  }, [order.createdAt]);

  const isDelivery = order.orderMode === "delivery";
  const itemCount = order.items?.length || 0;

  return (
    <div
      className={`rm-queue-card ${selected ? "rm-queue-card--selected" : ""}`}
      onClick={() => onSelectCard(order)}
      role="button"
      tabIndex={0}
    >
      {/* Left status stripe */}
      <div className="rm-queue-stripe" style={{ backgroundColor: s.color }} />

      {/* Row 1: Status dot + timer + order ID + fulfillment badge */}
      <div className="rm-queue-row1">
        <div className="rm-queue-status-group">
          <span className="rm-queue-status-dot" style={{ backgroundColor: s.color, boxShadow: `0 0 8px ${s.color}` }} />
          <span className="rm-queue-status-label" style={{ color: s.color }}>{s.label?.toUpperCase()}</span>
          <span className="rm-queue-timer" style={{ color: timerColor(elapsed.mins) }}>({elapsed.text})</span>
          <span className="rm-queue-id">{shortId}</span>
        </div>
        <span className={`rm-queue-badge ${isDelivery ? "rm-queue-badge--delivery" : "rm-queue-badge--pickup"}`}>
          {isDelivery ? "DELIVERY" : "PICKUP"}
        </span>
      </div>

      {/* Row 2: Customer name — large & bold */}
      <div className="rm-queue-name">{order.customerName || "Walk-in Guest"}</div>

      {/* Row 3: Item count + total */}
      <div className="rm-queue-row3">
        <span className="rm-queue-meta">
          {itemCount} {itemCount === 1 ? "item" : "items"} • {fmt(order.total)}
        </span>
        {!order.printed && order.status !== "refunded" && (
          <span className="rm-queue-unprinted">UNPRINTED</span>
        )}
      </div>
    </div>
  );
}
