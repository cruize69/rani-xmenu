// ── Tiered Delivery Configuration & Zone Definitions ───────────────────
// Rani Mahal: 327 Mamaroneck Ave, Mamaroneck, NY 10543
// Zones ordered strictly by driving distance from the restaurant.

export const DELIVERY_CONFIG = {
  FEE: 6.99,
  FREE_THRESHOLD: 99.00,
  DEFAULT_MINIMUM: 50.00,
};

// Single source of truth for quoted times. Delivery ETA is per-zone (see
// DELIVERY_ZONES below) — these two constants only cover pickup, and the
// fallback used when we don't know the customer's zone yet.
//
// These exist because "45–60 min" was previously hardcoded in four places
// (checkout toggle, stored order record, receipt email) while the
// fulfillment sheet quoted the real per-zone figure. A Mamaroneck customer
// was told 45–60 when we actually deliver in 30–40; a Greenwich customer
// was promised 45–60 on their receipt against a real 50–65. Anything that
// quotes a time now derives it from here or from the zone.
export const PICKUP_ETA = "25–35 min";
export const DEFAULT_DELIVERY_ETA = "45–60 min";

/** Quoted delivery window for a ZIP, falling back when the zone is unknown. */
export function getDeliveryEtaForZip(zip) {
  return getDeliveryZoneForZip(zip)?.eta || DEFAULT_DELIVERY_ETA;
}

/** Quoted fulfillment window for an order, whichever mode it is. */
export function getEtaFor(orderMode, zip) {
  return orderMode === "delivery" ? getDeliveryEtaForZip(zip) : PICKUP_ETA;
}

export const DELIVERY_ZONES = {
  // ── Zone 1: Immediate neighbors — closest to the restaurant ──────────
  ZONE_1: {
    id: "zone_1",
    name: "Zone 1 (Core Local)",
    label: "Zone 1: Mamaroneck, Larchmont, Harrison, Rye",
    minOrder: 50.00,
    // Policy (2026-08-17, owner decision after a real Zone 1 delivery order
    // to Rye read as too fast): every delivery zone quotes AT LEAST 45-60
    // min, no exceptions, even the closest zone — under-promise, over-
    // deliver, rather than tune each zone's number down to its real average
    // drive time. Was briefly "35-50" (a same-day interim fix for the exact
    // same complaint) before this floor was set as the actual standing rule.
    eta: "45–60 min",
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
    // Same 45-60 floor as Zone 1 — was "40-50 min", below the standing
    // minimum. See ZONE_1's comment for the policy this enforces.
    eta: "45–60 min",
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

// True only once we have a complete ZIP to judge — a 2-digit in-progress
// ZIP and a genuinely out-of-zone 5-digit ZIP must never look the same to
// the caller. Two Westchester/Yonkers customers independently built a full
// priced cart and reached a live "Continue to payment" button before being
// rejected, because every caller treated "zone unknown" (still typing) and
// "zone: none" (out of range) as the same case and fell back to default
// pricing for both.
export function isCompleteZip(zip) {
  return !!zip && String(zip).trim().length >= 5;
}

/** True once a complete ZIP resolves to no served zone — a hard block. */
export function isZipConfirmedOutOfZone(zip) {
  return isCompleteZip(zip) && !getDeliveryZoneForZip(zip);
}

// Single source of truth for the served-area message, DERIVED from the zone
// labels above rather than hand-typed — a hand-typed copy is exactly how the
// old message went stale (it named ~13 towns; the zones above actually cover
// closer to 20, including Bronxville, Mt. Vernon, Hartsdale, Tuckahoe,
// Ardsley, Dobbs Ferry, Elmsford, Irvington, Valhalla and Riverside/Cos Cob,
// none of which the old copy mentioned). A Yonkers customer — who IS in
// Westchester — was also told "Delivery is currently available for
// Westchester & Greenwich/Stamford areas," which reads as confirmation, not
// rejection. Name the towns instead; nobody misreads a list they're not on.
const SERVED_TOWNS = [DELIVERY_ZONES.ZONE_1, DELIVERY_ZONES.ZONE_2, DELIVERY_ZONES.ZONE_3]
  .map(z => z.label.replace(/^Zone \d+:\s*/, ""))
  .join(", ");

export const SERVED_AREAS_MESSAGE =
  `We deliver to ${SERVED_TOWNS}. Your ZIP isn't in that list yet — pickup at ` +
  `327 Mamaroneck Ave is still available with no minimum.`;

// Strips municipal designators off geocoder town names. The leading pattern
// allows a SLASH-COMBINED run of designators, which the old single-word
// version missed: OpenStreetMap returns Harrison — a Zone 1 served town — as
// "Town/Village of Harrison" (NY genuinely incorporates it as both), and it
// was flowing through uncleaned into the City field, the cart's "minimum for
// {city}" line, the kitchen ticket, and the driver's address. Verified live
// against the geocoder: "City of Rye", "Village of Port Chester" and
// "City of White Plains" already cleaned fine; only the slash forms leaked.
const MUNI_DESIGNATOR = "village|city|town|borough|township|hamlet";

export function cleanTownName(name) {
  if (!name) return "";
  return String(name)
    .replace(new RegExp(`^(?:(?:${MUNI_DESIGNATOR})\\s*/\\s*)*(?:${MUNI_DESIGNATOR})\\s+of\\s+`, "i"), "")
    .replace(new RegExp(`\\s+(?:${MUNI_DESIGNATOR})$`, "i"), "")
    .trim();
}

export function isZipInDeliveryZone(zip) {
  if (!zip) return false;
  const clean = String(zip).trim().slice(0, 5);
  return ALLOWED_DELIVERY_ZIPS.has(clean);
}
