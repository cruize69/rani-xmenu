// api/images/delete.js
// DELETE /api/images/delete
// Body: { itemId }
// Removes image from Vercel Blob storage and KV

import { del } from "@vercel/blob";
import { kv }  from "@vercel/kv";

export default async function handler(req, res) {
  if (req.headers["x-manager-secret"] !== process.env.MANAGER_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { itemId } = req.body;
  if (!itemId) return res.status(400).json({ error: "itemId required" });

  try {
    // Get the blob URL from KV
    const url = await kv.get(`image:${itemId}`);
    if (!url) {
      return res.status(404).json({ error: `No image found for ${itemId}` });
    }

    // Delete from Vercel Blob
    await del(url);

    // Remove from KV
    await kv.del(`image:${itemId}`);

    console.log(`Image deleted: ${itemId}`);

    return res.status(200).json({ success: true, itemId });

  } catch (err) {
    console.error("Delete error:", err);
    return res.status(500).json({ error: err.message });
  }
}
