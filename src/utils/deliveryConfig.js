// ── Tiered Delivery Configuration & Zone Definitions ───────────────────
// Rani Mahal: 327 Mamaroneck Ave, Mamaroneck, NY 10543
// Zones ordered strictly by driving distance from the restaurant.

export const DELIVERY_CONFIG = {
  FEE: 6.99,
  FREE_THRESHOLD: 99.00,
  DEFAULT_MINIMUM: 50.00,
  PICKUP_ETA: "25–35 min",
};

export const DELIVERY_ZONES = {
  // ── Zone 1: Immediate neighbors — closest to the restaurant ──────────
  ZONE_1: {
    id: "zone_1",
    name: "Zone 1 (Core Local)",
    label: "Zone 1: Mamaroneck, Larchmont, Harrison, Rye",
    minOrder: 50.00,
    eta: "30–40 min",
    zips: new Set([
      "10543", // Mamaroneck
      "10538", // Larchmont
      "10528", // Harrison
      "10580", // Rye
    ]),
  },

  // ── Zone 2: Mid Westchester — within reasonable range ───────────────
  ZONE_2: {
    id: "zone_2",
    name: "Zone 2 (Mid Westchester)",
    label: "Zone 2: Scarsdale, White Plains, New Rochelle, Port Chester, Purchase, Eastchester",
    minOrder: 60.00,
    eta: "40–50 min",
    zips: new Set([
      "10583",                              // Scarsdale
      "10601", "10604", "10605",
      "10606", "10607",                     // White Plains (core ZIPs)
      "10801", "10804", "10805",            // New Rochelle
      "10573",                              // Port Chester
      "10577",                              // Purchase
      "10709",                              // Eastchester
    ]),
  },

  // ── Zone 3: Outer Westchester + Fairfield CT — farthest from restaurant ─
  ZONE_3: {
    id: "zone_3",
    name: "Zone 3 (Outer Westchester / Fairfield CT)",
    label: "Zone 3: Bronxville, Pelham, Mt. Vernon, Hartsdale, Tuckahoe, Ardsley, Dobbs Ferry, Elmsford, Irvington, Valhalla, North White Plains, Greenwich, Stamford",
    minOrder: 70.00,
    eta: "50–65 min",
    zips: new Set([
      // Outer Westchester (moved up from Zone 2 or newly added)
      "10708",                              // Bronxville
      "10803",                              // Pelham
      "10550", "10552", "10553",            // Mt. Vernon
      "10530",                              // Hartsdale
      "10707",                              // Tuckahoe
      "10502",                              // Ardsley
      "10522",                              // Dobbs Ferry
      "10523",                              // Elmsford
      "10533",                              // Irvington
      "10595",                              // Valhalla
      "10603",                              // North White Plains
      // Fairfield County, CT
      "06830", "06831",                     // Greenwich
      "06870",                              // Old Greenwich
      "06878",                              // Riverside
      "06807",                              // Cos Cob
      "06901", "06902", "06903",
      "06905", "06906", "06907",            // Stamford
    ]),
  },
};

// ── ZIP → Town/State/Zone Lookup ─────────────────────────────────────────
export const ZIP_TOWN_MAP = {

  // ── Zone 1 ───────────────────────────────────────────────────────────
  "10543": { city: "Mamaroneck", state: "NY", zoneId: "zone_1" },
  "10538": { city: "Larchmont",  state: "NY", zoneId: "zone_1" },
  "10528": { city: "Harrison",   state: "NY", zoneId: "zone_1" },
  "10580": { city: "Rye",        state: "NY", zoneId: "zone_1" },

  // ── Zone 2 ───────────────────────────────────────────────────────────
  "10583": { city: "Scarsdale",    state: "NY", zoneId: "zone_2" },
  "10601": { city: "White Plains", state: "NY", zoneId: "zone_2" },
  "10604": { city: "White Plains", state: "NY", zoneId: "zone_2" },
  "10605": { city: "White Plains", state: "NY", zoneId: "zone_2" },
  "10606": { city: "White Plains", state: "NY", zoneId: "zone_2" },
  "10607": { city: "White Plains", state: "NY", zoneId: "zone_2" },
  "10801": { city: "New Rochelle", state: "NY", zoneId: "zone_2" },
  "10804": { city: "New Rochelle", state: "NY", zoneId: "zone_2" },
  "10805": { city: "New Rochelle", state: "NY", zoneId: "zone_2" },
  "10573": { city: "Port Chester", state: "NY", zoneId: "zone_2" },
  "10577": { city: "Purchase",     state: "NY", zoneId: "zone_2" },
  "10709": { city: "Eastchester",  state: "NY", zoneId: "zone_2" },

  // ── Zone 3 — Outer Westchester ────────────────────────────────────────
  "10708": { city: "Bronxville",        state: "NY", zoneId: "zone_3" },
  "10803": { city: "Pelham",            state: "NY", zoneId: "zone_3" },
  "10550": { city: "Mt. Vernon",        state: "NY", zoneId: "zone_3" },
  "10552": { city: "Mt. Vernon",        state: "NY", zoneId: "zone_3" },
  "10553": { city: "Mt. Vernon",        state: "NY", zoneId: "zone_3" },
  "10530": { city: "Hartsdale",         state: "NY", zoneId: "zone_3" },
  "10707": { city: "Tuckahoe",          state: "NY", zoneId: "zone_3" },
  "10502": { city: "Ardsley",           state: "NY", zoneId: "zone_3" },
  "10522": { city: "Dobbs Ferry",       state: "NY", zoneId: "zone_3" },
  "10523": { city: "Elmsford",          state: "NY", zoneId: "zone_3" },
  "10533": { city: "Irvington",         state: "NY", zoneId: "zone_3" },
  "10595": { city: "Valhalla",          state: "NY", zoneId: "zone_3" },
  "10603": { city: "North White Plains", state: "NY", zoneId: "zone_3" },

  // ── Zone 3 — Fairfield County, CT ────────────────────────────────────
  "06830": { city: "Greenwich",     state: "CT", zoneId: "zone_3" },
  "06831": { city: "Greenwich",     state: "CT", zoneId: "zone_3" },
  "06870": { city: "Old Greenwich", state: "CT", zoneId: "zone_3" },
  "06878": { city: "Riverside",     state: "CT", zoneId: "zone_3" },
  "06807": { city: "Cos Cob",       state: "CT", zoneId: "zone_3" },
  "06901": { city: "Stamford",      state: "CT", zoneId: "zone_3" },
  "06902": { city: "Stamford",      state: "CT", zoneId: "zone_3" },
  "06903": { city: "Stamford",      state: "CT", zoneId: "zone_3" },
  "06905": { city: "Stamford",      state: "CT", zoneId: "zone_3" },
  "06906": { city: "Stamford",      state: "CT", zoneId: "zone_3" },
  "06907": { city: "Stamford",      state: "CT", zoneId: "zone_3" },
};

export const ALLOWED_DELIVERY_ZIPS = new Set(Object.keys(ZIP_TOWN_MAP));

// ── Utility Functions ─────────────────────────────────────────────────────

export function calcDeliveryFee(subtotal) {
  if (subtotal >= DELIVERY_CONFIG.FREE_THRESHOLD) return 0;
  return DELIVERY_CONFIG.FEE;
}

export function lookupTownByZip(zip) {
  if (!zip) return null;
  const clean = String(zip).trim().slice(0, 5);
  return ZIP_TOWN_MAP[clean] || null;
}

export function getDeliveryZoneForZip(zip) {
  if (!zip) return null;
  const clean = String(zip).trim().slice(0, 5);
  if (DELIVERY_ZONES.ZONE_1.zips.has(clean)) return DELIVERY_ZONES.ZONE_1;
  if (DELIVERY_ZONES.ZONE_2.zips.has(clean)) return DELIVERY_ZONES.ZONE_2;
  if (DELIVERY_ZONES.ZONE_3.zips.has(clean)) return DELIVERY_ZONES.ZONE_3;
  return null;
}

export function cleanTownName(name) {
  if (!name) return "";
  return String(name)
    .replace(/^(village of|city of|town of|borough of|township of)\s+/i, "")
    .replace(/\s+(village|city|town|borough|township)$/i, "")
    .trim();
}

export function isZipInDeliveryZone(zip) {
  if (!zip) return false;
  const clean = String(zip).trim().slice(0, 5);
  return ALLOWED_DELIVERY_ZIPS.has(clean);
}
