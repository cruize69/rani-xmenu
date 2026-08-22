// api/feasts.js
// GET /api/feasts
// Public, read-only export of the canonical Family Meal / Group Meal
// bundles — same role for the marketing site's /family-meals page as
// api/catering-packages.js already plays for /catering: the marketing site
// fetches this instead of hand-copying names/prices/items, so the two
// properties can never drift apart. Bundle pricing itself is still only
// ever applied server-side at checkout (api/create-checkout.js's
// extractFeasts) — this endpoint is display data only.

import { FEASTS } from "../lib/feasts.js";
import { ITEM_MAP } from "../lib/menu.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const feasts = FEASTS.map((f) => ({
    id: f.id,
    name: f.name,
    feeds: f.feeds,
    price: f.price,
    aLaCarteTotal: f.aLaCarteTotal,
    heroImage: f.heroImage,
    flagship: !!f.flagship,
    items: f.items
      .map((it) => {
        const item = ITEM_MAP[it.baseId];
        if (!item) return null;
        // baseId+qty round-trip into the ordering app's own ?add= cart-
        // preload param (see main RaniMahal.jsx) — a customer who lands
        // there with a feast's exact contents pre-added gets the bundle
        // price automatically at checkout (lib/feasts.js's extractFeasts
        // runs on real cart contents, not on how they got there), so the
        // marketing site can link "Order Now" straight into a pre-filled
        // cart instead of dumping the customer on an empty one.
        //
        // swapTo (+ its resolved name) lets the marketing site offer the
        // same Rani Ki Offering -> Masala Dosa swap FeastCard.jsx offers
        // in the ordering app, without hand-copying which slot is
        // swappable or what the substitute is called.
        const swapItem = it.swapTo ? ITEM_MAP[it.swapTo] : null;
        return {
          baseId: it.baseId,
          name: item.name,
          qty: it.qty,
          ...(swapItem ? { swapTo: it.swapTo, swapToName: swapItem.name } : {}),
        };
      })
      .filter(Boolean),
  }));

  res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
  return res.status(200).json({ feasts });
}
