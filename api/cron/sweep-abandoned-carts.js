// Vercel Cron target — runs the abandoned-cart recovery sweep on a schedule.
// Previously this piggybacked on every GET /api/orders request (a Hobby-plan
// workaround, since Cron was capped at once/day there); Pro allows arbitrary
// schedules, so it now runs independently and no longer adds load to the
// staff-dashboard polling hot path.
import { sweepAbandonedCarts } from "../../lib/abandonedCart.js";
import { recordCronRun } from "../../lib/cronStatus.js";
import { isCronSecretValid } from "../../lib/auth.js";

export default async function handler(req, res) {
  if (!isCronSecretValid(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const result = await sweepAbandonedCarts();
    await recordCronRun("sweep-abandoned-carts", result);
    return res.status(200).json({ ok: true, result });
  } catch (err) {
    console.error("Cron sweepAbandonedCarts error:", err);
    return res.status(500).json({ error: "Sweep failed" });
  }
}
