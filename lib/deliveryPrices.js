// ── Third-party delivery platform prices (Uber Eats / DoorDash / Grubhub) ──
// Snapshot pasted by the owner, used only to compute the "order direct and
// save" line in the cart — NOT used anywhere in actual pricing/checkout.
// Delivery apps price higher than our own site to absorb their commission;
// this table lets us show customers the gap in real dollars.
//
// Keyed by the same item ids as MENU_ITEMS (lib/menu.js). Items with no
// entry here (currently just Tea or Coffee) are simply skipped in the
// savings calculation rather than guessed at.
export const DELIVERY_PRICES = {
  "item-tandoori-chicken": 29.95,
  "item-chicken-tikka": 29.95,
  "item-tandoori-medley": 39.95,
  "item-paneer-tikka": 28.95,
  "item-lamb-tikka": 34.95,
  "item-shrimp-tandoori": 37.95,
  "item-lamb-chops": 37.95,
  "item-lobster": 43.95,
  "item-tandoori-fish": 32.95,
  "item-korma-medley": 38.95,
  "item-biriyani-medley": 37.95,
  "item-sag-medley": 38.95,
  "item-madras-medley": 38.95,
  "item-vindaloo-medley": 38.95,
  "item-masala-medley": 38.95,
  "item-dhaba": 38.95,
  "item-bhuna-medley": 38.95,
  "item-tandoori-shrimp-masala": 37.95,
  "item-fish-curry": 37.95,
  "item-shrimp-biriyani": 36.95,
  "item-shrimp-sag": 37.95,
  "item-shrimp-korma": 36.95,
  "item-shrimp-bhuna": 36.95,
  "item-shrimp-malai": 37.95,
  "item-shrimp-vindaloo": 36.95,
  "item-shrimp-manglorian": 36.95,
  "item-rogan": 32.95,
  "item-vindaloo-l": 32.95,
  "item-sag-l": 32.95,
  "item-korma-l": 32.95,
  "item-biriyani-l": 32.95,
  "item-lamb-madras": 32.95,
  "item-kadai": 32.95,
  "item-phaal": 33.95,
  "item-boti": 33.95,
  "item-do-paiza-l": 32.95,
  "item-goat-curry": 38.95,
  "item-ctm": 29.95,
  "item-makhni": 29.95,
  "item-korma-c": 29.95,
  "item-vindaloo-c": 29.95,
  "item-biriyani-c": 29.95,
  "item-madras-c": 29.95,
  "item-curry-c": 29.95,
  "item-sagwala": 29.95,
  "item-kanda-curry-c": 29.95,
  "item-bhuna-c": 29.95,
  "item-do-paiza-c": 29.95,
  "item-jalfreazy-c": 29.95,
  "item-palak-paneer": 23.95,
  "item-aloo-gobi-palak": 23.95,
  "item-navaratan": 23.95,
  "item-chana-sag": 23.95,
  "item-baingan": 23.95,
  "item-shahi-paneer": 23.95,
  "item-aloo-gobi": 23.95,
  "item-chana-masala": 22.95,
  "item-dal-tarka": 18.95,
  "item-malai-kofta": 24.95,
  "item-mutter-paneer": 23.95,
  "item-veg-biriyani": 23.95,
  "item-dal-maharani": 18.95,
  "item-bhindi-mafaz": 23.95,
  "item-sabji-masala": 23.95,
  "item-sabji-lajawaab": 23.95,
  "item-broccoli-jalfreazy": 23.95,
  "item-rani-ki-avial": 22.95,
  "item-mushroom-masala": 23.95,
  "item-chicken-soup": 10.95,
  "item-mulligatawny": 10.95,
  "item-tomato-soup": 10.95,
  "item-salad": 11.95,
  "item-meat-samosa": 13.95,
  "item-rani-offering": 18.95,
  "item-seek-kabab": 18.95,
  "item-chicken-malai": 16.95,
  "item-keema-dosa": 17.95,
  "item-shrimp-bagari": 18.95,
  "item-masala-dosa": 15.95,
  "item-pakora": 11.95,
  "item-samosa": 13.95,
  "item-gobi-manchurian": 17.95,
  "item-mixed-app": 15.95,
  "item-ragada": 13.95,
  "item-papad": 6.95,
  "item-masala-sauce": 8.95,
  "item-hot-sauce": 6.95,
  "item-raita": 6.95,
  "item-rice": 9.95,
  "item-mango-chutney": 7.95,
  "item-mixed-pickles": 7.95,
  "item-garlic-naan": 8.95,
  "item-naan": 7.95,
  "item-onion-naan": 8.95,
  "item-poori": 8.95,
  "item-chapathi": 7.95,
  "item-peshwari": 10.95,
  "item-keema-paratha": 11.95,
  "item-aloo-paratha": 10.95,
  "item-rani-naan": 10.95,
  "item-mango-lassi": 10.95,
  "item-nemkin-lassi": 9.95,
  "item-nimbu-pani": 9.95,
  "item-sweet-lassi": 9.95,
  "item-root-beer": 8.95,
  "item-san-pellegrino": 9.95,
  "item-poland-spring": 6.95,
  "item-ice-tea": 4.95,
  // The delivery listing only had generic "Soda" and "Juices" entries — our
  // site now sells these as individual SKUs (see lib/menu.js Drinks), so the
  // generic delivery price is applied to each matching SKU as the closest
  // available comparison.
  "item-coke": 4.95,
  "item-diet-coke": 4.95,
  "item-sprite": 4.95,
  "item-ginger-ale": 4.95,
  "item-club-soda": 4.95,
  "item-tonic": 4.95,
  "item-cranberry-juice": 6.95,
  "item-apple-juice": 6.95,
  "item-orange-juice": 6.95,
  "item-pineapple-juice": 6.95,
  "item-mango-juice": 6.95,
};

// Returns the total dollar amount saved for a set of cart lines by ordering
// direct instead of through a delivery app. Lines with no entry in
// DELIVERY_PRICES (e.g. Goat Curry, Hot Sauce, Ice Tea, Tea or Coffee — not
// listed on the delivery apps) are skipped rather than guessed at, so the
// figure never overstates savings.
export function computeDeliverySavings(items) {
  let savings = 0;
  for (const { baseId, price, qty } of items) {
    const deliveryPrice = DELIVERY_PRICES[baseId];
    if (deliveryPrice == null) continue;
    const delta = deliveryPrice - price;
    if (delta > 0) savings += delta * qty;
  }
  return parseFloat(savings.toFixed(2));
}
