// lib/feasts.js
// "Family Feasts" — 1-tap bundles for groups of 3+. Numbers here are final:
// arrived at through several rounds of correction against real order data
// (see the implementation plan this ships alongside) — do not re-derive or
// pad with items that aren't genuinely part of the bundle. aLaCarteTotal
// must stay in sync with the real per-item prices in lib/menu.js; if menu
// prices change, recompute this rather than letting it drift stale.
//
// items[].baseId must exist in ITEM_MAP (lib/menu.js) — these are real
// menu items at their real prices, added to the cart exactly like any
// manual add. The bundle price is applied at checkout (api/create-
// checkout.js's extractFeasts), never client-side.
export const FEASTS = [
  {
    id: "family-feast",
    name: "The Family Feast",
    feeds: "3–4",
    price: 99.99,
    heroImage: "/feasts/family-feast.jpg",
    aLaCarteTotal: 114.75,
    flagship: true, // "Most Popular" badge — revisit against real sales data after a couple weeks live, don't leave on faith forever
    items: [
      { baseId: "item-rani-offering", qty: 1 },
      { baseId: "item-ctm", qty: 1 },
      { baseId: "item-rogan", qty: 1 },
      { baseId: "item-palak-paneer", qty: 1 },
      { baseId: "item-dal-maharani", qty: 1 },
      { baseId: "item-garlic-naan", qty: 2 },
      { baseId: "item-onion-naan", qty: 1 },
      { baseId: "item-raita", qty: 1 },
    ],
  },
  {
    id: "grand-feast",
    name: "The Grand Feast",
    feeds: "6–8",
    price: 189.99,
    heroImage: "/feasts/grand-feast.jpg",
    // +$21.95 (item-ctm's real menu price) over the old 195.05 total to
    // reflect the doubled Chicken Tikka Masala below — a 6-8 person feast
    // needs a second entree, and CTM already anchors the Family Feast.
    aLaCarteTotal: 217.0,
    flagship: false,
    items: [
      { baseId: "item-rani-offering", qty: 1 },
      { baseId: "item-mixed-app", qty: 1 },
      { baseId: "item-ctm", qty: 2 },
      { baseId: "item-rogan", qty: 1 },
      { baseId: "item-palak-paneer", qty: 1 },
      { baseId: "item-biriyani-c", qty: 1 },
      { baseId: "item-tandoori-medley", qty: 1 },
      { baseId: "item-dal-maharani", qty: 1 },
      { baseId: "item-garlic-naan", qty: 3 },
      { baseId: "item-onion-naan", qty: 2 },
      { baseId: "item-naan", qty: 1 },
      { baseId: "item-raita", qty: 2 },
    ],
  },
];

/**
 * Runs entirely on real cart contents (baseId -> qty pairs) — never
 * trusts a client-supplied "this is a feast" signal of any kind, not even
 * as a hint. Greedily extracts as many complete feast bundles as the
 * cart's actual quantities support, largest bundle first, so a big
 * genuine order doesn't get fragmented into a worse combination by trying
 * small feasts first. Whatever's left in `remaining` after every possible
 * feast has been extracted is true à la carte — untouched by feast
 * pricing, priced through whatever normal discount logic already applies.
 *
 * A customer who hand-builds the same combination of dishes without ever
 * touching an "Add Feast" button gets the bundle price too — that's
 * correct, not a loophole: the discount is for the food, not the button.
 *
 * @param {Array<{baseId: string, qty: number}>} cartLines
 * @returns {{ appliedFeasts: typeof FEASTS, remaining: Map<string, number> }}
 */
export function extractFeasts(cartLines) {
  const remaining = new Map();
  for (const line of cartLines) {
    remaining.set(line.baseId, (remaining.get(line.baseId) || 0) + line.qty);
  }

  const appliedFeasts = [];
  const orderedFeasts = [...FEASTS].sort((a, b) => b.price - a.price);

  let foundOne = true;
  while (foundOne) {
    foundOne = false;
    for (const feast of orderedFeasts) {
      const canApply = feast.items.every((req) => (remaining.get(req.baseId) || 0) >= req.qty);
      if (canApply) {
        feast.items.forEach((req) => remaining.set(req.baseId, remaining.get(req.baseId) - req.qty));
        appliedFeasts.push(feast);
        foundOne = true;
      }
    }
  }
  return { appliedFeasts, remaining };
}
