// api/campaign-run.js
// POST /api/campaign-run  Body: { job: "win-back-lapsed" }
// Protected by MANAGER_SECRET — lets staff trigger a lifecycle cron on
// demand from the SalesDashboard Campaigns tab instead of waiting for its
// schedule. Safe to call anytime: every cron this whitelists is idempotent
// (dedup keys per customer/subscriber), so running one early never
// double-messages anyone who was already sent to — it only processes
// whoever's currently eligible and hasn't been reached yet.
//
// Implemented as a server-to-server call to the real api/cron/{job}.js
// endpoint (with the actual CRON_SECRET this server already holds) rather
// than importing/duplicating each cron's logic — one code path, one
// source of truth for what a given cron actually does.

import { CRON_JOBS } from "../lib/cronStatus.js";
import { isManagerSecretValid } from "../lib/auth.js";

const BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL || "https://ranimahal.food").replace(/\/$/, "");

export default async function handler(req, res) {
  if (!isManagerSecretValid(req.headers["x-manager-secret"])) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { job } = req.body || {};
  if (!CRON_JOBS.includes(job)) {
    return res.status(400).json({ error: "Unknown job." });
  }

  try {
    const headers = {};
    if (process.env.CRON_SECRET) headers["Authorization"] = `Bearer ${process.env.CRON_SECRET}`;

    const cronRes = await fetch(`${BASE_URL}/api/cron/${job}`, { headers });
    const body = await cronRes.json().catch(() => ({}));

    if (!cronRes.ok) {
      return res.status(502).json({ error: `${job} returned HTTP ${cronRes.status}`, detail: body });
    }
    return res.status(200).json({ ok: true, job, result: body });
  } catch (e) {
    console.error(`Manual run of ${job} failed:`, e);
    return res.status(500).json({ error: "Failed to trigger job." });
  }
}
