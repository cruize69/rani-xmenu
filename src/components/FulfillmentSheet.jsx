import React, { useState, useEffect, useRef } from "react";
import { useSwipeToClose } from "../hooks/useSwipeToClose.js";
import { isZipInDeliveryZone, getDeliveryZoneForZip } from "../utils/deliveryConfig.js";
import { UniversalDeliveryForm } from "./UniversalDeliveryForm.jsx";

export function PickupIcon({ size = 18, color = "#E8A82E" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

export function DeliveryIcon({ size = 18, color = "#E8A82E" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1" y="3" width="15" height="13" rx="2" />
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  );
}

export function FulfillmentSheet({
  isOpen,
  onClose,
  orderMode = "pickup",
  setOrderMode,
  deliveryAddress = {},
  setDeliveryAddress,
  phone = "",
  setPhone,
  smsConsent = false,
  setSmsConsent,
  hasCartItems = false,
  onSaveLead,
}) {
  const { handleProps, sheetStyle } = useSwipeToClose(onClose);
  const [selectedMode, setSelectedMode] = useState(orderMode);
  const [error, setError] = useState(null);
  const [localPhone, setLocalPhone] = useState(phone);
  const [localConsent, setLocalConsent] = useState(smsConsent);

  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setSelectedMode(orderMode || "pickup");
      setLocalPhone(phone || "");
      setLocalConsent(!!smsConsent);
      setError(null);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  if (!isOpen) return null;

  // Read live from deliveryAddress prop — no local shadow state
  const addr = deliveryAddress || {};
  const zip = addr.zip || "";
  const city = addr.city || "";
  const street = addr.street || "";
  const isZipValid = zip.trim().length >= 5 && isZipInDeliveryZone(zip);
  const phoneDigits = localPhone.replace(/\D/g, "");
  const isPhoneValid = phoneDigits.length === 0 || phoneDigits.length === 10;

  const handleSave = () => {
    setError(null);
    if (localPhone && phoneDigits.length !== 10) {
      setError("Please enter a valid 10-digit phone number, or leave it blank.");
      return;
    }
    if (selectedMode === "delivery") {
      if (!street.trim()) {
        setError("Please enter your street address for delivery.");
        return;
      }
      if (!zip.trim() || zip.trim().length < 5) {
        setError("Please enter your 5-digit ZIP code.");
        return;
      }
      if (!isZipInDeliveryZone(zip)) {
        setError("We deliver to Greenwich, Stamford, Mamaroneck, Larchmont, Scarsdale, White Plains, New Rochelle, Pelham, Harrison, Purchase, Port Chester & Rye. Please check your ZIP code.");
        return;
      }
    }
    setOrderMode(selectedMode);
    const cleanPhone = phoneDigits.length === 10 ? `+1${phoneDigits}` : "";
    setPhone?.(cleanPhone);
    setSmsConsent?.(cleanPhone ? localConsent : false);
    if (cleanPhone && localConsent && hasCartItems) {
      onSaveLead?.({ phone: cleanPhone, smsConsent: true });
    }
    onClose();
  };

  const zone = selectedMode === "delivery" && zip ? getDeliveryZoneForZip(zip) : null;
  const eta = zone?.eta || "45–60 min";
  const minStr = zone?.minOrder ? `$${zone.minOrder.toFixed(0)} min` : "$50–$70 min";

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.70)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        zIndex: 600,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "#12100e",
          borderRadius: "20px 20px 0 0",
          width: "100%",
          maxWidth: 600,
          maxHeight: "92vh",
          overflowY: "auto",
          boxShadow: "0 -12px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(250,246,239,0.12)",
          paddingBottom: "env(safe-area-inset-bottom, 1.5rem)",
          ...sheetStyle,
        }}
      >
        {/* Swipe Handle */}
        <div {...handleProps} style={{ padding: "12px 0 6px", cursor: "grab" }}>
          <div style={{ width: 40, height: 4, background: "rgba(250,246,239,0.2)", borderRadius: 2, margin: "0 auto" }} />
        </div>

        {/* Header */}
        <div style={{ padding: "10px 1.25rem 12px", borderBottom: "0.5px solid rgba(250,246,239,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#E8A82E" }}>
            Pickup or Delivery
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: "transparent", border: "none", fontSize: 26, color: "#B8A995", cursor: "pointer", padding: 0, lineHeight: 1, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            ×
          </button>
        </div>

        {/* Mode Cards */}
        <div style={{ padding: "1.25rem 1.25rem 0", display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Pickup Card */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => { setSelectedMode("pickup"); setError(null); }}
            onKeyDown={(e) => e.key === "Enter" && setSelectedMode("pickup")}
            style={{
              padding: "14px 16px",
              borderRadius: 14,
              border: `1.5px solid ${selectedMode === "pickup" ? "#E8A82E" : "rgba(250,246,239,0.1)"}`,
              background: selectedMode === "pickup" ? "rgba(232,168,46,0.10)" : "#1c1814",
              cursor: "pointer",
              transition: "all 0.15s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: selectedMode === "pickup" ? "rgba(232,168,46,0.2)" : "rgba(250,246,239,0.05)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <PickupIcon size={20} color={selectedMode === "pickup" ? "#E8A82E" : "#B8A995"} />
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 600, color: selectedMode === "pickup" ? "#E8A82E" : "#FAF6EF", margin: 0 }}>
                  Pickup at Rani Mahal
                </p>
                <p style={{ fontSize: 12, color: "#B8A995", marginTop: 2, margin: "2px 0 0" }}>
                  327 Mamaroneck Ave · Ready in 25–35 min · No minimum
                </p>
              </div>
            </div>
            <div style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${selectedMode === "pickup" ? "#E8A82E" : "rgba(250,246,239,0.2)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {selectedMode === "pickup" && <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#E8A82E" }} />}
            </div>
          </div>

          {/* Delivery Card */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => { setSelectedMode("delivery"); setError(null); }}
            onKeyDown={(e) => e.key === "Enter" && setSelectedMode("delivery")}
            style={{
              padding: "14px 16px",
              borderRadius: 14,
              border: `1.5px solid ${selectedMode === "delivery" ? "#E8A82E" : "rgba(250,246,239,0.1)"}`,
              background: selectedMode === "delivery" ? "rgba(232,168,46,0.10)" : "#1c1814",
              cursor: "pointer",
              transition: "all 0.15s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: selectedMode === "delivery" ? "rgba(232,168,46,0.2)" : "rgba(250,246,239,0.05)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <DeliveryIcon size={20} color={selectedMode === "delivery" ? "#E8A82E" : "#B8A995"} />
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 600, color: selectedMode === "delivery" ? "#E8A82E" : "#FAF6EF", margin: 0 }}>
                  Delivery to Your Door
                </p>
                <p style={{ fontSize: 12, color: "#B8A995", margin: "2px 0 0" }}>
                  Est. {eta} · $6.99 fee (FREE over $99) · {minStr}
                </p>
              </div>
            </div>
            <div style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${selectedMode === "delivery" ? "#E8A82E" : "rgba(250,246,239,0.2)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {selectedMode === "delivery" && <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#E8A82E" }} />}
            </div>
          </div>
        </div>

        {/* Universal Delivery Address Form */}
        {selectedMode === "delivery" && (
          <div style={{ padding: "1.25rem 1.25rem 0" }}>
            <UniversalDeliveryForm
              deliveryAddress={deliveryAddress}
              setDeliveryAddress={setDeliveryAddress}
              setError={setError}
            />
          </div>
        )}

        {/* Phone — optional, used for ready/delivery texts */}
        <div style={{ padding: "1.25rem 1.25rem 0" }}>
          <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#B8A995", display: "block", marginBottom: 6 }}>
            Phone (optional)
          </label>
          <input
            type="tel"
            inputMode="tel"
            placeholder="(914) 555-0123"
            value={localPhone}
            onChange={e => setLocalPhone(e.target.value)}
            style={{
              width: "100%", padding: "12px 14px", borderRadius: 10,
              border: `1.5px solid ${isPhoneValid ? "rgba(250,246,239,0.15)" : "rgba(217,72,44,0.5)"}`,
              background: "#1c1814", color: "#FAF6EF", fontSize: 15, fontFamily: "'Inter', sans-serif",
              outline: "none", boxSizing: "border-box",
            }}
          />
          {localPhone && (
            <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 10, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={localConsent}
                onChange={e => setLocalConsent(e.target.checked)}
                style={{ marginTop: 2, flexShrink: 0, accentColor: "#E8A82E" }}
              />
              <span style={{ fontSize: 11.5, color: "#B8A995", lineHeight: 1.5 }}>
                We'll text you about this order — msg &amp; data rates may apply. Reply STOP anytime to opt out.
              </span>
            </label>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{ margin: "1rem 1.25rem 0", padding: "10px 14px", background: "rgba(217,72,44,0.12)", border: "0.5px solid rgba(217,72,44,0.35)", borderRadius: 10, color: "#FCA5A5", fontSize: 13, lineHeight: 1.5 }}>
            {error}
          </div>
        )}

        {/* Confirm Button */}
        <div style={{ padding: "1.25rem 1.25rem 0" }}>
          <button
            type="button"
            onClick={handleSave}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: 30,
              border: "none",
              background: "#E8A82E",
              color: "#080706",
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
              transition: "opacity 0.15s",
              fontFamily: "'Inter', sans-serif",
              minHeight: 50,
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = "0.9"}
            onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
          >
            {selectedMode === "delivery" ? "Save Address & Continue →" : "Confirm Pickup & Continue →"}
          </button>
        </div>
      </div>
    </div>
  );
}
