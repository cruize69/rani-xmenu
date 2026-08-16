// api/images/list.js
// GET /api/images/list
// Returns { images: { "item-garlic-naan": "https://...", ... } }
// Called by ImageManager portal on load and by RaniMahal.jsx on page load
//
// Public, unauthenticated, single response shape for every caller — the
// data (menu-item image URLs + upload coverage counts) isn't sensitive, so
// there's no manager-only variant to gate.

import { kv } from "@vercel/kv";
import { MENU_ITEMS } from "../../lib/menu.js";

// Derived from the canonical menu — never hand-maintained, can't drift.
const ALL_ITEM_IDS = MENU_ITEMS.map(item => item.id);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Batch fetch all image URLs from KV in one round trip
    // KV mget: returns array of values in same order as keys
    const keys   = ALL_ITEM_IDS.map(id => `image:${id}`);
    const values = await kv.mget(...keys);

    // Build { itemId → url } map, omitting nulls
    const images = {};
    ALL_ITEM_IDS.forEach((id, i) => {
      if (values[i]) images[id] = values[i];
    });

    const total    = ALL_ITEM_IDS.length;
    const uploaded = Object.keys(images).length;

    // Cache for 60 seconds — fast for customers, fresh enough for managers
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");

    return res.status(200).json({
      images,
      stats: {
        total,
        uploaded,
        missing: total - uploaded,
        coverage: Math.round((uploaded / total) * 100),
      },
    });

  } catch (err) {
    console.error("Image list error:", err);
    return res.status(500).json({ error: err.message });
  }
}
