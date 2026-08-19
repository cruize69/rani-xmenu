// api/admin/restore-batch.js
// POST /api/admin/restore-batch { pathname, cursor, confirm: true }
//
// Processes one batch of a restore (merge, never overwrite/delete — see
// lib/backupRestore.js's header for the actual semantics) and returns the
// next cursor. The Sales Dashboard calls this repeatedly until `done`,
// showing a live progress bar. Requires `confirm: true` explicitly in the
// body on top of staff auth — cheap insurance against this ever firing
// from a stray retry or a misconfigured client without a real person
// having gone through the preview step first.

import { checkManagerAuth } from "../../lib/auth.js";
import { restoreBatch } from "../../lib/backupRestore.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const auth = await checkManagerAuth(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const { pathname, cursor, confirm } = req.body || {};
  if (!pathname) return res.status(400).json({ error: "pathname required" });
  if (confirm !== true) return res.status(400).json({ error: "confirm:true required" });

  try {
    const result = await restoreBatch(pathname, Number(cursor) || 0);
    return res.status(200).json(result);
  } catch (err) {
    console.error("restore-batch failed:", err);
    return res.status(500).json({ error: err.message || "Restore batch failed." });
  }
}
