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

/** Best-effort client IP from Vercel's forwarding headers. */
export function clientIp(req) {
  return (req.headers["x-forwarded-for"] ?? "").split(",")[0].trim() || "unknown";
}
