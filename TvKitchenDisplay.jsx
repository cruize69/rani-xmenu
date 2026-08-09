import { useState, useEffect, useRef } from "react";
import { getManagerSecret } from "./lib/managerAuth.js";

// ── Custom High-Visibility 4K TV Vector Icons ─────────────────────
function TvPickupIcon({ size = 32, color = "#080706" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function TvDeliveryIcon({ size = 32, color = "#080706" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13" rx="2" />
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
      <circle cx="5.5" cy="18.5" r="2.5" fill={color} />
      <circle cx="18.5" cy="18.5" r="2.5" fill={color} />
    </svg>
  );
}

// ── Town / Destination Color Palette for 4K Visual Grouping ───────
const TOWN_COLORS = {
  "Scarsdale":    { bg: "rgba(245,158,11,0.22)", border: "#F59E0B", text: "#FBBF24", tagBg: "#F59E0B" },
  "Larchmont":    { bg: "rgba(34,197,94,0.22)",  border: "#22C55E", text: "#4ADE80", tagBg: "#22C55E" },
  "Rye":          { bg: "rgba(6,182,212,0.22)",  border: "#06B6D4", text: "#38BDF8", tagBg: "#06B6D4" },
  "Mamaroneck":   { bg: "rgba(59,130,246,0.22)",  border: "#3B82F6", text: "#60A5FA", tagBg: "#3B82F6" },
  "Harrison":     { bg: "rgba(236,72,153,0.22)", border: "#EC4899", text: "#F472B6", tagBg: "#EC4899" },
  "White Plains": { bg: "rgba(139,92,246,0.22)", border: "#8B5CF6", text: "#A78BFA", tagBg: "#8B5CF6" },
  "Greenwich":    { bg: "rgba(99,102,241,0.22)", border: "#6366F1", text: "#818CF8", tagBg: "#6366F1" },
  "New Rochelle": { bg: "rgba(20,184,166,0.22)", border: "#14B8A6", text: "#2DD4BF", tagBg: "#14B8A6" },
  "Pickup":       { bg: "rgba(232,168,46,0.18)", border: "#E8A82E", text: "#F5C56B", tagBg: "#E8A82E" },
};

const DEFAULT_TOWN_COLOR = { bg: "rgba(255,255,255,0.1)", border: "rgba(255,255,255,0.4)", text: "#FAF6EF", tagBg: "#A8A29E" };

function getTownConfig(city, mode) {
  if (mode !== "delivery") return TOWN_COLORS["Pickup"];
  if (!city) return DEFAULT_TOWN_COLOR;
  
  const match = Object.keys(TOWN_COLORS).find(t => t.toLowerCase() === city.toLowerCase().trim());
  return match ? TOWN_COLORS[match] : DEFAULT_TOWN_COLOR;
}

// ── Web Audio Chime for New Orders (with Browser Autoplay Unlock) ─
let globalAudioCtx = null;

function getAudioContext() {
  if (!globalAudioCtx && typeof window !== "undefined") {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) globalAudioCtx = new AudioCtx();
  }
  if (globalAudioCtx && globalAudioCtx.state === "suspended") {
    globalAudioCtx.resume().catch(() => {});
  }
  return globalAudioCtx;
}

function playChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const t = ctx.currentTime;

    // ── 1. Royal Elephant Trumpet Roar (FM Brass Growl + Pitch Bend) ──
    const mod = ctx.createOscillator();
    const modGain = ctx.createGain();
    mod.type = "sawtooth";
    mod.frequency.setValueAtTime(32, t); // 32Hz rapid growl
    modGain.gain.setValueAtTime(85, t);

    const carrier = ctx.createOscillator();
    const carrierGain = ctx.createGain();
    carrier.type = "sawtooth";
    carrier.frequency.setValueAtTime(180, t);
    carrier.frequency.exponentialRampToValueAtTime(460, t + 0.18); // Pitch sweep up
    carrier.frequency.linearRampToValueAtTime(320, t + 0.45);      // Pitch bend down

    carrierGain.gain.setValueAtTime(0.001, t);
    carrierGain.gain.linearRampToValueAtTime(0.75, t + 0.08);
    carrierGain.gain.exponentialRampToValueAtTime(0.001, t + 0.48);

    mod.connect(carrier.frequency);
    carrier.connect(carrierGain);
    carrierGain.connect(ctx.destination);

    mod.start(t);
    carrier.start(t);
    mod.stop(t + 0.48);
    carrier.stop(t + 0.48);

    // ── 2. Brass Thali Plate Metallic Clash (CLANGGG-RING!) ─────────
    const thaliTime = t + 0.22; // Clashes right as the elephant roar reaches peak!
    const metalFreqs = [1480, 2240, 3150, 4820, 6300, 7850];

    metalFreqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx % 2 === 0 ? "sine" : "triangle";
      osc.frequency.setValueAtTime(freq, thaliTime);

      const vol = 0.55 / (idx + 1);
      gain.gain.setValueAtTime(vol, thaliTime);
      gain.gain.exponentialRampToValueAtTime(0.001, thaliTime + (0.65 + idx * 0.12));

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(thaliTime);
      osc.stop(thaliTime + (0.65 + idx * 0.12));
    });
  } catch (e) {
    console.error("Elephant & Thali chime error:", e);
  }
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
function TvOrderCard({ order }) {
  const mins = useElapsedMins(order.createdAt);
  const city = order.orderMode === "delivery" ? (order.deliveryAddress?.city || "Delivery") : "Pickup";
  const townCfg = getTownConfig(city, order.orderMode);
  
  // Timer Urgency Stages: <5m Fresh, 5-15m Active, >15m Urgent
  const isUrgent = mins >= 15 && order.status === "new";
  const isFresh = mins < 5;

  return (
    <div
      style={{
        background: "linear-gradient(180deg, #1c1814 0%, #120e0b 100%)",
        borderRadius: 22,
        border: `4px solid ${townCfg.border}`,
        boxShadow: isUrgent
          ? "0 0 50px rgba(239,68,68,0.65), 0 12px 36px rgba(0,0,0,0.85)"
          : `0 0 30px ${townCfg.bg}, 0 12px 36px rgba(0,0,0,0.85)`,
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
          color: "#080706",
          padding: "12px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontWeight: 900,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {order.orderMode === "delivery" ? (
            <TvDeliveryIcon size={32} color="#080706" />
          ) : (
            <TvPickupIcon size={32} color="#080706" />
          )}
          <span style={{ fontSize: 28, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            {order.orderMode === "delivery" ? city : "PICKUP"}
          </span>
        </div>

        {/* Urgency / Elapsed Timer Badge */}
        <div
          style={{
            background: isUrgent ? "#EF4444" : isFresh ? "rgba(8,7,6,0.9)" : "rgba(8,7,6,0.85)",
            color: isUrgent ? "#FFFFFF" : isFresh ? "#4ADE80" : townCfg.border,
            padding: "6px 16px",
            borderRadius: 24,
            fontSize: 22,
            fontWeight: 900,
            letterSpacing: "0.04em",
            animation: isUrgent ? "pulseWarning 1.5s infinite" : "none",
          }}
        >
          {mins < 1 ? "JUST NOW" : `${mins} MIN AGO`} {isUrgent ? "⚠" : ""}
        </div>
      </div>

      {/* Customer Name & Order ID Bar */}
      <div style={{ padding: "16px 20px 12px", background: "rgba(255,255,255,0.04)", borderBottom: "1.5px solid rgba(250,246,239,0.12)", display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <h2 style={{ fontSize: 36, fontWeight: 900, color: "#FAF6EF", margin: 0, letterSpacing: "-0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {order.customerName}
        </h2>
        <span style={{ fontSize: 24, fontWeight: 900, color: "#E8A82E", letterSpacing: "0.1em", flexShrink: 0 }}>
          #{order.id.slice(-4).toUpperCase()}
        </span>
      </div>

      {/* Delivery Street Address banner if applicable */}
      {order.orderMode === "delivery" && order.deliveryAddress?.street && (
        <div style={{ background: "rgba(232,168,46,0.14)", padding: "10px 20px", borderBottom: "1.5px solid rgba(232,168,46,0.25)", fontSize: 20, fontWeight: 800, color: townCfg.text }}>
          📍 {order.deliveryAddress.street} {order.deliveryAddress.apt ? `(${order.deliveryAddress.apt})` : ""}
        </div>
      )}

      {/* Special Allergy / Instructions Warning Banner */}
      {order.specialInstructions && (
        <div style={{ background: order.specialInstructions.toUpperCase().includes("ALLERG") ? "#7F1D1D" : "#78350F", color: "#FFFFFF", padding: "12px 20px", fontSize: 24, fontWeight: 900, borderBottom: "3px solid #EF4444", lineHeight: 1.3 }}>
          ⚠️ NOTE: {order.specialInstructions}
        </div>
      )}

      {/* Item List (Super Large Legibility 4K TV Typography) */}
      <div style={{ padding: "16px 20px", flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
        {order.items.map((item, idx) => (
          <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 16, paddingBottom: 12, borderBottom: idx < order.items.length - 1 ? "1.5px solid rgba(250,246,239,0.08)" : "none" }}>
            {/* Super Large Quantity Bubble */}
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #F5C56B 0%, #E8A82E 100%)",
                color: "#080706",
                fontSize: 32,
                fontWeight: 900,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                boxShadow: "0 6px 14px rgba(0,0,0,0.6)",
              }}
            >
              {item.qty}
            </div>

            {/* Dish Name + Spice/Notes */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 32, fontWeight: 900, color: "#FAF6EF", margin: 0, lineHeight: 1.2 }}>
                {item.name}
              </p>
              {(item.spice || item.note) && (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
                  {item.spice && (
                    <span style={{ fontSize: 18, fontWeight: 900, padding: "3px 12px", borderRadius: 14, background: "rgba(239,68,68,0.25)", color: "#FCA5A5", border: "1.5px solid rgba(239,68,68,0.5)" }}>
                      🌶️ {item.spice}
                    </span>
                  )}
                  {item.note && (
                    <span style={{ fontSize: 20, color: "#E8A82E", fontWeight: 700 }}>
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
  const [flashOrder, setFlashOrder] = useState(null);

  const prevOrderIdsRef = useRef(new Set());
  const flashTimerRef = useRef(null);

  // Real-time SSE Sync + Auto Flash Notification Trigger
  useEffect(() => {
    const secret = getManagerSecret();
    const today = new Date().toISOString().slice(0, 10);
    const streamUrl = `/api/orders?stream=true&date=${today}&secret=${encodeURIComponent(secret)}`;

    const processOrders = (newOrders) => {
      if (prevOrderIdsRef.current.size > 0) {
        const freshIncoming = newOrders.find(o => !prevOrderIdsRef.current.has(o.id) && o.status === "new");
        if (freshIncoming) {
          triggerNewOrderAlert(freshIncoming);
        }
      }
      prevOrderIdsRef.current = new Set(newOrders.map(o => o.id));
      setOrders(newOrders);
      setLastSync(new Date());
    };

    const triggerNewOrderAlert = (order) => {
      setFlashOrder(order);
      playChime();

      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      flashTimerRef.current = setTimeout(() => {
        setFlashOrder(null);
      }, 5000); // 5-second auto dismiss
    };

    let es;
    try {
      es = new EventSource(streamUrl);
      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === "orders_update") {
            processOrders(data.orders || []);
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
          processOrders(Array.isArray(data) ? data : data.orders || []);
        }
      } catch (err) {}
    }, 10000);

    return () => {
      if (es) es.close();
      clearInterval(interval);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  // Document interaction unlock listener for browser AudioContext autoplay policy
  useEffect(() => {
    const unlock = () => getAudioContext();
    window.addEventListener("click", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("click", unlock);
      window.removeEventListener("keydown", unlock);
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
        background: "radial-gradient(ellipse at 50% 0%, #1c1814 0%, #100e0c 65%, #0a0807 100%)",
        color: "#FAF6EF",
        minHeight: "100vh",
        width: "100vw",
        overflow: "hidden",
        fontFamily: "'Inter', sans-serif",
        padding: "16px 22px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..700;1,9..144,400..500&family=Great+Vibes&family=Inter:wght@400;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: rgba(232,168,46,0.4); border-radius: 4px; }
        @keyframes pulseWarning {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.85; transform: scale(1.02); }
        }
        @keyframes flashBanner {
          0% { transform: translateY(-100%); opacity: 0; }
          15% { transform: translateY(0); opacity: 1; }
          85% { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(-100%); opacity: 0; }
        }
      `}</style>

      {/* Optimized New Order High-Visibility Flash Overlay Banner */}
      {flashOrder && (
        <div
          onClick={() => setFlashOrder(null)}
          style={{
            position: "fixed",
            top: 20,
            left: "50%",
            transform: "translateX(-50%)",
            width: "90%",
            maxWidth: 1200,
            background: "linear-gradient(135deg, #E8A82E 0%, #C8600A 100%)",
            color: "#080706",
            borderRadius: 24,
            padding: "20px 32px",
            boxShadow: "0 20px 60px rgba(232,168,46,0.6), 0 0 0 4px #FFFFFF",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            animation: "flashBanner 5s ease forwards",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <span style={{ fontSize: 42 }}>🔔</span>
            <div>
              <p style={{ fontSize: 16, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.2em", color: "#080706", opacity: 0.85 }}>
                New Incoming Order Received
              </p>
              <h2 style={{ fontSize: 36, fontWeight: 900, margin: 0, color: "#080706" }}>
                {flashOrder.customerName} ({flashOrder.orderMode === "delivery" ? flashOrder.deliveryAddress?.city || "Delivery" : "Pickup"})
              </h2>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: 40, fontWeight: 900, fontFamily: "'Inter', sans-serif" }}>
              #{flashOrder.id.slice(-4).toUpperCase()}
            </span>
            <p style={{ fontSize: 13, fontWeight: 700, margin: 0, opacity: 0.85 }}>Auto-dismiss in 5s</p>
          </div>
        </div>
      )}

      {/* Brand-Consistent Luxury 4K TV Header Bar */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 30px",
          background: "rgba(24,20,16,0.85)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderRadius: 22,
          border: "1.5px solid rgba(232,168,46,0.35)",
          marginBottom: 18,
          boxShadow: "0 12px 40px rgba(0,0,0,0.75)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {/* Brand Logo & Signature Typography */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <img
              src="/logo/apsara-logo.png"
              alt="Rani Mahal Logo"
              style={{ width: 54, height: 54, objectFit: "contain", filter: "drop-shadow(0 4px 10px rgba(232,168,46,0.4))" }}
            />
            <div>
              <h1 style={{ fontFamily: "'Great Vibes', cursive", fontSize: 42, color: "#FAF6EF", margin: 0, lineHeight: 1 }}>
                Rani Mahal
              </h1>
              <p style={{ fontSize: 13, color: "#E8A82E", letterSpacing: "0.22em", textTransform: "uppercase", margin: "2px 0 0", fontWeight: 700 }}>
                Kitchen Expediter Board · 4K Live Display
              </p>
            </div>
          </div>

          {/* Grouped Destination Cluster Badges */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
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
                    gap: 10,
                    padding: "8px 18px",
                    borderRadius: 24,
                    background: cfg.bg,
                    border: `2px solid ${cfg.border}`,
                    color: cfg.text,
                    fontSize: 18,
                    fontWeight: 900,
                    boxShadow: `0 0 16px ${cfg.bg}`,
                  }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    {mode === "delivery" ? (
                      <TvDeliveryIcon size={22} color={cfg.text} />
                    ) : (
                      <TvPickupIcon size={22} color={cfg.text} />
                    )}
                    <span>{groupKey}</span>
                  </span>
                  <span
                    style={{
                      background: cfg.border,
                      color: "#080706",
                      borderRadius: 12,
                      padding: "2px 10px",
                      fontSize: 18,
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

        {/* Sync Status Clock & Sound Test */}
        <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={() => {
                getAudioContext();
                playChime();
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "rgba(232,168,46,0.16)",
                border: "1.5px solid rgba(232,168,46,0.45)",
                color: "#E8A82E",
                padding: "6px 16px",
                borderRadius: 24,
                fontSize: 15,
                fontWeight: 800,
                cursor: "pointer",
                fontFamily: "'Inter', sans-serif",
                transition: "transform 0.15s ease",
              }}
              onMouseEnter={e => e.currentTarget.style.transform = "scale(1.04)"}
              onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
            >
              🔔 Test Sound
            </button>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "rgba(34,197,94,0.18)", border: "1.5px solid rgba(34,197,94,0.4)", padding: "6px 16px", borderRadius: 24, color: "#4ADE80", fontSize: 16, fontWeight: 800 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#4ADE80", boxShadow: "0 0 10px #4ADE80" }} />
              LIVE 4K SYNC
            </div>
          </div>
          <p style={{ fontSize: 14, color: "#B8A995", margin: 0, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
            Last updated {lastSync.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </p>
        </div>
      </header>

      {/* 1x6 Grid Layout for 4K 43" Screen */}
      <main style={{ flex: 1, minHeight: 0 }}>
        {displayOrders.length === 0 ? (
          <div style={{ height: "calc(100vh - 150px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, background: "rgba(18,16,14,0.6)", borderRadius: 24, border: "2px dashed rgba(232,168,46,0.25)" }}>
            <img src="/logo/apsara-logo.png" alt="Rani Mahal" style={{ width: 80, height: 80, opacity: 0.6 }} />
            <h2 style={{ fontSize: 36, color: "#FAF6EF", fontWeight: 900, margin: 0 }}>
              All Kitchen Tickets Complete
            </h2>
            <p style={{ fontSize: 20, color: "#B8A995", margin: 0, fontWeight: 600 }}>
              Standing by for incoming orders…
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${Math.min(6, Math.max(1, displayOrders.length))}, 1fr)`,
              gap: 18,
              height: "calc(100vh - 135px)",
            }}
          >
            {displayOrders.slice(0, 6).map((order) => (
              <TvOrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
