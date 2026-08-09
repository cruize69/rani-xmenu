import React, { useState, useEffect, useRef } from "react";
import { useSwipeToClose } from "../hooks/useSwipeToClose.js";
import { isZipInDeliveryZone, lookupTownByZip, getDeliveryZoneForZip, DELIVERY_CONFIG } from "../utils/deliveryConfig.js";
import { AddressAutocomplete } from "./AddressAutocomplete.jsx";
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
}) {
  const { handleProps, sheetStyle } = useSwipeToClose(onClose);
  const [selectedMode, setSelectedMode] = useState(orderMode);
  
  const initialAddr = deliveryAddress || {};
  const [street, setStreet] = useState(initialAddr.street || "");
  const [apt, setApt]       = useState(initialAddr.apt || "");
  const [city, setCity]     = useState(initialAddr.city || "Mamaroneck");
  const [zip, setZip]       = useState(initialAddr.zip || "10543");
  const [notes, setNotes]   = useState(initialAddr.notes || "");
  const [error, setError]   = useState(null);

  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setSelectedMode(orderMode || "pickup");
      const addr = deliveryAddress || {};
      setStreet(addr.street || "");
      setApt(addr.apt || "");
      setCity(addr.city || "Mamaroneck");
      setZip(addr.zip || "10543");
      setNotes(addr.notes || "");
      setError(null);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    setError(null);
    if (selectedMode === "delivery") {
      if (!street.trim()) {
        setError("Please enter your street address for delivery.");
        return;
      }
      if (!zip.trim()) {
        setError("Please enter your 5-digit ZIP code.");
        return;
      }
      if (!isZipInDeliveryZone(zip)) {
        setError("We deliver to Greenwich, Stamford, Mamaroneck, Larchmont, Scarsdale, White Plains, New Rochelle, Pelham, Harrison, Purchase, Port Chester & Rye. Please check your ZIP code.");
        return;
      }
      setDeliveryAddress({
        street: street.trim(),
        apt: apt.trim(),
        city: city.trim() || "Mamaroneck",
        zip: zip.trim(),
        notes: notes.trim(),
      });
    }
    setOrderMode(selectedMode);
    onClose();
  };

  const isZipValid = zip.trim().length >= 5 && isZipInDeliveryZone(zip);

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
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
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 -12px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(250,246,239,0.12)",
          paddingBottom: "1.5rem",
          ...sheetStyle,
        }}
      >
        {/* Swipe Handle */}
        <div {...handleProps} style={{ padding: "12px 0 6px", cursor: "grab" }}>
          <div style={{ width: 40, height: 4, background: "rgba(250,246,239,0.2)", borderRadius: 2, margin: "0 auto" }} />
        </div>

        {/* Header Row */}
        <div style={{ padding: "10px 1.5rem 12px", borderBottom: "0.5px solid rgba(250,246,239,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "#E8A82E" }}>
              Select Fulfillment
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "transparent", border: "none", fontSize: 24, color: "#B8A995", cursor: "pointer", padding: 0, lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {/* Mode Cards */}
        <div style={{ padding: "1.25rem 1.5rem 0", display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Pickup Card */}
          <div
            onClick={() => { setSelectedMode("pickup"); setError(null); }}
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
                <p style={{ fontSize: 12, color: "#B8A995", marginTop: 2 }}>
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
            onClick={() => { setSelectedMode("delivery"); setError(null); }}
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
                <p style={{ fontSize: 12, color: "#B8A995", marginTop: 2 }}>
                  {(() => {
                    const zone = getDeliveryZoneForZip(zip);
                    const eta = zone?.eta || "45–60 min";
                    const minStr = zone?.minOrder ? `$${zone.minOrder.toFixed(0)} min` : "$50–$70 min";
                    return `Est. ${eta} · $6.99 fee (FREE over $99) · ${minStr}`;
                  })()}
                </p>
              </div>
            </div>
            <div style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${selectedMode === "delivery" ? "#E8A82E" : "rgba(250,246,239,0.2)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {selectedMode === "delivery" && <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#E8A82E" }} />}
            </div>
          </div>
        </div>

        {/* Delivery Address Form (If Delivery is selected) */}
        {selectedMode === "delivery" && (
          <div style={{ padding: "1.25rem 1.5rem 0" }}>
            <UniversalDeliveryForm
              deliveryAddress={deliveryAddress}
              setDeliveryAddress={setDeliveryAddress}
              setError={setError}
            />
          </div>
        )}

        {/* Error message */}
        {error && (
          <div style={{ margin: "1rem 1.5rem 0", padding: "10px 14px", background: "rgba(217,72,44,0.12)", border: "0.5px solid rgba(217,72,44,0.35)", borderRadius: 10, color: "#FCA5A5", fontSize: 12.5 }}>
            {error}
          </div>
        )}

        {/* Confirm Button */}
        <div style={{ padding: "1.25rem 1.5rem 0" }}>
          <button
            type="button"
            onClick={handleSave}
            style={{
              width: "100%",
              padding: "13px",
              borderRadius: 30,
              border: "none",
              background: "#E8A82E",
              color: "#080706",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              transition: "background 0.15s",
            }}
          >
            {selectedMode === "delivery" ? "Save Address & Start Order →" : "Set Pickup & Start Order →"}
          </button>
        </div>
      </div>
    </div>
  );
}
