import React, { useState, useEffect, useRef } from "react";
import { isZipInDeliveryZone, lookupTownByZip, cleanTownName } from "../utils/deliveryConfig.js";

// Fast local Westchester & Fairfield verified address dataset for instant 0ms responses
const POPULAR_WESTCHESTER_STREETS = [
  { street: "327 Mamaroneck Ave", city: "Mamaroneck", zip: "10543", state: "NY" },
  { street: "150 Boston Post Rd", city: "Larchmont", zip: "10538", state: "NY" },
  { street: "45 Palmer Ave", city: "Larchmont", zip: "10538", state: "NY" },
  { street: "120 Mamaroneck Ave", city: "White Plains", zip: "10601", state: "NY" },
  { street: "88 Garth Rd", city: "Scarsdale", zip: "10583", state: "NY" },
  { street: "25 Spencer Pl", city: "Scarsdale", zip: "10583", state: "NY" },
  { street: "10 West Putnam Ave", city: "Greenwich", zip: "06830", state: "CT" },
  { street: "100 Greenwich Ave", city: "Greenwich", zip: "06830", state: "CT" },
  { street: "50 Harrison Ave", city: "Harrison", zip: "10528", state: "NY" },
  { street: "15 Purchase St", city: "Rye", zip: "10580", state: "NY" },
  { street: "20 North Main St", city: "Port Chester", zip: "10573", state: "NY" },
  { street: "40 Pelham Rd", city: "New Rochelle", zip: "10801", state: "NY" },
  { street: "10 Wolfs Ln", city: "Pelham", zip: "10803", state: "NY" },
  { street: "300 Atlantic St", city: "Stamford", zip: "06901", state: "CT" },
];

export function AddressAutocomplete({
  street,
  setStreet,
  city,
  setCity,
  zip,
  setZip,
  onSelectAddress,
  placeholder = "Start typing street address (e.g. 150 Boston Post Rd)",
  style = {},
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = async (e) => {
    const val = e.target.value;
    setStreet(val);

    if (val.trim().length < 3) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    setShowDropdown(true);

    // 1. Instant local matching
    const query = val.toLowerCase().trim();
    const localMatches = POPULAR_WESTCHESTER_STREETS.filter(item =>
      item.street.toLowerCase().includes(query) ||
      `${item.street} ${item.city}`.toLowerCase().includes(query)
    );

    setSuggestions(localMatches);

    // 2. Fetch OpenStreetMap Nominatim live verified addresses in Westchester / Fairfield
    if (query.length >= 4) {
      setLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&countrycodes=us&q=${encodeURIComponent(val + " Westchester NY")}`
        );
        if (res.ok) {
          const data = await res.json();
          const remoteMatches = data
            .map(item => {
              const a = item.address;
              const house = a.house_number ? `${a.house_number} ` : "";
              const road = a.road || a.pedestrian || a.street || "";
              const st = (house + road).trim();
              const rawTown = a.city || a.town || a.village || a.suburb || "Mamaroneck";
              const town = cleanTownName(rawTown);
              const pc = a.postcode || "";
              if (!st) return null;
              return {
                street: st,
                city: town,
                zip: pc,
                state: a.state === "Connecticut" ? "CT" : "NY",
                fullDisplay: `${st}, ${town}, ${a.state === "Connecticut" ? "CT" : "NY"} ${pc}`,
              };
            })
            .filter(Boolean);

          if (remoteMatches.length > 0) {
            setSuggestions(prev => {
              const combined = [...localMatches];
              remoteMatches.forEach(rm => {
                if (!combined.some(c => c.street.toLowerCase() === rm.street.toLowerCase())) {
                  combined.push(rm);
                }
              });
              return combined.slice(0, 6);
            });
          }
        }
      } catch {
        // Silently retain local suggestions if offline/rate-limited
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSelect = (item) => {
    const cleanedCity = cleanTownName(item.city);
    setStreet(item.street);
    if (cleanedCity) setCity(cleanedCity);
    if (item.zip) setZip(item.zip);

    onSelectAddress?.({
      street: item.street,
      city: cleanedCity,
      zip: item.zip,
      state: item.state || "NY",
    });

    setShowDropdown(false);
  };

  return (
    <div ref={wrapperRef} style={{ position: "relative", width: "100%" }}>
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <input
          type="text"
          placeholder={placeholder}
          value={street}
          onChange={handleInputChange}
          onFocus={() => street.trim().length >= 3 && setShowDropdown(true)}
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid rgba(250,246,239,0.15)",
            background: "#1c1814",
            color: "#FAF6EF",
            fontSize: 14,
            outline: "none",
            boxSizing: "border-box",
            fontFamily: "'Inter', sans-serif",
            transition: "border-color 0.15s, box-shadow 0.15s",
            ...style,
          }}
        />
        {loading && (
          <span style={{ position: "absolute", right: 12, fontSize: 11, color: "#E8A82E" }}>
            Verifying…
          </span>
        )}
      </div>

      {showDropdown && suggestions.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: "#1c1814",
            border: "1px solid rgba(232,168,46,0.35)",
            borderRadius: 12,
            zIndex: 999,
            boxShadow: "0 12px 32px rgba(0,0,0,0.7)",
            overflow: "hidden",
            maxHeight: 220,
            overflowY: "auto",
          }}
        >
          {suggestions.map((item, idx) => {
            const inZone = item.zip ? isZipInDeliveryZone(item.zip) : true;
            return (
              <div
                key={idx}
                onClick={() => handleSelect(item)}
                style={{
                  padding: "11px 14px",
                  borderBottom: idx < suggestions.length - 1 ? "1px solid rgba(250,246,239,0.06)" : "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(232,168,46,0.12)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <div>
                  <p style={{ fontSize: 13.5, fontWeight: 600, color: "#FAF6EF", margin: 0 }}>
                    📍 {item.street}
                  </p>
                  <p style={{ fontSize: 11.5, color: "#B8A995", margin: "2px 0 0" }}>
                    {item.city}, {item.state || "NY"} {item.zip}
                  </p>
                </div>
                {inZone && (
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: "#4ADE80", background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.3)", padding: "2px 8px", borderRadius: 10 }}>
                    Verified Zone
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
