import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { getManagerSecret } from "./lib/managerAuth.js";

async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-manager-secret": getManagerSecret(),
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

// ── Config ───────────────────────────────────────────────────────
const STAGES = {
  new:  { label:"RECEIVED", bg:"#C8600A", text:"#FFFFFF", next:"done", nextLabel:"MARK READY", nextBg:"#1A6B3A" },
  done: { label:"READY",    bg:"#1A6B3A", text:"#FFFFFF", next:null,   nextLabel:null,       nextBg:null },
};

const SPICE_COLORS = {
  Mild:   { bg:"#EDF4FB", color:"#1A5A8A" },
  Medium: { bg:"#FEF3E2", color:"#7A4A10" },
  Spicy:  { bg:"#FDECEC", color:"#922424" },
};

// ── Elapsed time ─────────────────────────────────────────────────
function useElapsed(createdAt) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const update = () => setElapsed(Math.floor((Date.now() - new Date(createdAt)) / 60000));
    update();
    const t = setInterval(update, 30000);
    return () => clearInterval(t);
  }, [createdAt]);
  return elapsed;
}

function ElapsedBadge({ createdAt, status }) {
  const mins = useElapsed(createdAt);
  const urgent = status === "new" && mins >= 15;
  const color = urgent ? "#9B2626" : "#8A7560";
  const bg    = urgent ? "#FEF0F0" : "rgba(0,0,0,0.06)";
  return (
    <span style={{ fontSize:16, fontWeight:700, color, background:bg, padding:"4px 12px", borderRadius:20, letterSpacing:"0.04em" }}>
      {mins < 1 ? "Just now" : `${mins}m ago`}{urgent ? " ⚠" : ""}
    </span>
  );
}

// ── Order ticket ─────────────────────────────────────────────────
function Ticket({ order, onAdvance, onUndo }) {
  const stage = STAGES[order.status] ?? STAGES.done;
  const isNew    = order.status === "new";
  const isDone   = order.status === "done";

  return (
    <div style={{
      background: isDone ? "#F5F0E8" : "#FFFFFF",
      borderRadius:16,
      border: isNew ? "2.5px solid #C8600A" : "1px solid rgba(0,0,0,0.12)",
      boxShadow: isDone ? "none" : isNew ? "0 4px 20px rgba(200,96,10,0.18)" : "0 2px 12px rgba(0,0,0,0.08)",
      opacity: isDone ? 0.65 : 1,
      transition:"all 0.25s",
      display:"flex",
      flexDirection:"column",
      overflow:"hidden",
    }}>
      {/* Ticket header */}
      <div style={{ background: isNew ? "#C8600A" : "#1A6B3A", padding:"14px 18px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:10 }}>
        <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
            <span style={{ fontSize:26, fontWeight:900, color:"#FFFFFF", lineHeight:1, letterSpacing:"-0.01em" }}>
              {order.customerName}
            </span>
            {order.orderMode === "delivery" && (
              <span style={{ background:"#D9482C", color:"#FFFFFF", fontSize:12, fontWeight:800, padding:"3px 10px", borderRadius:12, letterSpacing:"0.08em", whiteSpace:"nowrap" }}>
                🚗 DELIVERY
              </span>
            )}
          </div>
          <span style={{ fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.75)", letterSpacing:"0.18em", textTransform:"uppercase" }}>
            {stage.label} · #{order.id.slice(-4).toUpperCase()}
          </span>
        </div>
        <ElapsedBadge createdAt={order.createdAt} status={order.status} />
      </div>

      {/* Delivery Destination banner if delivery order */}
      {order.orderMode === "delivery" && order.deliveryAddress && (
        <div style={{ background:"#FFF8EC", padding:"10px 16px", borderBottom:"1px solid rgba(232,168,46,0.3)", color:"#7A4A10" }}>
          <p style={{ fontSize:12, fontWeight:800, letterSpacing:"0.08em", textTransform:"uppercase", margin:0 }}>
            🚗 Deliver To: {order.deliveryAddress.street}{order.deliveryAddress.apt ? `, ${order.deliveryAddress.apt}` : ""}, {order.deliveryAddress.city} {order.deliveryAddress.zip || ""}
          </p>
          {order.deliveryAddress.notes && (
            <p style={{ fontSize:12, color:"#922424", fontWeight:700, margin:"3px 0 0" }}>
              Driver Note: "{order.deliveryAddress.notes}"
            </p>
          )}
        </div>
      )}

      {/* Special instructions — shown prominently if present */}
      {order.specialInstructions && (
        <div style={{ background: order.specialInstructions.toUpperCase().includes("ALLERG") ? "#FEF0F0" : "#FFF3E8", padding:"10px 16px", borderBottom:"1px solid rgba(0,0,0,0.08)", display:"flex", gap:8, alignItems:"flex-start" }}>
          <span style={{ fontSize:18, flexShrink:0 }}>⚠</span>
          <span style={{ fontSize:18, fontWeight:700, color:"#9B2626", lineHeight:1.4 }}>{order.specialInstructions}</span>
        </div>
      )}

      {/* Items */}
      <div style={{ padding:"10px 0", flex:1 }}>
        {order.items.map((item, i) => (
          <div key={i} style={{ padding:"14px 18px", borderBottom: i < order.items.length-1 ? "1px solid rgba(0,0,0,0.06)" : "none", display:"flex", alignItems:"center", gap:16 }}>
            {/* Qty bubble */}
            <div style={{ width:52, height:52, borderRadius:"50%", background: isDone ? "rgba(0,0,0,0.1)" : "#0F0800", color:"#FFFFFF", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, fontWeight:900, flexShrink:0 }}>
              {item.qty}
            </div>
            {/* Name + spice + note */}
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ fontSize:22, fontWeight:700, color: isDone ? "#8A7560" : "#0F0800", lineHeight:1.2, textDecoration: isDone ? "line-through" : "none" }}>
                {item.name}
              </p>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop: item.spice || item.note ? 4 : 0 }}>
                {item.spice && (
                  <span style={{ fontSize:15, fontWeight:700, padding:"3px 11px", borderRadius:20, letterSpacing:"0.04em", textTransform:"uppercase", ...(SPICE_COLORS[item.spice] ?? { bg:"#F0EBE1", color:"#8A7560" }) }}>
                    {item.spice}
                  </span>
                )}
                {item.note && (
                  <span style={{ fontSize:15, color:"#8A7560", fontStyle:"italic", alignSelf:"center" }}>↳ {item.note}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Action button */}
      {!isDone && (
        <div style={{ padding:"12px 16px", borderTop:"1px solid rgba(0,0,0,0.08)" }}>
          <button
            onClick={() => onAdvance(order.id)}
            style={{ width:"100%", padding:"18px", background:stage.nextBg, color:"#FFFFFF", border:"none", borderRadius:10, fontSize:20, fontWeight:800, letterSpacing:"0.08em", textTransform:"uppercase", cursor:"pointer", transition:"opacity 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.opacity="0.85"}
            onMouseLeave={e => e.currentTarget.style.opacity="1"}>
            {stage.nextLabel}
          </button>
        </div>
      )}

      {/* Done — undo button */}
      {isDone && (
        <div style={{ padding:"10px 16px", borderTop:"1px solid rgba(0,0,0,0.08)", textAlign:"center" }}>
          <button onClick={() => onUndo(order.id)}
            style={{ background:"transparent", border:"none", color:"#8A7560", fontSize:13, cursor:"pointer", textDecoration:"underline" }}>
            Undo — move back to cooking
          </button>
        </div>
      )}
    </div>
  );
}

// ── New order flash overlay ───────────────────────────────────────
function NewOrderFlash({ visible, orderNum, onDismiss }) {
  if (!visible) return null;
  return (
    <div onClick={onDismiss} style={{ position:"fixed", inset:0, background:"rgba(200,96,10,0.92)", zIndex:999, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
      <p style={{ fontSize:28, fontWeight:800, color:"#FFFFFF", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:12 }}>New Order</p>
      <p style={{ fontSize:72, fontWeight:900, color:"#FFFFFF", lineHeight:1 }}>#{orderNum}</p>
      <p style={{ fontSize:16, color:"rgba(255,255,255,0.7)", marginTop:20 }}>Tap anywhere to dismiss</p>
    </div>
  );
}

// ── Main app ─────────────────────────────────────────────────────
export default function KitchenDisplay() {
  const [orders, setOrders]     = useState([]);
  const [flash, setFlash]       = useState(null);
  const [filter, setFilter]     = useState("active");
  const [lastPoll, setLastPoll] = useState(new Date());
  const prevIds = useRef(new Set());


  // Server-Sent Events (SSE) stream for real-time pushes (zero polling overhead)
  useEffect(() => {
    const secret = getManagerSecret();
    const streamUrl = `/api/orders?stream=true&secret=${encodeURIComponent(secret)}`;
    
    let es;
    let reconnectTimer;

    const connectSSE = () => {
      try {
        es = new EventSource(streamUrl);

        es.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "orders_update") {
              const fetchedOrders = data.orders || [];
              if (prevIds.current.size > 0) {
                const newArr = fetchedOrders.filter(o => !prevIds.current.has(o.id) && o.status === "new");
                if (newArr.length > 0) {
                  setFlash(newArr[0].id.slice(-4).toUpperCase());
                }
              }
              prevIds.current = new Set(fetchedOrders.map(o => o.id));
              setOrders(fetchedOrders);
              setLastPoll(new Date());
            }
          } catch (e) {}
        };

        es.onerror = () => {
          if (es) es.close();
          reconnectTimer = setTimeout(connectSSE, 3000);
        };
      } catch (e) {
        console.error("SSE stream error:", e);
      }
    };

    connectSSE();

    return () => {
      if (es) es.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []);

  const advance = useCallback(async (id) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: "done" } : o));
    try {
      await apiFetch("/api/orders", {
        method: "PATCH",
        body: JSON.stringify({ id, status: "done" }),
      });
    } catch (err) {
      console.error("Advance status error:", err);
    }
  }, []);

  const undo = useCallback(async (id) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: "new" } : o));
    try {
      await apiFetch("/api/orders", {
        method: "PATCH",
        body: JSON.stringify({ id, status: "new" }),
      });
    } catch (err) {
      console.error("Undo status error:", err);
    }
  }, []);

  const { active, done, shown, newCount, doneCount } = useMemo(() => {
    const act  = orders.filter(o => o.status !== "done" && o.status !== "refunded");
    const dn   = orders.filter(o => o.status === "done");
    const sh   = filter === "active" ? act : filter === "done" ? dn : orders;
    const nc   = orders.filter(o => o.status === "new").length;
    const dc   = orders.filter(o => o.status === "done").length;
    return { active: act, done: dn, shown: sh, newCount: nc, doneCount: dc };
  }, [orders, filter]);

  return (
    <div style={{ background:"#1A1008", minHeight:"100vh", fontFamily:"'Inter',sans-serif", userSelect:"none" }}>
      <style>{`
        * { box-sizing:border-box; margin:0; padding:0 }
        ::-webkit-scrollbar { width:4px }
        ::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.15); border-radius:2px }
      `}</style>

      {/* Flash alert */}
      <NewOrderFlash visible={!!flash} orderNum={flash} onDismiss={() => setFlash(null)} />

      {/* Header bar */}
      <header style={{ background:"#0F0800", padding:"12px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", borderBottom:"1px solid rgba(200,133,58,0.2)", position:"sticky", top:0, zIndex:100 }}>
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <h1 style={{ fontFamily:"Georgia,serif", fontSize:22, color:"#F5E6C8", fontWeight:400 }}>Kitchen</h1>
          {/* Live counts */}
          <div style={{ display:"flex", gap:8 }}>
            {newCount > 0 && (
              <span style={{ background:"#C8600A", color:"#FFFFFF", fontSize:12, fontWeight:800, padding:"4px 12px", borderRadius:20, letterSpacing:"0.06em", animation:"blink 1.5s infinite" }}>
                {newCount} NEW
              </span>
            )}
            {doneCount > 0 && (
              <span style={{ background:"#1A6B3A", color:"#FFFFFF", fontSize:12, fontWeight:700, padding:"4px 12px", borderRadius:20 }}>
                {doneCount} READY
              </span>
            )}
          </div>
        </div>

        {/* Filter + clock */}
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ display:"flex", gap:4 }}>
            {[
              { key:"active", label:`Active (${active.length})` },
              { key:"done",   label:`Done (${done.length})` },
              { key:"all",    label:"All" },
            ].map(tab => (
              <button key={tab.key} onClick={() => setFilter(tab.key)}
                style={{ background: filter===tab.key ? "#C8853A" : "rgba(255,255,255,0.08)", border:"none", color: filter===tab.key ? "#FFFFFF" : "#8A7560", fontSize:12, fontWeight:600, padding:"6px 14px", borderRadius:20, cursor:"pointer", letterSpacing:"0.04em" }}>
                {tab.label}
              </button>
            ))}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginLeft:6 }}>
            <div style={{ width:7, height:7, borderRadius:"50%", background:"#1A6B3A", boxShadow:"0 0 0 3px rgba(26,107,58,0.3)" }} />
            <span style={{ fontSize:11, color:"#8A7560", fontVariantNumeric:"tabular-nums" }}>
              {lastPoll.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}
            </span>
          </div>
        </div>
      </header>

      {/* Hint bar */}
      {newCount > 0 && (
        <div style={{ background:"#C8600A", padding:"10px 20px", textAlign:"center" }}>
          <p style={{ fontSize:14, fontWeight:700, color:"#FFFFFF", letterSpacing:"0.08em", textTransform:"uppercase" }}>
            {newCount} order{newCount > 1 ? "s" : ""} waiting — tap START COOKING to begin
          </p>
        </div>
      )}

      {/* Order grid */}
      <div style={{ padding:"16px", display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(300px, 1fr))", gap:14, alignItems:"start" }}>
        {shown.length === 0 ? (
          <div style={{ gridColumn:"1/-1", textAlign:"center", padding:"60px 0", color:"#8A7560", fontSize:16 }}>
            {filter === "active" ? "✓ No active orders — all clear" : "No orders to show"}
          </div>
        ) : (
          shown.map(order => (
            <Ticket key={order.id} order={order} onAdvance={advance} onUndo={undo} />
          ))
        )}
      </div>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.5} }
      `}</style>
    </div>
  );
}
