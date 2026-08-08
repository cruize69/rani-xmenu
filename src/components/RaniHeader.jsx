import React from "react";
import { SectionNav, JumpIcon } from "./SectionTabsNav.jsx";
import { SECTIONS } from "../../lib/menu.js";
import { PickupIcon, DeliveryIcon } from "./FulfillmentSheet.jsx";

export function RaniHeader({
  activeSection,
  setActiveSection,
  setShowSectionSheet,
  setView,
  orderMode = "pickup",
  setOrderMode,
  deliveryAddress,
  onOpenFulfillmentSheet,
}) {
  return (
    <header style={{ background:"rgba(8,7,6,0.57)", backdropFilter:"blur(20px) saturate(180%)", WebkitBackdropFilter:"blur(20px) saturate(180%)", position:"sticky", top:0, zIndex:100, borderBottom:"0.5px solid rgba(250,246,239,0.08)" }}>
      {/* Name + info row */}
      <div style={{ padding:"12px 20px 10px", display:"flex", alignItems:"flex-end", justifyContent:"space-between", gap:16, borderBottom:"1.5px solid #E8A82E" }}>
        {/* Left — logo emblem + name/tagline stacked */}
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <img 
            src="/logo/apsara-square.png" 
            alt="Rani Mahal Logo" 
            style={{ 
              width: 44, 
              height: 44, 
              borderRadius: "50%", 
              objectFit: "cover",
              border: "1px solid rgba(232,168,46,0.45)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.4), 0 0 10px rgba(232,168,46,0.12)",
              flexShrink: 0 
            }} 
          />
          <div>
            <h1 style={{ fontFamily:"'Great Vibes',cursive", fontSize:32, color:"#FAF6EF", margin:0, lineHeight:1, fontWeight:400, letterSpacing:"0.02em" }}>
              Rani Mahal
            </h1>
            <p style={{ fontSize:10, color:"#E8A82E", letterSpacing:"0.22em", textTransform:"uppercase", margin:"3px 0 0", fontWeight:600 }}>
              Fine Indian Cuisine
            </p>
          </div>
        </div>

        {/* Right action — Account / Sign In Chip */}
        <div>
          <button onClick={() => setView("account")} aria-label="Account & orders"
            style={{
              padding: "7px 15px",
              borderRadius: 20,
              background: "rgba(232,168,46,0.10)",
              border: "1px solid rgba(232,168,46,0.30)",
              color: "#E8A82E",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#E8A82E"; e.currentTarget.style.background = "rgba(232,168,46,0.18)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(232,168,46,0.30)"; e.currentTarget.style.background = "rgba(232,168,46,0.10)"; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" />
            </svg>
            <span>Account</span>
          </button>
        </div>
      </div>

      {/* Integrated Interactive Fulfillment Bar */}
      <div style={{ padding:"6px 16px", background:"rgba(18,16,14,0.50)", borderBottom:"0.5px solid rgba(250,246,239,0.06)", display:"flex", justifyContent:"center" }}>
        <button
          type="button"
          onClick={() => onOpenFulfillmentSheet?.()}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 16px",
            borderRadius: 24,
            border: "1px solid rgba(232,168,46,0.35)",
            background: "rgba(18,16,14,0.75)",
            color: "#FAF6EF",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
            boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
            maxWidth: "100%",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = "#E8A82E"}
          onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(232,168,46,0.35)"}
        >
          <span style={{ color: "#E8A82E", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}>
            {orderMode === "delivery" ? <><DeliveryIcon size={15} color="#E8A82E" /> Delivery to:</> : <><PickupIcon size={15} color="#E8A82E" /> Pickup:</>}
          </span>
          <span style={{ color: "#FAF6EF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {orderMode === "delivery"
              ? (deliveryAddress?.street ? `${deliveryAddress.street}, ${deliveryAddress.city || "Mamaroneck"}` : "Set address for ETA & fee ($50 min)")
              : "327 Mamaroneck Ave (25–35m)"}
          </span>
          <span style={{ fontSize: 10, color: "#E8A82E", marginLeft: 4 }}>▼</span>
        </button>
      </div>

      {/* Nav row */}
      <div style={{ display:"flex", alignItems:"center", gap:4 }}>
        <button onClick={() => setShowSectionSheet(true)} aria-label="Jump to section"
          style={{ width:36, height:36, marginLeft:10, flexShrink:0, borderRadius:"50%", background:"rgba(232,168,46,0.14)", border:"0.5px solid rgba(232,168,46,0.35)", color:"#E8A82E", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
          <JumpIcon />
        </button>
        <div style={{ flex:1, minWidth:0 }}>
          <SectionNav sections={SECTIONS} activeSection={activeSection} onSelect={setActiveSection} />
        </div>
      </div>
    </header>
  );
}

export default RaniHeader;
