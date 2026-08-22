import React, { useState } from "react";
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
  const street = String(addr.street || "");
  const apt    = String(addr.apt    || "");
  const city   = String(addr.city   || "");
  const zip    = String(addr.zip    || "");
  const notes  = String(addr.notes  || "");

  const zipDone    = zip.trim().length === 5;
  const isZipValid = zipDone && isZipInDeliveryZone(zip);

  // City/ZIP are resolved automatically from the address search below and
  // stay hidden by default — that's the whole point of collapsing this to
  // one box. Nominatim occasionally can't resolve a real address though
  // (new construction, an unusual road name), so a manual fallback has to
  // exist somewhere; it's just tucked behind an explicit toggle instead of
  // being two more boxes every customer sees regardless of whether they
  // need them.
  const [manualOverride, setManualOverride] = useState(false);
  const showManualFields = manualOverride || (street.trim().length > 0 && !zipDone);

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

      {/* Header row: label + status */}
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
            {isZipValid ? "Eligible for Delivery ✓" : "Outside Delivery Zone"}
          </div>
        )}
      </div>

      {/* Address search + Apt/Suite inline on one row — the two fields
          every customer actually needs to type, side by side instead of
          stacked. City/ZIP resolve silently from whichever suggestion the
          customer picks. */}
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <div style={{ flex: 2.2, minWidth: 0 }}>
          <label htmlFor="delivery-street" style={labelStyle}>Address *</label>
          <AddressAutocomplete
            street={street}
            // Verified live on production: editing the street text after an
            // address was already selected left the OLD city/zip in place —
            // "15 Chatsworth Ave" (a real Larchmont/10538 street) stayed
            // stamped "Mamaroneck, 10543" from a prior selection, still
            // showing "Eligible for Delivery ✓", with no re-validation tying
            // the three fields together. Any manual edit to the street now
            // clears city/zip immediately, so the eligibility badge disappears
            // until the customer either picks a fresh suggestion (which sets
            // all three atomically via onSelectAddress below) or retypes a
            // city/zip that actually matches what they just typed.
            setStreet={(val) => update({ street: val, city: "", zip: "" })}
            city={city}
            setCity={(val) => update({ city: val })}
            zip={zip}
            setZip={(val) => update({ zip: val })}
            onSelectAddress={(selected) => {
              setError?.(null);
              setManualOverride(false);
              setDeliveryAddress?.({ street: selected.street, apt, city: selected.city, zip: selected.zip, notes });
            }}
            placeholder="Start typing your address…"
            style={{ fontSize: 16, padding: "13px 14px", minHeight: 48 }}
          />
          {/* Resolved city/ZIP readout — confirms what got matched without
              asking the customer to type it again in a separate box. */}
          {zipDone && !showManualFields && (
            <p style={{ fontSize: 12, color: "#8A7F70", margin: "6px 0 0" }}>
              {city ? `${city}, ` : ""}{zip}{" "}
              <button
                type="button"
                onClick={() => setManualOverride(true)}
                style={{ background: "none", border: "none", padding: 0, color: "#E8A82E", fontSize: 12, textDecoration: "underline", cursor: "pointer" }}
              >
                Not right? Edit
              </button>
            </p>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <label htmlFor="delivery-apt" style={labelStyle}>Apt / Suite</label>
          <input
            id="delivery-apt"
            type="text"
            placeholder="Apt, floor"
            autoComplete="address-line2"
            value={apt}
            onChange={(e) => update({ apt: e.target.value })}
            style={input}
          />
        </div>
      </div>

      {/* Manual city/ZIP fallback — only shown if the search couldn't
          resolve a real match, or the customer explicitly asks to correct
          it. Everyone else never sees these two fields at all. */}
      {showManualFields && (
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1.6 }}>
            <label htmlFor="delivery-city" style={labelStyle}>City</label>
            <input
              id="delivery-city"
              type="text"
              placeholder="City"
              autoComplete="address-level2"
              value={city}
              onChange={(e) => update({ city: e.target.value })}
              style={input}
            />
          </div>
          <div style={{ width: 110, flexShrink: 0 }}>
            <label htmlFor="delivery-zip" style={labelStyle}>ZIP *</label>
            <input
              id="delivery-zip"
              type="text"
              placeholder="ZIP"
              maxLength={5}
              inputMode="numeric"
              autoComplete="postal-code"
              value={zip}
              onChange={(e) => update({ zip: e.target.value })}
              style={{
                ...input,
                textAlign: "center",
                fontWeight: 700,
                letterSpacing: "0.08em",
                borderColor: zipDone ? (isZipValid ? "#1A6B3A" : "rgba(240,132,106,0.5)") : "rgba(250,246,239,0.15)",
              }}
            />
          </div>
        </div>
      )}

      {/* Driver Notes — now the only remaining row, so it gets the full
          width instead of splitting it with Apt/Suite. */}
      <div>
        <label htmlFor="delivery-notes" style={labelStyle}>Driver Notes</label>
        <input
          id="delivery-notes"
          type="text"
          placeholder="Gate code, buzzer, parking, landmarks… (optional)"
          autoComplete="off"
          value={notes}
          onChange={(e) => update({ notes: e.target.value })}
          style={input}
        />
      </div>

    </div>
  );
}
