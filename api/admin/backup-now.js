// api/admin/backup-now.js
// POST /api/admin/backup-now — staff-triggered, on-demand, complete backup
// of every order ever placed (as opposed to the weekly cron's rolling
// 8-day window). What the Sales Dashboard's "Back Up Now" button calls.

import { checkManagerAuth } from "../../lib/auth.js";
import { runFullOrderBackup } from "../../lib/backupRestore.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const auth = await checkManagerAuth(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  try {
    const result = await runFullOrderBackup();
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    console.error("backup-now failed:", err);
    return res.status(500).json({ error: err.message || "Backup failed." });
  }
}
