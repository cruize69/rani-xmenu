// api/admin/backup-list.js
// GET /api/admin/backup-list — every backup file available to restore from.

import { checkManagerAuth } from "../../lib/auth.js";
import { listOrderBackups } from "../../lib/backupRestore.js";
import { captureServerError } from "../../lib/sentry.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const auth = await checkManagerAuth(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  try {
    const backups = await listOrderBackups();
    return res.status(200).json({ backups });
  } catch (err) {
    console.error("backup-list failed:", err);
    captureServerError(err, { route: "admin/backup-list" });
    return res.status(500).json({ error: "Could not list backups." });
  }
}
