import React from "react";
import { isZipInDeliveryZone, lookupTownByZip } from "../utils/deliveryConfig.js";
import { AddressAutocomplete } from "./AddressAutocomplete.jsx";

// Shared input style token — 16px font size prevents iOS Safari zoom on focus
const input = {
  display: "block",
  width: "100%",
  padding: "13px 14px",
  borderRadius: 12,
  border: "1px solid rgba(250,246,239,0.15)",
  background: "#1c1814",
  color: "#FAF6EF",
  fontSize: 16,
  outline: "none",
  fontFamily: "'Inter', sans-serif",
  boxSizing: "border-box",
  WebkitAppearance: "none",
  appearance: "none",
  minHeight: 48,
};

const labelStyle = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "#B8A995",
  marginBottom: 6,
};

export function UniversalDeliveryForm({
  deliveryAddress = {},
  setDeliveryAddress,
  setError,
}) {
  const addr = deliveryAddress || {};
  const street = addr.street || "";
  const apt    = addr.apt    || "";
  const city   = addr.city   || "";
  const zip    = addr.zip    || "";
  const notes  = addr.notes  || "";

  const zipDone    = zip.trim().length === 5;
  const isZipValid = zipDone && isZipInDeliveryZone(zip);

  const update = (patch) => {
    setError?.(null);
    const next = { street, apt, city, zip, notes, ...patch };
    // Auto-fill city from ZIP
    if (patch.zip && patch.zip.trim().length === 5) {
      const town = lookupTownByZip(patch.zip);
      if (town) next.city = town.city;
    }
    setDeliveryAddress?.(next);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Header row: label + zone status badge */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#E8A82E" }}>
          Delivery Address
        </span>
        {zipDone && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: isZipValid ? "#4ADE80" : "#FCA5A5" }}>
            <span style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: isZipValid ? "#4ADE80" : "#FCA5A5",
              boxShadow: isZipValid ? "0 0 6px #4ADE80" : "0 0 6px #FCA5A5",
              display: "inline-block",
              flexShrink: 0,
            }} />
            {isZipValid ? "Delivery Available ✓" : "Outside Delivery Zone"}
          </div>
        )}
      </div>

      {/* Street — full-width autocomplete */}
      <div>
        <label htmlFor="delivery-street" style={labelStyle}>Street Address *</label>
        <AddressAutocomplete
          street={street}
          setStreet={(val) => update({ street: val })}
          city={city}
          setCity={(val) => update({ city: val })}
          zip={zip}
          setZip={(val) => update({ zip: val })}
          onSelectAddress={(selected) => {
            setError?.(null);
            setDeliveryAddress?.({ street: selected.street, apt, city: selected.city, zip: selected.zip, notes });
          }}
          placeholder="Street address (e.g. 150 Boston Post Rd)"
          style={{ fontSize: 16, padding: "13px 14px", minHeight: 48 }}
        />
      </div>

      {/* Apt + City row */}
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label htmlFor="delivery-apt" style={labelStyle}>Apt / Suite</label>
          <input
            id="delivery-apt"
            type="text"
            placeholder="Apt 4B (optional)"
            autoComplete="address-line2"
            value={apt}
            onChange={(e) => update({ apt: e.target.value })}
            style={input}
          />
        </div>
        <div style={{ flex: 1.6 }}>
          <label htmlFor="delivery-city" style={labelStyle}>City</label>
          <input
            id="delivery-city"
            type="text"
            placeholder="Mamaroneck"
            autoComplete="address-level2"
            value={city}
            onChange={(e) => update({ city: e.target.value })}
            style={input}
          />
        </div>
      </div>

      {/* ZIP + Driver Notes row */}
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ width: 110, flexShrink: 0 }}>
          <label htmlFor="delivery-zip" style={labelStyle}>ZIP *</label>
          <input
            id="delivery-zip"
            type="text"
            placeholder="10543"
            maxLength={5}
            inputMode="numeric"
            autoComplete="postal-code"
            value={zip}
            onChange={(e) => update({ zip: e.target.value })}
            style={{
              ...input,
              textAlign: "center",
              fontWeight: 700,
              fontSize: 16,
              letterSpacing: "0.12em",
              borderColor: zipDone ? (isZipValid ? "#1A6B3A" : "rgba(240,132,106,0.5)") : "rgba(250,246,239,0.15)",
            }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <label htmlFor="delivery-notes" style={labelStyle}>Driver Notes</label>
          <input
            id="delivery-notes"
            type="text"
            placeholder="Gate code, leave at door… (optional)"
            autoComplete="off"
            value={notes}
            onChange={(e) => update({ notes: e.target.value })}
            style={input}
          />
        </div>
      </div>

    </div>
  );
}
