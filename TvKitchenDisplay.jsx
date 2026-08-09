import { useState, useEffect, useRef } from "react";
import { getManagerSecret } from "./lib/managerAuth.js";

// ── Town / Destination Color Palette for 4K Visual Grouping ───────
const TOWN_COLORS = {
  "Scarsdale":    { bg: "rgba(245,158,11,0.18)", border: "#F59E0B", text: "#FBBF24", tagBg: "#F59E0B" },
  "Larchmont":    { bg: "rgba(34,197,94,0.18)",  border: "#22C55E", text: "#4ADE80", tagBg: "#22C55E" },
  "Rye":          { bg: "rgba(6,182,212,0.18)",  border: "#06B6D4", text: "#38BDF8", tagBg: "#06B6D4" },
  "Mamaroneck":   { bg: "rgba(59,130,246,0.18)",  border: "#3B82F6", text: "#60A5FA", tagBg: "#3B82F6" },
  "Harrison":     { bg: "rgba(236,72,153,0.18)", border: "#EC4899", text: "#F472B6", tagBg: "#EC4899" },
  "White Plains": { bg: "rgba(139,92,246,0.18)", border: "#8B5CF6", text: "#A78BFA", tagBg: "#8B5CF6" },
  "Greenwich":    { bg: "rgba(99,102,241,0.18)", border: "#6366F1", text: "#818CF8", tagBg: "#6366F1" },
  "New Rochelle": { bg: "rgba(20,184,166,0.18)", border: "#14B8A6", text: "#2DD4BF", tagBg: "#14B8A6" },
  "Pickup":       { bg: "rgba(232,168,46,0.14)", border: "#E8A82E", text: "#F5C56B", tagBg: "#E8A82E" },
};

const DEFAULT_TOWN_COLOR = { bg: "rgba(255,255,255,0.08)", border: "rgba(255,255,255,0.3)", text: "#FAF6EF", tagBg: "#A8A29E" };

function getTownConfig(city, mode) {
  if (mode !== "delivery") return TOWN_COLORS["Pickup"];
  if (!city) return DEFAULT_TOWN_COLOR;
  
  const match = Object.keys(TOWN_COLORS).find(t => t.toLowerCase() === city.toLowerCase().trim());
  return match ? TOWN_COLORS[match] : DEFAULT_TOWN_COLOR;
}

// ── Elapsed Time Hook ──────────────────────────────────────────────
function useElapsedMins(createdAt) {
  const [mins, setMins] = useState(0);
  useEffect(() => {
    const calc = () => setMins(Math.floor((Date.now() - new Date(createdAt)) / 60000));
    calc();
    const timer = setInterval(calc, 10000);
    return () => clearInterval(timer);
  }, [createdAt]);
  return mins;
}

// ── 4K TV Large Order Card ─────────────────────────────────────────
function TvOrderCard({ order, groupIndex }) {
  const mins = useElapsedMins(order.createdAt);
  const city = order.orderMode === "delivery" ? (order.deliveryAddress?.city || "Delivery") : "Pickup";
  const townCfg = getTownConfig(city, order.orderMode);
  const isUrgent = mins >= 15 && order.status === "new";

  return (
    <div
      style={{
        background: "linear-gradient(180deg, #181410 0%, #100d0b 100%)",
        borderRadius: 18,
        border: `3px solid ${townCfg.border}`,
        boxShadow: isUrgent
          ? "0 0 35px rgba(239,68,68,0.45), 0 10px 30px rgba(0,0,0,0.8)"
          : `0 0 25px ${townCfg.bg}, 0 10px 30px rgba(0,0,0,0.8)`,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        height: "100%",
        minHeight: 0,
        position: "relative",
      }}
    >
      {/* Destination Town Header Banner */}
      <div
        style={{
          background: townCfg.tagBg,
          color: order.orderMode === "delivery" ? "#080706" : "#080706",
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontWeight: 900,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 24, lineHeight: 1 }}>
            {order.orderMode === "delivery" ? "🚗" : "🛍️"}
          </span>
          <span style={{ fontSize: 22, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            {order.orderMode === "delivery" ? city : "PICKUP AT STORE"}
          </span>
        </div>

        {/* Urgency / Elapsed Timer Badge */}
        <div
          style={{
            background: isUrgent ? "#EF4444" : "rgba(8,7,6,0.85)",
            color: isUrgent ? "#FFFFFF" : townCfg.border,
            padding: "4px 12px",
            borderRadius: 20,
            fontSize: 18,
            fontWeight: 800,
            letterSpacing: "0.04em",
          }}
        >
          {mins < 1 ? "JUST NOW" : `${mins} MIN AGO`} {isUrgent ? "⚠" : ""}
        </div>
      </div>

      {/* Customer Name & Order ID Bar */}
      <div style={{ padding: "14px 18px 10px", background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(250,246,239,0.08)", display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <h2 style={{ fontSize: 28, fontWeight: 900, color: "#FAF6EF", margin: 0, letterSpacing: "-0.01em" }}>
          {order.customerName}
        </h2>
        <span style={{ fontSize: 16, fontWeight: 700, color: "#E8A82E", letterSpacing: "0.1em" }}>
          #{order.id.slice(-4).toUpperCase()}
        </span>
      </div>

      {/* Delivery Street Address banner if applicable */}
      {order.orderMode === "delivery" && order.deliveryAddress?.street && (
        <div style={{ background: "rgba(232,168,46,0.1)", padding: "8px 18px", borderBottom: "1px solid rgba(232,168,46,0.2)", fontSize: 15, fontWeight: 700, color: townCfg.text }}>
          📍 {order.deliveryAddress.street} {order.deliveryAddress.apt ? `(${order.deliveryAddress.apt})` : ""}
        </div>
      )}

      {/* Special Allergy / Instructions Warning Banner */}
      {order.specialInstructions && (
        <div style={{ background: order.specialInstructions.toUpperCase().includes("ALLERG") ? "#7F1D1D" : "#78350F", color: "#FFFFFF", padding: "10px 18px", fontSize: 18, fontWeight: 800, borderBottom: "2px solid #EF4444" }}>
          ⚠️ NOTE: {order.specialInstructions}
        </div>
      )}

      {/* Item List (High legibility 4K TV text size) */}
      <div style={{ padding: "14px 18px", flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
        {order.items.map((item, idx) => (
          <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 14, paddingBottom: 10, borderBottom: idx < order.items.length - 1 ? "1px solid rgba(250,246,239,0.06)" : "none" }}>
            {/* Ultra Large Quantity Bubble */}
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "#E8A82E",
                color: "#080706",
                fontSize: 24,
                fontWeight: 900,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                boxShadow: "0 4px 10px rgba(0,0,0,0.5)",
              }}
            >
              {item.qty}
            </div>

            {/* Dish Name + Spice/Notes */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 24, fontWeight: 800, color: "#FAF6EF", margin: 0, lineHeight: 1.25 }}>
                {item.name}
              </p>
              {(item.spice || item.note) && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                  {item.spice && (
                    <span style={{ fontSize: 14, fontWeight: 800, padding: "2px 10px", borderRadius: 12, background: "rgba(239,68,68,0.2)", color: "#FCA5A5", border: "1px solid rgba(239,68,68,0.4)" }}>
                      🌶️ {item.spice}
                    </span>
                  )}
                  {item.note && (
                    <span style={{ fontSize: 15, color: "#E8A82E", fontWeight: 600 }}>
                      ↳ {item.note}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main 4K TV Kitchen Display ────────────────────────────────────
export default function TvKitchenDisplay() {
  const [orders, setOrders] = useState([]);
  const [lastSync, setLastSync] = useState(new Date());

  // Real-time SSE Sync with 5s Polling Fallback
  useEffect(() => {
    const secret = getManagerSecret();
    const today = new Date().toISOString().slice(0, 10);
    const streamUrl = `/api/orders?stream=true&date=${today}&secret=${encodeURIComponent(secret)}`;

    let es;
    try {
      es = new EventSource(streamUrl);
      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === "orders_update") {
            setOrders(data.orders || []);
            setLastSync(new Date());
          }
        } catch (err) {}
      };
    } catch (err) {}

    // Polling fallback every 10s
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders?date=${today}`, {
          headers: { "x-manager-secret": secret },
        });
        if (res.ok) {
          const data = await res.json();
          setOrders(Array.isArray(data) ? data : data.orders || []);
          setLastSync(new Date());
        }
      } catch (err) {}
    }, 10000);

    return () => {
      if (es) es.close();
      clearInterval(interval);
    };
  }, []);

  // Filter only ACTIVE orders (new or in_progress)
  const activeOrders = orders.filter(o => o.status !== "done" && o.status !== "refunded");

  // Group active orders by Destination Town / Mode
  const groupedClusters = {};
  activeOrders.forEach(o => {
    const groupKey = o.orderMode === "delivery" ? (o.deliveryAddress?.city || "Other Delivery") : "Pickup";
    if (!groupedClusters[groupKey]) groupedClusters[groupKey] = [];
    groupedClusters[groupKey].push(o);
  });

  // Sort groups: Delivery destinations with multiple orders first, then single orders, then Pickup
  const sortedGroupKeys = Object.keys(groupedClusters).sort((a, b) => {
    if (a === "Pickup") return 1;
    if (b === "Pickup") return -1;
    return groupedClusters[b].length - groupedClusters[a].length;
  });

  // Flatten ordered list grouped by town for 1x6 grid view
  const displayOrders = [];
  sortedGroupKeys.forEach(key => {
    displayOrders.push(...groupedClusters[key]);
  });

  return (
    <div
      style={{
        background: "#080706",
        color: "#FAF6EF",
        minHeight: "100vh",
        width: "100vw",
        overflow: "hidden",
        fontFamily: "'Inter', sans-serif",
        padding: "16px 20px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(232,168,46,0.3); border-radius: 4px; }
      `}</style>

      {/* 4K TV Header Summary Bar */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 24px",
          background: "linear-gradient(90deg, #181410 0%, #12100e 100%)",
          borderRadius: 16,
          border: "1px solid rgba(232,168,46,0.3)",
          marginBottom: 16,
          boxShadow: "0 8px 30px rgba(0,0,0,0.6)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 900, color: "#E8A82E", margin: 0, letterSpacing: "0.04em", textTransform: "uppercase" }}>
              📺 Rani Mahal 4K Kitchen Board
            </h1>
            <p style={{ fontSize: 13, color: "#B8A995", margin: 0 }}>
              Live Order Destination Grouping · Hands-Free Auto Display
            </p>
          </div>

          {/* Grouped Destination Cluster Badges */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {sortedGroupKeys.map(groupKey => {
              const count = groupedClusters[groupKey].length;
              const mode = groupKey === "Pickup" ? "pickup" : "delivery";
              const cfg = getTownConfig(groupKey, mode);

              return (
                <div
                  key={groupKey}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 14px",
                    borderRadius: 20,
                    background: cfg.bg,
                    border: `1.5px solid ${cfg.border}`,
                    color: cfg.text,
                    fontSize: 14,
                    fontWeight: 800,
                    boxShadow: `0 0 12px ${cfg.bg}`,
                  }}
                >
                  <span>{mode === "delivery" ? "🚗" : "🛍️"} {groupKey}</span>
                  <span
                    style={{
                      background: cfg.border,
                      color: "#080706",
                      borderRadius: 10,
                      padding: "1px 7px",
                      fontSize: 13,
                      fontWeight: 900,
                    }}
                  >
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sync Status Clock */}
        <div style={{ textAlign: "right" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", padding: "4px 12px", borderRadius: 20, color: "#4ADE80", fontSize: 13, fontWeight: 700 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ADE80", boxShadow: "0 0 8px #4ADE80" }} />
            LIVE SYNC
          </div>
          <p style={{ fontSize: 12, color: "#B8A995", marginTop: 4, margin: 0, fontVariantNumeric: "tabular-nums" }}>
            Last updated {lastSync.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </p>
        </div>
      </header>

      {/* 1x6 Grid Layout for 4K 43" Screen */}
      <main style={{ flex: 1, minHeight: 0 }}>
        {displayOrders.length === 0 ? (
          <div style={{ height: "calc(100vh - 140px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: "#12100e", borderRadius: 20, border: "1px dashed rgba(250,246,239,0.15)" }}>
            <span style={{ fontSize: 54 }}>👨‍🍳</span>
            <h2 style={{ fontSize: 28, color: "#FAF6EF", fontWeight: 700, margin: 0 }}>
              All Kitchen Tickets Complete
            </h2>
            <p style={{ fontSize: 16, color: "#B8A995", margin: 0 }}>
              Standing by for incoming dinner rush orders…
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${Math.min(6, Math.max(1, displayOrders.length))}, 1fr)`,
              gap: 16,
              height: "calc(100vh - 125px)",
            }}
          >
            {displayOrders.slice(0, 6).map((order, idx) => (
              <TvOrderCard key={order.id} order={order} groupIndex={idx} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
