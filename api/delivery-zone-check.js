// api/delivery-zone-check.js
// GET /api/delivery-zone-check?zip=10580
// Public, read-only lookup — the live-verification counterpart to what the
// ordering app's own CartDrawer.jsx already does client-side by importing
// src/utils/deliveryConfig.js directly. That file isn't reachable from the
// marketing site (separate repo/bundler), so the catering checkout modal
// calls this instead — same underlying zone data, same "are we sure yet"
// semantics (isCompleteZip vs isZipConfirmedOutOfZone), just over the wire.
// No side effects, no real data to leak (zone labels are already public
// marketing copy) — but still rate-limited to bound free compute-cost
// amplification from a scripted caller.

import { getDeliveryZoneForZip, isCompleteZip, SERVED_AREAS_MESSAGE } from "../src/utils/deliveryConfig.js";
import { overLimit, clientIp } from "../lib/rateLimit.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (await overLimit(`zone-check-rl:ip:${clientIp(req)}`, 60, 3600)) {
    return res.status(429).json({ error: "Too many requests. Please try again later." });
  }

  res.setHeader("Cache-Control", "public, max-age=86400");

  const zip = typeof req.query.zip === "string" ? req.query.zip.trim() : "";

  if (!isCompleteZip(zip)) {
    // Still typing — neither confirmed served nor confirmed out of zone.
    return res.status(200).json({ status: "incomplete" });
  }

  const zone = getDeliveryZoneForZip(zip);
  if (!zone) {
    return res.status(200).json({ status: "out_of_zone", message: SERVED_AREAS_MESSAGE });
  }

  return res.status(200).json({ status: "served", zoneLabel: zone.label, eta: zone.eta });
}
