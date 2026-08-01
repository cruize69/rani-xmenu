// api/menu.js
// GET /api/menu
// Public, read-only export of the canonical menu — the marketing site
// (a separate deployment) fetches this instead of hand-maintaining its own
// copy of items/prices/descriptions, so the two can never drift apart and
// a cart-preload link (?add=item-id) always resolves to a real item.
//
// Also includes each item's photo URL, sourced from the same Vercel Blob +
// KV store that ImageManager.jsx (see /images) writes to and RaniMahal.jsx
// reads on the ordering site — one photo library shared by both properties.

import { kv } from "@vercel/kv";
import { MENU_ITEMS, SECTIONS } from "../lib/menu.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const keys   = MENU_ITEMS.map(item => `image:${item.id}`);
  const values = await kv.mget(...keys).catch(() => keys.map(() => null));

  const items = MENU_ITEMS.map(({ id, name, price, desc, badge, spiceProfile, veg }, i) => ({
    id, name, price, desc, badge, spiceProfile, veg,
    image: values[i] ?? null,
  }));

  res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
  return res.status(200).json({ items, sections: SECTIONS });
}
