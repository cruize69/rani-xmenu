// api/catering-packages.js
// GET /api/catering-packages
// Public, read-only export of the canonical catering packages — same role
// for the marketing site's /catering page as api/menu.js already plays for
// /menu: the marketing site fetches this instead of hand-copying package
// names/prices/minimums, so the two properties can never drift apart, and
// a cart-preload link (?add=catering-item-id:headcount) always resolves to
// a real item at the real price.

import { kv } from "../lib/kv.js";
import { CATERING_PACKAGES, CATERING_ITEMS, CATERING_MINIMUMS, CATERING_ORDER_MINIMUM, CATERING_TIER_LABELS } from "../lib/menu.js";

const ITEM_BY_ID = Object.fromEntries(CATERING_ITEMS.map(i => [i.id, i]));

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const photoIds = CATERING_PACKAGES.map(p => p.photoId);
  const values = await kv.mget(...photoIds.map(id => `image:${id}`)).catch(() => photoIds.map(() => null));
  const photoById = Object.fromEntries(photoIds.map((id, i) => [id, values[i] ?? null]));

  const packages = CATERING_PACKAGES.map(p => ({
    name: p.name,
    blurb: p.blurb,
    items: p.items,
    photo: photoById[p.photoId] ?? null,
    tiers: p.tierIds.map(id => ({
      itemId: id,
      label: CATERING_TIER_LABELS[id] ?? null,
      price: ITEM_BY_ID[id].price,
      minimum: CATERING_MINIMUMS[id],
    })),
  }));

  res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
  return res.status(200).json({ packages, orderMinimum: CATERING_ORDER_MINIMUM });
}
