// api/images/upload.js
// POST /api/images/upload
// Multipart form: { itemId, file }
// Uploads image to Vercel Blob, stores URL in KV, returns { url }
//
// Setup: run `vercel blob enable` in your project once to activate Blob storage.
// Add BLOB_READ_WRITE_TOKEN to your Vercel environment variables (auto-added by Vercel).

import { put }    from "@vercel/blob";
import { kv }     from "@vercel/kv";
import { IncomingForm } from "formidable";
import fs from "fs";

// Vercel: disable default body parser so we can handle multipart
export const config = { api: { bodyParser: false } };

// Max image size — 5MB
const MAX_BYTES = 5 * 1024 * 1024;

// Accepted image types
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/avif"];

export default async function handler(req, res) {
  // Auth
  if (req.headers["x-manager-secret"] !== process.env.MANAGER_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Parse multipart form
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

  // Validate file type
  if (!ACCEPTED.includes(file.mimetype)) {
    return res.status(400).json({ error: `Invalid file type: ${file.mimetype}. Use JPEG, PNG, WebP or AVIF.` });
  }

  // Validate file size
  if (file.size > MAX_BYTES) {
    return res.status(400).json({ error: `File too large (${(file.size/1024/1024).toFixed(1)}MB). Max 5MB.` });
  }

  try {
    // Delete old blob if one exists for this item
    const existingUrl = await kv.get(`image:${itemId}`);
    if (existingUrl) {
      try {
        const { del } = await import("@vercel/blob");
        await del(existingUrl);
      } catch (e) {
        // Old blob deletion failure is non-fatal
        console.warn("Could not delete old blob:", e.message);
      }
    }

    // Upload to Vercel Blob
    // Pathname: menu-images/item-garlic-naan.jpg (clean, no collisions)
    const ext      = file.originalFilename?.split(".").pop() ?? "jpg";
    const pathname = `menu-images/${itemId}.${ext}`;
    const buffer   = fs.readFileSync(file.filepath);

    const blob = await put(pathname, buffer, {
      access:      "public",          // publicly readable — customers need to see it
      contentType: file.mimetype,
      addRandomSuffix: false,         // deterministic URL so old URLs auto-replace
    });

    // Save URL to KV — key: image:{itemId}  value: blob URL
    await kv.set(`image:${itemId}`, blob.url);

    // Clean up temp file
    try { fs.unlinkSync(file.filepath); } catch {}

    console.log(`Image uploaded: ${itemId} → ${blob.url}`);

    return res.status(200).json({
      success: true,
      itemId,
      url:   blob.url,
      size:  file.size,
    });

  } catch (err) {
    console.error("Upload error:", err);
    return res.status(500).json({ error: err.message });
  }
}
