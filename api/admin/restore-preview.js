// api/admin/restore-preview.js
// GET /api/admin/restore-preview?pathname=... — decrypts a backup file and
// compares it against live order stats WITHOUT writing anything. This is
// what the Sales Dashboard shows before the restore confirm step — the
// whole point is that nothing happens silently.

import { checkManagerAuth } from "../../lib/auth.js";
import { previewRestore } from "../../lib/backupRestore.js";
import { captureServerError } from "../../lib/sentry.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const auth = await checkManagerAuth(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const pathname = typeof req.query.pathname === "string" ? req.query.pathname : "";
  if (!pathname) return res.status(400).json({ error: "pathname required" });

  try {
    const preview = await previewRestore(pathname);
    return res.status(200).json(preview);
  } catch (err) {
    console.error("restore-preview failed:", err);
    captureServerError(err, { route: "admin/restore-preview" });
    return res.status(500).json({ error: err.message || "Could not read backup file." });
  }
}
