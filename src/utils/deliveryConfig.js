// ── Tiered Delivery Configuration & Zone Definitions ───────────────────

export const DELIVERY_CONFIG = {
  FEE: 6.99,
  FREE_THRESHOLD: 99.00,
  DEFAULT_MINIMUM: 50.00,
  PICKUP_ETA: "25–35 min",
};

// 3 Distinct Delivery Zones
export const DELIVERY_ZONES = {
  ZONE_1: {
    id: "zone_1",
    name: "Zone 1 (Core Local)",
    label: "Zone 1: Mamaroneck, Larchmont, Harrison, Rye",
    minOrder: 50.00,
    eta: "35–45 min",
    zips: new Set(["10543", "10538", "10528", "10580"]),
  },
  ZONE_2: {
    id: "zone_2",
    name: "Zone 2 (Mid Westchester)",
    label: "Zone 2: Scarsdale, White Plains, New Rochelle, Pelham, Port Chester, Purchase, Eastchester, Tuckahoe, Bronxville, Hartsdale, Ardsley, Dobbs Ferry",
    minOrder: 60.00,
    eta: "45–55 min",
    zips: new Set([
      "10583", "10601", "10603", "10604", "10605", "10606", "10607", // Scarsdale & White Plains
      "10801", "10804", "10805", "10803", // New Rochelle & Pelham
      "10573", "10577", // Port Chester & Purchase
      "10530", "10707", "10708", "10709", // Hartsdale, Tuckahoe, Bronxville, Eastchester
      "10502", "10522", "10523" // Ardsley, Dobbs Ferry, Elmsford
    ]),
  },
  ZONE_3: {
    id: "zone_3",
    name: "Zone 3 (Fairfield CT / Outer)",
    label: "Zone 3: Greenwich, Old Greenwich, Riverside, Cos Cob, Stamford",
    minOrder: 70.00,
    eta: "50–65 min",
    zips: new Set([
      "06830", "06831", "06870", "06878", "06807", // Greenwich, Old Greenwich, Riverside, Cos Cob
      "06901", "06902", "06903", "06905", "06906", "06907" // Stamford
    ]),
  },
};

// Supported ZIP codes and Town/City Lookup across Westchester & Fairfield Counties
export const ZIP_TOWN_MAP = {
  // Zone 1: Mamaroneck, Larchmont, Harrison, Rye
  "10543": { city: "Mamaroneck", state: "NY", zoneId: "zone_1" },
  "10538": { city: "Larchmont", state: "NY", zoneId: "zone_1" },
  "10528": { city: "Harrison", state: "NY", zoneId: "zone_1" },
  "10580": { city: "Rye", state: "NY", zoneId: "zone_1" },

  // Zone 2: Scarsdale, White Plains, New Rochelle, Pelham, Port Chester, Purchase, Eastchester, etc.
  "10583": { city: "Scarsdale", state: "NY", zoneId: "zone_2" },
  "10601": { city: "White Plains", state: "NY", zoneId: "zone_2" },
  "10603": { city: "White Plains", state: "NY", zoneId: "zone_2" },
  "10604": { city: "White Plains", state: "NY", zoneId: "zone_2" },
  "10605": { city: "White Plains", state: "NY", zoneId: "zone_2" },
  "10606": { city: "White Plains", state: "NY", zoneId: "zone_2" },
  "10607": { city: "White Plains", state: "NY", zoneId: "zone_2" },
  "10801": { city: "New Rochelle", state: "NY", zoneId: "zone_2" },
  "10804": { city: "New Rochelle", state: "NY", zoneId: "zone_2" },
  "10805": { city: "New Rochelle", state: "NY", zoneId: "zone_2" },
  "10803": { city: "Pelham", state: "NY", zoneId: "zone_2" },
  "10573": { city: "Port Chester", state: "NY", zoneId: "zone_2" },
  "10577": { city: "Purchase", state: "NY", zoneId: "zone_2" },
  "10530": { city: "Hartsdale", state: "NY", zoneId: "zone_2" },
  "10707": { city: "Tuckahoe", state: "NY", zoneId: "zone_2" },
  "10708": { city: "Bronxville", state: "NY", zoneId: "zone_2" },
  "10709": { city: "Eastchester", state: "NY", zoneId: "zone_2" },
  "10502": { city: "Ardsley", state: "NY", zoneId: "zone_2" },
  "10522": { city: "Dobbs Ferry", state: "NY", zoneId: "zone_2" },
  "10523": { city: "Elmsford", state: "NY", zoneId: "zone_2" },

  // Zone 3: Greenwich & Lower Fairfield County, CT
  "06830": { city: "Greenwich", state: "CT", zoneId: "zone_3" },
  "06831": { city: "Greenwich", state: "CT", zoneId: "zone_3" },
  "06870": { city: "Old Greenwich", state: "CT", zoneId: "zone_3" },
  "06878": { city: "Riverside", state: "CT", zoneId: "zone_3" },
  "06807": { city: "Cos Cob", state: "CT", zoneId: "zone_3" },

  // Stamford CT
  "06901": { city: "Stamford", state: "CT", zoneId: "zone_3" },
  "06902": { city: "Stamford", state: "CT", zoneId: "zone_3" },
  "06903": { city: "Stamford", state: "CT", zoneId: "zone_3" },
  "06905": { city: "Stamford", state: "CT", zoneId: "zone_3" },
  "06906": { city: "Stamford", state: "CT", zoneId: "zone_3" },
  "06907": { city: "Stamford", state: "CT", zoneId: "zone_3" },
};

export const ALLOWED_DELIVERY_ZIPS = new Set(Object.keys(ZIP_TOWN_MAP));

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
  if (!zip) return DELIVERY_ZONES.ZONE_1;
  const clean = String(zip).trim().slice(0, 5);
  if (DELIVERY_ZONES.ZONE_1.zips.has(clean)) return DELIVERY_ZONES.ZONE_1;
  if (DELIVERY_ZONES.ZONE_2.zips.has(clean)) return DELIVERY_ZONES.ZONE_2;
  if (DELIVERY_ZONES.ZONE_3.zips.has(clean)) return DELIVERY_ZONES.ZONE_3;
  return null;
}

export function isZipInDeliveryZone(zip) {
  if (!zip) return false;
  const clean = String(zip).trim().slice(0, 5);
  return ALLOWED_DELIVERY_ZIPS.has(clean);
}
