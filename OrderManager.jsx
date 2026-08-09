// OrderManager.jsx — Rani Mahal order + charge management dashboard

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { getManagerSecret } from "./lib/managerAuth.js";

const API_BASE       = ""; // same-origin — /api/* is served by this deployment
const POLL_INTERVAL  = 10_000;

const STATUS = {
  new:      { label:"Received", color:"#C8600A", bg:"#FEF3E8", next:"done", nextLabel:"Mark Ready", nextColor:"#1A6B3A" },
  done:     { label:"Ready",    color:"#1A6B3A", bg:"#E8F5EC", next:null,   nextLabel:null,       nextColor:null },
  refunded: { label:"Refunded", color:"#9B2626", bg:"#FEF0F0", next:null,   nextLabel:null,       nextColor:null },
};

const REFUND_REASONS = [
  "Wrong item prepared",
  "Item unavailable / out of stock",
  "Customer cancelled order",
  "Order never picked up",
  "Quality issue",
  "Duplicate order",
  "Other",
];

const fmt     = n   => "$" + Number(n ?? 0).toFixed(2);
const fmtTime = iso => new Date(iso).toLocaleTimeString("en-US",  { hour:"2-digit", minute:"2-digit" });
const fmtDate = iso => new Date(iso).toLocaleDateString("en-US",  { weekday:"short", month:"short", day:"numeric" });
const fmtFull = iso => new Date(iso).toLocaleString("en-US",      { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" });

// ── API helpers ──────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type":"application/json", "x-manager-secret":getManagerSecret(), ...(options.headers??{}) },
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

// ── Refund modal ─────────────────────────────────────────────────
function RefundModal({ order, onClose, onSuccess }) {
  const [mode,     setMode]     = useState("menu");   // menu | full | partial | item | void | history
  const [amount,   setAmount]   = useState("");
  const [itemName, setItemName] = useState(order.items[0]?.name ?? "");
  const [reason,   setReason]   = useState(REFUND_REASONS[0]);
  const [staff,    setStaff]    = useState("Manager");
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState(null);
  const [error,    setError]    = useState(null);

  const alreadyRefunded = order.refundedTotal ?? 0;
  const remaining       = Math.max(0, order.total - alreadyRefunded);
  const fullyRefunded   = alreadyRefunded >= order.total - 0.01;

  const submit = async (type) => {
    setLoading(true); setError(null);
    try {
      const amountRefunded = type === "full" ? remaining
        : type === "item" ? itemRefundAmount
        : type === "void" ? order.total
        : Number(amount);

      const res = await apiFetch("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          action: "refund",
          orderId: order.id,
          type,
          amount: amountRefunded,
          reason,
          itemName: type === "item" ? itemName : undefined,
          staffName: staff
        })
      });

      setResult({
        type,
        amountRefunded,
        stripeRefundId: res.stripeRefundId || ("re_" + Date.now().toString(36))
      });
      onSuccess(order.id, type, amountRefunded);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const itemRefundAmount = (() => {
    const item = order.items.find(i => i.name === itemName);
    return item ? item.price * item.qty : 0;
  })();

  // ── Success screen
  if (result) return (
    <ModalWrap onClose={onClose}>
      <div style={{ textAlign:"center", padding:"32px 24px" }}>
        <div style={{ fontSize:48, marginBottom:12 }}>✓</div>
        <p style={{ fontFamily:"'Georgia',serif", fontSize:20, color:"#0F0800", marginBottom:8 }}>
          {result.type === "void" ? "Order voided" : `${fmt(result.amountRefunded)} refunded`}
        </p>
        <p style={{ fontSize:13, color:"#8A7560", marginBottom:4 }}>Stripe ID: {result.stripeRefundId}</p>
        <p style={{ fontSize:12, color:"#8A7560", marginBottom:24 }}>Customer will receive funds in 5–10 business days.</p>
        <button onClick={onClose} style={btnStyle("#0F0800","#FFFFFF")}>Done</button>
      </div>
    </ModalWrap>
  );

  // ── Refund history screen
  if (mode === "history") return (
    <ModalWrap onClose={onClose} title="Refund history">
      {!order.refundHistory?.length ? (
        <p style={{ color:"#8A7560", fontSize:14, padding:"20px 0", textAlign:"center" }}>No refunds on this order.</p>
      ) : order.refundHistory.map((r, i) => (
        <div key={i} style={{ padding:"12px 0", borderBottom:"0.5px solid rgba(0,0,0,0.07)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
            <span style={{ fontSize:13, fontWeight:600, color: r.success ? "#1A6B3A" : "#9B2626" }}>
              {r.success ? "✓" : "✗"} {r.type.charAt(0).toUpperCase()+r.type.slice(1)} refund — {fmt(r.amount)}
            </span>
            <span style={{ fontSize:11, color:"#8A7560" }}>{fmtFull(r.timestamp)}</span>
          </div>
          {r.itemName && <p style={{ fontSize:12, color:"#8A7560" }}>Item: {r.itemName}</p>}
          <p style={{ fontSize:12, color:"#8A7560" }}>Reason: {r.reason}</p>
          <p style={{ fontSize:12, color:"#8A7560" }}>By: {r.staffName} · Stripe: {r.stripeRefundId}</p>
        </div>
      ))}
      <button onClick={() => setMode("menu")} style={{ ...btnStyle("#FFFFFF","#0F0800",true), marginTop:16 }}>← Back</button>
    </ModalWrap>
  );

  // ── Main menu
  if (mode === "menu") return (
    <ModalWrap onClose={onClose} title={`Manage charge — #${order.id.slice(-6).toUpperCase()}`}>
      <div style={{ marginBottom:16, padding:"12px 14px", background:"#FAFAF5", borderRadius:8, fontSize:13 }}>
        <div style={{ display:"flex", justifyContent:"space-between", color:"#8A7560" }}><span>Order total</span><span>{fmt(order.total)}</span></div>
        {alreadyRefunded > 0 && <div style={{ display:"flex", justifyContent:"space-between", color:"#9B2626", marginTop:4 }}><span>Already refunded</span><span>−{fmt(alreadyRefunded)}</span></div>}
        <div style={{ display:"flex", justifyContent:"space-between", fontWeight:700, color:"#0F0800", marginTop:6, paddingTop:6, borderTop:"0.5px solid rgba(0,0,0,0.08)" }}><span>Refundable</span><span>{fmt(remaining)}</span></div>
      </div>

      {fullyRefunded ? (
        <p style={{ textAlign:"center", color:"#9B2626", fontSize:14, padding:"8px 0" }}>This order has been fully refunded.</p>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          <ActionBtn icon="↩" label="Full refund" sub={fmt(remaining)} color="#9B2626" onClick={() => setMode("full")} />
          <ActionBtn icon="✂" label="Partial refund" sub="Custom amount" color="#C8600A" onClick={() => setMode("partial")} />
          <ActionBtn icon="🍽" label="Item refund" sub="Remove one item" color="#C8853A" onClick={() => setMode("item")} />
          <ActionBtn icon="✕" label="Void order" sub="Cancel before settlement" color="#8A7560" onClick={() => setMode("void")} />
        </div>
      )}

      {order.refundHistory?.length > 0 && (
        <button onClick={() => setMode("history")} style={{ ...btnStyle("#FFFFFF","#8A7560",true), marginTop:12, width:"100%", fontSize:12 }}>
          View refund history ({order.refundHistory.length})
        </button>
      )}
    </ModalWrap>
  );

  // ── Reason + staff fields (shared)
  const CommonFields = () => (
    <>
      <label style={labelStyle}>Reason</label>
      <select value={reason} onChange={e => setReason(e.target.value)} style={inputStyle}>
        {REFUND_REASONS.map(r => <option key={r}>{r}</option>)}
      </select>
      <label style={labelStyle}>Your name</label>
      <input value={staff} onChange={e => setStaff(e.target.value)} style={inputStyle} placeholder="Manager" />
    </>
  );

  // ── Full refund
  if (mode === "full") return (
    <ModalWrap onClose={onClose} title="Full refund" onBack={() => setMode("menu")}>
      <WarningBox>This will refund <strong>{fmt(remaining)}</strong> to the customer's card. Stripe's processing fee (~2.9% + 30¢) is not recoverable.</WarningBox>
      <CommonFields />
      {error && <ErrorBox>{error}</ErrorBox>}
      <div style={{ display:"flex", gap:8, marginTop:16 }}>
        <button onClick={() => setMode("menu")} style={btnStyle("#FFFFFF","#0F0800",true)}>Cancel</button>
        <button onClick={() => submit("full")} disabled={loading} style={btnStyle("#9B2626","#FFFFFF")}>
          {loading ? "Processing…" : `Refund ${fmt(remaining)}`}
        </button>
      </div>
    </ModalWrap>
  );

  // ── Partial refund
  if (mode === "partial") return (
    <ModalWrap onClose={onClose} title="Partial refund" onBack={() => setMode("menu")}>
      <label style={labelStyle}>Amount to refund</label>
      <div style={{ position:"relative", marginBottom:12 }}>
        <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:"#8A7560", fontSize:15 }}>$</span>
        <input type="number" min="0.01" max={remaining} step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
          style={{ ...inputStyle, paddingLeft:28, marginBottom:0 }} placeholder={remaining.toFixed(2)} />
      </div>
      <p style={{ fontSize:11, color:"#8A7560", marginBottom:12 }}>Max refundable: {fmt(remaining)}</p>
      {/* Quick amounts */}
      <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap" }}>
        {order.items.slice(0,4).map(item => (
          <button key={item.name} onClick={() => setAmount((item.price*item.qty).toFixed(2))}
            style={{ fontSize:11, padding:"4px 10px", borderRadius:20, border:"0.5px solid rgba(0,0,0,0.12)", background:"#FAFAF5", color:"#0F0800", cursor:"pointer" }}>
            {item.name.split(" ").slice(0,2).join(" ")} {fmt(item.price*item.qty)}
          </button>
        ))}
      </div>
      <CommonFields />
      {error && <ErrorBox>{error}</ErrorBox>}
      <div style={{ display:"flex", gap:8, marginTop:16 }}>
        <button onClick={() => setMode("menu")} style={btnStyle("#FFFFFF","#0F0800",true)}>Cancel</button>
        <button onClick={() => submit("partial")} disabled={loading || !amount || Number(amount) <= 0}
          style={btnStyle("#C8600A","#FFFFFF")}>
          {loading ? "Processing…" : `Refund ${amount ? fmt(Number(amount)) : "—"}`}
        </button>
      </div>
    </ModalWrap>
  );

  // ── Item refund
  if (mode === "item") return (
    <ModalWrap onClose={onClose} title="Item refund" onBack={() => setMode("menu")}>
      <label style={labelStyle}>Select item to refund</label>
      <select value={itemName} onChange={e => setItemName(e.target.value)} style={inputStyle}>
        {order.items.map(item => (
          <option key={item.name} value={item.name}>
            {item.qty}× {item.name} — {fmt(item.price * item.qty)}
          </option>
        ))}
      </select>
      <div style={{ padding:"10px 14px", background:"#FEF3E8", borderRadius:8, fontSize:13, marginBottom:12 }}>
        Refund amount: <strong style={{ color:"#C8853A" }}>{fmt(itemRefundAmount)}</strong>
      </div>
      <CommonFields />
      {error && <ErrorBox>{error}</ErrorBox>}
      <div style={{ display:"flex", gap:8, marginTop:16 }}>
        <button onClick={() => setMode("menu")} style={btnStyle("#FFFFFF","#0F0800",true)}>Cancel</button>
        <button onClick={() => submit("item")} disabled={loading} style={btnStyle("#C8853A","#FFFFFF")}>
          {loading ? "Processing…" : `Refund ${fmt(itemRefundAmount)}`}
        </button>
      </div>
    </ModalWrap>
  );

  // ── Void
  if (mode === "void") return (
    <ModalWrap onClose={onClose} title="Void order" onBack={() => setMode("menu")}>
      <WarningBox>Void cancels the payment before it settles. This only works within a few minutes of the charge. If settlement has already occurred, use a full refund instead.</WarningBox>
      <CommonFields />
      {error && <ErrorBox>{error}</ErrorBox>}
      <div style={{ display:"flex", gap:8, marginTop:16 }}>
        <button onClick={() => setMode("menu")} style={btnStyle("#FFFFFF","#0F0800",true)}>Cancel</button>
        <button onClick={() => submit("void")} disabled={loading} style={btnStyle("#8A7560","#FFFFFF")}>
          {loading ? "Voiding…" : "Void order"}
        </button>
      </div>
    </ModalWrap>
  );
}

// ── Shared sub-components ────────────────────────────────────────
function ModalWrap({ children, onClose, title, onBack }) {
  return (
    <div onClick={e => e.target===e.currentTarget && onClose()}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#FFFFFF", borderRadius:16, width:"100%", maxWidth:420, maxHeight:"90vh", overflowY:"auto", boxShadow:"0 24px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ padding:"16px 20px", borderBottom:"0.5px solid rgba(0,0,0,0.08)", display:"flex", alignItems:"center", gap:10 }}>
          {onBack && <button onClick={onBack} style={{ background:"transparent", border:"none", fontSize:20, color:"#8A7560", cursor:"pointer", padding:"0 4px 0 0" }}>←</button>}
          {title && <p style={{ fontSize:15, fontWeight:700, color:"#0F0800", flex:1 }}>{title}</p>}
          <button onClick={onClose} style={{ background:"transparent", border:"none", fontSize:20, color:"#8A7560", cursor:"pointer" }}>×</button>
        </div>
        <div style={{ padding:"16px 20px" }}>{children}</div>
      </div>
    </div>
  );
}

function ActionBtn({ icon, label, sub, color, onClick }) {
  return (
    <button onClick={onClick} style={{ display:"flex", alignItems:"center", gap:14, padding:"13px 16px", background:"#FAFAF5", border:`1px solid rgba(0,0,0,0.08)`, borderRadius:10, cursor:"pointer", textAlign:"left", width:"100%", transition:"background 0.12s" }}
      onMouseEnter={e => e.currentTarget.style.background="#F5F0E8"}
      onMouseLeave={e => e.currentTarget.style.background="#FAFAF5"}>
      <span style={{ fontSize:20, width:28, textAlign:"center", flexShrink:0 }}>{icon}</span>
      <div>
        <p style={{ fontSize:14, fontWeight:600, color }}>{label}</p>
        <p style={{ fontSize:12, color:"#8A7560", marginTop:1 }}>{sub}</p>
      </div>
      <span style={{ marginLeft:"auto", color:"#8A7560", fontSize:18 }}>›</span>
    </button>
  );
}

function WarningBox({ children }) {
  return <div style={{ padding:"10px 14px", background:"#FEF3E8", borderLeft:"3px solid #C8600A", borderRadius:"0 8px 8px 0", fontSize:13, color:"#0F0800", marginBottom:14, lineHeight:1.6 }}>{children}</div>;
}
function ErrorBox({ children }) {
  return <div style={{ padding:"10px 14px", background:"#FEF0F0", borderLeft:"3px solid #9B2626", borderRadius:"0 8px 8px 0", fontSize:13, color:"#9B2626", marginTop:8 }}>{children}</div>;
}

const labelStyle = { display:"block", fontSize:11, fontWeight:600, letterSpacing:"0.12em", textTransform:"uppercase", color:"#8A7560", marginBottom:5 };
const inputStyle = { display:"block", width:"100%", padding:"9px 12px", border:"1px solid rgba(0,0,0,0.12)", borderRadius:8, fontSize:14, color:"#0F0800", background:"#FAFAF5", marginBottom:12, outline:"none", fontFamily:"'Inter',sans-serif" };
const btnStyle = (bg, color, outline=false) => ({
  flex:1, padding:"10px 20px", background:bg, color, border: outline ? "1px solid rgba(0,0,0,0.15)" : "none",
  borderRadius:8, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"'Inter',sans-serif",
});

// ── Refund history badge ─────────────────────────────────────────
function RefundBadge({ order }) {
  if (!order.refundedTotal || order.refundedTotal <= 0) return null;
  const partial = order.refundedTotal < order.total - 0.01;
  return (
    <span style={{ fontSize:10, fontWeight:700, color: partial ? "#C8600A" : "#9B2626", background: partial ? "#FEF3E8" : "#FEF0F0", padding:"2px 8px", borderRadius:20, whiteSpace:"nowrap" }}>
      {partial ? `−${fmt(order.refundedTotal)} refunded` : "Fully refunded"}
    </span>
  );
}

// ── OrderCard ────────────────────────────────────────────────────
function OrderCard({ order, onStatusChange, onPrint, onRefundSuccess }) {
  const [expanded,     setExpanded]     = useState(false);
  const [updating,     setUpdating]     = useState(false);
  const [showRefund,   setShowRefund]   = useState(false);
  const [localOrder,   setLocalOrder]   = useState(order);
  const s = STATUS[localOrder.status] ?? STATUS.new;

  const handleStatus = async () => {
    if (!s.next || updating) return;
    setUpdating(true);
    try { await onStatusChange(localOrder.id, s.next); }
    finally { setUpdating(false); }
  };

  const handleRefundSuccess = (id, type, amount) => {
    // Optimistically update local state
    const newRefunded = (localOrder.refundedTotal ?? 0) + amount;
    const isFullyRefunded = newRefunded >= localOrder.total - 0.01;
    setLocalOrder(prev => ({
      ...prev,
      status: isFullyRefunded ? "refunded" : prev.status,
      refundedTotal: newRefunded,
      refundHistory: [...(prev.refundHistory ?? []), {
        type, amount, timestamp: new Date().toISOString(), success: true,
        staffName:"Manager", stripeRefundId:"re_preview", reason:"",
      }],
    }));
    setShowRefund(false);
    onRefundSuccess?.();
  };

  const canRefund = localOrder.stripePaymentId && localOrder.status !== "refunded";

  return (
    <>
      {showRefund && (
        <RefundModal
          order={localOrder}
          onClose={() => setShowRefund(false)}
          onSuccess={handleRefundSuccess}
        />
      )}

      <div style={{ background:"#FFFFFF", borderRadius:12, border:"0.5px solid rgba(0,0,0,0.08)", overflow:"hidden", boxShadow:"0 1px 4px rgba(0,0,0,0.05)", marginBottom:10 }}>
        {/* Header row */}
        <div onClick={() => setExpanded(e => !e)}
          style={{ padding:"14px 16px", display:"flex", alignItems:"center", gap:10, cursor:"pointer" }}>
          <span style={{ background:s.bg, color:s.color, fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:20, whiteSpace:"nowrap", letterSpacing:"0.05em", textTransform:"uppercase", flexShrink:0 }}>
            {s.label}
          </span>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
              <span style={{ fontSize:14, fontWeight:700, color:"#0F0800" }}>#{localOrder.id.slice(-6).toUpperCase()}</span>
              <span style={{ fontSize:13, color:"#8A7560" }}>{localOrder.customerName}</span>
              <RefundBadge order={localOrder} />
            </div>
            <p style={{ fontSize:12, color:"#8A7560", marginTop:2 }}>
              {fmtTime(localOrder.createdAt)} · {localOrder.items.length} items ·{" "}
              <strong style={{ color:"#0F0800" }}>{fmt(localOrder.total)}</strong>
              {localOrder.refundedTotal > 0 && <span style={{ color:"#9B2626" }}> (net {fmt(localOrder.total - localOrder.refundedTotal)})</span>}
            </p>
          </div>
          {!localOrder.printed && localOrder.status !== "refunded" && (
            <span style={{ fontSize:10, fontWeight:600, color:"#9B2626", background:"#FEF0F0", padding:"2px 8px", borderRadius:20, flexShrink:0 }}>UNPRINTED</span>
          )}
          <span style={{ fontSize:18, color:"#8A7560", transition:"transform 0.2s", transform: expanded ? "rotate(180deg)" : "none", flexShrink:0 }}>⌄</span>
        </div>

        {/* Expanded body */}
        {expanded && (
          <div style={{ borderTop:"0.5px solid rgba(0,0,0,0.07)", padding:"14px 16px" }}>
            {/* Items table */}
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13, marginBottom:12 }}>
              <thead>
                <tr style={{ color:"#8A7560", fontSize:10, textTransform:"uppercase", letterSpacing:"0.1em" }}>
                  <th style={{ textAlign:"left", paddingBottom:6, fontWeight:600 }}>Item</th>
                  <th style={{ textAlign:"center", paddingBottom:6, fontWeight:600 }}>Qty</th>
                  <th style={{ textAlign:"right", paddingBottom:6, fontWeight:600 }}>Price</th>
                </tr>
              </thead>
              <tbody>
                {localOrder.items.map((item, i) => (
                  <tr key={i} style={{ borderTop:"0.5px solid rgba(0,0,0,0.06)" }}>
                    <td style={{ padding:"7px 0" }}>
                      <span style={{ fontWeight:500, color:"#0F0800" }}>{item.name}</span>
                      {item.spice && <span style={{ fontSize:11, color:"#C8853A", marginLeft:6, fontWeight:600 }}>{item.spice}</span>}
                      {item.note  && <div style={{ fontSize:11, color:"#8A7560", marginTop:2 }}>↳ {item.note}</div>}
                    </td>
                    <td style={{ padding:"7px 0", textAlign:"center", color:"#8A7560" }}>{item.qty}</td>
                    <td style={{ padding:"7px 0", textAlign:"right", color:"#0F0800" }}>{fmt(item.price * item.qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div style={{ borderTop:"0.5px solid rgba(0,0,0,0.1)", paddingTop:8, fontSize:13 }}>
              <div style={{ display:"flex", justifyContent:"space-between", color:"#8A7560", marginBottom:3 }}><span>Subtotal</span><span>{fmt(localOrder.subtotal)}</span></div>
              {localOrder.orderMode === "delivery" && (
                <div style={{ display:"flex", justifyContent:"space-between", color:"#C8600A", marginBottom:3, fontWeight:600 }}>
                  <span>Delivery Fee</span><span>{localOrder.deliveryFee > 0 ? fmt(localOrder.deliveryFee) : "FREE"}</span>
                </div>
              )}
              <div style={{ display:"flex", justifyContent:"space-between", color:"#8A7560", marginBottom:6 }}><span>Tax (8.375%)</span><span>{fmt(localOrder.tax)}</span></div>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:15, fontWeight:700, color:"#0F0800" }}><span>Total charged</span><span>{fmt(localOrder.total)}</span></div>
              {localOrder.refundedTotal > 0 && (
                <>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, color:"#9B2626", marginTop:4 }}><span>Refunded</span><span>−{fmt(localOrder.refundedTotal)}</span></div>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:14, fontWeight:700, color:"#0F0800", borderTop:"0.5px solid rgba(0,0,0,0.1)", paddingTop:6, marginTop:6 }}><span>Net revenue</span><span style={{ color:"#1A6B3A" }}>{fmt(localOrder.total - localOrder.refundedTotal)}</span></div>
                </>
              )}
            </div>

            {/* Delivery details if applicable */}
            {localOrder.orderMode === "delivery" && localOrder.deliveryAddress && (
              <div style={{ marginTop:10, padding:"8px 12px", background:"#FFF8EC", border:"0.5px solid rgba(232,168,46,0.4)", borderRadius:8, fontSize:12.5, color:"#7A4A10" }}>
                <strong>🚗 Delivery Address: </strong>
                {localOrder.deliveryAddress.street}{localOrder.deliveryAddress.apt ? `, ${localOrder.deliveryAddress.apt}` : ""}, {localOrder.deliveryAddress.city} {localOrder.deliveryAddress.zip || ""}
                {localOrder.deliveryAddress.notes && <div style={{ marginTop:2, fontSize:12 }}><em>Driver Note: "{localOrder.deliveryAddress.notes}"</em></div>}
              </div>
            )}

            {/* Refund history inline */}
            {localOrder.refundHistory?.length > 0 && (
              <div style={{ marginTop:10, padding:"10px 12px", background:"#FEF3E8", borderRadius:8 }}>
                <p style={{ fontSize:10, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:"#C8600A", marginBottom:6 }}>Refund history</p>
                {localOrder.refundHistory.map((r, i) => (
                  <p key={i} style={{ fontSize:12, color:"#0F0800", marginBottom: i < localOrder.refundHistory.length-1 ? 4 : 0 }}>
                    {r.success ? "✓" : "✗"} {r.type} · {fmt(r.amount)} · {r.reason} · {fmtFull(r.timestamp)}
                  </p>
                ))}
              </div>
            )}

            {/* Special instructions */}
            {localOrder.specialInstructions && (
              <div style={{ marginTop:10, padding:"8px 12px", background:"#FEF3E8", borderRadius:8, fontSize:13, color:"#0F0800" }}>
                <strong>Note: </strong>{localOrder.specialInstructions}
              </div>
            )}

            {/* Contact */}
            {(localOrder.customerEmail || localOrder.customerPhone) && (
              <div style={{ marginTop:8, fontSize:12, color:"#8A7560", display:"flex", gap:12, flexWrap:"wrap" }}>
                {localOrder.customerEmail && <span>✉ {localOrder.customerEmail}</span>}
                {localOrder.customerPhone && <span>📞 {localOrder.customerPhone}</span>}
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display:"flex", gap:8, marginTop:14, flexWrap:"wrap" }}>
              {s.next && (
                <button onClick={handleStatus} disabled={updating}
                  style={{ flex:1, minWidth:100, padding:"10px 16px", background:s.nextColor, color:"#FFFFFF", border:"none", borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer", opacity:updating?0.6:1 }}>
                  {updating ? "…" : s.nextLabel}
                </button>
              )}
              <button onClick={() => onPrint(localOrder.id)}
                style={{ padding:"10px 16px", background:"#FFFFFF", color:"#0F0800", border:"1px solid rgba(0,0,0,0.15)", borderRadius:8, fontSize:13, fontWeight:500, cursor:"pointer" }}>
                🖨 {localOrder.printed ? "Reprint" : "Print"}
              </button>
              {canRefund && (
                <button onClick={() => setShowRefund(true)}
                  style={{ padding:"10px 16px", background:"#FEF0F0", color:"#9B2626", border:"1px solid rgba(155,38,38,0.2)", borderRadius:8, fontSize:13, fontWeight:600, cursor:"pointer" }}>
                  ↩ Refund
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ── Stat card ────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{ background:"#FFFFFF", borderRadius:12, padding:"16px 20px", border:"0.5px solid rgba(0,0,0,0.08)", flex:1, minWidth:130, boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
      <p style={{ fontSize:10, fontWeight:600, letterSpacing:"0.15em", textTransform:"uppercase", color:"#8A7560", marginBottom:5 }}>{label}</p>
      <p style={{ fontSize:26, fontWeight:700, color: accent ?? "#0F0800", lineHeight:1 }}>{value}</p>
      {sub && <p style={{ fontSize:11, color:"#8A7560", marginTop:4 }}>{sub}</p>}
    </div>
  );
}

// ── Top items ────────────────────────────────────────────────────
function TopItems({ items }) {
  if (!items?.length) return null;
  const max = items[0].qty;
  return (
    <div style={{ background:"#FFFFFF", borderRadius:12, padding:"16px 20px", border:"0.5px solid rgba(0,0,0,0.08)", boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
      <p style={{ fontSize:10, fontWeight:600, letterSpacing:"0.15em", textTransform:"uppercase", color:"#8A7560", marginBottom:14 }}>Top Items Today</p>
      {items.map((item, i) => (
        <div key={item.name} style={{ display:"flex", alignItems:"center", gap:10, marginBottom: i < items.length-1 ? 10 : 0 }}>
          <span style={{ fontSize:13, fontWeight:700, color:"#C8853A", width:28, textAlign:"right", flexShrink:0 }}>{item.qty}×</span>
          <div style={{ flex:1, minWidth:0 }}>
            <p style={{ fontSize:13, fontWeight:500, color:"#0F0800", marginBottom:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.name}</p>
            <div style={{ height:4, borderRadius:2, background:"#F0EBE1" }}>
              <div style={{ height:"100%", borderRadius:2, background:"#C8853A", width:`${(item.qty/max)*100}%` }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main app ─────────────────────────────────────────────────────
export default function OrderManager() {
  const [orders,       setOrders]       = useState([]);
  const [summary,      setSummary]      = useState(null);
  const [date,         setDate]         = useState(() => new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }));
  const [filter,       setFilter]       = useState("active");
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);
  const [lastRefresh,  setLastRefresh]  = useState(new Date());
  const [newOrderIds,  setNewOrderIds]  = useState(new Set());
  const prevOrderIds = useRef(new Set());

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const data = await apiFetch(`/api/orders?date=${date}`);
      const fetchedOrders = data.orders || [];
      setOrders(fetchedOrders);
      setSummary(data.summary || null);
      setLastRefresh(new Date());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [date]);

  // Server-Sent Events (SSE) stream for real-time manager pushes
  useEffect(() => {
    const secret = getManagerSecret();
    const streamUrl = `/api/orders?stream=true&date=${date}&secret=${encodeURIComponent(secret)}`;
    
    let es;
    let reconnectTimer;
    setLoading(true);

    const connectSSE = () => {
      try {
        es = new EventSource(streamUrl);

        es.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "orders_update") {
              const fetchedOrders = data.orders || [];
              if (prevOrderIds.current.size > 0) {
                const newIds = new Set(fetchedOrders.map(o => o.id).filter(id => !prevOrderIds.current.has(id)));
                setNewOrderIds(newIds);
              }
              prevOrderIds.current = new Set(fetchedOrders.map(o => o.id));
              setOrders(fetchedOrders);
              setSummary(data.summary || null);
              setLastRefresh(new Date());
              setError(null);
              setLoading(false);
            }
          } catch (e) {}
        };

        es.onerror = () => {
          setLoading(false);
          if (es) es.close();
          reconnectTimer = setTimeout(connectSSE, 3000);
        };
      } catch (e) {
        setLoading(false);
      }
    };

    connectSSE();

    return () => {
      if (es) es.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [date]);

  const handleStatusChange = async (id, status) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
    try {
      await apiFetch("/api/orders", {
        method: "PATCH",
        body: JSON.stringify({ id, status }),
      });
    } catch (err) {
      console.error("Status update error:", err);
      load(false);
    }
  };

  const handlePrint = async (id) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, printed: true } : o));
    try {
      await apiFetch("/api/orders", {
        method: "POST",
        body: JSON.stringify({ action: "reprint", id }),
      });
    } catch (err) {
      console.error("Print queue error:", err);
    }
  };

  const { filtered, newCount, inProgCount, refundedCount, totalRefunded } = useMemo(() => {
    const list = orders.filter(o => {
      if (filter === "active")   return o.status !== "done" && o.status !== "refunded";
      if (filter === "done")     return o.status === "done";
      if (filter === "refunded") return o.status === "refunded";
      return true;
    });
    const nc = orders.filter(o => o.status === "new").length;
    const ipc = orders.filter(o => o.status === "in_progress").length;
    const rc = orders.filter(o => o.status === "refunded").length;
    const tr = orders.reduce((s, o) => s + (o.refundedTotal ?? 0), 0);
    return { filtered: list, newCount: nc, inProgCount: ipc, refundedCount: rc, totalRefunded: tr };
  }, [orders, filter]);

  return (
    <div style={{ background:"#F0EBE1", minHeight:"100vh", fontFamily:"'Inter',sans-serif" }}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0} button:active{opacity:0.8}`}</style>

      {/* Header */}
      <header style={{ background:"#0F0800", padding:"14px 20px", position:"sticky", top:0, zIndex:100, display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
        <div>
          <h1 style={{ fontFamily:"'Georgia',serif", fontSize:20, color:"#F5E6C8", fontWeight:400, margin:0 }}>Rani Mahal</h1>
          <p style={{ fontSize:10, color:"#C8853A", letterSpacing:"0.2em", textTransform:"uppercase", margin:0 }}>Order Manager</p>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ background:"rgba(255,255,255,0.08)", border:"0.5px solid rgba(200,133,58,0.4)", color:"#F5E6C8", padding:"6px 10px", borderRadius:8, fontSize:12, cursor:"pointer" }} />
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <div style={{ width:7, height:7, borderRadius:"50%", background: error?"#9B2626":"#1A6B3A", boxShadow: error?"none":"0 0 0 3px rgba(26,107,58,0.3)" }} />
            <span style={{ fontSize:11, color:"#8A7560" }}>
              {error ? "Offline" : lastRefresh.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"})}
            </span>
          </div>
          <button onClick={() => load(true)} style={{ background:"rgba(200,133,58,0.15)", border:"0.5px solid rgba(200,133,58,0.4)", color:"#C8853A", padding:"6px 12px", borderRadius:8, fontSize:12, cursor:"pointer" }}>
            ↺
          </button>
        </div>
      </header>

      <div style={{ maxWidth:900, margin:"0 auto", padding:"18px 16px 40px" }}>

        {/* Stats */}
        <div style={{ display:"flex", gap:10, marginBottom:18, flexWrap:"wrap" }}>
          <StatCard label="Total Orders"    value={orders.length} sub={fmtDate(date+"T00:00:00")} />
          <StatCard label="Active"          value={newCount+inProgCount} accent={newCount+inProgCount>0?"#C8600A":"#0F0800"} sub={`${newCount} new · ${inProgCount} in progress`} />
          <StatCard label="Revenue"         value={fmt(summary?.totalRevenue ?? 0)} sub={`avg ${fmt(summary?.avgOrderValue ?? 0)}`} accent="#C8853A" />
          {totalRefunded > 0 && <StatCard label="Refunded today" value={fmt(totalRefunded)} accent="#9B2626" sub={`${refundedCount} order${refundedCount!==1?"s":""}`} />}
        </div>

        {/* Filter tabs */}
        <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap", alignItems:"center" }}>
          {[
            { key:"active",   label:`Active (${newCount+inProgCount})` },
            { key:"done",     label:`Done (${orders.filter(o=>o.status==="done").length})` },
            { key:"refunded", label:`Refunded (${refundedCount})` },
            { key:"all",      label:`All (${orders.length})` },
          ].map(tab => (
            <button key={tab.key} onClick={() => setFilter(tab.key)}
              style={{ padding:"7px 16px", borderRadius:20, border:"none", fontSize:12, fontWeight:600, cursor:"pointer",
                background: filter===tab.key ? "#C8853A" : "#FFFFFF",
                color: filter===tab.key ? "#FFFFFF" : "#8A7560",
                boxShadow:"0 1px 3px rgba(0,0,0,0.08)" }}>
              {tab.label}
            </button>
          ))}
          {newCount > 0 && (
            <span style={{ background:"#9B2626", color:"#FFFFFF", fontSize:10, fontWeight:700, padding:"4px 10px", borderRadius:20, letterSpacing:"0.06em" }}>
              {newCount} NEW
            </span>
          )}
        </div>

        {error && (
          <div style={{ background:"#FEF0F0", border:"0.5px solid rgba(155,38,38,0.3)", borderRadius:10, padding:"12px 16px", color:"#9B2626", fontSize:13, marginBottom:12 }}>
            ⚠ {error}
          </div>
        )}

        {loading && orders.length === 0 ? (
          <div style={{ textAlign:"center", padding:"40px 0", color:"#8A7560" }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:"center", padding:"40px 0", color:"#8A7560", fontSize:14, background:"#FFFFFF", borderRadius:12 }}>
            {filter === "active" ? "✓ No active orders right now" : "No orders to show"}
          </div>
        ) : (
          filtered.map(order => (
            <div key={order.id} style={{ outline: newOrderIds.has(order.id) ? "2px solid #C8853A" : "none", borderRadius:12 }}>
              <OrderCard
                order={order}
                onStatusChange={handleStatusChange}
                onPrint={handlePrint}
                onRefundSuccess={() => load(false)}
              />
            </div>
          ))
        )}

        {summary?.topItems?.length > 0 && (
          <div style={{ marginTop:16 }}>
            <TopItems items={summary.topItems} />
          </div>
        )}
      </div>
    </div>
  );
}
