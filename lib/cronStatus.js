// lib/cronStatus.js
// Shared "last run" snapshot for every lifecycle cron — read by
// api/cron-status.js and rendered on the SalesDashboard Campaigns tab.
// Previously none of these crons left any trace of when they last ran or
// what they did; staff had no operational visibility beyond the aggregate
// send/claim counters in lib/notifications.js.

import { kv } from "@vercel/kv";

// Fixed list, matching the "path" segment under api/cron/*.js — used both
// to render a full status board (a job that's never run still shows up,
// as "never run") and to whitelist which jobs api/campaign-run.js is
// allowed to trigger on demand.
export const CRON_JOBS = [
  "win-back-lapsed",
  "second-order-push",
  "never-ordered-nudge",
  "newsletter-digest",
  "catering-cross-sell",
  "sweep-abandoned-carts",
  "review-nudge",
  "cultural-calendar",
];

export async function recordCronRun(name, result) {
  try {
    await kv.set(`cron-last-run:${name}`, JSON.stringify({ ...result, ranAt: new Date().toISOString() }));
  } catch (e) { console.error(`recordCronRun(${name}) failed:`, e); }
}
