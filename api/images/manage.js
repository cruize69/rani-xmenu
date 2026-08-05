// api/images/manage.js
// POST   /api/images/manage   — multipart upload: { itemId, file }
// DELETE /api/images/manage   — { itemId } — remove image
//
// Consolidated from the old upload.js + delete.js so the deployment stays
// under Vercel's Hobby-plan 12-serverless-function limit. api/images/list.js
// (customer-facing) stays separate.

import { put, del } from "@vercel/blob";
import { kv }        from "@vercel/kv";
import { IncomingForm } from "formidable";
import { buffer }    from "micro";
import fs from "fs";

// bodyParser must stay off for multipart upload; DELETE's JSON body is
// parsed manually below since this config applies to the whole handler.
export const config = { api: { bodyParser: false } };

// Vercel serverless functions hard-cap the whole request body at 4.5MB —
// a platform limit below our own file-size check, so anything close to 5MB
// was getting rejected before this handler even ran. Staying at 4MB leaves
// headroom for multipart form overhead.
const MAX_BYTES = 4 * 1024 * 1024;
const ACCEPTED  = ["image/jpeg", "image/png", "image/webp", "image/avif"];

export default async function handler(req, res) {
  if (req.headers["x-manager-secret"] !== process.env.MANAGER_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method === "POST")   return handleUpload(req, res);
  if (req.method === "DELETE") return handleDelete(req, res);
  return res.status(405).json({ error: "Method not allowed" });
}

async function handleUpload(req, res) {
  const form = new IncomingForm({ maxFileSize: MAX_BYTES, keepExtensions: true });

  const { fields, files } = await new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });

  const itemId = Array.isArray(fields.itemId) ? fields.itemId[0] : fields.itemId;
  const file   = Array.isArray(files.file)   ? files.file[0]   : files.file;

  if (!itemId) return res.status(400).json({ error: "itemId required" });
  if (!file)   return res.status(400).json({ error: "file required" });

  if (!ACCEPTED.includes(file.mimetype)) {
    return res.status(400).json({ error: `Invalid file type: ${file.mimetype}. Use JPEG, PNG, WebP or AVIF.` });
  }
  if (file.size > MAX_BYTES) {
    return res.status(400).json({ error: `File too large (${(file.size/1024/1024).toFixed(1)}MB). Max 4MB.` });
  }

  try {
    const existingUrl = await kv.get(`image:${itemId}`);
    if (existingUrl) {
      try { await del(existingUrl); }
      catch (e) { console.warn("Could not delete old blob:", e.message); }
    }

    const ext      = file.originalFilename?.split(".").pop() ?? "jpg";
    const pathname = `menu-images/${itemId}.${ext}`;
    const buf      = fs.readFileSync(file.filepath);

    // A unique URL per upload (Blob's default) — reusing the same URL on
    // replace meant the browser and Blob's own CDN cache would keep serving
    // the old cached bytes at that URL even after the content changed.
    const blob = await put(pathname, buf, {
      access:      "public",
      contentType: file.mimetype,
    });

    await kv.set(`image:${itemId}`, blob.url);
    try { fs.unlinkSync(file.filepath); } catch {}

    console.log(`Image uploaded: ${itemId} → ${blob.url}`);

    return res.status(200).json({ success: true, itemId, url: blob.url, size: file.size });

  } catch (err) {
    console.error("Upload error:", err);
    return res.status(500).json({ error: err.message });
  }
}

async function handleDelete(req, res) {
  let itemId;
  try {
    const raw = await buffer(req);
    ({ itemId } = JSON.parse(raw.toString() || "{}"));
  } catch {
    return res.status(400).json({ error: "Invalid JSON body" });
  }
  if (!itemId) return res.status(400).json({ error: "itemId required" });

  try {
    const url = await kv.get(`image:${itemId}`);
    if (!url) return res.status(404).json({ error: `No image found for ${itemId}` });

    await del(url);
    await kv.del(`image:${itemId}`);

    console.log(`Image deleted: ${itemId}`);
    return res.status(200).json({ success: true, itemId });

  } catch (err) {
    console.error("Delete error:", err);
    return res.status(500).json({ error: err.message });
  }
}
