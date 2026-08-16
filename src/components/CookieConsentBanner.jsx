// src/components/CookieConsentBanner.jsx
// Gates GA4 (src/utils/analytics.js) behind an explicit choice — see that
// file's CONSENT_KEY comment for why this can't just read a decision made
// on ranimahal.cc (different domain, no shared cookie/localStorage scope).
//
// Deliberately a slim, non-blocking bar rather than a modal: nothing on
// the page is disabled while it's up, and it never reappears once a
// choice is made (no re-prompting, no daily nag) — the "friction-free"
// requirement this was built under.
//
// Renders as normal in-flow content (not position:fixed) at the very top,
// simply pushing the page down by its own height rather than overlaying
// anything. RaniHeader.jsx is itself sticky at top:0, and RaniMahal.jsx's
// floating "View order" cart bar owns the bottom edge (fixed, bottom:12,
// zIndex:200) once there's anything in the cart — a fixed banner at
// either edge would have sat behind/against one of those. In-flow avoids
// the z-index question entirely.

import React, { useState, useEffect } from "react";
import { getConsent, setConsent } from "../utils/analytics.js";

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!getConsent());
  }, []);

  if (!visible) return null;

  const respond = (value) => {
    setConsent(value);
    setVisible(false);
  };

  return (
    <div
      role="region"
      aria-label="Cookie consent"
      style={{
        background: "#12100e",
        borderBottom: "1px solid rgba(232,168,46,0.35)",
        padding: "12px 16px",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <p style={{ margin: 0, fontSize: 12.5, color: "#B8A995", lineHeight: 1.5, flex: "1 1 240px", maxWidth: 480 }}>
        We use cookies for basic order analytics — nothing else is tracked. See our{" "}
        <a href="/privacy" style={{ color: "#E8A82E", textDecoration: "underline" }}>Privacy Policy</a>.
      </p>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <button
          onClick={() => respond("denied")}
          style={{ padding: "9px 16px", borderRadius: 20, background: "transparent", border: "1px solid rgba(250,246,239,0.2)", color: "#B8A995", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}
        >
          No thanks
        </button>
        <button
          onClick={() => respond("granted")}
          style={{ padding: "9px 18px", borderRadius: 20, background: "#E8A82E", border: "none", color: "#080706", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}
        >
          Accept
        </button>
      </div>
    </div>
  );
}

export default CookieConsentBanner;
