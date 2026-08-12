import React, { useState, useEffect, useRef } from "react";
import { useSwipeToClose } from "../hooks/useSwipeToClose.js";
import { isZipInDeliveryZone, getDeliveryZoneForZip } from "../utils/deliveryConfig.js";
import { UniversalDeliveryForm } from "./UniversalDeliveryForm.jsx";
import { formatTime, getTimeSlots } from "../../lib/hours.js";

function ClockIcon({ size = 14, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

function SunIcon({ size = 13, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8L6 18M18 6l1.8-1.8" />
    </svg>
  );
}

function MoonIcon({ size = 13, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" />
    </svg>
  );
}

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
  openStatus = { isOpen: true, label: "" },
  upcomingWindows = [],
  scheduledFor = null,
  setScheduledFor,
}) {
  const { handleProps, sheetStyle } = useSwipeToClose(onClose);
  const [selectedMode, setSelectedMode] = useState(orderMode);
  const [error, setError] = useState(null);
  const [localPhone, setLocalPhone] = useState(phone);
  const [localConsent, setLocalConsent] = useState(smsConsent);
  // "Order for later" is forced open once the restaurant is closed (there's
  // no ASAP option then); while open it's an optional toggle a customer can
  // use to pre-order for a later window.
  const [showSchedulePicker, setShowSchedulePicker] = useState(!openStatus.isOpen);
  // Which service window (Today/Lunch, Tomorrow/Dinner, etc.) is expanded
  // to show its specific time slots. Index into upcomingWindows, or null
  // when none is expanded yet.
  const [selectedWindowIdx, setSelectedWindowIdx] = useState(null);

  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setSelectedMode(orderMode || "pickup");
      setLocalPhone(phone || "");
      setLocalConsent(!!smsConsent);
      setError(null);
      setShowSchedulePicker(!openStatus.isOpen);
      // Restore which window+time was already chosen, if any, so reopening
      // the sheet doesn't silently forget a previous selection.
      const matchIdx = scheduledFor
        ? upcomingWindows.findIndex(w => w.date === scheduledFor.date && scheduledFor.time >= w.opens && scheduledFor.time < w.closes)
        : -1;
      setSelectedWindowIdx(matchIdx >= 0 ? matchIdx : null);
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
    if (!openStatus.isOpen && !scheduledFor) {
      setError("Please pick a time for us to prepare your order — we're closed right now.");
      return;
    }
    setOrderMode(selectedMode);
    const cleanPhone = phoneDigits.length === 10 ? `+1${phoneDigits}` : "";
    setPhone?.(cleanPhone);
    setSmsConsent?.(cleanPhone ? localConsent : false);
    // Save the lead whenever a phone is given, even without SMS consent —
    // consent only gates whether SMS is allowed, not whether the lead
    // record exists. Without this, someone who types a phone but leaves the
    // box unchecked produces no lead at all, so email-fallback recovery
    // (lib/abandonedCart.js sendDraftTouch1/2) never has anything to use.
    if (cleanPhone && hasCartItems) {
      onSaveLead?.({ phone: cleanPhone, smsConsent: localConsent });
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
                By checking this box, you agree to receive SMS text messages from Rani Mahal — order
                confirmations, prep/delivery status updates, and occasional cart reminders. Message frequency
                varies. Msg &amp; data rates may apply. Reply STOP to cancel, HELP for help. Optional —
                you can place your order without checking this box.{" "}
                See our <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "#E8A82E" }}>Privacy Policy</a> and{" "}
                <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: "#E8A82E" }}>Terms</a>.
              </span>
            </label>
          )}
        </div>

        {/* Order-for-later */}
        <div style={{ margin: "1.25rem 1.25rem 0", padding: "16px", background: "#161310", border: `0.5px solid ${openStatus.isOpen ? "rgba(232,168,46,0.2)" : "rgba(217,72,44,0.3)"}`, borderRadius: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <div style={{
                flexShrink: 0, width: 30, height: 30, borderRadius: "50%", marginTop: 1,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: openStatus.isOpen ? "rgba(232,168,46,0.12)" : "rgba(217,72,44,0.14)",
                color: openStatus.isOpen ? "#E8A82E" : "#D9482C",
              }}>
                <ClockIcon size={15} color="currentColor" />
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: openStatus.isOpen ? "#FAF6EF" : "#F0846A", margin: 0 }}>
                  {openStatus.isOpen ? "Order for later" : "We're closed right now"}
                </p>
                <p style={{ fontSize: 11.5, color: "#B8A995", margin: "2px 0 0", lineHeight: 1.4 }}>
                  {openStatus.isOpen ? openStatus.label : `${openStatus.label} — pick a time below and we'll have it ready then.`}
                </p>
              </div>
            </div>
            {openStatus.isOpen && (
              <button
                type="button"
                onClick={() => { setShowSchedulePicker(v => !v); if (showSchedulePicker) { setScheduledFor?.(null); setSelectedWindowIdx(null); } }}
                style={{
                  flexShrink: 0, padding: "7px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                  border: `1px solid ${showSchedulePicker ? "#E8A82E" : "rgba(250,246,239,0.2)"}`,
                  background: showSchedulePicker ? "rgba(232,168,46,0.14)" : "transparent",
                  color: showSchedulePicker ? "#E8A82E" : "#FAF6EF", cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {showSchedulePicker ? "ASAP instead" : "Schedule"}
              </button>
            )}
          </div>

          {showSchedulePicker && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "0.5px solid rgba(250,246,239,0.08)" }}>
              <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8A7560", margin: "0 0 10px" }}>
                Choose a time
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {upcomingWindows.map((w, i) => {
                const windowSelected = selectedWindowIdx === i;
                const isLunch = w.serviceName === "Lunch";
                return (
                  <button
                    key={`${w.date}-${w.opens}-${i}`}
                    type="button"
                    onClick={() => {
                      setSelectedWindowIdx(i);
                      const slots = getTimeSlots(w.date, w);
                      if (slots.length) setScheduledFor?.({ date: w.date, time: slots[0] });
                    }}
                    style={{
                      position: "relative", flex: "1 1 128px", minWidth: 128, maxWidth: 168,
                      padding: "10px 14px", borderRadius: 12, textAlign: "left", cursor: "pointer",
                      border: `1.5px solid ${windowSelected ? "#E8A82E" : "rgba(250,246,239,0.12)"}`,
                      background: windowSelected ? "rgba(232,168,46,0.14)" : "#1c1814",
                      color: windowSelected ? "#E8A82E" : "#FAF6EF",
                      boxShadow: windowSelected ? "0 2px 12px rgba(232,168,46,0.15)" : "none",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {windowSelected && (
                      <span style={{
                        position: "absolute", top: 8, right: 8, width: 16, height: 16, borderRadius: "50%",
                        background: "#E8A82E", color: "#080706", fontSize: 10, fontWeight: 700,
                        display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
                      }}>✓</span>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {isLunch ? <SunIcon color={windowSelected ? "#E8A82E" : "#B8A995"} /> : <MoonIcon color={windowSelected ? "#E8A82E" : "#B8A995"} />}
                      <span style={{ fontSize: 12.5, fontWeight: 700 }}>{w.dayLabel}</span>
                    </div>
                    <div style={{ fontSize: 11.5, opacity: 0.85, marginTop: 3 }}>{w.serviceName} · opens {formatTime(w.opens)}</div>
                  </button>
                );
              })}
              </div>

              {selectedWindowIdx !== null && upcomingWindows[selectedWindowIdx] && (() => {
                const w = upcomingWindows[selectedWindowIdx];
                const slots = getTimeSlots(w.date, w);
                if (slots.length === 0) return null;
                return (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: "0.5px solid rgba(250,246,239,0.08)" }}>
                    <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8A7560", margin: "0 0 10px" }}>
                      {w.dayLabel} · {w.serviceName} — pick a time
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                      {slots.map(t => {
                        const active = scheduledFor?.date === w.date && scheduledFor?.time === t;
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setScheduledFor?.({ date: w.date, time: t })}
                            style={{
                              padding: "8px 12px", borderRadius: 10, fontSize: 12.5, fontWeight: active ? 700 : 500,
                              cursor: "pointer", whiteSpace: "nowrap",
                              border: `1.5px solid ${active ? "#E8A82E" : "rgba(250,246,239,0.1)"}`,
                              background: active ? "#E8A82E" : "#1c1814",
                              color: active ? "#080706" : "#FAF6EF",
                              transition: "all 0.15s ease",
                            }}
                          >
                            {formatTime(t)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
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
