import React, { useState, useEffect, useRef } from "react";
import { isZipInDeliveryZone, cleanTownName } from "../utils/deliveryConfig.js";

// Curated Westchester County & Fairfield County local street dataset
const POPULAR_WESTCHESTER_STREETS = [
  // Zone 1: Mamaroneck, Larchmont, Harrison, Rye
  { street: "327 Mamaroneck Ave", city: "Mamaroneck", zip: "10543", state: "NY" },
  { street: "120 Mamaroneck Ave", city: "Mamaroneck", zip: "10543", state: "NY" },
  { street: "500 Mamaroneck Ave", city: "Mamaroneck", zip: "10543", state: "NY" },
  { street: "150 Boston Post Rd", city: "Larchmont", zip: "10538", state: "NY" },
  { street: "120 Boston Post Rd", city: "Mamaroneck", zip: "10543", state: "NY" },
  { street: "45 Palmer Ave", city: "Larchmont", zip: "10538", state: "NY" },
  { street: "190 Chatsworth Ave", city: "Larchmont", zip: "10538", state: "NY" },
  { street: "50 Harrison Ave", city: "Harrison", zip: "10528", state: "NY" },
  { street: "200 Halstead Ave", city: "Harrison", zip: "10528", state: "NY" },
  { street: "15 Purchase St", city: "Rye", zip: "10580", state: "NY" },
  { street: "50 Boston Post Rd", city: "Rye", zip: "10580", state: "NY" },
  { street: "100 Forest Ave", city: "Rye", zip: "10580", state: "NY" },

  // Zone 2: Scarsdale, White Plains, New Rochelle, Pelham, Port Chester, Purchase
  { street: "88 Garth Rd", city: "Scarsdale", zip: "10583", state: "NY" },
  { street: "25 Spencer Pl", city: "Scarsdale", zip: "10583", state: "NY" },
  { street: "100 Mamaroneck Rd", city: "Scarsdale", zip: "10583", state: "NY" },
  { street: "100 Mamaroneck Ave", city: "White Plains", zip: "10601", state: "NY" },
  { street: "1 North Broadway", city: "White Plains", zip: "10601", state: "NY" },
  { street: "125 Westchester Ave", city: "White Plains", zip: "10601", state: "NY" },
  { street: "40 Pelham Rd", city: "New Rochelle", zip: "10801", state: "NY" },
  { street: "100 North Ave", city: "New Rochelle", zip: "10801", state: "NY" },
  { street: "10 Wolfs Ln", city: "Pelham", zip: "10803", state: "NY" },
  { street: "20 North Main St", city: "Port Chester", zip: "10573", state: "NY" },
  { street: "10 Willett Ave", city: "Port Chester", zip: "10573", state: "NY" },
  { street: "735 Anderson Hill Rd", city: "Purchase", zip: "10577", state: "NY" },
  { street: "455 Central Park Ave", city: "Scarsdale", zip: "10583", state: "NY" },
  { street: "200 Eastchester Rd", city: "Eastchester", zip: "10709", state: "NY" },

  // Zone 3: Greenwich, Old Greenwich, Riverside, Cos Cob, Stamford CT
  { street: "10 West Putnam Ave", city: "Greenwich", zip: "06830", state: "CT" },
  { street: "100 Greenwich Ave", city: "Greenwich", zip: "06830", state: "CT" },
  { street: "15 Sound Beach Ave", city: "Old Greenwich", zip: "06870", state: "CT" },
  { street: "300 Atlantic St", city: "Stamford", zip: "06901", state: "CT" },
  { street: "100 Summer St", city: "Stamford", zip: "06901", state: "CT" },
];

export function AddressAutocomplete({
  street,
  setStreet,
  city,
  setCity,
  zip,
  setZip,
  onSelectAddress,
  placeholder = "Street address",
  style = {},
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);

  const wrapperRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setStreet(val);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (abortControllerRef.current) abortControllerRef.current.abort();

    const query = val.toLowerCase().trim();

    // Smart Threshold: Requires 2+ numbers (e.g. "15", "120") OR 3+ letters (e.g. "bos", "mam")
    const isNumberQuery = /^\d{2,}/.test(query);
    const isTextQuery = query.length >= 3;
    const shouldTrigger = isNumberQuery || isTextQuery;

    if (!shouldTrigger) {
      setSuggestions([]);
      setShowDropdown(false);
      setLoading(false);
      return;
    }

    // 1. Instant local database lookup
    const localMatches = POPULAR_WESTCHESTER_STREETS.filter(item => {
      const cleanC = cleanTownName(item.city);
      return (
        item.street.toLowerCase().includes(query) ||
        `${item.street} ${cleanC}`.toLowerCase().includes(query)
      );
    }).map(item => ({
      ...item,
      city: cleanTownName(item.city),
    }));

    setSuggestions(localMatches);
    setShowDropdown(true);

    // 2. Debounced Remote Search (300ms) for verified addresses across NY & CT
    setLoading(true);
    debounceTimerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const searchQ = val.trim();
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&countrycodes=us&viewbox=-73.95,41.25,-73.45,40.85&bounded=1&q=${encodeURIComponent(searchQ)}`,
          {
            signal: controller.signal,
            headers: { "Accept-Language": "en-US,en" },
          }
        );

        if (res.ok) {
          const data = await res.json();
          const remoteMatches = data
            .map(item => {
              const a = item.address;
              const house = a.house_number ? `${a.house_number} ` : "";
              const road = a.road || a.pedestrian || a.street || "";
              const st = (house + road).trim();
              const rawTown = a.city || a.town || a.village || a.suburb || a.county || "";
              const town = cleanTownName(rawTown);
              const pc = a.postcode || "";
              if (!st) return null;
              return {
                street: st,
                city: town,
                zip: pc,
                state: a.state === "Connecticut" ? "CT" : "NY",
              };
            })
            .filter(Boolean);

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
      } catch (err) {
        if (err.name !== "AbortError") {
          // Retain instant local matches if rate limited or offline
        }
      } finally {
        setLoading(false);
      }
    }, 300);
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
          onFocus={() => {
            const query = street.toLowerCase().trim();
            if (/^\d{2,}/.test(query) || query.length >= 3) setShowDropdown(true);
          }}
          style={{
            width: "100%",
            padding: "13px 14px",
            borderRadius: 12,
            border: "1px solid rgba(250,246,239,0.18)",
            background: "#1c1814",
            color: "#FAF6EF",
            fontSize: 16,
            outline: "none",
            boxSizing: "border-box",
            fontFamily: "'Inter', sans-serif",
            WebkitAppearance: "none",
            appearance: "none",
            minHeight: 48,
            transition: "border-color 0.15s, box-shadow 0.15s",
            ...style,
          }}
        />
      </div>

      {/* Clean Dropdown List */}
      {showDropdown && suggestions.length > 0 && (
        <div
          style={{
            marginTop: 6,
            background: "#181410",
            border: "1px solid rgba(232,168,46,0.35)",
            borderRadius: 12,
            boxShadow: "0 10px 28px rgba(0,0,0,0.65)",
            overflow: "hidden",
            maxHeight: 230,
            overflowY: "auto",
          }}
        >
          {suggestions.map((item, idx) => {
            const displayCity = cleanTownName(item.city);
            return (
              <div
                key={idx}
                onClick={() => handleSelect(item)}
                onTouchStart={(e) => {
                  e.preventDefault();
                  handleSelect(item);
                }}
                style={{
                  padding: "12px 14px",
                  borderBottom: idx < suggestions.length - 1 ? "1px solid rgba(250,246,239,0.06)" : "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(232,168,46,0.16)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#FAF6EF", margin: 0 }}>
                    📍 {item.street}
                  </p>
                  <p style={{ fontSize: 12, color: "#B8A995", margin: "2px 0 0" }}>
                    {displayCity ? `${displayCity}, ` : ""}{item.state || "NY"} {item.zip ? item.zip : ""}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
