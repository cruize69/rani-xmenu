// AccountPortal.jsx
// Standalone account page — order history + favourites + one-tap reorder.
// Rendered by RaniMahal.jsx in place of the menu when the customer taps "Account".
//
// Auth: Clerk (https://clerk.com) — main.jsx mounts <ClerkProvider> only
// when VITE_CLERK_PUBLISHABLE_KEY is set, so this file never calls Clerk's
// hooks unconditionally (they throw outside a provider): AccountPortalPage
// below takes auth as plain props, and the two thin wrapper components at
// the bottom decide which auth source to pass in — only one of them ever
// mounts, and only the enabled one touches real Clerk hooks.
//
// Guests (no Clerk session) are looked up by the email they used at checkout —
// RaniMahal.jsx passes that in as `guestEmail`, sourced from localStorage.

import { useState, useEffect } from "react";
import { useUser, useAuth, useClerk } from "@clerk/clerk-react";

const CLERK_ENABLED = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

const FONT_LINK = "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..600;1,9..144,400..500&family=Great+Vibes&family=Inter:wght@300;400;500;600&display=swap";

const fmt     = n   => "$" + Number(n ?? 0).toFixed(2);
const fmtDate = iso => iso ? new Date(iso).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" }) : "—";

// ── Shared styles — same dark palette as RaniMahal.jsx ─────────────
const S = {
  card:      { background:"#12100e", border:"0.5px solid rgba(250,246,239,0.1)", borderRadius:14, padding:"1rem 1.25rem", marginBottom:10 },
  label:     { fontSize:11, fontWeight:600, letterSpacing:"0.15em", textTransform:"uppercase", color:"#B8A995", marginBottom:5, display:"block" },
  input:     { display:"block", width:"100%", padding:"10px 14px", border:"1px solid rgba(250,246,239,0.12)", borderRadius:10, fontSize:14, color:"#FAF6EF", background:"#1c1814", outline:"none", fontFamily:"'Inter',sans-serif", marginBottom:12, boxSizing:"border-box" },
  btnGold:   { width:"100%", padding:"12px 16px", background:"#E8A82E", color:"#080706", border:"none", borderRadius:10, fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"'Inter',sans-serif" },
  btnOutline:{ width:"100%", padding:"12px 16px", background:"transparent", color:"#FAF6EF", border:"1px solid rgba(250,246,239,0.15)", borderRadius:10, fontSize:14, fontWeight:500, cursor:"pointer", fontFamily:"'Inter',sans-serif" },
  divider:   { border:"none", borderTop:"0.5px solid rgba(250,246,239,0.08)", margin:"14px 0" },
  pill:      (bg, color, border) => ({ display:"inline-flex", alignItems:"center", gap:4, fontSize:11, fontWeight:500, padding:"3px 10px", borderRadius:20, background:bg, color, border:`0.5px solid ${border}` }),
};

// ── Order card ────────────────────────────────────────────────────
function OrderCard({ order, onReorder }) {
  const [expanded, setExpanded] = useState(false);
  const statusConfig = {
    new:         { label:"Received",    ...S.pill("rgba(232,168,46,0.14)","#E8A82E","rgba(232,168,46,0.3)") },
    in_progress: { label:"Being made",  ...S.pill("rgba(127,190,107,0.14)","#9CD684","rgba(127,190,107,0.3)") },
    done:        { label:"Complete",    ...S.pill("rgba(127,190,107,0.14)","#9CD684","rgba(127,190,107,0.3)") },
    refunded:    { label:"Refunded",    ...S.pill("rgba(217,72,44,0.14)","#F0846A","rgba(217,72,44,0.3)") },
  };
  const sc = statusConfig[order.status] ?? statusConfig.done;
  const spiceColor = { Mild:"#B8A995", Medium:"#E8A82E", Spicy:"#F0846A" };
  const spiceBg    = { Mild:"rgba(184,169,149,0.14)", Medium:"rgba(232,168,46,0.14)", Spicy:"rgba(217,72,44,0.14)" };

  return (
    <div style={S.card}>
      {/* Header */}
      <div onClick={() => setExpanded(e => !e)} style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", cursor:"pointer", gap:10 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:5 }}>
            <span style={{ ...sc, fontSize:11, fontWeight:500, padding:"3px 10px", borderRadius:20, display:"inline-flex", alignItems:"center", gap:4 }}>
              {order.status === "done" ? "✓ " : ""}{sc.label}
            </span>
          </div>
          <p style={{ fontSize:12, color:"#B8A995", margin:0 }}>
            {fmtDate(order.createdAt)} · #{order.id.slice(-6).toUpperCase()}
          </p>
          {!expanded && (
            <p style={{ fontSize:13, color:"#FAF6EF", marginTop:5, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {order.items.map(i => i.name).join(", ")}
            </p>
          )}
        </div>
        <span style={{ fontSize:16, color:"#B8A995", transition:"transform 0.2s", transform: expanded ? "rotate(180deg)" : "none", flexShrink:0, marginTop:2 }}>⌄</span>
      </div>

      {/* Expanded items */}
      {expanded && (
        <div style={{ marginTop:12 }}>
          <hr style={S.divider} />
          {order.items.map((item, i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"6px 0", borderBottom: i < order.items.length-1 ? "0.5px solid rgba(250,246,239,0.06)" : "none", gap:10 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, flex:1, minWidth:0 }}>
                <span style={{ fontSize:12, color:"#B8A995", flexShrink:0 }}>{item.qty}×</span>
                <span style={{ fontSize:13, fontWeight:500, color: order.status === "refunded" ? "#B8A995" : "#FAF6EF", textDecoration: order.status === "refunded" ? "line-through" : "none", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {item.name}
                </span>
              </div>
              {item.spice && (
                <span style={{ fontSize:11, fontWeight:500, padding:"2px 8px", borderRadius:20, background: spiceBg[item.spice] ?? "rgba(250,246,239,0.08)", color: spiceColor[item.spice] ?? "#B8A995", border:`0.5px solid ${spiceColor[item.spice] ?? "#B8A995"}55`, flexShrink:0 }}>
                  {item.spice}
                </span>
              )}
            </div>
          ))}
          {order.specialInstructions && (
            <div style={{ marginTop:8, padding:"8px 12px", background:"rgba(232,168,46,0.08)", borderRadius:8, fontSize:12, color:"#FAF6EF", borderLeft:"3px solid #E8A82E" }}>
              <strong style={{ fontWeight:500 }}>Note: </strong>{order.specialInstructions}
            </div>
          )}
          <button onClick={() => onReorder(order)} style={{ ...S.btnOutline, marginTop:12, borderColor:"rgba(232,168,46,0.4)", color:"#E8A82E" }}>
            Reorder this
          </button>
        </div>
      )}
    </div>
  );
}

// ── Account portal ────────────────────────────────────────────────
// isSignedIn / getToken / signOut arrive as props — see the file header for
// why this component has no direct Clerk dependency of its own.
function AccountPortalPage({ guestEmail, onStartOrder, onReorder, isSignedIn, getToken, signOut }) {
  const [tab,     setTab]     = useState("history");
  const [profile, setProfile] = useState(null);
  const [status,  setStatus]  = useState("loading"); // loading | ready | signed-out | error

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const token = isSignedIn ? await getToken() : null;

      if (!token && !guestEmail) {
        if (!cancelled) setStatus("signed-out");
        return;
      }

      const headers = { "Content-Type":"application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const url = token ? "/api/account/profile" : `/api/account/profile?email=${encodeURIComponent(guestEmail)}`;

      try {
        const r = await fetch(url, { headers });
        if (!r.ok) throw new Error("Not found");
        const data = await r.json();
        if (!cancelled) { setProfile(data); setStatus("ready"); }
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => { cancelled = true; };
  }, [guestEmail, isSignedIn]);

  if (status === "loading") return (
    <div style={{ minHeight:"100vh", background:"#080706", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ width:32, height:32, border:"3px solid #1c1814", borderTop:"3px solid #E8A82E", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (status === "signed-out" || status === "error" || !profile) return (
    <div style={{ minHeight:"100vh", background:"#080706", display:"flex", alignItems:"center", justifyContent:"center", padding:"1.5rem" }}>
      <div style={{ ...S.card, maxWidth:360, width:"100%", textAlign:"center" }}>
        <p style={{ fontFamily:"'Fraunces',serif", fontSize:20, color:"#FAF6EF", marginBottom:8 }}>No order history yet</p>
        <p style={{ fontSize:13, color:"#B8A995", marginBottom:18, lineHeight:1.55 }}>
          {status === "error"
            ? "We couldn't load your account right now."
            : "Sign in, or check out as a guest once, and your orders and favourites will show up here."}
        </p>
        <button onClick={onStartOrder} style={S.btnGold}>Start an order</button>
      </div>
    </div>
  );

  const maxCount = profile.favourites[0]?.count ?? 1;

  return (
    <div style={{ background:"#080706", minHeight:"100vh", fontFamily:"'Inter',sans-serif", color:"#FAF6EF" }}>
      <style>{`@import url('${FONT_LINK}'); *{box-sizing:border-box}`}</style>

      {/* Header */}
      <header style={{ background:"#080706", borderBottom:"0.5px solid rgba(250,246,239,0.08)", padding:"14px 20px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <p style={{ fontFamily:"'Great Vibes',cursive", fontSize:24, color:"#FAF6EF", margin:0, lineHeight:1 }}>Rani Mahal</p>
          <p style={{ fontSize:10, color:"#E8A82E", letterSpacing:"0.18em", textTransform:"uppercase", margin:"3px 0 0" }}>Your account</p>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <button onClick={onStartOrder} style={{ background:"transparent", border:"0.5px solid rgba(250,246,239,0.15)", color:"#FAF6EF", fontSize:12, padding:"6px 12px", borderRadius:8, cursor:"pointer", fontFamily:"'Inter',sans-serif" }}>
            ← Menu
          </button>
          {isSignedIn && (
            <button onClick={() => signOut()} style={{ background:"transparent", border:"0.5px solid rgba(232,168,46,0.3)", color:"#E8A82E", fontSize:12, padding:"6px 12px", borderRadius:8, cursor:"pointer", fontFamily:"'Inter',sans-serif" }}>
              Sign out
            </button>
          )}
        </div>
      </header>

      <div style={{ maxWidth:540, margin:"0 auto", padding:"16px 14px 60px" }}>

        {/* Profile row */}
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
          <div style={{ width:44, height:44, borderRadius:"50%", background:"rgba(232,168,46,0.14)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, fontWeight:500, color:"#E8A82E", flexShrink:0 }}>
            {(profile.profile?.name ?? profile.profile?.email ?? "?").split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase()}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <p style={{ fontSize:16, fontWeight:500, color:"#FAF6EF", margin:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {profile.profile?.name ?? profile.profile?.email ?? "Guest"}
            </p>
            <p style={{ fontSize:12, color:"#B8A995", margin:0 }}>Member since {fmtDate(profile.stats?.memberSince)}</p>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(2,minmax(0,1fr))", gap:10, marginBottom:12 }}>
          {[
            { val: profile.stats?.totalOrders ?? 0, label:"Total orders" },
            { val: `${profile.favourites[0]?.count ?? 0}×`, label: profile.favourites[0]?.name ?? "No orders yet" },
            { val: profile.stats?.topSpice ?? "—", label:"Preferred heat" },
            { val: fmtDate(profile.stats?.memberSince).split(",")[0] ?? "—", label:"First order" },
          ].map(({ val, label }) => (
            <div key={label} style={{ ...S.card, margin:0, textAlign:"center", padding:"14px 10px" }}>
              <p style={{ fontSize:22, fontWeight:500, color:"#FAF6EF", margin:"0 0 4px", lineHeight:1 }}>{val}</p>
              <p style={{ fontSize:11, color:"#B8A995", margin:0, letterSpacing:"0.03em", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", gap:6, marginBottom:14 }}>
          {[["history","Orders"],["favourites","Favourites"]].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              style={{ padding:"8px 18px", borderRadius:20, border:"none", fontSize:12, fontWeight:600, cursor:"pointer", background: tab===key ? "#E8A82E" : "#1c1814", color: tab===key ? "#080706" : "#B8A995", fontFamily:"'Inter',sans-serif" }}>
              {label}
            </button>
          ))}
        </div>

        {/* Order history */}
        {tab === "history" && (
          profile.orders.length === 0 ? (
            <div style={{ ...S.card, textAlign:"center", padding:"2.5rem", color:"#B8A995", fontSize:14 }}>
              No orders yet. <button onClick={onStartOrder} style={{ background:"transparent", border:"none", color:"#E8A82E", cursor:"pointer", fontSize:14, fontWeight:500, padding:0 }}>Place your first order →</button>
            </div>
          ) : (
            profile.orders.map(order => (
              <OrderCard key={order.id} order={order} onReorder={onReorder} />
            ))
          )
        )}

        {/* Favourites */}
        {tab === "favourites" && (
          profile.favourites.length === 0 ? (
            <div style={{ ...S.card, textAlign:"center", padding:"2.5rem", color:"#B8A995", fontSize:14 }}>
              Order a few times and your favourites will show up here.
            </div>
          ) : (
            <div style={S.card}>
              <p style={{ fontSize:11, fontWeight:600, letterSpacing:"0.15em", textTransform:"uppercase", color:"#B8A995", marginBottom:14 }}>Your most ordered</p>
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                {profile.favourites.map(fav => (
                  <div key={fav.name} style={{ display:"flex", alignItems:"center", gap:12 }}>
                    <span style={{ fontSize:13, fontWeight:600, color:"#E8A82E", width:24, textAlign:"right", flexShrink:0 }}>{fav.count}×</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:14, fontWeight:500, color:"#FAF6EF", margin:"0 0 4px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{fav.name}</p>
                      <div style={{ height:4, borderRadius:2, background:"#1c1814" }}>
                        <div style={{ height:"100%", borderRadius:2, background:"#E8A82E", width:`${(fav.count/maxCount)*100}%`, transition:"width 0.4s ease" }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {profile.orders[0] && (
                <>
                  <hr style={{ ...S.divider, margin:"16px 0 12px" }} />
                  <div style={{ textAlign:"center" }}>
                    <p style={{ fontSize:13, color:"#B8A995", marginBottom:10 }}>Order your usual in one tap</p>
                    <button onClick={() => onReorder(profile.orders[0])} style={{ ...S.btnGold, width:"auto", padding:"10px 24px", borderRadius:24 }}>
                      Reorder last order
                    </button>
                  </div>
                </>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ── Root export ────────────────────────────────────────────────────
// Only one of these two ever mounts, chosen by a plain constant check
// (not a hook), so calling real Clerk hooks stays safe either way.
function ClerkAwareAccountPortal(props) {
  const { isSignedIn } = useUser();
  const { getToken }   = useAuth();
  const { signOut }    = useClerk();
  return <AccountPortalPage {...props} isSignedIn={isSignedIn} getToken={getToken} signOut={signOut} />;
}

function GuestOnlyAccountPortal(props) {
  return <AccountPortalPage {...props} isSignedIn={false} getToken={async () => null} signOut={async () => {}} />;
}

export default function AccountPortal({ guestEmail = null, onStartOrder = () => {}, onReorder = () => {} }) {
  const props = { guestEmail, onStartOrder, onReorder };
  return CLERK_ENABLED ? <ClerkAwareAccountPortal {...props} /> : <GuestOnlyAccountPortal {...props} />;
}
