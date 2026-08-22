// lib/feasts.js
// "Family Meal" / "Group Meal" — 1-tap bundles for groups of 3+. Named
// deliberately NOT "Feast" (the internal id/variable names below still say
// "feast" — that's just implementation vocabulary, invisible to customers
// and search engines) to avoid colliding with the catering menu's "Rani
// Feast" tier (lib/menu.js): same word, completely different product
// (44.95-49.95/person, 20-guest minimum, event catering vs. these — flat
// price, no minimum, self-checkout) was cannibalizing both in search and
// confusing anyone landing on either from Google. See the SEO naming
// decision this shipped alongside for the full reasoning.
//
// Numbers here are final: arrived at through several rounds of correction
// against real order data (see the implementation plan this ships
// alongside) — do not re-derive or pad with items that aren't genuinely
// part of the bundle. aLaCarteTotal must stay in sync with the real
// per-item prices in lib/menu.js; if menu prices change, recompute this
// rather than letting it drift stale.
//
// items[].baseId must exist in ITEM_MAP (lib/menu.js) — these are real
// menu items at their real prices, added to the cart exactly like any
// manual add. The bundle price is applied at checkout (api/create-
// checkout.js's extractFeasts), never client-side.
export const FEASTS = [
  {
    id: "family-meal",
    name: "The Family Meal",
    feeds: "3–4",
    price: 99.99,
    heroImage: "/feasts/family-feast.jpg",
    aLaCarteTotal: 114.75,
    flagship: true, // "Most Popular" badge — revisit against real sales data after a couple weeks live, don't leave on faith forever
    items: [
      // swapTo: a customer can substitute Masala Dosa here — vegetarian,
      // shareable, and made fresh to order, so it's a real answer for
      // "does anyone here eat veg?" instead of losing that customer to a
      // fully à la carte order. Bundle price/savings stay flat regardless
      // of which one is actually in the box (standard combo-swap
      // convention); extractFeasts below resolves whichever of the two is
      // actually present in the cart, so the swap only has to be
      // expressed by what's really there — no separate "isSwapped" flag
      // for the server to trust or distrust.
      { baseId: "item-rani-offering", qty: 1, swapTo: "item-masala-dosa" },
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
    id: "group-meal",
    name: "The Group Meal",
    feeds: "6–8",
    price: 189.99,
    heroImage: "/feasts/grand-feast.jpg",
    // +$21.95 (item-ctm's real menu price) over the old 195.05 total to
    // reflect the doubled Chicken Tikka Masala below — a 6-8 person meal
    // needs a second entree, and CTM already anchors the Family Meal.
    aLaCarteTotal: 217.0,
    flagship: false,
    items: [
      // swapTo: a customer can substitute Masala Dosa here — vegetarian,
      // shareable, and made fresh to order, so it's a real answer for
      // "does anyone here eat veg?" instead of losing that customer to a
      // fully à la carte order. Bundle price/savings stay flat regardless
      // of which one is actually in the box (standard combo-swap
      // convention); extractFeasts below resolves whichever of the two is
      // actually present in the cart, so the swap only has to be
      // expressed by what's really there — no separate "isSwapped" flag
      // for the server to trust or distrust.
      { baseId: "item-rani-offering", qty: 1, swapTo: "item-masala-dosa" },
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
      // For a slot with a swapTo, either the original baseId or its
      // substitute satisfies the slot — whichever is actually sitting in
      // the cart. The original is preferred when both happen to be
      // present (a customer who has one of each keeps their standalone
      // dosa order as genuine à la carte, not folded into the bundle).
      const resolution = feast.items.map((req) => {
        if ((remaining.get(req.baseId) || 0) >= req.qty) return { req, baseId: req.baseId };
        if (req.swapTo && (remaining.get(req.swapTo) || 0) >= req.qty) return { req, baseId: req.swapTo };
        return { req, baseId: null };
      });
      const canApply = resolution.every((r) => r.baseId);
      if (canApply) {
        resolution.forEach(({ req, baseId }) => remaining.set(baseId, remaining.get(baseId) - req.qty));
        // items carries the RESOLVED baseId per slot (not the feast's
        // static definition) — api/create-checkout.js prices each applied
        // feast straight off this list, so a swapped slot is priced and
        // labeled as what's actually in the box, automatically, with no
        // special-casing needed downstream.
        appliedFeasts.push({ ...feast, items: resolution.map(({ req, baseId }) => ({ ...req, baseId })) });
        foundOne = true;
      }
    }
  }
  return { appliedFeasts, remaining };
}
