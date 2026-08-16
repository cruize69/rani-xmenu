import React from "react";
import { SectionNav, JumpIcon } from "./SectionTabsNav.jsx";
import { SECTIONS } from "../../lib/menu.js";
import { PickupIcon, DeliveryIcon } from "./FulfillmentSheet.jsx";
import { PICKUP_ETA } from "../utils/deliveryConfig.js";

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
    {/* Content column matches the page's own maxWidth (RaniMahal.jsx) so the
        pill stays visually tied to the logo instead of centering across the
        full viewport on wide desktop screens. No-op on mobile. */}
    <div style={{ maxWidth:1100, margin:"0 auto" }}>
      {/* Top section — name/info row + fulfillment pill, together above the gold line */}
      <div style={{ borderBottom:"1.5px solid #E8A82E" }}>
        {/* Name + info row — logo/name centered, Account floats as a corner
            chip so the centered block stays balanced at any width instead
            of needing a left/right split. On narrow (mobile) viewports the
            56px reserve is a large enough fraction of the width that the
            corner icon's visual weight optically pulls the block right of
            true center — nudge it left there to compensate. Negligible at
            desktop widths, so left untouched above 640px. */}
        <style>{`
          @media (max-width: 640px) {
            .rm-header-namerow { padding-left: 72px !important; padding-right: 72px !important; }
          }
          .rm-header-chip:hover .rm-header-chip-circle {
            border-color: #E8A82E;
            background: rgba(232,168,46,0.18);
          }
        `}</style>
        <div className="rm-header-namerow" style={{ position:"relative", padding:"14px 56px 8px", display:"flex", alignItems:"center", justifyContent:"center", gap:16 }}>
          {/* Call/help — top-left corner, mirrors the account chip on the
              right. Every persona in the ordering-flow review cited having
              no visible fallback if something went wrong as a reason to
              hesitate — this is the fix, placed as a matched pair with the
              account icon rather than crowded into the same corner. */}
          <a href="tel:9148359066" aria-label="Call Rani Mahal: (914) 835-9066" className="rm-header-chip"
            style={{
              position: "absolute",
              top: 16,
              left: 12,
              width: 48,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              cursor: "pointer",
              textDecoration: "none",
            }}
          >
            <span className="rm-header-chip-circle"
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "rgba(232,168,46,0.10)",
                border: "1px solid rgba(232,168,46,0.30)",
                color: "#E8A82E",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.15s ease",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 5c0-.6.4-1 1-1h2.3c.5 0 .9.3 1 .8l.8 3c.1.4 0 .8-.4 1L7.2 10a12 12 0 0 0 5.8 5.8l1.2-1.5c.2-.3.6-.5 1-.4l3 .8c.5.1.8.5.8 1V18c0 .6-.4 1-1 1h-1C9.7 19 4 13.3 4 6V5Z" />
              </svg>
            </span>
            <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#B8A995" }}>Call</span>
          </a>

          {/* Account / Sign In Chip — top-right corner, mirrors the call
              chip's icon+label layout so it stays legible without widening
              past the centered logo/name's reserved space at any width */}
          <button onClick={() => setView("account")} aria-label="Account & orders" className="rm-header-chip"
            style={{
              position: "absolute",
              top: 16,
              right: 12,
              width: 48,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
          >
            <span className="rm-header-chip-circle"
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "rgba(232,168,46,0.10)",
                border: "1px solid rgba(232,168,46,0.30)",
                color: "#E8A82E",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.15s ease",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" />
              </svg>
            </span>
            <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#B8A995" }}>Account</span>
          </button>

          {/* Centered — logo emblem + name/tagline stacked, linking back to
              the marketing site (ranimahal.cc carries the full brand story;
              this app is deliberately thin) */}
          <a href="https://ranimahal.cc" style={{ display:"flex", alignItems:"center", gap:12, textDecoration:"none" }}>
            <img
              src="/logo/apsara-logo.png"
              alt="Rani Mahal Logo"
              style={{
                width: 44,
                height: 44,
                objectFit: "contain",
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
          </a>
        </div>

        {/* Integrated Interactive Fulfillment Bar — enlarged now that it sits above the gold line */}
        <div style={{ padding:"2px 16px 14px", display:"flex", justifyContent:"center" }}>
          <button
            type="button"
            onClick={() => onOpenFulfillmentSheet?.()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 22px",
              borderRadius: 28,
              border: "1px solid rgba(232,168,46,0.35)",
              background: "rgba(18,16,14,0.75)",
              color: "#FAF6EF",
              fontSize: 13.5,
              fontWeight: 500,
              cursor: "pointer",
              boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
              maxWidth: "100%",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = "#E8A82E"}
            onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(232,168,46,0.35)"}
          >
            <span style={{ color: "#E8A82E", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 7 }}>
              {orderMode === "delivery" ? <><DeliveryIcon size={17} color="#E8A82E" /> Delivery to:</> : <><PickupIcon size={17} color="#E8A82E" /> Pickup:</>}
            </span>
            <span style={{ color: "#FAF6EF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {orderMode === "delivery"
                ? (deliveryAddress?.street ? `${deliveryAddress.street}, ${deliveryAddress.city || "Mamaroneck"}` : "Set address for ETA & fee ($50 min)")
                : `327 Mamaroneck Ave (${PICKUP_ETA.replace(" min", "m")})`}
            </span>
            <span style={{ fontSize: 11, color: "#E8A82E", marginLeft: 4 }}>▼</span>
          </button>
        </div>
      </div>

      {/* Nav row */}
      <div style={{ display:"flex", alignItems:"center", gap:4, paddingTop:6 }}>
        <button onClick={() => setShowSectionSheet(true)} aria-label="Jump to section"
          style={{ width:36, height:36, marginLeft:10, flexShrink:0, borderRadius:"50%", background:"rgba(232,168,46,0.14)", border:"0.5px solid rgba(232,168,46,0.35)", color:"#E8A82E", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
          <JumpIcon />
        </button>
        <div style={{ flex:1, minWidth:0 }}>
          <SectionNav sections={SECTIONS} activeSection={activeSection} onSelect={setActiveSection} />
        </div>
      </div>
    </div>
    </header>
  );
}

export default RaniHeader;
