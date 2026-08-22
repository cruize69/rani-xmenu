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
  isSignedIn = false,
  userInitial = null,
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
            .rm-header-namerow { padding-left: 92px !important; padding-right: 92px !important; }
          }
          .rm-hotel-btn {
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          }
          .rm-hotel-btn:hover {
            border-color: #E8A82E !important;
            background: linear-gradient(145deg, rgba(232,168,46,0.24) 0%, rgba(32,26,20,0.95) 100%) !important;
            box-shadow: 0 4px 18px rgba(232,168,46,0.35), inset 0 1px 0 rgba(232,168,46,0.3) !important;
            transform: translateY(-50%) scale(1.03) !important;
          }
          .rm-hotel-btn:active {
            transform: translateY(-50%) scale(0.97) !important;
          }
        `}</style>
        <div className="rm-header-namerow" style={{ position:"relative", padding:"12px 96px 10px", display:"flex", alignItems:"center", justifyContent:"center" }}>
          {/* Boutique Hotel Button with Icon + Text — Call (Left) */}
          <a
            href="tel:9148359066"
            aria-label="Call Rani Mahal: (914) 835-9066"
            className="rm-hotel-btn"
            style={{
              position: "absolute",
              top: "50%",
              transform: "translateY(-50%)",
              left: 12,
              height: 38,
              padding: "0 13px",
              borderRadius: 10,
              background: "linear-gradient(145deg, rgba(232,168,46,0.14) 0%, rgba(22,18,14,0.92) 100%)",
              border: "1px solid rgba(232,168,46,0.32)",
              color: "#FAF6EF",
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              boxShadow: "0 3px 12px rgba(0,0,0,0.35), inset 0 1px 0 rgba(232,168,46,0.18)",
              cursor: "pointer",
              textDecoration: "none",
              fontFamily: "'Inter',sans-serif",
              fontSize: 12.5,
              fontWeight: 600,
              letterSpacing: "0.01em",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E8A82E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 5c0-.6.4-1 1-1h2.3c.5 0 .9.3 1 .8l.8 3c.1.4 0 .8-.4 1L7.2 10a12 12 0 0 0 5.8 5.8l1.2-1.5c.2-.3.6-.5 1-.4l3 .8c.5.1.8.5.8 1V18c0 .6-.4 1-1 1h-1C9.7 19 4 13.3 4 6V5Z" />
            </svg>
            <span>Call</span>
          </a>

          {/* Boutique Hotel Button with Icon + Text — Account (Right) */}
          <button
            onClick={() => setView("account")}
            aria-label="Account & orders"
            className="rm-hotel-btn"
            style={{
              position: "absolute",
              top: "50%",
              transform: "translateY(-50%)",
              right: 12,
              height: 38,
              padding: "0 13px",
              borderRadius: 10,
              background: isSignedIn
                ? "linear-gradient(135deg, rgba(232,168,46,0.25) 0%, rgba(30,24,18,0.95) 100%)"
                : "linear-gradient(145deg, rgba(232,168,46,0.14) 0%, rgba(22,18,14,0.92) 100%)",
              border: `1px solid ${isSignedIn ? "#E8A82E" : "rgba(232,168,46,0.32)"}`,
              color: "#FAF6EF",
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              boxShadow: isSignedIn
                ? "0 3px 14px rgba(232,168,46,0.35), inset 0 1px 0 rgba(232,168,46,0.3)"
                : "0 3px 12px rgba(0,0,0,0.35), inset 0 1px 0 rgba(232,168,46,0.18)",
              cursor: "pointer",
              fontFamily: "'Inter',sans-serif",
              fontSize: 12.5,
              fontWeight: 600,
              letterSpacing: "0.01em",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            {isSignedIn ? (
              <>
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "#E8A82E",
                    color: "#080706",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  {(userInitial ?? "•").toUpperCase()}
                </span>
                <span>Account</span>
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E8A82E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" />
                </svg>
                <span>Sign In</span>
              </>
            )}
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

        {/* Integrated Interactive Fulfillment Bar — enlarged now that it sits above the gold line.
            Padding trimmed (10px 22px -> 7px 20px vertical) after it read as
            oversized on smaller phones (iPhone 16e etc.) — same tap target,
            less height eaten before the menu even starts. */}
        <div style={{ padding:"2px 16px 10px", display:"flex", justifyContent:"center" }}>
          <button
            type="button"
            onClick={() => onOpenFulfillmentSheet?.()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "7px 20px",
              borderRadius: 24,
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
              {orderMode === "delivery" ? <><DeliveryIcon size={16} color="#E8A82E" /> Delivery to:</> : <><PickupIcon size={16} color="#E8A82E" /> Pickup:</>}
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
