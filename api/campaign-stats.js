// api/campaign-stats.js
// GET /api/campaign-stats
// Protected by MANAGER_SECRET, same as api/analytics.js and api/orders.js.
//
// Reads the campaign-stats:{source}:sent / :claimed counters written by
// lib/notifications.js's recordCampaignSent/recordCampaignClaimed —
// instrumentation that didn't exist before: none of the lifecycle crons
// (win-back, second-order-push, abandoned-cart, newsletter) tracked whether
// anyone actually used what was sent. "Claimed" means a checkout session
// was started with that voucher, not that the order was ultimately paid —
// good enough to compare touches against each other, not a substitute for
// real revenue attribution against paid orders.

import { kv } from "@vercel/kv";
import { isManagerSecretValid } from "../lib/auth.js";

// Fixed list rather than a KV scan — every source string a voucher/email
// can be tagged with lives in exactly the call sites below, so there's no
// discovery problem, and a fixed list means new/renamed sources show up as
// an explicit code change instead of silently appearing or disappearing.
const KNOWN_SOURCES = [
  "winback",
  "winback-touch2",
  "second-order-touch1",
  "second-order-touch2",
  "abandoned-lead-touch1",
  "abandoned-draft-touch1",
  "abandoned-cart",
  "newsletter-welcome",
  "never-ordered",
  "newsletter-digest",
  "referral",
  "catering-cross-sell",
];

export default async function handler(req, res) {
  if (!isManagerSecretValid(req.headers["x-manager-secret"])) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const rows = await Promise.all(KNOWN_SOURCES.map(async source => {
      const [sent, claimed] = await Promise.all([
        kv.get(`campaign-stats:${source}:sent`),
        kv.get(`campaign-stats:${source}:claimed`),
      ]);
      const sentN = Number(sent) || 0;
      const claimedN = Number(claimed) || 0;
      return {
        source,
        sent: sentN,
        claimed: claimedN,
        claimRate: sentN > 0 ? Number((claimedN / sentN * 100).toFixed(1)) : null,
      };
    }));

    return res.status(200).json({ ok: true, campaigns: rows });
  } catch (e) {
    console.error("Campaign stats fetch failed:", e);
    return res.status(500).json({ error: "Failed to load campaign stats" });
  }
}
