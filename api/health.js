// api/health.js
// GET /api/health — public, unauthenticated, meant to be hit every few
// minutes by an external uptime monitor (UptimeRobot, Better Uptime, etc.).
// Previously nothing in this stack would notice a full outage until a
// customer complained — this is the thing an external monitor actually
// pings.
//
// Deliberately checks the real dependency the app can't function without
// (Vercel KV) rather than just returning 200 unconditionally — a "health"
// endpoint that can't fail isn't telling you anything.

import { kv } from "../lib/kv.js";

export default async function handler(req, res) {
  const checks = {};
  let healthy = true;

  try {
    const start = Date.now();
    await kv.ping();
    checks.kv = { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    checks.kv = { ok: false, error: err.message || String(err) };
    healthy = false;
  }

  res.setHeader("Cache-Control", "no-store");
  return res.status(healthy ? 200 : 503).json({
    ok: healthy,
    timestamp: new Date().toISOString(),
    checks,
  });
}
