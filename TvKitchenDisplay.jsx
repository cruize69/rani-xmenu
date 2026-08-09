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

function playSingleRoarAndClash(ctx, startTime, isGrandFinale = false) {
  // ── 1. Royal Elephant Trumpet Roar ─────────────────────────────
  const mod = ctx.createOscillator();
  const modGain = ctx.createGain();
  mod.type = "sawtooth";
  mod.frequency.setValueAtTime(34, startTime);
  modGain.gain.setValueAtTime(90, startTime);

  const carrier = ctx.createOscillator();
  const carrierGain = ctx.createGain();
  carrier.type = "sawtooth";
  carrier.frequency.setValueAtTime(180, startTime);
  carrier.frequency.exponentialRampToValueAtTime(isGrandFinale ? 520 : 460, startTime + 0.20);
  carrier.frequency.linearRampToValueAtTime(300, startTime + 0.50);

  carrierGain.gain.setValueAtTime(0.001, startTime);
  carrierGain.gain.linearRampToValueAtTime(0.8, startTime + 0.09);
  carrierGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.52);

  mod.connect(carrier.frequency);
  carrier.connect(carrierGain);
  carrierGain.connect(ctx.destination);

  mod.start(startTime);
  carrier.start(startTime);
  mod.stop(startTime + 0.52);
  carrier.stop(startTime + 0.52);

  // ── 2. Heavy Brass Thali Metallic Clash (CLANGGG!) ──────────────
  const thaliTime = startTime + 0.22;
  const metalFreqs = isGrandFinale
    ? [1240, 1480, 2240, 3150, 4820, 6300, 7850, 9200]
    : [1480, 2240, 3150, 4820, 6300, 7850];

  const decayDuration = isGrandFinale ? 1.6 : 0.75;

  metalFreqs.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = idx % 2 === 0 ? "sine" : "triangle";
    osc.frequency.setValueAtTime(freq, thaliTime);

    const vol = (isGrandFinale ? 0.65 : 0.55) / (idx + 1);
    gain.gain.setValueAtTime(vol, thaliTime);
    gain.gain.exponentialRampToValueAtTime(0.001, thaliTime + (decayDuration + idx * 0.12));

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(thaliTime);
    osc.stop(thaliTime + (decayDuration + idx * 0.12));
  });
}

function playChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    // 5.5-Second Extended Royal Kitchen Alert: 3 Consecutive Elephant Roars & Thali Clashes
    playSingleRoarAndClash(ctx, t, false);          // Burst 1 (0.0s)
    playSingleRoarAndClash(ctx, t + 1.65, false);   // Burst 2 (1.65s)
    playSingleRoarAndClash(ctx, t + 3.30, true);    // Grand Finale Burst 3 (3.30s -> rings out to 5.5s!)
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
        borderRadius: 20,
        border: `3.5px solid ${townCfg.border}`,
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
      {/* Destination Town Header Banner + Dedicated Order # Badge */}
      <div
        style={{
          background: townCfg.tagBg,
          color: "#080706",
          padding: "1.0vh 1.2vw",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontWeight: 900,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {order.orderMode === "delivery" ? (
            <TvDeliveryIcon size={28} color="#080706" />
          ) : (
            <TvPickupIcon size={28} color="#080706" />
          )}
          <span style={{ fontSize: "clamp(20px, 1.3vw, 28px)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            {order.orderMode === "delivery" ? city : "PICKUP"}
          </span>
        </div>

        {/* Dedicated Order # Tag */}
        <span
          style={{
            background: "#080706",
            color: "#E8A82E",
            padding: "4px 12px",
            borderRadius: 12,
            fontSize: "clamp(18px, 1.2vw, 24px)",
            fontWeight: 900,
            letterSpacing: "0.08em",
            boxShadow: "0 4px 10px rgba(0,0,0,0.4)",
          }}
        >
          #{order.id.slice(-4).toUpperCase()}
        </span>
      </div>

      {/* Dedicated Customer Name Row */}
      <div style={{ padding: "1.2vh 1.4vw 0.8vh", background: "rgba(255,255,255,0.04)", borderBottom: "1.5px solid rgba(250,246,239,0.12)", flexShrink: 0 }}>
        <h2 style={{ fontSize: "clamp(26px, 1.8vw, 38px)", fontWeight: 900, color: "#FAF6EF", margin: 0, letterSpacing: "-0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {order.customerName}
        </h2>
      </div>

      {/* Delivery Street Address banner if applicable */}
      {order.orderMode === "delivery" && order.deliveryAddress?.street && (
        <div style={{ background: "rgba(232,168,46,0.14)", padding: "0.8vh 1.4vw", borderBottom: "1.5px solid rgba(232,168,46,0.25)", fontSize: "clamp(16px, 1.0vw, 20px)", fontWeight: 800, color: townCfg.text, flexShrink: 0 }}>
          📍 {order.deliveryAddress.street} {order.deliveryAddress.apt ? `(${order.deliveryAddress.apt})` : ""}
        </div>
      )}

      {/* Special Allergy / Instructions Warning Banner */}
      {order.specialInstructions && (
        <div style={{ background: order.specialInstructions.toUpperCase().includes("ALLERG") ? "#7F1D1D" : "#78350F", color: "#FFFFFF", padding: "1.0vh 1.4vw", fontSize: "clamp(18px, 1.2vw, 24px)", fontWeight: 900, borderBottom: "3px solid #EF4444", lineHeight: 1.3, flexShrink: 0 }}>
          ⚠️ NOTE: {order.specialInstructions}
        </div>
      )}

      {/* Item List with Full Item Modifiers Display (Super Large 4K Legibility) */}
      <div style={{ padding: "1.2vh 1.4vw", flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
        {order.items.map((item, idx) => {
          // Normalize modifiers / options / custom choices
          const rawMods = item.modifiers || item.options || item.choices || item.selectedOptions || item.customizations || [];
          const modifierList = Array.isArray(rawMods)
            ? rawMods.map(m => typeof m === "string" ? m : m.name || m.label || m.title || String(m))
            : typeof rawMods === "string" && rawMods.trim().length > 0
            ? [rawMods]
            : [];

          return (
            <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 12, paddingBottom: 10, borderBottom: idx < order.items.length - 1 ? "1.5px solid rgba(250,246,239,0.08)" : "none" }}>
              {/* Super Large Quantity Bubble */}
              <div
                style={{
                  width: "clamp(40px, 2.3vw, 52px)",
                  height: "clamp(40px, 2.3vw, 52px)",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #F5C56B 0%, #E8A82E 100%)",
                  color: "#080706",
                  fontSize: "clamp(22px, 1.4vw, 30px)",
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

              {/* Dish Name + Spice/Notes/Modifiers */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: "clamp(20px, 1.3vw, 28px)", fontWeight: 900, color: "#FAF6EF", margin: 0, lineHeight: 1.2 }}>
                  {item.name}
                </p>

                {/* Modifiers & Customization Tags */}
                {((item.spice || item.note || item.instructions || modifierList.length > 0)) && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 5 }}>
                    {/* Spice Badge */}
                    {item.spice && (
                      <span style={{ fontSize: "clamp(13px, 0.85vw, 16px)", fontWeight: 900, padding: "2px 8px", borderRadius: 10, background: "rgba(239,68,68,0.25)", color: "#FCA5A5", border: "1px solid rgba(239,68,68,0.5)" }}>
                        🌶️ {item.spice}
                      </span>
                    )}

                    {/* Special Note / Customization */}
                    {(item.note || item.instructions) && (
                      <span style={{ fontSize: "clamp(13px, 0.85vw, 16px)", color: "#F5C56B", fontWeight: 800, background: "rgba(232,168,46,0.14)", padding: "2px 8px", borderRadius: 10, border: "1px solid rgba(232,168,46,0.35)" }}>
                        ↳ {item.note || item.instructions}
                      </span>
                    )}

                    {/* Item Modifiers List */}
                    {modifierList.map((modText, mIdx) => (
                      <span key={mIdx} style={{ fontSize: "clamp(13px, 0.85vw, 16px)", fontWeight: 800, padding: "2px 8px", borderRadius: 10, background: "rgba(59,130,246,0.2)", color: "#93C5FD", border: "1px solid rgba(59,130,246,0.4)" }}>
                        + {modText}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Card Footer: Time Ago Banner & Urgency Caution */}
      <div
        style={{
          background: isUrgent
            ? "#EF4444"
            : isFresh
            ? "rgba(34,197,94,0.18)"
            : "rgba(232,168,46,0.14)",
          borderTop: `2px solid ${isUrgent ? "#EF4444" : isFresh ? "#22C55E" : "rgba(232,168,46,0.4)"}`,
          color: isUrgent ? "#FFFFFF" : isFresh ? "#4ADE80" : "#F5C56B",
          padding: "1.0vh 1.4vw",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontWeight: 900,
          fontSize: "clamp(16px, 1.1vw, 22px)",
          letterSpacing: "0.04em",
          flexShrink: 0,
          animation: isUrgent ? "pulseWarning 1.5s infinite" : "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>⏱️</span>
          <span>{mins < 1 ? "JUST NOW" : `${mins} MIN AGO`}</span>
        </div>
        {isUrgent && (
          <span style={{ background: "#7F1D1D", color: "#FFFFFF", padding: "2px 10px", borderRadius: 12, fontSize: "clamp(14px, 0.9vw, 18px)" }}>
            ⚠️ URGENT
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main 4K TV Kitchen Display ────────────────────────────────────
export default function TvKitchenDisplay() {
  const [orders, setOrders] = useState([]);
  const [lastSync, setLastSync] = useState(new Date());
  const [flashOrder, setFlashOrder] = useState(null);
  const [pageIndex, setPageIndex] = useState(0);

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
      }, 5500); // 5.5-second auto dismiss matching sound
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

  // Flatten ordered list grouped by town for grid view
  const displayOrders = [];
  sortedGroupKeys.forEach(key => {
    displayOrders.push(...groupedClusters[key]);
  });

  const activeCount = displayOrders.length;
  const totalPages = Math.ceil(activeCount / 6);

  // Auto-Cycle Page Rotation for > 6 Orders (every 10 seconds)
  useEffect(() => {
    if (totalPages <= 1) {
      setPageIndex(0);
      return;
    }
    const timer = setInterval(() => {
      setPageIndex(prev => (prev + 1) % totalPages);
    }, 10000);

    return () => clearInterval(timer);
  }, [totalPages]);

  // Current page sliced orders
  const safePageIndex = Math.min(pageIndex, Math.max(0, totalPages - 1));
  const currentPageOrders = displayOrders.slice(safePageIndex * 6, (safePageIndex + 1) * 6);
  const currentCount = currentPageOrders.length;

  // Compute fluid column layout based on current page order count
  const gridColumns = currentCount <= 1 ? "1fr" : `repeat(${Math.min(6, currentCount)}, minmax(0, 1fr))`;

  return (
    <div
      style={{
        background: "radial-gradient(ellipse at 50% 0%, #1c1814 0%, #100e0c 65%, #0a0807 100%)",
        color: "#FAF6EF",
        height: "100vh",
        maxHeight: "100vh",
        width: "100%",
        maxWidth: "100%",
        overflow: "hidden",
        fontFamily: "'Inter', sans-serif",
        padding: "1.2vh 1.4vw",
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
            top: "2vh",
            left: "50%",
            transform: "translateX(-50%)",
            width: "90%",
            maxWidth: 1200,
            background: "linear-gradient(135deg, #E8A82E 0%, #C8600A 100%)",
            color: "#080706",
            borderRadius: 24,
            padding: "2.0vh 2.4vw",
            boxShadow: "0 20px 60px rgba(232,168,46,0.6), 0 0 0 4px #FFFFFF",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            animation: "flashBanner 5.5s ease forwards",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <span style={{ fontSize: 42 }}>🔔</span>
            <div>
              <p style={{ fontSize: 16, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.2em", color: "#080706", opacity: 0.85 }}>
                New Incoming Order Received
              </p>
              <h2 style={{ fontSize: "clamp(28px, 2.0vw, 40px)", fontWeight: 900, margin: 0, color: "#080706" }}>
                {flashOrder.customerName} ({flashOrder.orderMode === "delivery" ? flashOrder.deliveryAddress?.city || "Delivery" : "Pickup"})
              </h2>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: "clamp(32px, 2.2vw, 44px)", fontWeight: 900, fontFamily: "'Inter', sans-serif" }}>
              #{flashOrder.id.slice(-4).toUpperCase()}
            </span>
            <p style={{ fontSize: 13, fontWeight: 700, margin: 0, opacity: 0.85 }}>Auto-dismiss in 5.5s</p>
          </div>
        </div>
      )}

      {/* Brand-Consistent Luxury 4K TV Header Bar */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1.2vh 1.8vw",
          background: "rgba(24,20,16,0.85)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderRadius: 20,
          border: "1.5px solid rgba(232,168,46,0.35)",
          marginBottom: "1.2vh",
          boxShadow: "0 12px 40px rgba(0,0,0,0.75)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {/* Brand Logo & Signature Typography */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <img
              src="/logo/apsara-logo.png"
              alt="Rani Mahal Logo"
              style={{ width: "clamp(42px, 3.0vw, 54px)", height: "clamp(42px, 3.0vw, 54px)", objectFit: "contain", filter: "drop-shadow(0 4px 10px rgba(232,168,46,0.4))" }}
            />
            <div>
              <h1 style={{ fontFamily: "'Great Vibes', cursive", fontSize: "clamp(32px, 2.5vw, 44px)", color: "#FAF6EF", margin: 0, lineHeight: 1 }}>
                Rani Mahal
              </h1>
              <p style={{ fontSize: "clamp(11px, 0.8vw, 14px)", color: "#E8A82E", letterSpacing: "0.22em", textTransform: "uppercase", margin: "2px 0 0", fontWeight: 700 }}>
                Kitchen Board · 4K Display
              </p>
            </div>
          </div>

          {/* Grouped Destination Cluster Badges with Spaced Padding */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
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
                    fontSize: "clamp(15px, 1.0vw, 19px)",
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
                      fontSize: "clamp(15px, 1.0vw, 19px)",
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

        {/* Header Right: Smart Page Rotation Controller for >6 Orders + Sync Status Clock */}
        <div style={{ textAlign: "right", display: "flex", alignItems: "center", gap: 16 }}>
          {/* Smart Page Rotation Control Pill (if > 6 orders active) */}
          {totalPages > 1 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: "rgba(232,168,46,0.18)",
                border: "2px solid #E8A82E",
                borderRadius: 24,
                padding: "6px 16px",
                color: "#FAF6EF",
                boxShadow: "0 0 20px rgba(232,168,46,0.3)",
              }}
            >
              <button
                onClick={() => setPageIndex(prev => (prev - 1 + totalPages) % totalPages)}
                style={{ background: "none", border: "none", color: "#E8A82E", fontSize: 18, cursor: "pointer", fontWeight: 900 }}
                title="Previous Orders Page"
              >
                ◀
              </button>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span style={{ fontSize: "clamp(14px, 0.9vw, 17px)", fontWeight: 900, color: "#E8A82E", letterSpacing: "0.06em" }}>
                  PAGE {safePageIndex + 1} OF {totalPages}
                </span>
                <span style={{ fontSize: "clamp(11px, 0.7vw, 13px)", color: "#B8A995", fontWeight: 700 }}>
                  ({activeCount} ACTIVE ORDERS)
                </span>
              </div>

              <button
                onClick={() => setPageIndex(prev => (prev + 1) % totalPages)}
                style={{ background: "none", border: "none", color: "#E8A82E", fontSize: 18, cursor: "pointer", fontWeight: 900 }}
                title="Next Orders Page"
              >
                ▶
              </button>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                onClick={() => {
                  getAudioContext();
                  playChime();
                }}
                title="Test Kitchen Sound Alert"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 38,
                  height: 38,
                  borderRadius: "50%",
                  background: "rgba(232,168,46,0.18)",
                  border: "1.5px solid rgba(232,168,46,0.45)",
                  color: "#E8A82E",
                  fontSize: 18,
                  cursor: "pointer",
                  transition: "transform 0.15s ease",
                }}
                onMouseEnter={e => e.currentTarget.style.transform = "scale(1.08)"}
                onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
              >
                🔔
              </button>
              
              {/* Glowing Live Sync Status Light Only */}
              <div title="System Active & Synced" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: "50%", background: "rgba(34,197,94,0.18)", border: "1.5px solid rgba(34,197,94,0.4)" }}>
                <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#4ADE80", boxShadow: "0 0 12px #4ADE80" }} />
              </div>
            </div>
            <p style={{ fontSize: "clamp(11px, 0.75vw, 14px)", color: "#B8A995", margin: 0, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
              Last updated {lastSync.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </p>
          </div>
        </div>
      </header>

      {/* Fluid Grid Layout for 4K TV Screens with Auto-Cycling Pages */}
      <main style={{ flex: 1, minHeight: 0, height: "100%", display: "flex", flexDirection: "column" }}>
        {activeCount === 0 ? (
          <div style={{ height: "100%", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, background: "rgba(18,16,14,0.6)", borderRadius: 24, border: "2px dashed rgba(232,168,46,0.25)" }}>
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
              gridTemplateColumns: gridColumns,
              gap: "1.0vw",
              height: "100%",
              minHeight: 0,
              minWidth: 0,
              width: "100%",
              justifyContent: currentCount === 1 ? "center" : "stretch",
            }}
          >
            {currentPageOrders.map((order) => (
              <div key={order.id} style={{ height: "100%", minHeight: 0, minWidth: 0, maxWidth: currentCount === 1 ? "750px" : "100%", margin: currentCount === 1 ? "0 auto" : "0", width: "100%", overflow: "hidden" }}>
                <TvOrderCard order={order} />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
