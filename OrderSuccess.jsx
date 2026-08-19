import { useState, useEffect, useRef, useCallback } from "react";
import { useUser, useClerk } from "@clerk/clerk-react";
import { trackEvent } from "./src/utils/analytics.js";

const FONT_LINK = "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&family=Lora:ital,wght@0,400;0,500;1,400&family=Great+Vibes&family=Inter:wght@300;400;500;600&display=swap";

const fmt = n => "$" + Number(n ?? 0).toFixed(2);

function AccountClaimCard({ email }) {
  let isSignedIn = false;
  let user = null;
  let clerk = null;

  try {
    const u = useUser();
    isSignedIn = u.isSignedIn;
    user = u.user;
    clerk = useClerk();
  } catch {}

  if (isSignedIn && user) {
    return (
      <div style={{ background: "#F5E6C8", border: "0.5px solid rgba(200,133,58,0.3)", borderRadius: 14, padding: "16px 20px", marginBottom: 20, textAlign: "center" }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#0F0800", margin: "0 0 4px" }}>
          ✓ Order saved to your Rani Mahal account history!
        </p>
        <a href="/account" style={{ fontSize: 12, fontWeight: 600, color: "#C8853A", textDecoration: "underline" }}>
          View order history in Account →
        </a>
      </div>
    );
  }

  return (
    <div style={{ background: "#0F0800", borderRadius: 16, padding: "20px 22px", marginBottom: 20, border: "1px solid rgba(200,133,58,0.4)", color: "#F5E6C8" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 20 }}>👑</span>
        <h4 style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 600, color: "#FFFFFF", margin: 0 }}>
          Join the Rani Royal Club — 10% Off Your Next Order
        </h4>
      </div>
      <p style={{ fontSize: 13, color: "rgba(245,230,200,0.8)", marginBottom: 14, lineHeight: 1.5 }}>
        Create an account with <strong style={{ color: "#FFFFFF" }}>{email}</strong> in 1-click. Your first signed-in order is automatically 10% off, then 5% off every order after that — no punch card, no tracking required.
      </p>
      <div style={{ display: "flex", justifyContent: "center", marginTop: 14 }}>
        <button
          onClick={() => {
            if (clerk) {
              clerk.openSignUp({ initialValues: { emailAddress: email }, forceRedirectUrl: window.location.href });
            } else {
              window.location.href = `/account?email=${encodeURIComponent(email || "")}`;
            }
          }}
          style={{
            padding: "11px 22px",
            background: "#C8853A",
            color: "#0F0800",
            border: "none",
            borderRadius: 24,
            fontSize: 13.5,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "'Inter',sans-serif",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            boxShadow: "0 4px 14px rgba(200,133,58,0.3)",
            transition: "transform 0.15s ease",
          }}
          onMouseEnter={e => e.currentTarget.style.transform = "scale(1.02)"}
          onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
        >
          <span>Create Account / Claim Order →</span>
        </button>
      </div>
    </div>
  );
}

// Maps backend status → customer-facing stage index (2 stages: Received and Ready)
const STATUS_TO_STAGE = { new: 0, in_progress: 0, done: 1 };

const STAGES = [
  {
    key:   "received",
    label: "Order Received",
    icon:  "✓",
    desc:  "Your order is confirmed and being prepared fresh in our kitchen.",
    color: "#E8A82E",
  },
  {
    key:   "ready",
    label: "Ready for Pickup",
    icon:  "🎉",
    desc:  "Your order is ready! Come on in or watch for delivery.",
    color: "#1A6B3A",
  },
];

// ── Animated checkmark ───────────────────────────────────────────
function AnimatedCheck({ size = 72, color = "#1A6B3A" }) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => { const t = setTimeout(() => setDrawn(true), 150); return () => clearTimeout(t); }, []);
  const r = (size / 2) * 0.9;
  const cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ display:"block", margin:"0 auto" }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color + "22"} strokeWidth={size * 0.1} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={size * 0.1}
        strokeDasharray={circ} strokeDashoffset={drawn ? 0 : circ} strokeLinecap="round"
        style={{ transition:"stroke-dashoffset 0.55s cubic-bezier(0.4,0,0.2,1)", transformOrigin:"center", transform:"rotate(-90deg)" }} />
      <polyline
        points={`${size*0.3},${size*0.52} ${size*0.44},${size*0.66} ${size*0.71},${size*0.37}`}
        fill="none" stroke={color} strokeWidth={size * 0.07} strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray="60" strokeDashoffset={drawn ? 0 : 60}
        style={{ transition:"stroke-dashoffset 0.35s ease 0.5s" }} />
    </svg>
  );
}

// ── Live tracker ─────────────────────────────────────────────────
function LiveTracker({ orderId, initialStatus }) {
  const [stage, setStage]         = useState(STATUS_TO_STAGE[initialStatus] ?? 0);
  const [prevStage, setPrevStage] = useState(null);
  const [polling, setPolling]     = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const intervalRef = useRef(null);

  // DEMO: auto-advance through stages — only when there's no real order to
  // poll (e.g. visiting this page directly without a Stripe session_id).
  // Real orders rely solely on the polling effect below.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("session_id")) return;
    const t1 = setTimeout(() => {
      setPrevStage(0); setStage(1); setLastUpdate(new Date());
    }, 5000);
    const t2 = setTimeout(() => {
      setPrevStage(1); setStage(2); setLastUpdate(new Date());
      setPolling(false); setReadyBurst(true);
    }, 12000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // Real polling — fires in production when session_id is in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.get("session_id") || !polling || !orderId) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/orders?status_id=${orderId}`);
        if (!res.ok) return;
        const data = await res.json();
        const newStage = STATUS_TO_STAGE[data.status] ?? 0;
        setStage(currentStage => {
          if (newStage !== currentStage) {
            setPrevStage(currentStage);
            setLastUpdate(new Date(data.updatedAt));
            if (newStage === 1) { setPolling(false); }
            return newStage;
          }
          return currentStage;
        });
      } catch (err) { console.error("Poll error:", err); }
    };
    poll();
    intervalRef.current = setInterval(poll, 5000);
    return () => clearInterval(intervalRef.current);
  }, [orderId, polling]);

  const isReady = stage === 1;

  return (
    <>
      {/* Ready banner */}
      {isReady && (
        <div style={{ background:"#1A6B3A", borderRadius:12, padding:"16px 20px", marginBottom:20, textAlign:"center", animation:"fadeIn 0.5s ease" }}>
          <p style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:600, color:"#FFFFFF", marginBottom:4 }}>Your order is ready! 🎉</p>
          <p style={{ fontSize:14, color:"rgba(255,255,255,0.8)" }}>Head on in — we're waiting for you.</p>
        </div>
      )}

      {/* Review ask — shown once the customer has the food in hand, not before */}
      {isReady && (
        <div style={{ background:"#FAFAF5", borderRadius:14, border:"0.5px solid rgba(0,0,0,0.08)", padding:"16px 20px", marginBottom:20, textAlign:"center" }}>
          <p style={{ fontSize:13, color:"#8A7560", marginBottom:10 }}>Enjoying your meal? A quick review helps us more than you'd think.</p>
          {/* Real "Ask for reviews" short link from Google Business Profile —
              replaces the old writereview?placeid=... link, which 404'd. */}
          <a href="https://g.page/r/CXNevQ8KoPZSEBM/review" target="_blank" rel="noopener noreferrer"
            style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:12.5, fontWeight:700, color:"#C8853A", textDecoration:"none", border:"1px solid rgba(200,133,58,0.4)", borderRadius:20, padding:"9px 18px" }}>
            ⭐ Leave a Google Review
          </a>
        </div>
      )}

      {/* Progress track */}
      <div style={{ background:"#FFFFFF", borderRadius:16, border:"0.5px solid rgba(0,0,0,0.08)", boxShadow:"0 2px 20px rgba(0,0,0,0.06)", padding:"24px 20px", marginBottom:20 }}>

        {/* Section label */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
          <p style={{ fontSize:11, fontWeight:600, letterSpacing:"0.2em", textTransform:"uppercase", color:"#C8853A" }}>Live Order Status</p>
          {polling && (
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <div style={{ width:7, height:7, borderRadius:"50%", background:"#1A6B3A", boxShadow:"0 0 0 3px rgba(26,107,58,0.25)", animation:"livepulse 2s infinite" }} />
              <span style={{ fontSize:11, color:"#8A7560" }}>Live</span>
            </div>
          )}
        </div>

        {/* Steps */}
        <div style={{ position:"relative" }}>
          {/* Connector line */}
          <div style={{ position:"absolute", left:19, top:20, bottom:20, width:2, background:"#F0EBE1", zIndex:0 }} />
          {/* Progress fill */}
          <div style={{ position:"absolute", left:19, top:20, width:2, background:"#1A6B3A", zIndex:1,
            height: stage === 0 ? "0%" : stage === 1 ? "50%" : "100%",
            transition:"height 0.6s cubic-bezier(0.4,0,0.2,1)" }} />

          {STAGES.map((s, i) => {
            const done    = i < stage;
            const active  = i === stage;
            const pending = i > stage;
            return (
              <div key={s.key} style={{ display:"flex", alignItems:"flex-start", gap:16, marginBottom: i < STAGES.length-1 ? 28 : 0, position:"relative", zIndex:2 }}>
                {/* Icon */}
                <div style={{
                  width:40, height:40, borderRadius:"50%", flexShrink:0,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize: done ? 18 : active ? 20 : 16,
                  background: done ? "#1A6B3A" : active ? (isReady && i === 2 ? "#1A6B3A" : "#FFF3E8") : "#F0EBE1",
                  border: active && !done ? "2px solid #C8853A" : "2px solid transparent",
                  color: done ? "#FFFFFF" : active ? "#C8600A" : "#8A7560",
                  transition:"all 0.4s ease",
                  boxShadow: active ? "0 0 0 4px rgba(200,96,10,0.12)" : "none",
                }}>
                  {done ? "✓" : s.icon}
                </div>
                {/* Text */}
                <div style={{ paddingTop:8, flex:1 }}>
                  <p style={{ fontSize:15, fontWeight: active || done ? 700 : 500, color: pending ? "#8A7560" : "#0F0800", marginBottom:3, transition:"color 0.3s" }}>
                    {s.label}
                  </p>
                  {(active || done) && (
                    <p style={{ fontSize:13, color:"#8A7560", lineHeight:1.5, animation:"fadeIn 0.4s ease" }}>
                      {done && i < stage ? "Done" : s.desc}
                    </p>
                  )}
                </div>
                {/* Active pulse ring on icon */}
                {active && !done && (
                  <div style={{ position:"absolute", left:0, top:0, width:40, height:40, borderRadius:"50%", border:"2px solid #C8853A", animation:"ripple 1.8s infinite", opacity:0 }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Last update */}
        {lastUpdate && (
          <p style={{ fontSize:11, color:"#8A7560", textAlign:"center", marginTop:20, paddingTop:16, borderTop:"0.5px solid rgba(0,0,0,0.07)" }}>
            Updated {lastUpdate.toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit", second:"2-digit" })}
          </p>
        )}
      </div>
    </>
  );
}

function ReferralCard({ referralCode }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    const inviteLink = `https://ranimahal.cc/order?invite=${referralCode}`;
    navigator.clipboard.writeText(inviteLink)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      })
      .catch(() => {});
  };

  return (
    <div style={{
      background: "#FAFAF5",
      borderRadius: 16,
      border: "0.5px solid rgba(0,0,0,0.08)",
      padding: "20px 22px",
      marginBottom: 20,
      boxShadow: "0 2px 20px rgba(0,0,0,0.04)"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 20 }}>🎉</span>
        <h4 style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 600, color: "#0F0800", margin: 0 }}>
          Share the Feast & Save 10%
        </h4>
      </div>
      <p style={{ fontSize: 13, color: "#8A7560", marginBottom: 14, lineHeight: 1.55 }}>
        Send your friends a <strong>10% discount</strong> on their first order. Once they order, we'll automatically email you a <strong>10% off voucher</strong> for your next visit — no need to track anything.
      </p>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <button
          onClick={handleCopy}
          style={{
            padding: "11px 22px",
            background: "#0F0800",
            color: "#F5E6C8",
            border: "none",
            borderRadius: 24,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "'Inter',sans-serif",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            transition: "transform 0.1s ease"
          }}
          onMouseEnter={e => e.currentTarget.style.transform = "scale(1.02)"}
          onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
        >
          <span>{copied ? "Link Copied! ✓" : "Copy Invite Link 🔗"}</span>
        </button>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────
export default function OrderSuccess() {
  const [order, setOrder]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Instantly clear saved cart from localStorage on successful order
    try {
      localStorage.removeItem("rani_cart_v1");
    } catch {}

    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");

    if (!sessionId) {
      // No session ID — nothing to show
      setLoading(false);
      return;
    }

    fetch(`/api/orders?session_id=${sessionId}`)
      .then(r => { if (!r.ok) throw new Error("Not found"); return r.json(); })
      .then(data => {
        setOrder(data);
        setLoading(false);
        trackEvent("purchase", {
          transaction_id: data.id,
          currency: "USD",
          value: data.total,
          items: (data.items || []).map(i => ({ item_id: i.baseId, item_name: i.name, quantity: i.qty, price: i.price })),
        });
      })
      .catch(() => { setLoading(false); });
  }, []);

  if (loading) return (
    <div style={{ minHeight:"100vh", background:"#FFFDF9", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Inter',sans-serif" }}>
      <style>{`@import url('${FONT_LINK}'); *{box-sizing:border-box;margin:0;padding:0}`}</style>
      <div style={{ textAlign:"center" }}>
        <div style={{ width:36, height:36, border:"3px solid #F0EBE1", borderTop:"3px solid #C8853A", borderRadius:"50%", margin:"0 auto 14px", animation:"spin 0.8s linear infinite" }} />
        <p style={{ color:"#8A7560", fontSize:14 }}>Loading your order…</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const fmtTime = iso => new Date(iso).toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit" });

  if (!order) return (
    <div style={{ minHeight:"100vh", background:"#FFFDF9", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Inter',sans-serif", textAlign:"center", padding:"2rem" }}>
      <div>
        <p style={{ fontFamily:"'Playfair Display',serif", fontSize:20, color:"#0F0800", marginBottom:8 }}>Order not found</p>
        <p style={{ fontSize:14, color:"#8A7560", marginBottom:16 }}>We couldn't load your order details.</p>
        <p style={{ fontSize:13, color:"#8A7560" }}>Questions? Call <a href="tel:9148359066" style={{ color:"#C8853A" }}>(914) 835-9066</a></p>
      </div>
    </div>
  );

  const firstName = (order.customerName ?? "").split(" ")[0] || "there";

  return (
    <div style={{ minHeight:"100vh", background:"#FFFDF9", fontFamily:"'Inter',sans-serif", position:"relative" }}>
      <style>{`
        @import url('${FONT_LINK}');
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:#FFFDF9}
        @keyframes spin    { to{transform:rotate(360deg)} }
        @keyframes fadeIn  { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
        @keyframes livepulse { 0%,100%{box-shadow:0 0 0 3px rgba(26,107,58,0.25)} 50%{box-shadow:0 0 0 6px rgba(26,107,58,0.1)} }
        @keyframes ripple  { 0%{transform:scale(1);opacity:0.6} 100%{transform:scale(1.8);opacity:0} }
      `}</style>

      <div style={{ position:"relative", zIndex:1, maxWidth:520, margin:"0 auto", padding:"36px 20px 60px" }}>

        {/* ── Hero ── */}
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <AnimatedCheck size={72} color="#1A6B3A" />
          <div style={{ marginTop:16, marginBottom:6 }}>
            <h1 style={{ fontFamily:"'Great Vibes',cursive", fontSize:48, color:"#0F0800", lineHeight:1 }}>Rani Mahal</h1>
          </div>
          <p style={{ fontFamily:"'Playfair Display',serif", fontSize:24, fontWeight:500, color:"#0F0800", marginBottom:8 }}>
            Thank you, {firstName}!
          </p>
          <p style={{ fontSize:14, color:"#8A7560", lineHeight:1.7 }}>
            Your order is confirmed.<br />
            A receipt was sent to <strong style={{ color:"#0F0800" }}>{order.customerEmail}</strong>.
          </p>
        </div>

        {/* ── Live tracker ── */}
        <LiveTracker orderId={order.id} initialStatus="new" />

        {/* ── Order summary ── */}
        <div style={{ background:"#FFFFFF", borderRadius:16, border:"0.5px solid rgba(0,0,0,0.08)", boxShadow:"0 2px 20px rgba(0,0,0,0.06)", overflow:"hidden", marginBottom:20 }}>

          <div style={{ background:"#0F0800", padding:"14px 20px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <p style={{ fontSize:10, fontWeight:500, letterSpacing:"0.2em", textTransform:"uppercase", color:"#C8853A", marginBottom:3 }}>Order</p>
              <p style={{ fontFamily:"'Playfair Display',serif", fontSize:18, color:"#F5E6C8", fontWeight:500 }}>#{order.id.slice(-6).toUpperCase()}</p>
            </div>
            <div style={{ textAlign:"right" }}>
              <p style={{ fontSize:10, fontWeight:500, letterSpacing:"0.2em", textTransform:"uppercase", color:"#C8853A", marginBottom:3 }}>Placed at</p>
              <p style={{ fontSize:16, color:"#F5E6C8", fontWeight:500 }}>{fmtTime(order.createdAt)}</p>
            </div>
          </div>

          <div style={{ padding:"4px 0" }}>
            {order.items.map((item, i) => (
              <div key={i} style={{ padding:"11px 20px", borderBottom: i < order.items.length-1 ? "0.5px solid rgba(0,0,0,0.06)" : "none", display:"flex", alignItems:"center", gap:12 }}>
                <span style={{ width:26, height:26, borderRadius:"50%", background:"#F0EBE1", color:"#0F0800", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, flexShrink:0 }}>{item.qty}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontFamily:"'Lora',serif", fontSize:15, fontWeight:500, color:"#0F0800" }}>{item.name}</p>
                  <div style={{ display:"flex", gap:6, marginTop: item.spice || item.note ? 3 : 0 }}>
                    {item.spice && <span style={{ fontSize:11, fontWeight:600, color:"#C8853A", textTransform:"uppercase", letterSpacing:"0.05em" }}>{item.spice}</span>}
                    {item.note  && <span style={{ fontSize:11, color:"#8A7560", fontStyle:"italic" }}>· {item.note}</span>}
                  </div>
                </div>
                <span style={{ fontSize:14, fontWeight:600, color:"#0F0800", flexShrink:0 }}>{fmt(item.price * item.qty)}</span>
              </div>
            ))}
          </div>

          {order.specialInstructions && (
            <div style={{ margin:"0 20px 12px", padding:"10px 14px", background:"#FEF3E8", borderRadius:8, borderLeft:"3px solid #C8853A", fontSize:13, color:"#0F0800" }}>
              <strong>Note: </strong>{order.specialInstructions}
            </div>
          )}

          <div style={{ padding:"12px 20px", borderTop:"0.5px solid rgba(0,0,0,0.08)", background:"#FAFAF5" }}>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, color:"#8A7560", marginBottom:4 }}>
              <span>Subtotal</span><span>{fmt(order.subtotal)}</span>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, color:"#8A7560", marginBottom:8 }}>
              <span>Tax (8.375%)</span><span>{fmt(order.tax)}</span>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:17, fontWeight:700, color:"#0F0800", paddingTop:8, borderTop:"0.5px solid rgba(0,0,0,0.1)" }}>
              <span>Total paid</span>
              <span style={{ color:"#C8853A" }}>{fmt(order.total)}</span>
            </div>
          </div>
        </div>

        {/* ── Account Save / Claim Card ── */}
        <AccountClaimCard email={order.customerEmail} />

        {/* ── Viral Referral Card ── */}
        {order.shareCode && <ReferralCard referralCode={order.shareCode} />}

        {/* ── Footer CTA ── */}
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <p style={{ fontSize:13, color:"#8A7560", marginBottom:16 }}>
            Questions? Call us at{" "}
            <a href="tel:9148359066" style={{ color:"#C8853A", fontWeight:600 }}>(914) 835-9066</a>
          </p>
          <a href="/" style={{ display:"inline-block", padding:"13px 32px", background:"#0F0800", color:"#F5E6C8", borderRadius:30, fontSize:14, fontWeight:500, textDecoration:"none", letterSpacing:"0.04em" }}>
            Back to menu
          </a>
        </div>

        {/* ── Restaurant footer ── */}
        <div style={{ textAlign:"center", paddingTop:24, borderTop:"0.5px solid rgba(0,0,0,0.08)" }}>
          <p style={{ fontFamily:"'Great Vibes',cursive", fontSize:28, color:"#C8853A", marginBottom:4 }}>Rani Mahal</p>
          <p style={{ fontSize:12, color:"#8A7560", letterSpacing:"0.06em" }}>327 Mamaroneck Avenue · Mamaroneck, NY 10543</p>
        </div>

      </div>
    </div>
  );
}
