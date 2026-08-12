import { QA } from "../../lib/menu.js";

// ── Classification sets ──────────────────────────────────────────
export const S = {
  CURRY:      new Set(["item-ctm","item-makhni","item-korma-c","item-sagwala","item-vindaloo-c","item-madras-c","item-jalfreazy-c","item-do-paiza-c","item-bhuna-c","item-curry-c","item-rogan","item-sag-l","item-korma-l","item-do-paiza-l","item-kadai","item-vindaloo-l","item-boti","item-phaal","item-shrimp-korma","item-tandoori-shrimp-masala","item-shrimp-bhuna","item-shrimp-manglorian","item-fish-curry","item-shrimp-sag","item-shrimp-vindaloo","item-shrimp-malai","item-dhaba","item-sag-medley","item-masala-medley","item-vindaloo-medley","item-korma-medley","item-bhuna-medley","item-madras-medley","item-aloo-gobi","item-baingan","item-chana-masala","item-palak-paneer","item-malai-kofta","item-shahi-paneer","item-navaratan","item-chana-sag","item-dal-maharani","item-dal-tarka"]),
  SPICY:      new Set(["item-vindaloo-c","item-madras-c","item-jalfreazy-c","item-vindaloo-l","item-kadai","item-phaal","item-shrimp-vindaloo","item-vindaloo-medley","item-gobi-manchurian"]),
  BREAD:      new Set(["item-naan","item-onion-naan","item-garlic-naan","item-rani-naan","item-peshwari","item-poori","item-chapathi","item-aloo-paratha","item-keema-paratha"]),
  DRINK:      new Set(["item-mango-lassi","item-sweet-lassi","item-nemkin-lassi","item-nimbu-pani","item-root-beer","item-san-pellegrino","item-poland-spring","item-juices","item-soda","item-tea-coffee"]),
  TANDOORI:   new Set(["item-tandoori-chicken","item-chicken-tikka","item-lamb-tikka","item-tandoori-fish","item-shrimp-tandoori","item-tandoori-medley","item-lobster","item-paneer-tikka","item-lamb-chops","item-seek-kabab","item-rani-offering"]),
  LAMB:       new Set(["item-meat-samosa","item-seek-kabab","item-keema-dosa","item-rogan","item-sag-l","item-korma-l","item-do-paiza-l","item-kadai","item-vindaloo-l","item-boti","item-phaal","item-biriyani-l","item-lamb-chops","item-lamb-tikka","item-dhaba","item-sag-medley","item-masala-medley","item-vindaloo-medley","item-biriyani-medley","item-korma-medley","item-bhuna-medley","item-madras-medley"]),
  VEG:        new Set(["item-aloo-gobi","item-baingan","item-chana-masala","item-palak-paneer","item-malai-kofta","item-shahi-paneer","item-navaratan","item-chana-sag","item-dal-maharani","item-dal-tarka","item-veg-biriyani","item-paneer-tikka"]),
  APPETIZER:  new Set(["item-samosa","item-meat-samosa","item-pakora","item-mixed-app","item-papad","item-masala-dosa","item-gobi-manchurian","item-ragada","item-seek-kabab","item-chicken-malai","item-shrimp-bagari","item-rani-offering","item-keema-dosa"]),
  SOUP:       new Set(["item-mulligatawny","item-tomato-soup","item-chicken-soup","item-salad"]),
  SIDE:       new Set(["item-mango-chutney","item-mixed-pickles","item-raita","item-rice","item-masala-sauce"]),
  BIRIYANI:   new Set(["item-biriyani-c","item-biriyani-l","item-shrimp-biriyani","item-veg-biriyani","item-biriyani-medley"]),
  SEAFOOD:    new Set(["item-shrimp-korma","item-tandoori-shrimp-masala","item-shrimp-bhuna","item-shrimp-manglorian","item-fish-curry","item-shrimp-sag","item-shrimp-vindaloo","item-shrimp-malai","item-shrimp-biriyani","item-shrimp-bagari"]),
};

// ── Upsell logic ─────────────────────────────────────────────────
export const QA_BREADS     = ["qa-garlic-naan","qa-peshwari","qa-onion-naan","qa-rani-naan","qa-aloo-paratha","qa-plain-naan","qa-keema-paratha"];
export const QA_DRINKS     = ["qa-mango-lassi","qa-sweet-lassi","qa-nimbu-pani"];
export const QA_COOLING    = ["qa-raita","qa-mango-chutney"];
export const QA_APPETIZERS = ["qa-samosa","qa-pakora"];

export const QA_ITEM_ID = {
  "qa-garlic-naan":   "item-garlic-naan",
  "qa-peshwari":      "item-peshwari",
  "qa-onion-naan":    "item-onion-naan",
  "qa-rani-naan":     "item-rani-naan",
  "qa-aloo-paratha":  "item-aloo-paratha",
  "qa-plain-naan":    "item-naan",
  "qa-keema-paratha": "item-keema-paratha",
  "qa-raita":         "item-raita",
  "qa-mango-chutney": "item-mango-chutney",
  "qa-mango-lassi":   "item-mango-lassi",
  "qa-sweet-lassi":   "item-sweet-lassi",
  "qa-nimbu-pani":    "item-nimbu-pani",
  "qa-samosa":        "item-samosa",
  "qa-pakora":        "item-pakora",
};

export function cartHasType(cart, set) { return Object.values(cart).some(v => set.has(v.baseId)); }
export function cartHasBread(cart)     { return cartHasType(cart, S.BREAD) || QA_BREADS.some(k => cart[k]); }
export function cartHasDrink(cart)     { return cartHasType(cart, S.DRINK) || QA_DRINKS.some(k => cart[k]); }
export function cartHasCooling(cart)   { return QA_COOLING.some(k => cart[k]); }
export function cartCount(cart)        { return Object.values(cart).reduce((s,v) => s + v.qty, 0); }

export function getModalUpsells(baseId, cart) {
  const sections = [];
  const is = id => S[id]?.has(baseId);

  if (is("BREAD")) {
    if (!cartHasDrink(cart)) sections.push({ label:"Something to drink", hint:"A Mango Lassi is the perfect companion to any of our breads — or a Nimbu Pani to keep it light.", items:["qa-mango-lassi","qa-sweet-lassi","qa-nimbu-pani"] });
    if (!cartHasCooling(cart)) sections.push({ label:"Add a dip", hint:"Mango Chutney alongside fresh-baked naan is a combination our guests never skip.", items:["qa-mango-chutney","qa-raita"] });
    return sections;
  }
  if (is("DRINK")) {
    if (!cartHasBread(cart) && (cartHasType(cart, S.CURRY) || cartHasType(cart, S.TANDOORI))) sections.push({ label:"Don't forget bread", hint:"Most tables with a drink order also grab a Garlic Naan — practically a reflex at this point.", items: QA_BREADS });
    return sections;
  }
  if (is("SIDE")) {
    if (!cartHasBread(cart) && cartHasType(cart, S.CURRY)) sections.push({ label:"Complete with bread", hint:"A side pairs best alongside a fresh naan — Garlic Naan is the one most guests can't resist.", items: QA_BREADS });
    if (!cartHasDrink(cart)) sections.push({ label:"Add a drink", hint:"Mango Lassi rounds out any order beautifully.", items:["qa-mango-lassi","qa-nimbu-pani"] });
    return sections;
  }
  if (is("APPETIZER")) {
    if (!cartHasDrink(cart)) sections.push({ label:"To drink", hint:"A Mango Lassi is the most popular drink pairing with our starters — or a Nimbu Pani to start light.", items:["qa-mango-lassi","qa-sweet-lassi","qa-nimbu-pani"] });
    if (!cartHasBread(cart) && !cartHasType(cart, S.CURRY) && !cartHasType(cart, S.TANDOORI)) sections.push({ label:"Add a bread while you wait", hint:"Garlic Naan makes a wonderful addition before the mains arrive — many guests order it as its own course.", items: QA_BREADS });
    return sections;
  }
  if (is("SOUP")) {
    if (!cartHasDrink(cart)) sections.push({ label:"Something to drink", hint:"A Nimbu Pani alongside soup is a classic light pairing. Or a Mango Lassi if you're going richer.", items:["qa-nimbu-pani","qa-mango-lassi","qa-sweet-lassi"] });
    if (!cartHasBread(cart)) sections.push({ label:"Bread on the side", hint:"Fresh naan with a bowl of Mulligatawny is one of those simple combinations that just works.", items: QA_BREADS });
    return sections;
  }
  if (is("BIRIYANI")) {
    if (!cartHasCooling(cart)) sections.push({ label:"Classic pairing", hint:"Raita is the traditional accompaniment to biriyani — the cool yogurt balances the fragrant spices perfectly.", items:["qa-raita","qa-mango-chutney"] });
    if (!cartHasDrink(cart)) sections.push({ label:"Something to drink", hint:"A Mango Lassi with biriyani is one of those combinations that needs no explanation.", items:["qa-mango-lassi","qa-sweet-lassi","qa-nimbu-pani"] });
    return sections;
  }
  if (is("SEAFOOD")) {
    if (is("SPICY") && !cartHasCooling(cart)) sections.push({ label:"Balance the heat", hint:"Spicy seafood calls for something cool — Raita or Mango Chutney works beautifully here.", items:["qa-raita","qa-mango-chutney"] });
    if (!cartHasBread(cart)) sections.push({ label:"Add a bread", hint:"Garlic Naan alongside seafood curry is a pairing our coastal guests swear by.", items: QA_BREADS });
    if (!cartHasDrink(cart)) sections.push({ label:"To drink", hint:"Nimbu Pani is a lovely light pairing with seafood — or the classic Mango Lassi.", items:["qa-nimbu-pani","qa-mango-lassi","qa-sweet-lassi"] });
    return sections;
  }
  // All other entrees
  if (is("SPICY") && !cartHasCooling(cart)) sections.push({ label:"Cool it down", hint:"This is a hot dish — our chef always pairs it with something to balance the heat.", items:["qa-raita","qa-mango-chutney"] });
  if (!cartHasBread(cart)) {
    const hint = is("SPICY") ? "Peshwari Naan's sweetness is a beautiful contrast to the heat. Garlic Naan is always the safe choice — ordered at nearly every table."
      : is("LAMB")     ? "Garlic Naan is our most-ordered bread. The Keema Paratha — stuffed with minced lamb — is a perfect match."
      : is("TANDOORI") ? "Garlic Naan is what we're known for — and the Rani Ki Special Naan was made for tandoori night."
      : is("VEG")      ? "Garlic Naan pairs with every dish on the menu. Aloo Paratha is a hearty favorite with vegetarian plates."
      :                  "Garlic Naan is what we're known for — guests order it with every entrée, sometimes as a starter on its own.";
    sections.push({ label:"Add a bread", hint, items: QA_BREADS });
  }
  if (!cartHasDrink(cart)) {
    const [items, hint] = is("SPICY")    ? [["qa-mango-lassi","qa-sweet-lassi","qa-nimbu-pani"],"A Mango Lassi alongside a spicy dish is one of the great pairings in Indian dining."]
      : is("LAMB")   ? [["qa-mango-lassi","qa-nimbu-pani","qa-sweet-lassi"],"Most lamb dishes pair beautifully with a Mango Lassi — the creaminess complements the spices."]
      : is("VEG")    ? [["qa-mango-lassi","qa-sweet-lassi","qa-nimbu-pani"],"A Sweet Lassi is a wonderful complement to vegetarian dishes."]
      :                 [["qa-mango-lassi","qa-sweet-lassi","qa-nimbu-pani"],"Mango Lassi is our most-loved drink — a true Indian classic and the perfect companion."];
    sections.push({ label:"Something to drink", hint, items });
  }
  return sections;
}

// Not capped — this is a horizontally-scrollable rail, not a single
// recommendation slot, so hiding items doesn't reduce friction (a swipe is
// already free) and only costs AOV opportunity for anyone who wants more
// than one bread or drink. Sort order still matters: lead with whatever
// category the cart is missing, then proven best-sellers, so the first
// couple of on-screen slots are the most relevant — the rest is there for
// anyone who wants to keep browsing.
export function rankedQuickAdds(cart) {
  const hasBread     = cartHasBread(cart);
  const hasDrink     = cartHasDrink(cart);
  const hasCooling   = cartHasCooling(cart);
  const hasAppetizer = QA_APPETIZERS.some(k => cart[k]);
  const priority = id => {
    if (QA_BREADS.includes(id)     && !hasBread)     return 0;
    if (QA_DRINKS.includes(id)     && !hasDrink)     return 0;
    if (QA_APPETIZERS.includes(id) && !hasAppetizer) return 1;
    if (QA_COOLING.includes(id)    && !hasCooling)   return 1;
    return 2;
  };

  return Object.entries(QA)
    .map(([id, item]) => ({ id, ...item }))
    .sort((a, b) => {
      const p = priority(a.id) - priority(b.id);
      if (p !== 0) return p;
      return (b.star ? 1 : 0) - (a.star ? 1 : 0); // proven best-sellers first within a tier
    });
}

export const SPICE_LEVELS = [
  { key:"Mild",   heat:1, desc:"Gentle warmth — all the flavor, none of the burn" },
  { key:"Medium", heat:2, desc:"Our house standard — noticeable, comfortable heat" },
  { key:"Spicy",  heat:3, desc:"Full heat, the way it's traditionally made" },
];
