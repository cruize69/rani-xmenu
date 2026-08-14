// AccountPortal.jsx — Fresh Rebuild
// Luxury Standalone Account & Order History Portal for Rani Mahal.

import { useState, useEffect, useRef } from "react";
import { useUser, useAuth, useClerk } from "@clerk/clerk-react";
import { PickupIcon, DeliveryIcon } from "./src/components/FulfillmentSheet.jsx";

const CLERK_ENABLED = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const FONT_LINK = "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..600;1,9..144,400..500&family=Great+Vibes&family=Inter:wght@300;400;500;600&display=swap";

const fmt = n => "$" + Number(n ?? 0).toFixed(2);
const fmtDate = iso => iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

// ── Luxury Theme Tokens ─────────────────────────────────────────────
const S = {
  card: { background: "#12100e", border: "0.5px solid rgba(250,246,239,0.1)", borderRadius: 16, padding: "1.25rem 1.5rem", marginBottom: 12 },
  label: { fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#B8A995", marginBottom: 6, display: "block" },
  input: { display: "block", width: "100%", padding: "11px 14px", border: "1px solid rgba(250,246,239,0.12)", borderRadius: 10, fontSize: 14, color: "#FAF6EF", background: "#1c1814", outline: "none", fontFamily: "'Inter',sans-serif", boxSizing: "border-box" },
  btnGold: { width: "100%", padding: "12px 18px", background: "#E8A82E", color: "#080706", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter',sans-serif", transition: "opacity 0.15s ease" },
  btnOutline: { width: "100%", padding: "12px 18px", background: "transparent", color: "#FAF6EF", border: "1px solid rgba(250,246,239,0.18)", borderRadius: 10, fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "'Inter',sans-serif", transition: "all 0.15s ease" },
  pill: (bg, color, border) => ({ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 20, background: bg, color, border: `0.5px solid ${border}` }),
};

// ── Item Thumbnail ──────────────────────────────────────────────────
function ItemThumb({ imageUrl, size = 68, alt = "" }) {
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: 14,
      flexShrink: 0,
      overflow: "hidden",
      background: "#1c1814",
      border: "2px solid #181410",
      boxShadow: "0 6px 16px rgba(0,0,0,0.65), 0 0 10px rgba(232,168,46,0.15)",
      backgroundImage: imageUrl ? `url(${imageUrl})` : "none",
      backgroundSize: "cover",
      backgroundPosition: "center"
    }}>
      {!imageUrl && (
        <div style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, rgba(232,168,46,0.12) 0%, rgba(28,24,20,0.8) 100%)",
          color: "#E8A82E",
          fontSize: size * 0.4
        }}>
          🍲
        </div>
      )}
    </div>
  );
}

// ── Order Card Component ───────────────────────────────────────────
function OrderCard({ order, onReorder, cloudImages }) {
  const [expanded, setExpanded] = useState(false);
  const statusConfig = {
    new:         { label: "Received",    ...S.pill("rgba(232,168,46,0.14)", "#E8A82E", "rgba(232,168,46,0.3)") },
    in_progress: { label: "Being Made",  ...S.pill("rgba(127,190,107,0.14)", "#9CD684", "rgba(127,190,107,0.3)") },
    done:        { label: "Completed",   ...S.pill("rgba(127,190,107,0.14)", "#9CD684", "rgba(127,190,107,0.3)") },
    refunded:    { label: "Refunded",    ...S.pill("rgba(217,72,44,0.14)", "#F0846A", "rgba(217,72,44,0.3)") },
  };
  const sc = statusConfig[order.status] ?? statusConfig.done;

  return (
    <div style={{ ...S.card, padding: "1.25rem 1.4rem" }}>
      <div onClick={() => setExpanded(e => !e)} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", cursor: "pointer", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
            <span style={sc}>{order.status === "done" ? "✓ " : ""}{sc.label}</span>
            <span style={{ fontSize: 11, color: "#E8A82E", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5 }}>
              {order.orderMode === "delivery" ? (
                <DeliveryIcon size={14} color="#E8A82E" />
              ) : (
                <PickupIcon size={14} color="#E8A82E" />
              )}
              <span>{order.orderMode === "delivery" ? "Delivery" : "Pickup"}</span>
            </span>
          </div>
          <p style={{ fontSize: 12, color: "#B8A995", margin: 0, fontWeight: 500 }}>
            {fmtDate(order.createdAt)} · #{order.id.slice(-6).toUpperCase()}
          </p>
          
          {/* Prominent High-Visibility Deck of Cards Image Previews */}
          {!expanded && (
            <div style={{ display: "flex", alignItems: "center", marginTop: 12, paddingLeft: 4, height: 72 }}>
              {order.items.slice(0, 4).map((item, i) => (
                <div
                  key={i}
                  style={{
                    position: "relative",
                    marginLeft: i === 0 ? 0 : -26,
                    zIndex: 10 - i,
                    transition: "transform 0.2s ease",
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = "translateY(-4px) scale(1.05)"}
                  onMouseLeave={e => e.currentTarget.style.transform = "translateY(0) scale(1)"}
                >
                  <ItemThumb imageUrl={item.baseId ? cloudImages?.[item.baseId] : null} size={68} />
                  {item.qty > 1 && (
                    <span style={{
                      position: "absolute",
                      top: -4,
                      right: -4,
                      background: "linear-gradient(135deg, #E8A82E 0%, #B87A14 100%)",
                      color: "#080706",
                      fontSize: 10.5,
                      fontWeight: 800,
                      borderRadius: 10,
                      padding: "2px 6px",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.8)",
                      border: "1px solid rgba(8,7,6,0.6)",
                      zIndex: 20,
                    }}>
                      ×{item.qty}
                    </span>
                  )}
                </div>
              ))}
              {order.items.length > 4 && (
                <div style={{
                  marginLeft: -26,
                  zIndex: 5,
                  width: 68,
                  height: 68,
                  borderRadius: 14,
                  background: "linear-gradient(135deg, rgba(232,168,46,0.25) 0%, rgba(18,16,14,0.95) 100%)",
                  border: "2px solid #E8A82E",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.7)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#E8A82E",
                  flexShrink: 0,
                }}>
                  <span style={{ fontSize: 15, fontWeight: 800, lineHeight: 1 }}>+{order.items.length - 4}</span>
                  <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>more</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <p style={{ fontFamily: "'Fraunces',serif", fontSize: 17, color: "#FAF6EF", margin: 0, fontWeight: 600 }}>
            {fmt(order.total)}
          </p>
          <span style={{ fontSize: 11.5, color: "#E8A82E", fontWeight: 500, display: "block", marginTop: 4 }}>
            {expanded ? "Collapse ▲" : "View Details ▼"}
          </span>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: "0.5px solid rgba(250,246,239,0.1)", marginTop: 14, paddingTop: 14 }}>
          {/* Expanded Item Breakdown with Large Food Previews */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
            {order.items.map((item, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "rgba(250,246,239,0.02)", padding: "8px 10px", borderRadius: 12, border: "0.5px solid rgba(250,246,239,0.06)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                  <ItemThumb imageUrl={item.baseId ? cloudImages?.[item.baseId] : null} size={46} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ fontSize: 13.5, fontWeight: 600, color: "#FAF6EF", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.qty}× {item.name}
                    </p>
                    {(item.spice || item.note) && (
                      <p style={{ fontSize: 11, color: "#E8A82E", margin: "2px 0 0" }}>
                        {[item.spice ? `Spice: ${item.spice}` : null, item.note].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                </div>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: "#FAF6EF", flexShrink: 0 }}>
                  {fmt(item.price * item.qty)}
                </span>
              </div>
            ))}
          </div>

          <button onClick={() => onReorder(order)} style={{ ...S.btnGold, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px 18px", fontSize: 13.5 }}>
            <span>⚡ Reorder These Items</span>
            <span>({fmt(order.total)}) →</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ── Primary Account Portal Page Component ──────────────────────────
function AccountPortalPage({
  onStartOrder,
  onReorder,
  cloudImages,
  isSignedIn,
  getToken,
  signOut,
  openSignIn,
}) {
  const [profile, setProfile] = useState(null);
  const [status, setStatus] = useState(() => (isSignedIn ? "loading" : "signed-out"));

  // Order history is only ever shown for a verified signed-in account — a
  // bare guest email is not proof of identity, so there's no server-side
  // lookup-by-email path anymore (see api/account/profile.js). Guests still
  // get their order confirmation email with a live tracking link; they just
  // don't get a browsable history without creating an account.
  useEffect(() => {
    let active = true;

    async function loadAccount() {
      if (!isSignedIn) { if (active) setStatus("signed-out"); return; }
      const token = await getToken();
      if (!token) { if (active) setStatus("signed-out"); return; }

      const fetchPromise = fetch("/api/account/profile", {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 1500));

      try {
        const res = await Promise.race([fetchPromise, timeoutPromise]);
        if (res && res.ok) {
          const data = await res.json();
          if (active) {
            setProfile(data);
            setStatus(data?.orders?.length > 0 ? "ready" : "not-found");
          }
        } else {
          if (active) {
            setProfile({ profile: {}, orders: [], favorites: [] });
            setStatus("not-found");
          }
        }
      } catch {
        if (active) {
          setProfile({ profile: {}, orders: [], favorites: [] });
          setStatus("not-found");
        }
      }
    }

    loadAccount();
    return () => { active = false; };
  }, [isSignedIn, getToken]);

  const activeEmail = profile?.profile?.email || "";

  // ── 1. Loading Spinner View ──────────────────────────────────────
  if (status === "loading") {
    return (
      <div style={{ minHeight: "100vh", background: "radial-gradient(ellipse at 50% 0%, #1c1814 0%, #100e0c 65%, #0a0807 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
        <div style={{ width: 36, height: 36, border: "3px solid #1c1814", borderTop: "3px solid #E8A82E", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <p style={{ fontSize: 13, color: "#B8A995" }}>Checking account & order history…</p>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  // ── 2. Signed Out — accounts only, no guest email lookup ───────
  if (status === "signed-out") {
    return (
      <div style={{ minHeight: "100vh", background: "radial-gradient(ellipse at 50% 0%, #1c1814 0%, #100e0c 65%, #0a0807 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem", fontFamily: "'Inter',sans-serif" }}>
        <style>{`@import url('${FONT_LINK}'); html,body{background:#080706 !important;color:#FAF6EF;margin:0;padding:0;min-height:100vh} *{box-sizing:border-box}`}</style>

        <div style={{ ...S.card, maxWidth: 420, width: "100%", padding: "2.25rem 1.75rem", marginBottom: 0, boxShadow: "0 20px 50px rgba(0,0,0,0.6)" }}>
          <div style={{ textAlign: "center", marginBottom: 22 }}>
            <img
              src="/logo/apsara-logo.png"
              alt="Rani Mahal Logo"
              style={{ width: 68, height: 68, objectFit: "contain", margin: "0 auto 14px", display: "block" }}
            />
            <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 22, color: "#FAF6EF", margin: 0, fontWeight: 500 }}>
              Sign In & Save 10%
            </h2>
            {/* Lead with the offer, not the opt-out. The previous copy ended
                on "no account needed", which talked people out of the very
                thing this screen exists to convert. */}
            <p style={{ fontSize: 13, color: "#B8A995", marginTop: 6, lineHeight: 1.55 }}>
              Your first signed-in order is <strong style={{ color: "#E8A82E" }}>10% off</strong>, then <strong style={{ color: "#E8A82E" }}>5% off every order</strong> after that — plus saved history and 1-tap reorders.
            </p>
          </div>

          {openSignIn && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 6 }}>
              <button
                onClick={() => openSignIn({ fallbackRedirectUrl: window.location.href })}
                style={{
                  padding: "12px 28px",
                  background: "#E8A82E",
                  color: "#080706",
                  border: "none",
                  borderRadius: 24,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "'Inter',sans-serif",
                  boxShadow: "0 4px 16px rgba(232,168,46,0.3)",
                  transition: "transform 0.15s ease",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
                onMouseEnter={e => e.currentTarget.style.transform = "scale(1.02)"}
                onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
              >
                <span>🔑 Sign In / Create Account</span>
              </button>
            </div>
          )}

          <div style={{ marginTop: 12, textAlign: "center" }}>
            <a href="/rewards" style={{ display: "block", fontSize: 12.5, color: "#E8A82E", textDecoration: "none", fontWeight: 600, marginBottom: 12 }}>
              How the Rani Royal Club works →
            </a>
            <button onClick={onStartOrder} style={{ background: "transparent", border: "none", color: "#B8A995", fontSize: 13, cursor: "pointer" }}>
              ← Return to Menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── 2b. Signed in, but no orders yet ────────────────────────────
  if (status === "not-found" || !profile || !profile.orders?.length) {
    return (
      <div style={{ minHeight: "100vh", background: "radial-gradient(ellipse at 50% 0%, #1c1814 0%, #100e0c 65%, #0a0807 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem", fontFamily: "'Inter',sans-serif" }}>
        <style>{`@import url('${FONT_LINK}'); html,body{background:#080706 !important;color:#FAF6EF;margin:0;padding:0;min-height:100vh} *{box-sizing:border-box}`}</style>

        <div style={{ ...S.card, maxWidth: 420, width: "100%", padding: "2.25rem 1.75rem", marginBottom: 0, boxShadow: "0 20px 50px rgba(0,0,0,0.6)", textAlign: "center" }}>
          <img
            src="/logo/apsara-logo.png"
            alt="Rani Mahal Logo"
            style={{ width: 68, height: 68, objectFit: "contain", margin: "0 auto 14px", display: "block" }}
          />
          <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 22, color: "#FAF6EF", margin: 0, fontWeight: 500 }}>
            No Orders Yet
          </h2>
          <p style={{ fontSize: 13, color: "#B8A995", marginTop: 6, marginBottom: 22, lineHeight: 1.55 }}>
            Once you place your first order, it'll show up here.
          </p>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <button
              onClick={onStartOrder}
              style={{ padding: "11px 24px", background: "#E8A82E", color: "#080706", border: "none", borderRadius: 24, fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter',sans-serif", boxShadow: "0 4px 14px rgba(232,168,46,0.25)" }}
            >
              Start an Order →
            </button>
            {isSignedIn && (
              <button onClick={() => signOut()} style={{ background: "transparent", border: "none", color: "#B8A995", fontSize: 12.5, cursor: "pointer" }}>
                🚪 Log Out
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── 3. Signed In / Ready View (Orders Found) ─────────────────────
  const activeOrder = profile.orders.find(o => o.status === "new" || o.status === "in_progress");
  const lastOrder   = profile.orders.find(o => o.id !== activeOrder?.id) ?? profile.orders[0] ?? null;

  // Calculate guest stats
  const totalOrders = profile.orders.length;
  const totalSpent = profile.orders.reduce((sum, o) => sum + (o.total || 0), 0);
  
  // Find favorite dish from history
  const itemCounts = {};
  profile.orders.forEach(o => {
    (o.items || []).forEach(i => {
      itemCounts[i.name] = (itemCounts[i.name] || 0) + (i.qty || 1);
    });
  });
  const favoriteDish = Object.entries(itemCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  return (
    <div style={{ background: "radial-gradient(ellipse at 50% 0%, #1c1814 0%, #100e0c 65%, #0a0807 100%)", minHeight: "100vh", fontFamily: "'Inter',sans-serif", color: "#FAF6EF" }}>
      <style>{`@import url('${FONT_LINK}'); html,body{background:#080706 !important;color:#FAF6EF;margin:0;padding:0;min-height:100vh} *{box-sizing:border-box}`}</style>

      {/* Portal Header */}
      <header style={{ background: "rgba(18,16,14,0.85)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderBottom: "0.5px solid rgba(250,246,239,0.08)", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img
            src="/logo/apsara-logo.png"
            alt="Rani Mahal Logo"
            style={{ width: 34, height: 34, objectFit: "contain" }}
          />
          <div>
            <p style={{ fontFamily: "'Great Vibes',cursive", fontSize: 24, color: "#FAF6EF", margin: 0, lineHeight: 1 }}>Rani Mahal</p>
            <p style={{ fontSize: 9.5, color: "#E8A82E", letterSpacing: "0.18em", textTransform: "uppercase", margin: "2px 0 0", fontWeight: 600 }}>Your Orders & Account</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={onStartOrder} style={{ background: "rgba(232,168,46,0.12)", border: "1px solid rgba(232,168,46,0.35)", color: "#E8A82E", fontSize: 12.5, fontWeight: 600, padding: "7px 14px", borderRadius: 20, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
            ← Back to Menu
          </button>
          {isSignedIn && (
            <button onClick={() => signOut()} style={{ background: "rgba(217,72,44,0.12)", border: "0.5px solid rgba(217,72,44,0.35)", color: "#F0846A", fontSize: 12, fontWeight: 600, padding: "7px 12px", borderRadius: 20, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
              🚪 Log Out
            </button>
          )}
        </div>
      </header>

      <div style={{ maxWidth: 540, margin: "0 auto", padding: "18px 14px 60px" }}>
        
        {/* User Identity & Account Actions Card */}
        <div style={{ ...S.card, marginBottom: 14, background: "linear-gradient(145deg, #181410 0%, #12100e 100%)", border: "1px solid rgba(232,168,46,0.2)", boxShadow: "0 10px 30px rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
            <div style={{ width: 46, height: 46, borderRadius: "50%", background: "linear-gradient(135deg, #E8A82E 0%, #B87A14 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "#080706", flexShrink: 0, boxShadow: "0 4px 12px rgba(232,168,46,0.3)" }}>
              {(profile.profile?.name ?? activeEmail ?? "?").split("@")[0].slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <p style={{ fontSize: 15, fontWeight: 600, color: "#FAF6EF", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {profile.profile?.name ?? activeEmail}
                </p>
                <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 12, background: "rgba(127,190,107,0.14)", color: "#9CD684", border: "0.5px solid rgba(127,190,107,0.3)" }}>
                  ✓ Account Verified
                </span>
              </div>
              <p style={{ fontSize: 12, color: "#B8A995", marginTop: 2, margin: 0 }}>
                {activeEmail ? activeEmail : `Member since ${fmtDate(profile.stats?.memberSince)}`}
              </p>
            </div>
          </div>

          <div style={{ flexShrink: 0 }}>
            <button onClick={() => signOut()} style={{ padding: "7px 13px", background: "rgba(217,72,44,0.12)", border: "0.5px solid rgba(217,72,44,0.35)", color: "#F0846A", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              🚪 Log Out
            </button>
          </div>
        </div>

        {/* Account Summary Stats Bar */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
          <div style={{ background: "#16120e", border: "0.5px solid rgba(250,246,239,0.08)", borderRadius: 14, padding: "10px 12px", textAlign: "center" }}>
            <p style={{ fontSize: 10, color: "#B8A995", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 2px", fontWeight: 600 }}>Total Orders</p>
            <p style={{ fontFamily: "'Fraunces',serif", fontSize: 18, color: "#FAF6EF", margin: 0, fontWeight: 600 }}>{totalOrders}</p>
          </div>
          <div style={{ background: "#16120e", border: "0.5px solid rgba(250,246,239,0.08)", borderRadius: 14, padding: "10px 12px", textAlign: "center" }}>
            <p style={{ fontSize: 10, color: "#B8A995", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 2px", fontWeight: 600 }}>Total Spent</p>
            <p style={{ fontFamily: "'Fraunces',serif", fontSize: 18, color: "#E8A82E", margin: 0, fontWeight: 600 }}>{fmt(totalSpent)}</p>
          </div>
          <div style={{ background: "#16120e", border: "0.5px solid rgba(250,246,239,0.08)", borderRadius: 14, padding: "10px 12px", textAlign: "center", minWidth: 0 }}>
            <p style={{ fontSize: 10, color: "#B8A995", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 2px", fontWeight: 600 }}>Top Dish</p>
            <p style={{ fontSize: 12.5, color: "#FAF6EF", margin: 0, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {favoriteDish || "—"}
            </p>
          </div>
        </div>

        {/* Rani Royal Club status. The old copy here was a progress bar
            counting toward a milestone voucher — that mechanic is gone (see
            api/create-checkout.js). There's no longer a "toward" to show:
            the standing 5% applies every order, so this is a status, not a
            progress indicator. totalOrders already reflects the change —
            it's the same field the server checks (via the account-orders
            list) to decide first-order eligibility, so this can't drift
            out of sync with what's actually applied at checkout. */}
        <div style={{ ...S.card, marginBottom: 16, background: "linear-gradient(145deg, #1c1610 0%, #12100e 100%)", border: "1px solid rgba(232,168,46,0.25)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 16 }}>👑</span>
            <p style={{ fontSize: 12.5, fontWeight: 700, color: "#E8A82E", margin: 0, letterSpacing: "0.04em" }}>Rani Royal Club</p>
          </div>
          <p style={{ fontSize: 12.5, color: "#D9CDBB", margin: 0, lineHeight: 1.5 }}>
            {totalOrders === 0
              ? <>Your first order gets <strong style={{ color: "#FAF6EF" }}>10% off</strong> automatically — you're already in.</>
              : <>You're a member — <strong style={{ color: "#FAF6EF" }}>5% off</strong> is applied automatically on every order, no minimum and nothing to track.</>}
          </p>
        </div>

        {/* Active Order Spotlight */}
        {activeOrder && (
          <div style={{ background: "rgba(232,168,46,0.08)", border: "1px solid rgba(232,168,46,0.35)", borderRadius: 16, padding: "14px 16px", marginBottom: 16, boxShadow: "0 6px 20px rgba(232,168,46,0.1)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "#E8A82E", color: "#080706", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {activeOrder.status === "in_progress" ? "🔥 Being Made" : "✓ Order Received"}
              </span>
              <span style={{ fontSize: 11, color: "#B8A995" }}>#{activeOrder.id.slice(-6).toUpperCase()}</span>
            </div>
            <p style={{ fontSize: 13.5, color: "#FAF6EF", margin: "0 0 6px", fontWeight: 500 }}>{activeOrder.items.map(i => `${i.qty}× ${i.name}`).join(", ")}</p>
            <p style={{ fontSize: 11.5, color: "#E8A82E", margin: 0, fontWeight: 500 }}>We'll text updates to your phone →</p>
          </div>
        )}

        {/* 1-Tap Reorder Spotlight Card */}
        {lastOrder && (
          <div style={{ ...S.card, marginBottom: 18, background: "linear-gradient(135deg, rgba(232,168,46,0.12) 0%, rgba(24,20,16,0.9) 100%)", border: "1px solid rgba(232,168,46,0.3)", padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ ...S.label, color: "#E8A82E", marginBottom: 4 }}>⚡ Instant 1-Tap Reorder</span>
                <p style={{ fontSize: 13.5, color: "#FAF6EF", margin: 0, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {lastOrder.items.map(i => `${i.qty}× ${i.name}`).join(", ")}
                </p>
                <p style={{ fontSize: 11.5, color: "#B8A995", marginTop: 2, margin: "2px 0 0" }}>
                  {fmtDate(lastOrder.createdAt)} · {fmt(lastOrder.total)}
                </p>
              </div>
              <button
                onClick={() => onReorder(lastOrder)}
                style={{
                  padding: "9px 16px",
                  background: "#E8A82E",
                  color: "#080706",
                  border: "none",
                  borderRadius: 20,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "'Inter',sans-serif",
                  boxShadow: "0 4px 14px rgba(232,168,46,0.3)",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                Reorder →
              </button>
            </div>
          </div>
        )}

        {/* Order History Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <p style={{ ...S.label, margin: 0 }}>Order History ({profile.orders.length})</p>
          <span style={{ fontSize: 11, color: "#B8A995" }}>Tap order to view details</span>
        </div>

        {/* Order History Cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {profile.orders.map(order => (
            <OrderCard key={order.id} order={order} onReorder={onReorder} cloudImages={cloudImages} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Root Wrappers ──────────────────────────────────────────────────
function ClerkAwareAccountPortal(props) {
  const { isSignedIn } = useUser();
  const { getToken }   = useAuth();
  const { signOut, openSignIn } = useClerk();
  return <AccountPortalPage {...props} isSignedIn={isSignedIn} getToken={getToken} signOut={signOut} openSignIn={openSignIn} />;
}

function GuestOnlyAccountPortal(props) {
  return <AccountPortalPage {...props} isSignedIn={false} getToken={async () => null} signOut={async () => {}} openSignIn={null} />;
}

export default function AccountPortal({
  onStartOrder = () => {},
  onReorder = () => {},
  cloudImages = {},
}) {
  const props = { onStartOrder, onReorder, cloudImages };
  return CLERK_ENABLED ? <ClerkAwareAccountPortal {...props} /> : <GuestOnlyAccountPortal {...props} />;
}
