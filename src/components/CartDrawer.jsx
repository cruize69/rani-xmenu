import React, { useState, useEffect, useRef } from "react";
import { useUser, useClerk } from "@clerk/clerk-react";
import { useSwipeToClose } from "../hooks/useSwipeToClose.js";
import { rankedQuickAdds, cartCount, QA_ITEM_ID } from "../utils/upsells.js";
import { QuickAddCard } from "./MenuItemCard.jsx";
import { isZipInDeliveryZone, lookupTownByZip, getDeliveryZoneForZip, DELIVERY_CONFIG } from "../utils/deliveryConfig.js";
import { PickupIcon, DeliveryIcon } from "./FulfillmentSheet.jsx";
import { AddressAutocomplete } from "./AddressAutocomplete.jsx";

const CLERK_ENABLED = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const fmt = (n) => "$" + n.toFixed(2);

export function CartRow({ entry, onQty, onRemove }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 1.25rem", borderBottom:"0.5px solid rgba(250,246,239,0.05)" }}>
      <div style={{ display:"flex", alignItems:"center", border:"1px solid rgba(250,246,239,0.12)", borderRadius:20, flexShrink:0 }}>
        <button onClick={() => onQty(entry.baseId,-1)} style={{ width:26, height:26, background:"transparent", border:"none", fontSize:16, color:"#FAF6EF", display:"flex", alignItems:"center", justifyContent:"center" }}>−</button>
        <span style={{ fontSize:13, fontWeight:500, minWidth:20, textAlign:"center", color:"#FAF6EF" }}>{entry.qty}</span>
        <button onClick={() => onQty(entry.baseId,1)} style={{ width:26, height:26, background:"transparent", border:"none", fontSize:16, color:"#FAF6EF", display:"flex", alignItems:"center", justifyContent:"center" }}>+</button>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ fontSize:14, fontWeight:500, color:"#FAF6EF", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{entry.name}</p>
        {entry.spice && <p style={{ fontSize:12, color:"#B8A995", marginTop:1 }}>{entry.spice}</p>}
        {entry.note  && <p style={{ fontSize:12, color:"#B8A995", marginTop:1 }}>{entry.note}</p>}
      </div>
      <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4, flexShrink:0 }}>
        <span style={{ fontSize:14, fontWeight:500, color:"#FAF6EF", whiteSpace:"nowrap" }}>{fmt(entry.price*entry.qty)}</span>
        <button
          onClick={() => onRemove(entry.baseId)}
          aria-label={`Remove ${entry.name} from cart`}
          style={{ width:24, height:24, background:"transparent", border:"none", color:"#B8A995", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", padding:0 }}
          onMouseEnter={e => e.currentTarget.style.color="#D9482C"}
          onMouseLeave={e => e.currentTarget.style.color="#B8A995"}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 7h16" />
            <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
            <path d="M10 11v6M14 11v6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export function CompleteMealRail({ cart, onQty, images }) {
  if (cartCount(cart) === 0) return null;
  const items = rankedQuickAdds(cart);

  return (
    <div style={{ borderTop:"0.5px solid rgba(250,246,239,0.07)", padding:"12px 0" }}>
      <p style={{ fontSize:11, fontWeight:500, letterSpacing:"0.15em", textTransform:"uppercase", color:"#E8A82E", marginBottom:10, padding:"0 1.25rem" }}>Complete your meal</p>
      <div style={{ display:"flex", gap:8, overflowX:"auto", padding:"0 1.25rem 4px", scrollbarWidth:"none" }}>
        {items.map(item => (
          <QuickAddCard key={item.id} id={item.id} cart={cart} onQty={onQty} imageUrl={images?.[QA_ITEM_ID[item.id]] ?? null} />
        ))}
      </div>
    </div>
  );
}

const DELIVERY_TIP_OPTIONS = [
  { key: 0.15, label: "15%" },
  { key: 0.18, label: "18%" },
  { key: 0.20, label: "20%" },
  { key: 0.25, label: "25%" },
  { key: "custom", label: "Custom" },
];

const PICKUP_TIP_OPTIONS = [
  { key: 0, label: "No tip" },
  { key: 0.10, label: "10%" },
  { key: 0.15, label: "15%" },
  { key: 0.20, label: "20%" },
  { key: "custom", label: "Custom" },
];

export function TipSelector({ tipPct, setTipPct, tipCustom, setTipCustom, subtotal, orderMode = "pickup" }) {
  const isDelivery = orderMode === "delivery";
  const options = isDelivery ? DELIVERY_TIP_OPTIONS : PICKUP_TIP_OPTIONS;

  return (
    <div style={{ padding:"12px 1.25rem", borderTop:"0.5px solid rgba(250,246,239,0.07)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <p style={{ fontSize:11, fontWeight:500, letterSpacing:"0.15em", textTransform:"uppercase", color:"#E8A82E", margin: 0 }}>
          {isDelivery ? "Driver Tip" : "Staff Tip (Optional)"}
        </p>
        <span style={{ fontSize: 11, color: "#B8A995" }}>
          {isDelivery ? "100% goes to your driver" : "100% shared with packing staff"}
        </span>
      </div>
      <div style={{ display:"flex", gap:6 }}>
        {options.map(opt => {
          const active = tipPct === opt.key;
          return (
            <button key={opt.key} onClick={() => setTipPct(opt.key)}
              style={{ flex:1, padding:"9px 4px", borderRadius:8, border:`1.5px solid ${active?"#E8A82E":"rgba(250,246,239,0.1)"}`, background:active?"rgba(232,168,46,0.12)":"#1c1814", color:active?"#E8A82E":"#FAF6EF", fontSize:12.5, fontWeight:500 }}>
              {opt.label}
            </button>
          );
        })}
      </div>
      {tipPct === "custom" && (
        <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:8 }}>
          <span style={{ fontSize:14, color:"#B8A995" }}>$</span>
          <input type="number" min="0" step="0.01" placeholder="0.00" value={tipCustom} onChange={e => setTipCustom(e.target.value)} autoFocus
            style={{ flex:1, padding:"8px 12px", borderRadius:8, border:"1px solid rgba(250,246,239,0.12)", background:"#1c1814", color:"#FAF6EF", fontSize:14, outline:"none", fontFamily:"'Inter',sans-serif" }} />
        </div>
      )}
      {typeof tipPct === "number" && tipPct > 0 && (
        <p style={{ fontSize:11, color:"#B8A995", marginTop:6 }}>{fmt(subtotal * tipPct)} ({Math.round(tipPct * 100)}%) tip on this order</p>
      )}
    </div>
  );
}

export function Notice({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div style={{ position:"fixed", bottom:90, left:"50%", transform:"translateX(-50%)", background:"#1c1814", border:"0.5px solid rgba(250,246,239,0.15)", borderRadius:16, padding:"12px 16px", width:"min(380px, calc(100vw - 2rem))", zIndex:500, boxShadow:"0 8px 32px rgba(0,0,0,0.45)", display:"flex", alignItems:"center", gap:12 }}>
      <p style={{ fontSize:13, color:"#FAF6EF", lineHeight:1.5, flex:1, margin:0 }}>{message}</p>
      <button onClick={onDismiss}
        style={{ background:"transparent", color:"#B8A995", border:"0.5px solid rgba(250,246,239,0.15)", fontFamily:"'Inter',sans-serif", fontSize:12, padding:"6px 12px", borderRadius:20, cursor:"pointer", flexShrink:0 }}>
        Got it
      </button>
    </div>
  );
}

export function ClerkSignInButton({ style, disabled, onSignedIn }) {
  const { isSignedIn, user } = useUser();
  const clerk = useClerk();
  const firedRef = useRef(false);

  useEffect(() => {
    if (isSignedIn && user && !firedRef.current) {
      firedRef.current = true;
      onSignedIn(user.id);
    }
  }, [isSignedIn, user]);

  return (
    <button style={style} disabled={disabled} onClick={() => clerk.openSignIn({ fallbackRedirectUrl: window.location.href })}>
      <span style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
        <svg width="14" height="14" viewBox="0 0 384 512" fill="currentColor" aria-hidden="true">
          <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
        </svg>
        <svg width="15" height="15" viewBox="0 0 18 18" aria-hidden="true">
          <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" />
          <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
          <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
          <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
        </svg>
      </span>
      Sign in to save your order history
    </button>
  );
}

export function CheckoutGate({
  cart,
  total,
  subtotal = 0,
  tip = 0,
  deliveryFee = 0,
  orderMode = "pickup",
  setOrderMode,
  deliveryAddress = {},
  setDeliveryAddress,
  onCancel,
  onGuestIdentified,
  onViewAccount,
}) {
  const { handleProps, sheetStyle } = useSwipeToClose(onCancel);
  const [step,       setStep]       = useState("choice");
  const [guestEmail, setGuestEmail] = useState("");
  const addr = deliveryAddress || {};
  const [street,     setStreet]     = useState(addr.street || "");
  const [apt,        setApt]        = useState(addr.apt || "");
  const [city,       setCity]       = useState(addr.city || "Mamaroneck");
  const [zip,        setZip]        = useState(addr.zip || "10543");
  const [notes,      setNotes]      = useState(addr.notes || "");
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const [returning,  setReturning]  = useState(null);

  const initializedRef = useRef(false);
  useEffect(() => {
    if (!initializedRef.current) {
      const d = deliveryAddress || {};
      if (d.street) setStreet(d.street);
      if (d.apt)    setApt(d.apt);
      if (d.city)   setCity(d.city);
      if (d.zip)    setZip(d.zip);
      if (d.notes)  setNotes(d.notes);
      initializedRef.current = true;
    }
  }, [deliveryAddress]);

  const checkReturning = async emailToCheck => {
    if (!emailToCheck.includes("@")) return;
    try {
      const res = await fetch(`/api/account/profile?email=${encodeURIComponent(emailToCheck)}`);
      if (!res.ok) { setReturning(null); return; }
      const data = await res.json();
      setReturning(data?.orders?.length > 0
        ? { totalOrders: data.stats?.totalOrders ?? data.orders.length, favoriteName: data.favorites?.[0]?.name ?? null }
        : null);
    } catch { setReturning(null); }
  };

  const validateDelivery = () => {
    if (orderMode !== "delivery") return true;
    if (!street.trim()) { setError("Please enter your street address for delivery."); return false; }
    if (!city.trim()) { setError("Please enter your city."); return false; }
    if (!zip.trim()) { setError("Please enter your 5-digit ZIP code."); return false; }
    if (!isZipInDeliveryZone(zip)) {
      setError("Delivery is currently available for Westchester & Greenwich/Stamford areas.");
      return false;
    }
    const zone = getDeliveryZoneForZip(zip);
    const requiredMin = zone?.minOrder || 50.00;
    if (subtotal < requiredMin) {
      setError(`Delivery to ${city || "your area"} (${zone?.name || "Zone"}) requires a minimum food subtotal of $${requiredMin.toFixed(2)}.`);
      return false;
    }
    return true;
  };

  const goToStripe = async ({ clerkUserId = null, guestEmail = null } = {}) => {
    setLoading(true); setError(null);
    if (!validateDelivery()) { setLoading(false); return; }
    try {
      const fullDeliveryAddress = orderMode === "delivery" ? { street, apt, city, zip, notes } : null;
      if (setDeliveryAddress && fullDeliveryAddress) setDeliveryAddress(fullDeliveryAddress);

      const res = await fetch("/api/create-checkout", {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({
          items: Object.values(cart),
          specialInstructions:"",
          clerkUserId,
          guestEmail,
          tip,
          orderMode,
          deliveryAddress: fullDeliveryAddress,
          deliveryFee: orderMode === "delivery" ? deliveryFee : 0
        }),
      });
      if (!res.ok) throw new Error("Checkout failed");
      const { url } = await res.json();
      window.location.href = url;
    } catch (err) {
      setError(err.message || "Something went wrong. Please call (914) 835-9066.");
      setLoading(false);
    }
  };

  const handleGuestContinue = async e => {
    e.preventDefault();
    if (!guestEmail.includes("@")) { setError("Please enter a valid email for your receipt"); return; }
    if (!validateDelivery()) return;
    onGuestIdentified?.(guestEmail);
    goToStripe({ guestEmail });
  };

  const iStyle = { display:"block", width:"100%", padding:"10px 14px", border:"1px solid rgba(250,246,239,0.12)", borderRadius:10, fontSize:14, color:"#FAF6EF", background:"#1c1814", outline:"none", fontFamily:"'Inter',sans-serif", marginBottom:10, boxSizing:"border-box" };
  const socialBtn = { width:"100%", padding:"11px 16px", background:"#1c1814", color:"#FAF6EF", border:"0.5px solid rgba(250,246,239,0.15)", borderRadius:10, fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"'Inter',sans-serif", display:"flex", alignItems:"center", gap:10, marginBottom:8 };

  return (
    <div onClick={e => e.target===e.currentTarget && onCancel()} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.65)", zIndex:700, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
      <div style={{ background:"#12100e", borderRadius:"18px 18px 0 0", width:"100%", maxWidth:640, maxHeight:"92vh", overflowY:"auto", boxShadow:"0 -8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(250,246,239,0.1)", ...sheetStyle }}>
        <div {...handleProps}>
          <div style={{ width:36, height:4, background:"rgba(250,246,239,0.15)", borderRadius:2, margin:"12px auto 0" }} />
          <div style={{ padding:"16px 20px 12px", borderBottom:"0.5px solid rgba(250,246,239,0.08)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <img 
                src="/logo/apsara-square.png" 
                alt="Rani Mahal" 
                style={{ 
                  width: 28, 
                  height: 28, 
                  borderRadius: "50%", 
                  objectFit: "cover", 
                  border: "1px solid rgba(232,168,46,0.4)",
                  flexShrink: 0 
                }} 
              />
              <div>
                <p style={{ fontFamily:"'Great Vibes',cursive", fontSize:26, color:"#FAF6EF", margin:0, lineHeight:1 }}>Rani Mahal</p>
                <p style={{ fontSize:11, color:"#B8A995", letterSpacing:"0.12em", textTransform:"uppercase", margin:"3px 0 0" }}>
                  {orderMode === "delivery" ? "Delivery" : "Pickup"} · {fmt(total)}
                </p>
              </div>
            </div>
            <button onClick={onCancel} style={{ background:"transparent", border:"none", fontSize:22, color:"#B8A995", cursor:"pointer" }}>×</button>
          </div>
        </div>

        {/* Order Mode Selector Tabs */}
        <div style={{ padding:"12px 20px 0", display:"flex", gap:8 }}>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); setOrderMode?.("pickup"); setError(null); }}
            style={{
              flex:1, padding:"8px 12px", borderRadius:10, border:"1px solid " + (orderMode==="pickup" ? "#E8A82E" : "rgba(250,246,239,0.1)"),
              background: orderMode==="pickup" ? "rgba(232,168,46,0.12)" : "rgba(28,24,20,0.5)",
              color: orderMode==="pickup" ? "#E8A82E" : "#B8A995",
              fontSize:13, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6
            }}
          >
            <PickupIcon size={15} color={orderMode==="pickup" ? "#E8A82E" : "#B8A995"} /> Pickup (25–35m)
          </button>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); setOrderMode?.("delivery"); setError(null); }}
            style={{
              flex:1, padding:"8px 12px", borderRadius:10, border:"1px solid " + (orderMode==="delivery" ? "#E8A82E" : "rgba(250,246,239,0.1)"),
              background: orderMode==="delivery" ? "rgba(232,168,46,0.12)" : "rgba(28,24,20,0.5)",
              color: orderMode==="delivery" ? "#E8A82E" : "#B8A995",
              fontSize:13, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6
            }}
          >
            <DeliveryIcon size={15} color={orderMode==="delivery" ? "#E8A82E" : "#B8A995"} /> Delivery (45–60m)
          </button>
        </div>

        <div style={{ padding:"16px 20px 32px" }}>
          {step === "choice" && (
            <>
              <div style={{ background:"#1c1814", border:"0.5px solid rgba(250,246,239,0.1)", borderRadius:12, padding:"1rem 1.25rem", marginBottom:16 }}>
                <p style={{ fontSize:14, fontWeight:600, color:"#FAF6EF", margin:"0 0 4px" }}>Continue as guest</p>
                <p style={{ fontSize:13, color:"#B8A995", margin:"0 0 14px", lineHeight:1.55 }}>No account needed. Your receipt goes to your email.</p>
                <button style={{ width:"100%", padding:"12px", background:"#E8A82E", color:"#080706", border:"none", borderRadius:10, fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"'Inter',sans-serif" }} onClick={() => setStep("guest-email")}>
                  Continue as guest
                </button>
              </div>
              {CLERK_ENABLED && (
                <>
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
                    <div style={{ flex:1, height:"0.5px", background:"rgba(250,246,239,0.1)" }} />
                    <p style={{ fontSize:11, color:"#B8A995", margin:0, whiteSpace:"nowrap" }}>or sign in to save your order history</p>
                    <div style={{ flex:1, height:"0.5px", background:"rgba(250,246,239,0.1)" }} />
                  </div>
                  {error && <p style={{ fontSize:12, color:"#F0846A", marginBottom:8 }}>{error}</p>}
                  <ClerkSignInButton style={socialBtn} disabled={loading} onSignedIn={clerkUserId => goToStripe({ clerkUserId })} />
                </>
              )}
            </>
          )}

          {step === "guest-email" && (
            <>
              <button onClick={() => { setStep("choice"); setError(null); }} style={{ background:"transparent", border:"none", color:"#B8A995", fontSize:13, cursor:"pointer", padding:"0 0 14px", display:"flex", alignItems:"center", gap:4 }}>← Back</button>

              {orderMode === "delivery" && (
                <div style={{ marginBottom:16, background:"#1c1814", border:"0.5px solid rgba(232,168,46,0.25)", borderRadius:14, padding:"16px", display:"flex", flexDirection:"column", gap:12 }}>
                  <p style={{ fontSize:13, fontWeight:600, color:"#E8A82E", margin:"0 0 4px", textTransform:"uppercase", letterSpacing:"0.08em" }}>
                    🚗 Delivery Address & Driver Instructions
                  </p>
                  
                  <div>
                    <label style={{ fontSize:11, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", color:"#B8A995", marginBottom:6, display:"block" }}>Street Address *</label>
                    <AddressAutocomplete
                      street={street}
                      setStreet={(val) => {
                        setStreet(val); setError(null);
                        setDeliveryAddress?.({ street: val, apt, city, zip, notes });
                      }}
                      city={city}
                      setCity={setCity}
                      zip={zip}
                      setZip={setZip}
                      onSelectAddress={(selected) => {
                        setError(null);
                        setDeliveryAddress?.({
                          street: selected.street,
                          apt,
                          city: selected.city,
                          zip: selected.zip,
                          notes,
                        });
                      }}
                      placeholder="Start typing street address (e.g. 150 Boston Post Rd)"
                    />
                  </div>

                  <div style={{ display:"flex", gap:10 }}>
                    <div style={{ flex:1 }}>
                      <label style={{ fontSize:11, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", color:"#B8A995", marginBottom:6, display:"block" }}>Apt / Suite (Optional)</label>
                      <input type="text" placeholder="Apt 4B" value={apt} onChange={e => {
                        const val = e.target.value; setApt(val);
                        setDeliveryAddress?.({ street, apt: val, city, zip, notes });
                      }} style={iStyle} />
                    </div>
                    <div style={{ flex:1 }}>
                      <label style={{ fontSize:11, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", color:"#B8A995", marginBottom:6, display:"block" }}>City *</label>
                      <input type="text" placeholder="Mamaroneck" value={city} onChange={e => {
                        const val = e.target.value; setCity(val);
                        setDeliveryAddress?.({ street, apt, city: val, zip, notes });
                      }} style={iStyle} required />
                    </div>
                  </div>

                  <div style={{ display:"flex", gap:10, alignItems:"flex-end" }}>
                    <div style={{ width:110, flexShrink:0 }}>
                      <label style={{ fontSize:11, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", color:"#B8A995", marginBottom:6, display:"block" }}>ZIP Code *</label>
                      <input type="text" placeholder="10543" value={zip} onChange={e => {
                        const val = e.target.value;
                        setZip(val);
                        setError(null);
                        const found = lookupTownByZip(val);
                        const newCity = found ? found.city : city;
                        if (found) setCity(found.city);
                        setDeliveryAddress?.({ street, apt, city: newCity, zip: val, notes });
                      }} style={{ ...iStyle, textAlign:"center", fontWeight:600 }} maxLength={5} required />
                    </div>
                    <div style={{ flex:1 }}>
                      <label style={{ fontSize:11, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", color:"#B8A995", marginBottom:6, display:"block" }}>Driver Instructions (Optional)</label>
                      <input type="text" placeholder="e.g. Leave at door, ring bell" value={notes} onChange={e => {
                        const val = e.target.value; setNotes(val);
                        setDeliveryAddress?.({ street, apt, city, zip, notes: val });
                      }} style={iStyle} />
                    </div>
                  </div>
                </div>
              )}

              <p style={{ fontSize:15, fontWeight:500, color:"#FAF6EF", marginBottom:4, fontFamily:"'Fraunces',serif" }}>Where should we send your receipt?</p>
              <p style={{ fontSize:13, color:"#B8A995", marginBottom:14, lineHeight:1.55 }}>We'll email your order confirmation and live delivery status link.</p>
              <form onSubmit={handleGuestContinue}>
                <label style={{ fontSize:11, fontWeight:600, letterSpacing:"0.15em", textTransform:"uppercase", color:"#B8A995", marginBottom:5, display:"block" }}>Your email *</label>
                <input type="email" placeholder="you@email.com" value={guestEmail}
                  onChange={e => { setGuestEmail(e.target.value); setReturning(null); }}
                  onBlur={e => checkReturning(e.target.value)}
                  style={iStyle} required autoFocus />
                {returning && (
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, background:"rgba(232,168,46,0.1)", border:"0.5px solid rgba(232,168,46,0.3)", borderRadius:10, padding:"10px 14px", marginBottom:12 }}>
                    <p style={{ fontSize:12.5, color:"#FAF6EF", lineHeight:1.4, margin:0 }}>
                      Welcome back! You've ordered with us {returning.totalOrders} time{returning.totalOrders===1?"":"s"}{returning.favoriteName ? ` — usually ${returning.favoriteName}` : ""}.
                    </p>
                    <button type="button" onClick={() => onViewAccount?.()} style={{ background:"transparent", border:"none", color:"#E8A82E", fontSize:12, fontWeight:600, cursor:"pointer", flexShrink:0, whiteSpace:"nowrap" }}>
                      View past orders
                    </button>
                  </div>
                )}
                {error && <p style={{ fontSize:13, color:"#F0846A", marginBottom:10, background:"rgba(240,132,106,0.1)", padding:"8px 12px", borderRadius:8, border:"0.5px solid rgba(240,132,106,0.3)" }}>{error}</p>}
                <button type="submit" style={{ width:"100%", padding:"13px", background:"#E8A82E", color:"#080706", border:"none", borderRadius:10, fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"'Inter',sans-serif" }} disabled={loading}>
                  {loading ? "Redirecting to payment…" : `Continue to payment · ${fmt(total)}`}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function CartDrawer({
  drawerOpen,
  setDrawerOpen,
  cart,
  adjustQty,
  removeItem,
  cloudImages,
  tipPct,
  setTipPct,
  tipCustom,
  setTipCustom,
  subtotal,
  tax,
  tip,
  ccFee,
  total,
  orderMode = "pickup",
  deliveryAddress = {},
  deliveryFee = 0,
  handleCheckout,
}) {
  const drawerSwipe = useSwipeToClose(() => setDrawerOpen(false));
  const entries = Object.values(cart);
  const isDelivery = orderMode === "delivery";
  const isBelowMin = isDelivery && subtotal < DELIVERY_CONFIG.MINIMUM_ORDER;

  if (!drawerOpen) return null;

  return (
    <>
      <div onClick={() => setDrawerOpen(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:300 }} />
      <div style={{
        position:"fixed",
        bottom:0,
        left:0,
        right:0,
        margin:"0 auto",
        width:"100%",
        maxWidth:640,
        background:"#12100e",
        borderRadius:"18px 18px 0 0",
        zIndex:400,
        height:"auto",
        maxHeight:"88vh",
        display:"flex",
        flexDirection:"column",
        boxShadow:"0 -8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(250,246,239,0.1)",
        ...drawerSwipe.sheetStyle
      }}>
        {/* Fixed Top Header */}
        <div {...drawerSwipe.handleProps} style={{ flexShrink:0 }}>
          <div style={{ width:36, height:4, background:"rgba(250,246,239,0.15)", borderRadius:2, margin:"12px auto 0" }} />
          <div style={{ padding:"1rem 1.25rem", display:"flex", justifyContent:"space-between", alignItems:"center", borderBottom:"0.5px solid rgba(250,246,239,0.08)" }}>
            <span style={{ fontFamily:"'Fraunces',serif", fontSize:22, fontWeight:500, color:"#FAF6EF" }}>
              Your order ({isDelivery ? "Delivery" : "Pickup"})
            </span>
            <button onClick={() => setDrawerOpen(false)} style={{ background:"transparent", border:"none", fontSize:22, color:"#B8A995", cursor:"pointer" }}>×</button>
          </div>
        </div>

        {/* Scrollable Drawer Body */}
        {entries.length === 0 ? (
          <p style={{ padding:"2.5rem 1.25rem", textAlign:"center", color:"#B8A995", fontSize:14 }}>Your cart is empty.</p>
        ) : (
          <>
            <div style={{ flex:1, overflowY:"auto", minHeight:0 }}>
              {entries.map((entry, i) => (
                <CartRow key={i} entry={entry} onQty={adjustQty} onRemove={removeItem} />
              ))}
              <CompleteMealRail cart={cart} onQty={adjustQty} images={cloudImages} />
              <TipSelector tipPct={tipPct} setTipPct={setTipPct} tipCustom={tipCustom} setTipCustom={setTipCustom} subtotal={subtotal} orderMode={orderMode} />
              
              {isDelivery && (() => {
                const zone = getDeliveryZoneForZip(deliveryAddress?.zip);
                const zoneMin = zone?.minOrder || 50.00;
                return (
                  <div style={{ margin:"0.75rem 1.25rem 0", padding:"12px 14px", background:"rgba(232,168,46,0.08)", border:"0.5px solid rgba(232,168,46,0.25)", borderRadius:12, fontSize:12.5, color:"#FAF6EF" }}>
                    {subtotal < zoneMin ? (
                      <div style={{ color:"#E8A82E", textAlign:"center", fontWeight:500 }}>
                        Delivery requires a <strong>${zoneMin.toFixed(2)}</strong> minimum food subtotal. Add <strong>{fmt(zoneMin - subtotal)}</strong> more to checkout.
                      </div>
                    ) : subtotal < 99 ? (
                      <div>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6, fontSize:12, fontWeight:600 }}>
                          <span style={{ color:"#E8A82E" }}>🎉 Add {fmt(99 - subtotal)} more for FREE Delivery!</span>
                          <span style={{ color:"#B8A995" }}>{Math.round((subtotal / 99) * 100)}%</span>
                        </div>
                        <div style={{ height:6, background:"rgba(250,246,239,0.12)", borderRadius:3, overflow:"hidden" }}>
                          <div style={{ height:"100%", background:"linear-gradient(90deg, #E8A82E 0%, #F5C56B 100%)", borderRadius:3, width:`${Math.min(100, (subtotal / 99) * 100)}%`, transition:"width 0.3s ease" }} />
                        </div>
                      </div>
                    ) : (
                      <div style={{ color:"#4ADE80", fontWeight:600, textAlign:"center" }}>
                        🎉 FREE Delivery Unlocked! ($6.99 fee waived)
                      </div>
                    )}
                  </div>
                );
              })()}

              <div style={{ padding:"0.75rem 1.25rem", borderTop:"0.5px solid rgba(250,246,239,0.07)" }}>
                {[
                  ["Subtotal", fmt(subtotal), false],
                  isDelivery ? ["Delivery fee ($6.99 | Free over $99)", deliveryFee === 0 ? "FREE" : fmt(6.99), false] : null,
                  ["Tax (est. 8.375%)", fmt(tax), false],
                  ["Tip", fmt(tip), false],
                  ["Credit card processing fee", fmt(ccFee), false],
                  ["Total", fmt(total), true],
                ].filter(Boolean).map(([l, v, isTotal]) => (
                  <div key={l} style={{ display:"flex", justifyContent:"space-between", fontSize:isTotal?16:14, fontWeight:isTotal?500:400, color:isTotal?"#FAF6EF":"#B8A995", padding:"3px 0", borderTop:isTotal?"0.5px solid rgba(250,246,239,0.08)":"none", marginTop:isTotal?6:0 }}>
                    <span>{l}</span><span>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Permanent Sticky Bottom Checkout Footer */}
            <div style={{ flexShrink:0, padding:"1rem 1.25rem 1.5rem", background:"#12100e", borderTop:"1px solid rgba(250,246,239,0.1)", zIndex:10 }}>
              <button 
                onClick={handleCheckout}
                disabled={isBelowMin}
                style={{ 
                  display:"block", 
                  width:"100%", 
                  padding:14, 
                  background: isBelowMin ? "#342820" : "#E8A82E", 
                  border:"none", 
                  color: isBelowMin ? "#B8A995" : "#080706", 
                  fontSize:15, 
                  fontWeight:600, 
                  borderRadius:10, 
                  cursor: isBelowMin ? "not-allowed" : "pointer",
                  transition: "background 0.15s, color 0.15s",
                  boxShadow: isBelowMin ? "none" : "0 4px 20px rgba(232,168,46,0.3)"
                }}
              >
                {isBelowMin ? `Add ${fmt(DELIVERY_CONFIG.MINIMUM_ORDER - subtotal)} for delivery ($50 min)` : `Proceed to checkout — ${fmt(total)}`}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default CartDrawer;
