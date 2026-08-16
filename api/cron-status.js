// api/cron-status.js
// GET /api/cron-status
// Protected by MANAGER_SECRET, same as api/analytics.js and api/campaign-stats.js.
//
// Reads the cron-last-run:{name} snapshots written by lib/cronStatus.js's
// recordCronRun — real operational visibility into every lifecycle cron:
// when it last ran, and what it actually did (sent/skipped/candidates,
// shape varies per job). A job that's never run comes back as null, not
// omitted, so the dashboard can show "never run" explicitly.

import { kv } from "@vercel/kv";
import { checkManagerAuth } from "../lib/auth.js";
import { CRON_JOBS } from "../lib/cronStatus.js";

export default async function handler(req, res) {
  const auth = await checkManagerAuth(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const jobs = await Promise.all(CRON_JOBS.map(async name => {
      const raw = await kv.get(`cron-last-run:${name}`);
      const lastRun = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : null;
      return { name, lastRun };
    }));

    return res.status(200).json({ ok: true, jobs });
  } catch (e) {
    console.error("Cron status fetch failed:", e);
    return res.status(500).json({ error: "Failed to load cron status" });
  }
}
