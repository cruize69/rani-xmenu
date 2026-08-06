// AccountPortal.jsx
// Standalone account page — order history + favorites + one-tap reorder.
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
import { ITEM_MAP } from "./lib/menu.js";

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

// Small round thumbnail, shared by the collapsed item-stack and the
// expanded item rows — falls back to the same diagonal-stripe pattern used
// everywhere else in the app when a photo hasn't been uploaded yet.
function ItemThumb({ imageUrl, size, radius }) {
  return (
    <div style={{ width:size, height:size, borderRadius:radius, flexShrink:0, overflow:"hidden", background:"#1c1814", border:"1.5px solid #080706", backgroundImage: imageUrl ? `url(${imageUrl})` : "none", backgroundSize:"cover", backgroundPosition:"center" }}>
      {!imageUrl && <div style={{ width:"100%", height:"100%", background:"repeating-linear-gradient(135deg,rgba(232,168,46,0.08) 0px,rgba(232,168,46,0.08) 1px,transparent 1px,transparent 6px)" }} />}
    </div>
  );
}

// ── Order card ────────────────────────────────────────────────────
function OrderCard({ order, onReorder, cloudImages }) {
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
            <>
              <div style={{ display:"flex", marginTop:7 }}>
                {order.items.slice(0, 5).map((item, i) => (
                  <div key={i} style={{ marginLeft: i === 0 ? 0 : -8 }}>
                    <ItemThumb imageUrl={item.baseId ? cloudImages?.[item.baseId] : null} size={37} radius={9} />
                  </div>
                ))}
                {order.items.length > 5 && (
                  <div style={{ marginLeft:-8, width:37, height:37, borderRadius:9, flexShrink:0, background:"#1c1814", border:"1.5px solid #080706", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:600, color:"#B8A995" }}>
                    +{order.items.length - 5}
                  </div>
                )}
              </div>
              <p style={{ fontSize:13, color:"#FAF6EF", marginTop:6, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {order.items.map(i => i.name).join(", ")}
              </p>
            </>
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
              <div style={{ display:"flex", alignItems:"center", gap:9, flex:1, minWidth:0 }}>
                <ItemThumb imageUrl={item.baseId ? cloudImages?.[item.baseId] : null} size={44} radius={10} />
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

// ── Favorite card — photo, name, price, one-tap add ────────────────
function FavoriteCard({ fav, imageUrl, onQuickAdd }) {
  const item = ITEM_MAP[fav.baseId];
  const [added, setAdded] = useState(false);

  const handleAdd = () => {
    onQuickAdd?.(fav.baseId);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  };

  return (
    <div style={{ display:"flex", alignItems:"center", gap:12, background:"#12100e", border:"0.5px solid rgba(250,246,239,0.1)", borderRadius:14, padding:10 }}>
      <div style={{ width:64, height:64, borderRadius:10, flexShrink:0, overflow:"hidden", background:"#1c1814", backgroundImage: imageUrl ? `url(${imageUrl})` : "none", backgroundSize:"cover", backgroundPosition:"center" }}>
        {!imageUrl && <div style={{ width:"100%", height:"100%", background:"repeating-linear-gradient(135deg,rgba(232,168,46,0.08) 0px,rgba(232,168,46,0.08) 1px,transparent 1px,transparent 8px)" }} />}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ fontSize:14, fontWeight:500, color:"#FAF6EF", margin:"0 0 2px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{fav.name}</p>
        <p style={{ fontSize:12, color:"#B8A995", margin:0 }}>{item ? `${fmt(item.price)} · ` : ""}Ordered {fav.count}×</p>
      </div>
      {fav.baseId && (
        <button onClick={handleAdd} aria-label={`Add ${fav.name} to cart`}
          style={{ width:34, height:34, borderRadius:"50%", flexShrink:0, background: added ? "#E8A82E" : "rgba(232,168,46,0.14)", border:"1.5px solid #E8A82E", color: added ? "#080706" : "#E8A82E", fontSize:17, fontWeight:600, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", transition:"background 0.15s, color 0.15s" }}>
          {added ? "✓" : "+"}
        </button>
      )}
    </div>
  );
}

// ── Account portal ────────────────────────────────────────────────
// isSignedIn / getToken / signOut arrive as props — see the file header for
// why this component has no direct Clerk dependency of its own.
function AccountPortalPage({ guestEmail, onStartOrder, onReorder, onQuickAdd, cloudImages, isSignedIn, getToken, signOut }) {
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
            : "Sign in, or check out as a guest once, and your orders and favorites will show up here."}
        </p>
        <button onClick={onStartOrder} style={S.btnGold}>Start an order</button>
      </div>
    </div>
  );

  const activeOrder = profile.orders.find(o => o.status === "new" || o.status === "in_progress");
  // Most recent order that isn't the active one — so "previous order" means
  // the last thing they actually finished, not whatever's still cooking.
  const previousOrder = profile.orders.find(o => o.id !== activeOrder?.id) ?? null;
  const usualFav = profile.favorites[0];
  const reorderUsual = () => {
    if (!usualFav?.baseId) return;
    onReorder({ items: [{ baseId: usualFav.baseId, qty: 1, spice: null, note: "" }] });
  };

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

        {/* Active order — its own spotlight rather than mixed into history */}
        {activeOrder && (
          <div style={{ background:"rgba(232,168,46,0.08)", border:"1px solid rgba(232,168,46,0.3)", borderRadius:14, padding:"12px 14px", marginBottom:12 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
              <span style={{ fontSize:11, fontWeight:600, padding:"3px 10px", borderRadius:20, background:"#E8A82E", color:"#080706" }}>
                {activeOrder.status === "in_progress" ? "Being made" : "Received"}
              </span>
              <span style={{ fontSize:11, color:"#B8A995" }}>#{activeOrder.id.slice(-6).toUpperCase()}</span>
            </div>
            <p style={{ fontSize:13, color:"#FAF6EF", margin:"0 0 6px" }}>{activeOrder.items.map(i => i.name).join(", ")}</p>
            <p style={{ fontSize:11, color:"#E8A82E", margin:0 }}>We'll text you when it's ready →</p>
          </div>
        )}

        {/* Reorder shortcuts — the two things a returning customer wants
            most, one tap each, instead of buried behind the Favorites tab. */}
        {(usualFav?.baseId || previousOrder) && (
          <div style={{ display:"grid", gridTemplateColumns: (usualFav?.baseId && previousOrder) ? "repeat(2,minmax(0,1fr))" : "1fr", gap:8, marginBottom:16 }}>
            {usualFav?.baseId && (
              <button onClick={reorderUsual} style={{ ...S.btnGold, fontSize:13, lineHeight:1.3, padding:"12px 10px" }}>
                Reorder your usual
              </button>
            )}
            {previousOrder && (
              <button onClick={() => onReorder(previousOrder)} style={{ ...S.btnOutline, fontSize:13, lineHeight:1.3, padding:"12px 10px", borderColor:"rgba(232,168,46,0.4)", color:"#E8A82E" }}>
                Reorder your previous order
              </button>
            )}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display:"flex", gap:6, marginBottom:14 }}>
          {[["history","Orders"],["favorites","Favorites"]].map(([key, label]) => (
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
              <OrderCard key={order.id} order={order} onReorder={onReorder} cloudImages={cloudImages} />
            ))
          )
        )}

        {/* Favorites */}
        {tab === "favorites" && (
          profile.favorites.length === 0 ? (
            <div style={{ ...S.card, textAlign:"center", padding:"2.5rem", color:"#B8A995", fontSize:14 }}>
              Order a few times and your favorites will show up here.
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {profile.favorites.map(fav => (
                <FavoriteCard key={fav.name} fav={fav} imageUrl={fav.baseId ? cloudImages?.[fav.baseId] : null} onQuickAdd={onQuickAdd} />
              ))}
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

export default function AccountPortal({ guestEmail = null, onStartOrder = () => {}, onReorder = () => {}, onQuickAdd = () => {}, cloudImages = {} }) {
  const props = { guestEmail, onStartOrder, onReorder, onQuickAdd, cloudImages };
  return CLERK_ENABLED ? <ClerkAwareAccountPortal {...props} /> : <GuestOnlyAccountPortal {...props} />;
}
