// ── Shared fixed-window rate limiting ────────────────────────────────
// Extracted from api/cart/save-draft.js once a third endpoint needed the
// same pattern. Fixed-window (not sliding) is deliberate: it's one KV op
// per check, and these limits exist to bound abuse cost, not to enforce a
// precise quota — a caller briefly getting up to 2x the cap across a window
// boundary is irrelevant at these thresholds.

import { kv } from "@vercel/kv";

/** Returns true if this key has exceeded `max` hits within `ttlSec`. */
export async function overLimit(key, max, ttlSec) {
  try {
    const count = await kv.incr(key);
    if (count === 1) await kv.expire(key, ttlSec);
    return count > max;
  } catch (e) {
    // Never let a KV hiccup in the limiter itself block a real customer.
    console.error("Rate limit check failed (allowing request):", e);
    return false;
  }
}

/** Best-effort client IP from Vercel's forwarding headers.
 *
 * Prefers x-real-ip, which Vercel's edge sets itself from the actual TCP
 * connection and a client cannot override. x-forwarded-for is client-
 * suppliable — Vercel appends the real IP as the LAST hop, but anything
 * a client sends is prepended in FRONT of it, so reading index [0] (as
 * this used to) returns whatever string the caller chose to send. Every
 * IP-keyed rate limit in this file (newsletter signups, cart-link SMS,
 * manager-auth lockout, etc.) was trivially bypassable by rotating a fake
 * x-forwarded-for value per request — reading the last hop instead closes
 * that without needing per-endpoint changes. */
export function clientIp(req) {
  const realIp = req.headers["x-real-ip"];
  if (realIp) return String(realIp).trim();
  const chain = (req.headers["x-forwarded-for"] ?? "").split(",").map(s => s.trim()).filter(Boolean);
  return chain[chain.length - 1] || "unknown";
}
