import React from "react";
import { isZipInDeliveryZone, lookupTownByZip } from "../utils/deliveryConfig.js";
import { AddressAutocomplete } from "./AddressAutocomplete.jsx";

export function UniversalDeliveryForm({
  deliveryAddress = {},
  setDeliveryAddress,
  setError,
}) {
  const { street = "", apt = "", city = "Mamaroneck", zip = "10543", notes = "" } = deliveryAddress || {};
  const isZipValid = zip.trim().length >= 5 && isZipInDeliveryZone(zip);

  const updateField = (field, val) => {
    setError?.(null);
    const updated = {
      street,
      apt,
      city,
      zip,
      notes,
      [field]: val,
    };
    if (field === "zip" && val.trim().length === 5) {
      const town = lookupTownByZip(val);
      if (town) updated.city = town.city;
    }
    setDeliveryAddress?.(updated);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#E8A82E", margin: 0 }}>
          🚗 Delivery Destination & Driver Notes
        </p>
        {zip.trim().length === 5 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: isZipValid ? "#4ADE80" : "#FCA5A5" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: isZipValid ? "#4ADE80" : "#FCA5A5", boxShadow: isZipValid ? "0 0 8px #4ADE80" : "0 0 8px #FCA5A5", display: "inline-block" }} />
            {isZipValid ? "Delivery Available" : "Outside Delivery Zone"}
          </div>
        )}
      </div>

      {/* Street Autocomplete */}
      <AddressAutocomplete
        street={street}
        setStreet={(val) => updateField("street", val)}
        city={city}
        setCity={(val) => updateField("city", val)}
        zip={zip}
        setZip={(val) => updateField("zip", val)}
        onSelectAddress={(selected) => {
          setError?.(null);
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

      <div style={{ display: "flex", gap: 10 }}>
        <input
          type="text"
          placeholder="Apt / Suite (optional)"
          value={apt}
          onChange={(e) => updateField("apt", e.target.value)}
          style={{ flex: 1, padding: "11px 14px", borderRadius: 12, border: "1px solid rgba(250,246,239,0.15)", background: "#1c1814", color: "#FAF6EF", fontSize: 13.5, outline: "none", fontFamily: "'Inter', sans-serif" }}
        />
        <input
          type="text"
          placeholder="City (e.g. Mamaroneck)"
          value={city}
          onChange={(e) => updateField("city", e.target.value)}
          style={{ flex: 1.5, padding: "11px 14px", borderRadius: 12, border: "1px solid rgba(250,246,239,0.15)", background: "#1c1814", color: "#FAF6EF", fontSize: 13.5, outline: "none", fontFamily: "'Inter', sans-serif" }}
        />
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <input
          type="text"
          placeholder="ZIP"
          maxLength={5}
          value={zip}
          onChange={(e) => updateField("zip", e.target.value)}
          style={{ width: 110, flexShrink: 0, padding: "11px 14px", borderRadius: 12, border: `1px solid ${isZipValid ? "#1A6B3A" : "rgba(250,246,239,0.15)"}`, background: "#1c1814", color: "#FAF6EF", fontSize: 13.5, outline: "none", textAlign: "center", fontFamily: "'Inter', sans-serif", fontWeight: 600 }}
        />
        <input
          type="text"
          placeholder="Driver Notes / Gate Code (optional)"
          value={notes}
          onChange={(e) => updateField("notes", e.target.value)}
          style={{ flex: 1, padding: "11px 14px", borderRadius: 12, border: "1px solid rgba(250,246,239,0.15)", background: "#1c1814", color: "#FAF6EF", fontSize: 13.5, outline: "none", fontFamily: "'Inter', sans-serif" }}
        />
      </div>
    </div>
  );
}
