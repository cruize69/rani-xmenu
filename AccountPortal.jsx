// AccountPortal.jsx — Fresh Rebuild
// Luxury Standalone Account & Order History Portal for Rani Mahal.

import { useState, useEffect, useRef } from "react";
import { useUser, useAuth, useClerk } from "@clerk/clerk-react";

const CLERK_ENABLED = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const FONT_LINK = "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..600;1,9..144,400..500&family=Great+Vibes&family=Inter:wght@300;400;500;600&display=swap";

const fmt = n => "$" + Number(n ?? 0).toFixed(2);
const fmtDate = iso => iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

const MOCK_PREVIEW_PROFILE = {
  profile: { name: "Rajesh Sharma", email: "rajesh.sharma@example.com" },
  stats: { memberSince: "2024-03-15T00:00:00.000Z", totalOrders: 14, topSpice: "Medium" },
  orders: [
    {
      id: "ord_rm8921a4",
      status: "in_progress",
      orderMode: "delivery",
      createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      total: 68.50,
      subtotal: 58.00,
      tax: 4.86,
      tip: 10.44,
      deliveryFee: 6.99,
      items: [
        { baseId: "mock_ctm", name: "Chicken Tikka Masala", qty: 2, price: 21.00 },
        { baseId: "mock_garlic_naan", name: "Garlic Naan", qty: 3, price: 4.50 },
        { baseId: "mock_mango_lassi", name: "Mango Lassi", qty: 2, price: 5.50 },
      ]
    },
    {
      id: "ord_rm7740b2",
      status: "done",
      orderMode: "pickup",
      createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      total: 52.30,
      subtotal: 44.00,
      tax: 3.68,
      tip: 4.62,
      deliveryFee: 0,
      items: [
        { baseId: "mock_rogan", name: "Lamb Rogan Josh", qty: 1, price: 24.00 },
        { baseId: "mock_saag", name: "Saag Paneer", qty: 1, price: 18.00 },
        { baseId: "mock_garlic_naan", name: "Garlic Naan", qty: 2, price: 4.50 },
      ]
    },
    {
      id: "ord_rm6619c8",
      status: "done",
      orderMode: "delivery",
      createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
      total: 94.20,
      subtotal: 82.00,
      tax: 6.87,
      tip: 14.76,
      deliveryFee: 0,
      items: [
        { baseId: "mock_butter_chicken", name: "Butter Chicken", qty: 2, price: 22.00 },
        { baseId: "mock_dal", name: "Dal Makhani", qty: 1, price: 18.00 },
        { baseId: "mock_roti", name: "Tandoori Roti", qty: 4, price: 3.50 },
        { baseId: "mock_gulab", name: "Gulab Jamun", qty: 2, price: 6.00 },
      ]
    }
  ]
};

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
function ItemThumb({ imageUrl, size = 38 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: 9, flexShrink: 0, overflow: "hidden", background: "#1c1814", border: "1px solid rgba(250,246,239,0.1)", backgroundImage: imageUrl ? `url(${imageUrl})` : "none", backgroundSize: "cover", backgroundPosition: "center" }}>
      {!imageUrl && <div style={{ width: "100%", height: "100%", background: "repeating-linear-gradient(135deg,rgba(232,168,46,0.08) 0px,rgba(232,168,46,0.08) 1px,transparent 1px,transparent 6px)" }} />}
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
    <div style={S.card}>
      <div onClick={() => setExpanded(e => !e)} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", cursor: "pointer", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
            <span style={sc}>{order.status === "done" ? "✓ " : ""}{sc.label}</span>
            <span style={{ fontSize: 11, color: "#E8A82E", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
              {order.orderMode === "delivery" ? "🚗 Delivery" : "🛍️ Pickup"}
            </span>
          </div>
          <p style={{ fontSize: 12, color: "#B8A995", margin: 0 }}>
            {fmtDate(order.createdAt)} · #{order.id.slice(-6).toUpperCase()}
          </p>
          {!expanded && (
            <div style={{ display: "flex", marginTop: 8 }}>
              {order.items.slice(0, 4).map((item, i) => (
                <div key={i} style={{ marginLeft: i === 0 ? 0 : -8 }}>
                  <ItemThumb imageUrl={item.baseId ? cloudImages?.[item.baseId] : null} size={34} />
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <p style={{ fontFamily: "'Fraunces',serif", fontSize: 16, color: "#FAF6EF", margin: 0, fontWeight: 500 }}>
            {fmt(order.total)}
          </p>
          <span style={{ fontSize: 11, color: "#B8A995" }}>{expanded ? "Collapse ▲" : "Details ▼"}</span>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: "0.5px solid rgba(250,246,239,0.08)", marginTop: 12, paddingTop: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
            {order.items.map((item, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "#FAF6EF" }}>{item.qty}× {item.name}</span>
                <span style={{ color: "#B8A995" }}>{fmt(item.price * item.qty)}</span>
              </div>
            ))}
          </div>
          <button onClick={() => onReorder(order)} style={S.btnOutline}>
            Reorder these items →
          </button>
        </div>
      )}
    </div>
  );
}

// ── Primary Account Portal Page Component ──────────────────────────
function AccountPortalPage({
  guestEmail,
  setGuestEmail,
  onStartOrder,
  onReorder,
  cloudImages,
  isSignedIn,
  getToken,
  signOut,
  openSignIn,
}) {
  const [tab, setTab] = useState("history");
  const [profile, setProfile] = useState(null);
  const [searchedEmail, setSearchedEmail] = useState(guestEmail || "");
  const [status, setStatus] = useState(() => (searchedEmail || guestEmail || isSignedIn ? "loading" : "signed-out"));
  const fetchLockRef = useRef(null);

  useEffect(() => {
    let active = true;

    async function loadAccount() {
      const token = isSignedIn ? await getToken() : null;
      const targetEmail = (searchedEmail || guestEmail || "").trim();

      if (!token && !targetEmail) {
        if (active) setStatus("signed-out");
        return;
      }

      if (targetEmail.toLowerCase().includes("demo") || targetEmail === "preview") {
        if (active) {
          setProfile(MOCK_PREVIEW_PROFILE);
          setStatus("ready");
        }
        return;
      }

      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const url = token ? "/api/account/profile" : `/api/account/profile?email=${encodeURIComponent(targetEmail)}`;

      const fetchPromise = fetch(url, { headers });
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
            setProfile({ profile: { email: targetEmail }, orders: [], favorites: [] });
            setStatus("not-found");
          }
        }
      } catch {
        if (active) {
          setProfile({ profile: { email: targetEmail }, orders: [], favorites: [] });
          setStatus("not-found");
        }
      }
    }

    loadAccount();
    return () => { active = false; };
  }, [guestEmail, searchedEmail, isSignedIn]);

  const activeEmail = searchedEmail || guestEmail || "";

  // ── 1. Loading Spinner View ──────────────────────────────────────
  if (status === "loading") {
    return (
      <div style={{ minHeight: "100vh", background: "#080706", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
        <div style={{ width: 36, height: 36, border: "3px solid #1c1814", borderTop: "3px solid #E8A82E", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <p style={{ fontSize: 13, color: "#B8A995" }}>Checking account & order history…</p>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  // ── 2. Signed Out / Search Form / Not Found Card ───────────────
  if (status === "signed-out" || status === "not-found" || !profile || !profile.orders?.length) {
    const isNotFound = status === "not-found";

    return (
      <div style={{ minHeight: "100vh", background: "#080706", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem", fontFamily: "'Inter',sans-serif" }}>
        <style>{`@import url('${FONT_LINK}'); *{box-sizing:border-box}`}</style>
        
        <div style={{ ...S.card, maxWidth: 420, width: "100%", padding: "2.25rem 1.75rem", marginBottom: 0, boxShadow: "0 20px 50px rgba(0,0,0,0.6)" }}>
          {/* Card Header Icon & Heading */}
          <div style={{ textAlign: "center", marginBottom: 22 }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: isNotFound ? "rgba(217,72,44,0.12)" : "rgba(232,168,46,0.12)", border: `1px solid ${isNotFound ? "rgba(217,72,44,0.35)" : "rgba(232,168,46,0.35)"}`, color: isNotFound ? "#F0846A" : "#E8A82E", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" />
              </svg>
            </div>
            <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 22, color: "#FAF6EF", margin: 0, fontWeight: 500 }}>
              {isNotFound ? "No Past Orders Found" : "Welcome to Rani Mahal"}
            </h2>
            <p style={{ fontSize: 13, color: "#B8A995", marginTop: 6, lineHeight: 1.55 }}>
              {isNotFound
                ? `No past order history was found for "${activeEmail}". Check your email or start an order below!`
                : "Sign in or enter your email to view past orders, save favorites & reorder in 1 tap."}
            </p>
          </div>

          {/* Primary Action Button when No Orders Found */}
          {isNotFound && (
            <div style={{ marginBottom: 20 }}>
              <button onClick={onStartOrder} style={S.btnGold}>
                ← Browse Menu & Order Now
              </button>
            </div>
          )}

          {/* Clerk Account Sign-In Option */}
          {openSignIn && (
            <div style={{ marginBottom: 18 }}>
              <button onClick={() => openSignIn({ fallbackRedirectUrl: window.location.href })} style={isNotFound ? S.btnOutline : S.btnGold}>
                🔑 Sign In / Create Account
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0" }}>
                <div style={{ flex: 1, height: 0.5, background: "rgba(250,246,239,0.1)" }} />
                <span style={{ fontSize: 11, color: "#B8A995", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {isNotFound ? "or try another email" : "or email lookup"}
                </span>
                <div style={{ flex: 1, height: 0.5, background: "rgba(250,246,239,0.1)" }} />
              </div>
            </div>
          )}

          {/* Email Order Lookup Form */}
          <form onSubmit={e => {
            e.preventDefault();
            const val = e.target.email.value.trim();
            if (val && val.includes("@")) {
              localStorage.setItem("rani_guest_email", val);
              setGuestEmail?.(val);
              setSearchedEmail(val);
              setStatus("loading");
            }
          }}>
            <label style={S.label}>Lookup Past Orders by Email</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                name="email"
                type="email"
                placeholder="you@email.com"
                style={{ ...S.input, flex: 1 }}
                defaultValue={activeEmail}
                required
              />
              <button type="submit" style={{ padding: "10px 16px", background: "rgba(232,168,46,0.14)", border: "1px solid rgba(232,168,46,0.35)", color: "#E8A82E", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                Lookup →
              </button>
            </div>
          </form>

          {/* Quick Demo Preview Button */}
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: "0.5px solid rgba(250,246,239,0.08)", textAlign: "center" }}>
            <button
              onClick={() => {
                setProfile(MOCK_PREVIEW_PROFILE);
                setStatus("ready");
              }}
              style={{
                width: "100%",
                padding: "11px 16px",
                background: "rgba(232,168,46,0.12)",
                border: "1px solid rgba(232,168,46,0.35)",
                color: "#E8A82E",
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                transition: "all 0.15s ease",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(232,168,46,0.22)"}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(232,168,46,0.12)"}
            >
              <span>✨ Preview Sample Member Account</span>
            </button>
          </div>

          {!isNotFound && (
            <div style={{ marginTop: 12, textAlign: "center" }}>
              <button onClick={onStartOrder} style={{ background: "transparent", border: "none", color: "#B8A995", fontSize: 13, cursor: "pointer" }}>
                ← Return to Menu
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── 3. Signed In / Ready View (Orders Found) ─────────────────────
  const activeOrder = profile.orders.find(o => o.status === "new" || o.status === "in_progress");
  const lastOrder   = profile.orders.find(o => o.id !== activeOrder?.id) ?? null;

  return (
    <div style={{ background: "#080706", minHeight: "100vh", fontFamily: "'Inter',sans-serif", color: "#FAF6EF" }}>
      <style>{`@import url('${FONT_LINK}'); *{box-sizing:border-box}`}</style>

      {/* Portal Header */}
      <header style={{ background: "#080706", borderBottom: "0.5px solid rgba(250,246,239,0.08)", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <div>
          <p style={{ fontFamily: "'Great Vibes',cursive", fontSize: 24, color: "#FAF6EF", margin: 0, lineHeight: 1 }}>Rani Mahal</p>
          <p style={{ fontSize: 10, color: "#E8A82E", letterSpacing: "0.18em", textTransform: "uppercase", margin: "3px 0 0" }}>Your Account</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onStartOrder} style={{ background: "transparent", border: "0.5px solid rgba(250,246,239,0.15)", color: "#FAF6EF", fontSize: 12, padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
            ← Menu
          </button>
          {isSignedIn && (
            <button onClick={() => signOut()} style={{ background: "transparent", border: "0.5px solid rgba(232,168,46,0.3)", color: "#E8A82E", fontSize: 12, padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
              Sign Out
            </button>
          )}
        </div>
      </header>

      <div style={{ maxWidth: 540, margin: "0 auto", padding: "16px 14px 60px" }}>
        {/* User Badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(232,168,46,0.14)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 600, color: "#E8A82E", flexShrink: 0, border: "1px solid rgba(232,168,46,0.3)" }}>
            {(profile.profile?.name ?? activeEmail ?? "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 16, fontWeight: 500, color: "#FAF6EF", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {profile.profile?.name ?? activeEmail}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2, flexWrap: "wrap" }}>
              <p style={{ fontSize: 12, color: "#B8A995", margin: 0 }}>Member since {fmtDate(profile.stats?.memberSince)}</p>
              {profile.savedCard && (
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, background: "rgba(232,168,46,0.12)", color: "#E8A82E", border: "0.5px solid rgba(232,168,46,0.3)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  💳 {profile.savedCard.brand?.toUpperCase()} •••• {profile.savedCard.last4}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Active Order Spotlight */}
        {activeOrder && (
          <div style={{ background: "rgba(232,168,46,0.08)", border: "1px solid rgba(232,168,46,0.3)", borderRadius: 16, padding: "14px 16px", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: "#E8A82E", color: "#080706" }}>
                {activeOrder.status === "in_progress" ? "Being Made" : "Order Received"}
              </span>
              <span style={{ fontSize: 11, color: "#B8A995" }}>#{activeOrder.id.slice(-6).toUpperCase()}</span>
            </div>
            <p style={{ fontSize: 13, color: "#FAF6EF", margin: "0 0 6px" }}>{activeOrder.items.map(i => i.name).join(", ")}</p>
            <p style={{ fontSize: 11, color: "#E8A82E", margin: 0 }}>We'll text you when your order is ready →</p>
          </div>
        )}

        {/* 1-Tap Reorder Shortcut */}
        {lastOrder && (
          <div style={{ ...S.card, marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <span style={S.label}>Reorder Last Order</span>
              <p style={{ fontSize: 13, color: "#FAF6EF", margin: 0 }}>{lastOrder.items.map(i => `${i.qty}× ${i.name}`).join(", ")}</p>
            </div>
            <button onClick={() => onReorder(lastOrder)} style={{ ...S.btnGold, width: "auto", padding: "8px 14px", fontSize: 12.5 }}>
              Reorder →
            </button>
          </div>
        )}

        {/* Order History Cards */}
        <p style={S.label}>Past Orders ({profile.orders.length})</p>
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
  guestEmail = null,
  setGuestEmail,
  onStartOrder = () => {},
  onReorder = () => {},
  cloudImages = {},
}) {
  const props = { guestEmail, setGuestEmail, onStartOrder, onReorder, cloudImages };
  return CLERK_ENABLED ? <ClerkAwareAccountPortal {...props} /> : <GuestOnlyAccountPortal {...props} />;
}
