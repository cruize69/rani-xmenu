import { useState, useEffect, useRef, useCallback } from "react";
import { MENU_ITEMS, ITEM_MAP, QA, TAX_RATE } from "./lib/menu.js";
import AccountPortal from "./AccountPortal.jsx";

// ── Fonts — matches the Rani Mahal marketing site (Fraunces / Inter / Great Vibes) ──
const FONT_LINK = "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..600;1,9..144,400..500&family=Great+Vibes&family=Inter:wght@300;400;500;600&display=swap";

// ── Design tokens — same dark palette as the marketing site ───────
const T = {
  ink: "#080706", surface: "#12100e", surface2: "#1c1814", line: "#342820",
  saffron: "#E8A82E", saffronDeep: "#C8871A", chili: "#D9482C",
  bone: "#FAF6EF", muted: "#B8A995",
};

// ── Menu data (MENU_ITEMS, ITEM_MAP, QA, TAX_RATE) — imported from lib/menu.js, shared with the backend ──

const SECTIONS = [
  { id:"appetizers", eyebrow:"To start",                 title:"Appetizers",         note:"",                                                                  subsections:[{ label:"Vegetarian", ids:["item-samosa","item-pakora","item-mixed-app","item-papad","item-masala-dosa","item-gobi-manchurian","item-ragada"] },{ label:"Non-Vegetarian", ids:["item-meat-samosa","item-seek-kabab","item-chicken-malai","item-shrimp-bagari","item-rani-offering","item-keema-dosa"] }] },
  { id:"soups",      eyebrow:"Light courses",            title:"Soups & Salads",     note:"",                                                                  subsections:[{ label:"", ids:["item-mulligatawny","item-tomato-soup","item-chicken-soup","item-salad"] }] },
  { id:"breads",     eyebrow:"From the oven",            title:"Breads",              note:"",                                                                  subsections:[{ label:"", ids:["item-naan","item-onion-naan","item-garlic-naan","item-rani-naan","item-peshwari","item-poori","item-chapathi","item-aloo-paratha","item-keema-paratha"] }] },
  { id:"medley",     eyebrow:"Chicken, lamb and shrimp", title:"Medley",              note:"A delicate combination of chicken, lamb and shrimp — served with basmati rice", subsections:[{ label:"", ids:["item-dhaba","item-sag-medley","item-masala-medley","item-vindaloo-medley","item-biriyani-medley","item-korma-medley","item-bhuna-medley","item-madras-medley"] }] },
  { id:"tandoori",   eyebrow:"Clay oven specialties",    title:"Tandoori",            note:"All entrees served with aromatic basmati rice",                    subsections:[{ label:"", ids:["item-tandoori-chicken","item-chicken-tikka","item-lamb-tikka","item-tandoori-fish","item-shrimp-tandoori","item-tandoori-medley","item-lobster","item-paneer-tikka"] }] },
  { id:"chicken",    eyebrow:"Entrees",                  title:"Chicken",             note:"All entrees served with aromatic basmati rice",                    subsections:[{ label:"", ids:["item-ctm","item-makhni","item-korma-c","item-sagwala","item-vindaloo-c","item-madras-c","item-jalfreazy-c","item-do-paiza-c","item-biriyani-c","item-bhuna-c","item-curry-c"] }] },
  { id:"lamb",       eyebrow:"Entrees",                  title:"Lamb",                note:"All entrees served with aromatic basmati rice",                    subsections:[{ label:"", ids:["item-rogan","item-sag-l","item-korma-l","item-do-paiza-l","item-kadai","item-vindaloo-l","item-boti","item-phaal","item-biriyani-l","item-lamb-chops"] }] },
  { id:"seafood",    eyebrow:"From the sea",             title:"Seafood",             note:"All entrees served with aromatic basmati rice",                    subsections:[{ label:"", ids:["item-shrimp-korma","item-tandoori-shrimp-masala","item-shrimp-bhuna","item-shrimp-manglorian","item-fish-curry","item-shrimp-sag","item-shrimp-vindaloo","item-shrimp-malai","item-shrimp-biriyani"] }] },
  { id:"vegetarian", eyebrow:"Entrees",                  title:"Vegetarian",          note:"All entrees served with aromatic basmati rice",                    subsections:[{ label:"", ids:["item-aloo-gobi","item-baingan","item-chana-masala","item-palak-paneer","item-malai-kofta","item-shahi-paneer","item-navaratan","item-dal-maharani","item-dal-tarka","item-veg-biriyani","item-chana-sag"] }] },
  { id:"sides",      eyebrow:"On the side",              title:"Sides & Condiments",  note:"",                                                                  subsections:[{ label:"", ids:["item-mango-chutney","item-mixed-pickles","item-raita","item-rice","item-masala-sauce"] }] },
  { id:"drinks",     eyebrow:"To drink",                 title:"Drinks",              note:"",                                                                  subsections:[{ label:"", ids:["item-mango-lassi","item-sweet-lassi","item-nemkin-lassi","item-nimbu-pani","item-root-beer","item-san-pellegrino","item-poland-spring","item-juices","item-soda","item-tea-coffee"] }] },
];

// ── Classification sets ──────────────────────────────────────────
const S = {
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
const QA_BREADS  = ["qa-garlic-naan","qa-peshwari","qa-onion-naan","qa-rani-naan","qa-aloo-paratha","qa-plain-naan","qa-keema-paratha"];
const QA_DRINKS  = ["qa-mango-lassi","qa-sweet-lassi","qa-nimbu-pani"];
const QA_COOLING = ["qa-raita","qa-mango-chutney"];

function cartHasType(cart, set) { return Object.values(cart).some(v => set.has(v.baseId)); }
function cartHasBread(cart)     { return cartHasType(cart, S.BREAD) || QA_BREADS.some(k => cart[k]); }
function cartHasDrink(cart)     { return cartHasType(cart, S.DRINK) || QA_DRINKS.some(k => cart[k]); }
function cartHasCooling(cart)   { return QA_COOLING.some(k => cart[k]); }
function cartCount(cart)        { return Object.values(cart).reduce((s,v) => s + v.qty, 0); }

function getModalUpsells(baseId, cart) {
  const sections = [];
  const is = id => S[id]?.has(baseId);
  const isEntree = is("CURRY") || is("TANDOORI");

  if (is("BREAD")) {
    if (!cartHasDrink(cart)) sections.push({ label:"Something to drink", hint:"A Mango Lassi is the perfect companion to any of our breads — or a Nimbu Pani to keep it light.", items:["qa-mango-lassi","qa-sweet-lassi","qa-nimbu-pani"] });
    if (!cartHasCooling(cart)) sections.push({ label:"Add a dip", hint:"Mango Chutney alongside fresh-baked naan is a combination our guests never skip.", items:["qa-mango-chutney","qa-raita"] });
    return sections;
  }
  if (is("DRINK")) {
    if (!cartHasBread(cart) && (cartHasType(cart, S.CURRY) || cartHasType(cart, S.TANDOORI))) sections.push({ label:"Don't forget bread", hint:"Most tables with a drink order also grab a Garlic Naan — practically a reflex at this point.", items:["qa-garlic-naan","qa-peshwari","qa-onion-naan"] });
    return sections;
  }
  if (is("SIDE")) {
    if (!cartHasBread(cart) && cartHasType(cart, S.CURRY)) sections.push({ label:"Complete with bread", hint:"A side pairs best alongside a fresh naan — Garlic Naan is the one most guests can't resist.", items:["qa-garlic-naan","qa-plain-naan","qa-aloo-paratha"] });
    if (!cartHasDrink(cart)) sections.push({ label:"Add a drink", hint:"Mango Lassi rounds out any order beautifully.", items:["qa-mango-lassi","qa-nimbu-pani"] });
    return sections;
  }
  if (is("APPETIZER")) {
    if (!cartHasDrink(cart)) sections.push({ label:"To drink", hint:"A Mango Lassi is the most popular drink pairing with our starters — or a Nimbu Pani to start light.", items:["qa-mango-lassi","qa-sweet-lassi","qa-nimbu-pani"] });
    if (!cartHasBread(cart) && !cartHasType(cart, S.CURRY) && !cartHasType(cart, S.TANDOORI)) sections.push({ label:"Add a bread while you wait", hint:"Garlic Naan makes a wonderful addition before the mains arrive — many guests order it as its own course.", items:["qa-garlic-naan","qa-onion-naan","qa-peshwari"] });
    return sections;
  }
  if (is("SOUP")) {
    if (!cartHasDrink(cart)) sections.push({ label:"Something to drink", hint:"A Nimbu Pani alongside soup is a classic light pairing. Or a Mango Lassi if you're going richer.", items:["qa-nimbu-pani","qa-mango-lassi","qa-sweet-lassi"] });
    if (!cartHasBread(cart)) sections.push({ label:"Bread on the side", hint:"Fresh naan with a bowl of Mulligatawny is one of those simple combinations that just works.", items:["qa-garlic-naan","qa-plain-naan","qa-aloo-paratha"] });
    return sections;
  }
  if (is("BIRIYANI")) {
    if (!cartHasCooling(cart)) sections.push({ label:"Classic pairing", hint:"Raita is the traditional accompaniment to biriyani — the cool yogurt balances the fragrant spices perfectly.", items:["qa-raita","qa-mango-chutney"] });
    if (!cartHasDrink(cart)) sections.push({ label:"Something to drink", hint:"A Mango Lassi with biriyani is one of those combinations that needs no explanation.", items:["qa-mango-lassi","qa-sweet-lassi","qa-nimbu-pani"] });
    return sections;
  }
  if (is("SEAFOOD")) {
    if (is("SPICY") && !cartHasCooling(cart)) sections.push({ label:"Balance the heat", hint:"Spicy seafood calls for something cool — Raita or Mango Chutney works beautifully here.", items:["qa-raita","qa-mango-chutney"] });
    if (!cartHasBread(cart)) sections.push({ label:"Add a bread", hint:"Garlic Naan alongside seafood curry is a pairing our coastal guests swear by.", items:["qa-garlic-naan","qa-plain-naan","qa-peshwari"] });
    if (!cartHasDrink(cart)) sections.push({ label:"To drink", hint:"Nimbu Pani is a lovely light pairing with seafood — or the classic Mango Lassi.", items:["qa-nimbu-pani","qa-mango-lassi","qa-sweet-lassi"] });
    return sections;
  }
  // All other entrees
  if (is("SPICY") && !cartHasCooling(cart)) sections.push({ label:"Cool it down", hint:"This is a hot dish — our chef always pairs it with something to balance the heat.", items:["qa-raita","qa-mango-chutney"] });
  if (!cartHasBread(cart)) {
    const [items, hint] = is("SPICY") ? [["qa-peshwari","qa-garlic-naan"],"Peshwari Naan's sweetness is a beautiful contrast to the heat. Garlic Naan is always the safe choice — ordered at nearly every table."]
      : is("LAMB")     ? [["qa-garlic-naan","qa-keema-paratha","qa-peshwari"],"Garlic Naan is our most-ordered bread. The Keema Paratha — stuffed with minced lamb — is a perfect match."]
      : is("TANDOORI") ? [["qa-garlic-naan","qa-rani-naan","qa-onion-naan"],"Garlic Naan is what we're known for — and the Rani Ki Special Naan was made for tandoori night."]
      : is("VEG")      ? [["qa-garlic-naan","qa-aloo-paratha","qa-plain-naan"],"Garlic Naan pairs with every dish on the menu. Aloo Paratha is a hearty favourite with vegetarian plates."]
      :                   [["qa-garlic-naan","qa-onion-naan","qa-peshwari"],"Garlic Naan is what we're known for — guests order it with every entrée, sometimes as a starter on its own."];
    sections.push({ label:"Add a bread", hint, items });
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

// ── Helpers ──────────────────────────────────────────────────────
const fmt = n => "$" + n.toFixed(2);
const TAX = TAX_RATE;

// ── Spice chart — restaurant-specific, not a generic mild/medium/hot label.
// "Medium" means something different at every restaurant; this spells out what
// it means here so guests aren't guessing.
const SPICE_LEVELS = [
  { key:"Mild",   heat:1, desc:"Gentle warmth — all the flavor, none of the burn" },
  { key:"Medium", heat:2, desc:"Our house standard — noticeable, comfortable heat" },
  { key:"Spicy",  heat:3, desc:"Full heat, the way it's traditionally made" },
];

// ── Styles (inline — no build step needed) ──────────────────────
const css = `
@import url('${FONT_LINK}');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{background:#080706}
body{font-family:'Inter',sans-serif;color:#FAF6EF;-webkit-font-smoothing:antialiased}
button{cursor:pointer;font-family:'Inter',sans-serif}
::-webkit-scrollbar{width:3px;height:3px}
::-webkit-scrollbar-thumb{background:rgba(232,168,46,0.3);border-radius:2px}
`;

// ── Components ───────────────────────────────────────────────────

function Badge({ type, label }) {
  if (!type || !label) return null;
  const s = {
    bestseller: { background:"rgba(232,168,46,0.14)", color:"#E8A82E", border:"0.5px solid rgba(232,168,46,0.3)" },
    chef:       { background:"rgba(232,168,46,0.10)", color:"#E8A82E", border:"0.5px solid rgba(232,168,46,0.22)" },
    spicy:      { background:"rgba(217,72,44,0.14)", color:"#F0846A", border:"0.5px solid rgba(217,72,44,0.3)" },
  };
  return (
    <span style={{ display:"inline-flex", alignItems:"center", fontFamily:"'Inter',sans-serif", fontSize:"9.5px", fontWeight:500, letterSpacing:"0.05em", padding:"1px 6px", borderRadius:3, whiteSpace:"nowrap", lineHeight:1.6, marginTop:4, ...s[type] }}>
      {label}
    </span>
  );
}

function ItemCard({ item, cartEntry, onOpen, imageUrl }) {
  const qty = cartEntry?.qty ?? 0;
  return (
    <div
      onClick={() => onOpen(item)}
      onMouseEnter={e => e.currentTarget.style.background="#1c1814"}
      onMouseLeave={e => e.currentTarget.style.background="#12100e"}
      style={{ background:"#12100e", padding:16, display:"flex", gap:12, alignItems:"flex-start", cursor:"pointer", position:"relative", borderBottom:"0.5px solid rgba(250,246,239,0.07)", transition:"background 0.1s" }}>
      {/* Info */}
      <div style={{ flex:1, minWidth:0, order:1 }}>
        <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", gap:8, marginBottom:4 }}>
          <p style={{ fontFamily:"'Fraunces',serif", fontSize:16, fontWeight:500, color:"#FAF6EF", lineHeight:1.3, flex:1, minWidth:0 }}>{item.name}</p>
          <p style={{ fontSize:15, fontWeight:600, color:"#FAF6EF", whiteSpace:"nowrap", flexShrink:0 }}>{fmt(item.price)}</p>
        </div>
        <p style={{ fontFamily:"'Fraunces',serif", fontStyle:"italic", fontSize:14.5, color:"#B8A995", lineHeight:1.6, marginBottom:item.badge ? 4 : 0, display:"-webkit-box", WebkitLineClamp:3, WebkitBoxOrient:"vertical", overflow:"hidden" }}>{item.desc}</p>
        {item.badge && <Badge type={item.badge} label={item.badge==="bestseller"?"Most Loved":item.badge==="chef"?"Chef's selection":"Spicy"} />}
      </div>
      {/* Photo */}
      <div style={{ width:96, height:96, borderRadius:10, flexShrink:0, order:2, backgroundColor:"#1c1814", backgroundSize:"cover", backgroundPosition:"center", overflow:"hidden", position:"relative", backgroundImage: imageUrl ? `url(${imageUrl})` : "none" }}>
        {!imageUrl && (
          <div style={{ width:"100%", height:"100%", background:"repeating-linear-gradient(135deg,rgba(232,168,46,0.08) 0px,rgba(232,168,46,0.08) 1px,transparent 1px,transparent 8px)" }} />
        )}
        {qty > 0 && (
          <div style={{ position:"absolute", top:-6, right:-6, width:22, height:22, borderRadius:"50%", background:"#E8A82E", color:"#080706", fontSize:11, fontWeight:600, display:"flex", alignItems:"center", justifyContent:"center", zIndex:2 }}>{qty}</div>
        )}
      </div>
    </div>
  );
}

function UpsellChip({ id, cart, onQtyChange }) {
  const item = QA[id];
  if (!item) return null;
  const qty = cart[id]?.qty ?? 0;
  const inCart = qty > 0;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 12px", border:`0.5px solid ${item.star?"rgba(232,168,46,0.4)":"rgba(250,246,239,0.1)"}`, borderRadius:10, background: inCart?"rgba(232,168,46,0.12)":item.star?"#1c1814":"#12100e", position:"relative", transition:"border-color 0.12s" }}>
      {item.star && <span style={{ position:"absolute", top:-7, left:10, fontSize:9, fontWeight:500, letterSpacing:"0.08em", background:"#E8A82E", color:"#080706", padding:"1px 6px", borderRadius:20 }}>Most Loved</span>}
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ fontSize:14, fontWeight:500, color:"#FAF6EF" }}>{item.name}</p>
        <p style={{ fontSize:12, color:"#B8A995", marginTop:1 }}>{item.note}</p>
      </div>
      <span style={{ fontSize:14, fontWeight:500, color:"#FAF6EF", flexShrink:0 }}>{fmt(item.price)}</span>
      <div style={{ display:"flex", alignItems:"center", border:"1.5px solid #E8A82E", borderRadius:20, overflow:"hidden", flexShrink:0 }}>
        {inCart ? (
          <>
            <button onClick={() => onQtyChange(id,-1)} style={{ width:28, height:28, background:"transparent", border:"none", color:"#E8A82E", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center" }}>−</button>
            <span style={{ fontSize:13, fontWeight:500, minWidth:20, textAlign:"center", color:"#FAF6EF" }}>{qty}</span>
            <button onClick={() => onQtyChange(id,1)} style={{ width:28, height:28, background:"transparent", border:"none", color:"#E8A82E", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center" }}>+</button>
          </>
        ) : (
          <button onClick={() => onQtyChange(id,1)} style={{ width:28, height:28, background:"transparent", border:"none", color:"#E8A82E", fontSize:20, display:"flex", alignItems:"center", justifyContent:"center" }}>+</button>
        )}
      </div>
    </div>
  );
}

function ItemModal({ item, cart, onClose, onCommit, onUpsellQty, imageUrl }) {
  const [qty, setQty] = useState(1);
  const [spice, setSpice] = useState(null);
  const [note, setNote] = useState("");
  // Upsells frozen at open time — don't re-evaluate as cart changes mid-modal
  const [frozenUpsells, setFrozenUpsells] = useState([]);
  const existing = item ? cart[item.id+"_1"] : null;

  useEffect(() => {
    if (!item) return;
    setQty(existing?.qty ?? 1);
    const defaultSpice =
      item.spiceProfile === "mild" ? "Mild"  :
      item.spiceProfile === "hot"  ? "Spicy" : null;
    setSpice(existing?.spice ?? defaultSpice);
    setNote(existing?.note ?? "");
    // Build a cart snapshot containing ONLY real menu items (not qa- quick-adds).
    // This means each customer's modal evaluates fresh — previous customers adding
    // bread or drinks won't suppress suggestions for the next person's order.
    const entreeCart = Object.fromEntries(
      Object.entries(cart).filter(([k]) => !k.startsWith("qa-"))
    );
    setFrozenUpsells(getModalUpsells(item.id, entreeCart));
  }, [item?.id]); // deliberately NOT in cart deps — stays frozen

  if (!item) return null;
  const photo = imageUrl ?? null;

  return (
    <div onClick={e => e.target===e.currentTarget && onClose()} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.65)", zIndex:600, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
      <div style={{ background:"#12100e", borderRadius:"16px 16px 0 0", width:"100%", maxWidth:540, maxHeight:"90vh", overflowY:"auto" }}>
        {/* Photo hero */}
        <div style={{ width:"100%", height:220, background: photo?`url(${photo}) center/cover`:"#1c1814", position:"relative", flexShrink:0 }}>
          {!photo && <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center", background:"repeating-linear-gradient(135deg,rgba(232,168,46,0.08) 0px,rgba(232,168,46,0.08) 1px,transparent 1px,transparent 12px)" }}><span style={{ fontSize:40, opacity:0.3, color:"#E8A82E" }}>⬡</span></div>}
          <button onClick={onClose} style={{ position:"absolute", top:12, right:12, width:32, height:32, borderRadius:"50%", background:"rgba(8,7,6,0.75)", border:"none", fontSize:18, color:"#FAF6EF", display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
        </div>
        {/* Body */}
        <div style={{ padding:"1.25rem" }}>
          <h2 style={{ fontFamily:"'Fraunces',serif", fontSize:26, fontWeight:500, color:"#FAF6EF", marginBottom:6 }}>{item.name}</h2>
          <p style={{ fontFamily:"'Fraunces',serif", fontStyle:"italic", fontSize:15, color:"#B8A995", lineHeight:1.6, marginBottom:12 }}>{item.desc}</p>
          <p style={{ fontSize:17, fontWeight:500, color:"#FAF6EF", marginBottom:"1.25rem" }}>{fmt(item.price)}</p>

          {item.spiceProfile !== "none" && (
            <div style={{ marginBottom:"1.25rem" }}>
              <p style={{ fontSize:12, fontWeight:500, letterSpacing:"0.15em", textTransform:"uppercase", color:"#B8A995", marginBottom:8 }}>Spice level</p>

              {(item.spiceProfile === "mild" || item.spiceProfile === "hot") ? (
                <div style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 12px", borderRadius:8, border:"1.5px solid rgba(232,168,46,0.25)", background:"rgba(232,168,46,0.08)" }}>
                  <span style={{ fontSize:10, letterSpacing:"1px", color:"#E8A82E", flexShrink:0 }}>
                    {item.spiceProfile === "mild" ? "●○○" : "●●●"}
                  </span>
                  <span style={{ fontSize:13.5, color:"#FAF6EF" }}>
                    {item.spiceProfile === "mild"
                      ? "Always Mild — cool, creamy and comforting by tradition."
                      : "Always Spicy — full heat, made the way it's meant to be."}
                  </span>
                </div>
              ) : (
                <>
                  <div style={{ display:"flex", gap:6 }}>
                    {SPICE_LEVELS.map(l => {
                      const active = spice === l.key;
                      return (
                        <button key={l.key} onClick={() => setSpice(active ? null : l.key)}
                          style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6, padding:"9px 6px", borderRadius:8, border:`1.5px solid ${active?"#E8A82E":"rgba(250,246,239,0.1)"}`, background:active?"rgba(232,168,46,0.12)":"#1c1814" }}>
                          <span style={{ fontSize:10, letterSpacing:"1px", color: active ? "#E8A82E" : "#D9482C" }}>
                            {"●".repeat(l.heat)}{"○".repeat(3 - l.heat)}
                          </span>
                          <span style={{ fontSize:13.5, fontWeight:500, color: active ? "#E8A82E" : "#FAF6EF" }}>{l.key}</span>
                        </button>
                      );
                    })}
                  </div>
                  {spice && (
                    <p style={{ fontSize:12.5, color:"#E8A82E", background:"rgba(232,168,46,0.08)", border:"0.5px solid rgba(232,168,46,0.2)", borderRadius:8, padding:"7px 10px", marginTop:8, lineHeight:1.4 }}>
                      {SPICE_LEVELS.find(l => l.key === spice)?.desc}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {frozenUpsells.map(sec => (
            <div key={sec.label} style={{ marginTop:"1rem", borderTop:"0.5px solid rgba(250,246,239,0.07)", paddingTop:"1rem" }}>
              <p style={{ fontSize:12, fontWeight:500, letterSpacing:"0.15em", textTransform:"uppercase", color:"#E8A82E", marginBottom:4 }}>{sec.label}</p>
              <p style={{ fontSize:13, color:"#B8A995", lineHeight:1.55, marginBottom:10 }}>{sec.hint}</p>
              <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                {sec.items.map(id => <UpsellChip key={id} id={id} cart={cart} onQtyChange={onUpsellQty} />)}
              </div>
            </div>
          ))}

          <p style={{ fontSize:12, fontWeight:500, letterSpacing:"0.15em", textTransform:"uppercase", color:"#B8A995", margin:"1rem 0 8px" }}>Special instructions</p>
          <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Allergies, dietary notes, extra spice requests…"
            style={{ width:"100%", border:"1.5px solid rgba(250,246,239,0.1)", borderRadius:10, padding:"10px 12px", fontFamily:"'Inter',sans-serif", fontSize:14, color:"#FAF6EF", background:"#1c1814", resize:"none", height:70, marginBottom:"1.25rem", outline:"none" }} />
        </div>
        {/* Footer */}
        <div style={{ display:"flex", alignItems:"center", gap:12, padding:"1rem 1.25rem", borderTop:"0.5px solid rgba(250,246,239,0.07)", background:"#12100e", position:"sticky", bottom:0 }}>
          <div style={{ display:"flex", alignItems:"center", border:"1.5px solid rgba(250,246,239,0.12)", borderRadius:30, overflow:"hidden", flexShrink:0 }}>
            <button onClick={() => setQty(q=>Math.max(1,q-1))} disabled={qty<=1} style={{ width:36, height:36, background:"transparent", border:"none", fontSize:20, color:qty<=1?"rgba(250,246,239,0.25)":"#FAF6EF", display:"flex", alignItems:"center", justifyContent:"center" }}>−</button>
            <span style={{ minWidth:28, textAlign:"center", fontSize:15, fontWeight:500, color:"#FAF6EF" }}>{qty}</span>
            <button onClick={() => setQty(q=>q+1)} style={{ width:36, height:36, background:"transparent", border:"none", fontSize:20, color:"#FAF6EF", display:"flex", alignItems:"center", justifyContent:"center" }}>+</button>
          </div>
          <button
            onClick={() => { onCommit(item,qty,spice,note); onClose(); }}
            onMouseEnter={e => e.currentTarget.style.background="#C8871A"}
            onMouseLeave={e => e.currentTarget.style.background="#E8A82E"}
            style={{ flex:1, background:"#E8A82E", color:"#080706", border:"none", borderRadius:30, height:44, fontSize:15, fontWeight:600, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 16px" }}>
            <span>{existing?"Update order":"Add to order"}</span>
            <span>{fmt(item.price*qty)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function CartRow({ entry, onQty }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 1.25rem", borderBottom:"0.5px solid rgba(250,246,239,0.05)" }}>
      <div style={{ display:"flex", alignItems:"center", border:"1px solid rgba(250,246,239,0.12)", borderRadius:20, flexShrink:0 }}>
        <button onClick={() => onQty(entry.baseId,-1)} style={{ width:26, height:26, background:"transparent", border:"none", fontSize:16, color:"#FAF6EF", display:"flex", alignItems:"center", justifyContent:"center" }}>−</button>
        <span style={{ fontSize:13, fontWeight:500, minWidth:20, textAlign:"center", color:"#FAF6EF" }}>{entry.qty}</span>
        <button onClick={() => onQty(entry.baseId,1)} style={{ width:26, height:26, background:"transparent", border:"none", fontSize:16, color:"#FAF6EF", display:"flex", alignItems:"center", justifyContent:"center" }}>+</button>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ fontSize:14, fontWeight:500, color:"#FAF6EF", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{entry.name}</p>
        {entry.spice && <p style={{ fontSize:12, color:"#B8A995", marginTop:1 }}>{entry.spice}</p>}
        {entry.note  && <p style={{ fontSize:12, color:"#B8A995", marginTop:1 }}>{entry.note}</p>}
      </div>
      <span style={{ fontSize:14, fontWeight:500, color:"#FAF6EF", whiteSpace:"nowrap", flexShrink:0 }}>{fmt(entry.price*entry.qty)}</span>
    </div>
  );
}

// Ranks quick-adds by relevance to what's already in the cart (contextual
// bread/drink gaps first) so the rail leads with the most useful items,
// while still showing everything — a horizontally-scrolling "browse more"
// surface rather than just two forced suggestions.
function rankedQuickAdds(cart) {
  const hasBread    = cartHasBread(cart);
  const hasDrink    = cartHasDrink(cart);
  const hasCooling  = cartHasCooling(cart);
  const priority = id => {
    if (QA_BREADS.includes(id)  && !hasBread)   return 0;
    if (QA_DRINKS.includes(id)  && !hasDrink)   return 0;
    if (QA_COOLING.includes(id) && !hasCooling) return 1;
    return 2;
  };
  return Object.entries(QA)
    .map(([id, item]) => ({ id, ...item }))
    .sort((a, b) => priority(a.id) - priority(b.id));
}

function CompleteMealRail({ cart, onQty }) {
  if (cartCount(cart) === 0) return null;
  const items = rankedQuickAdds(cart);

  return (
    <div style={{ borderTop:"0.5px solid rgba(250,246,239,0.07)", padding:"12px 0" }}>
      <p style={{ fontSize:11, fontWeight:500, letterSpacing:"0.15em", textTransform:"uppercase", color:"#E8A82E", marginBottom:10, padding:"0 1.25rem" }}>Complete your meal</p>
      <div style={{ display:"flex", gap:8, overflowX:"auto", padding:"0 1.25rem 4px", scrollbarWidth:"none" }}>
        {items.map(item => {
          const qty = cart[item.id]?.qty ?? 0;
          return (
            <div key={item.id} style={{ flexShrink:0, width:126, background:"#1c1814", border:"0.5px solid rgba(250,246,239,0.1)", borderRadius:12, padding:10 }}>
              {item.star && <span style={{ display:"inline-block", fontSize:8.5, fontWeight:600, letterSpacing:"0.06em", color:"#E8A82E", marginBottom:4 }}>MOST LOVED</span>}
              <p style={{ fontSize:12.5, fontWeight:500, color:"#FAF6EF", lineHeight:1.3, minHeight:32, marginBottom:6 }}>{item.name}</p>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <span style={{ fontSize:12, color:"#B8A995" }}>{fmt(item.price)}</span>
                {qty > 0 ? (
                  <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                    <button aria-label={`Remove one ${item.name}`} onClick={() => onQty(item.id,-1)} style={{ width:20, height:20, borderRadius:"50%", background:"transparent", border:"1px solid #E8A82E", color:"#E8A82E", fontSize:12, lineHeight:1, display:"flex", alignItems:"center", justifyContent:"center" }}>−</button>
                    <span style={{ fontSize:12, color:"#FAF6EF", minWidth:12, textAlign:"center" }}>{qty}</span>
                    <button aria-label={`Add another ${item.name}`} onClick={() => onQty(item.id,1)} style={{ width:20, height:20, borderRadius:"50%", background:"#E8A82E", border:"none", color:"#080706", fontSize:12, lineHeight:1, display:"flex", alignItems:"center", justifyContent:"center" }}>+</button>
                  </div>
                ) : (
                  <button aria-label={`Add ${item.name}`} onClick={() => onQty(item.id,1)} style={{ width:22, height:22, borderRadius:"50%", background:"#E8A82E", border:"none", color:"#080706", fontSize:14, lineHeight:1, display:"flex", alignItems:"center", justifyContent:"center" }}>+</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const TIP_OPTIONS = [
  { key:0,        label:"No tip" },
  { key:0.15,     label:"15%" },
  { key:0.20,     label:"20%" },
  { key:0.25,     label:"25%" },
  { key:"custom", label:"Custom" },
];

function TipSelector({ tipPct, setTipPct, tipCustom, setTipCustom, subtotal }) {
  return (
    <div style={{ padding:"12px 1.25rem", borderTop:"0.5px solid rgba(250,246,239,0.07)" }}>
      <p style={{ fontSize:11, fontWeight:500, letterSpacing:"0.15em", textTransform:"uppercase", color:"#E8A82E", marginBottom:10 }}>Add a tip</p>
      <div style={{ display:"flex", gap:6 }}>
        {TIP_OPTIONS.map(opt => {
          const active = tipPct === opt.key;
          return (
            <button key={opt.key} onClick={() => setTipPct(opt.key)}
              style={{ flex:1, padding:"9px 4px", borderRadius:8, border:`1.5px solid ${active?"#E8A82E":"rgba(250,246,239,0.1)"}`, background:active?"rgba(232,168,46,0.12)":"#1c1814", color:active?"#E8A82E":"#FAF6EF", fontSize:12.5, fontWeight:500 }}>
              {opt.label}
            </button>
          );
        })}
      </div>
      {tipPct === "custom" && (
        <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:8 }}>
          <span style={{ fontSize:14, color:"#B8A995" }}>$</span>
          <input type="number" min="0" step="0.01" placeholder="0.00" value={tipCustom} onChange={e => setTipCustom(e.target.value)} autoFocus
            style={{ flex:1, padding:"8px 12px", borderRadius:8, border:"1px solid rgba(250,246,239,0.12)", background:"#1c1814", color:"#FAF6EF", fontSize:14, outline:"none", fontFamily:"'Inter',sans-serif" }} />
        </div>
      )}
      {typeof tipPct === "number" && tipPct > 0 && (
        <p style={{ fontSize:11, color:"#B8A995", marginTop:6 }}>{fmt(subtotal * tipPct)} on this order</p>
      )}
    </div>
  );
}

// Quiet, unbranded system notice (e.g. "some items from that order aren't on
// the menu anymore") — not an upsell surface, just a fact the customer needs.
function Notice({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div style={{ position:"fixed", bottom:90, left:"50%", transform:"translateX(-50%)", background:"#1c1814", border:"0.5px solid rgba(250,246,239,0.15)", borderRadius:16, padding:"12px 16px", width:"min(380px, calc(100vw - 2rem))", zIndex:500, boxShadow:"0 8px 32px rgba(0,0,0,0.45)", display:"flex", alignItems:"center", gap:12 }}>
      <p style={{ fontSize:13, color:"#FAF6EF", lineHeight:1.5, flex:1, margin:0 }}>{message}</p>
      <button onClick={onDismiss}
        style={{ background:"transparent", color:"#B8A995", border:"0.5px solid rgba(250,246,239,0.15)", fontFamily:"'Inter',sans-serif", fontSize:12, padding:"6px 12px", borderRadius:20, cursor:"pointer", flexShrink:0 }}>
        Got it
      </button>
    </div>
  );
}

// ── Checkout gate (inline — no separate import needed) ───────────
function CheckoutGate({ cart, total, tip, onCancel, onGuestIdentified, onViewAccount }) {
  const [step,       setStep]       = useState("choice");
  const [email,      setEmail]      = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const [returning,  setReturning]  = useState(null); // { totalOrders, favouriteName } | null

  // Recognizes a returning guest by email so we can surface their history —
  // without touching the cart they're actively checking out with.
  const checkReturning = async emailToCheck => {
    if (!emailToCheck.includes("@")) return;
    try {
      const res = await fetch(`/api/account/profile?email=${encodeURIComponent(emailToCheck)}`);
      if (!res.ok) { setReturning(null); return; }
      const data = await res.json();
      setReturning(data?.orders?.length > 0
        ? { totalOrders: data.stats?.totalOrders ?? data.orders.length, favouriteName: data.favourites?.[0]?.name ?? null }
        : null);
    } catch { setReturning(null); }
  };

  const goToStripe = async ({ clerkUserId = null, guestEmail = null } = {}) => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/create-checkout", {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ items: Object.values(cart), specialInstructions:"", clerkUserId, guestEmail, tip }),
      });
      if (!res.ok) throw new Error("Checkout failed");
      const { url } = await res.json();
      window.location.href = url;
    } catch (err) {
      setError("Something went wrong. Please call (914) 835-9066.");
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    // Production: clerk.openSignIn({ afterSignInUrl: ... })
    setLoading(true);
    setTimeout(() => goToStripe({ clerkUserId:"user_google_preview" }), 600);
  };

  const handleAppleSignIn = () => {
    setLoading(true);
    setTimeout(() => goToStripe({ clerkUserId:"user_apple_preview" }), 600);
  };

  const handleMagicLink = async e => {
    e.preventDefault();
    if (!email.includes("@")) { setError("Please enter a valid email"); return; }
    setLoading(true); setError(null);
    setTimeout(() => { setLoading(false); setStep("magic-sent"); }, 700);
  };

  const handleGuestContinue = async e => {
    e.preventDefault();
    if (!guestEmail.includes("@")) { setError("Please enter a valid email for your receipt"); return; }
    onGuestIdentified?.(guestEmail);
    goToStripe({ guestEmail });
  };

  const iStyle = { display:"block", width:"100%", padding:"10px 14px", border:"1px solid rgba(250,246,239,0.12)", borderRadius:10, fontSize:14, color:"#FAF6EF", background:"#1c1814", outline:"none", fontFamily:"'Inter',sans-serif", marginBottom:12, boxSizing:"border-box" };
  const socialBtn = { width:"100%", padding:"11px 16px", background:"#1c1814", color:"#FAF6EF", border:"0.5px solid rgba(250,246,239,0.15)", borderRadius:10, fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"'Inter',sans-serif", display:"flex", alignItems:"center", gap:10, marginBottom:8 };

  return (
    <div onClick={e => e.target===e.currentTarget && onCancel()} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.65)", zIndex:700, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
      <div style={{ background:"#12100e", borderRadius:"18px 18px 0 0", width:"100%", maxWidth:520, maxHeight:"92vh", overflowY:"auto" }}>
        <div style={{ width:36, height:4, background:"rgba(250,246,239,0.15)", borderRadius:2, margin:"12px auto 0" }} />
        <div style={{ padding:"16px 20px 12px", borderBottom:"0.5px solid rgba(250,246,239,0.08)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <p style={{ fontFamily:"'Great Vibes',cursive", fontSize:26, color:"#FAF6EF", margin:0, lineHeight:1 }}>Rani Mahal</p>
            <p style={{ fontSize:11, color:"#B8A995", letterSpacing:"0.12em", textTransform:"uppercase", margin:"3px 0 0" }}>Ready to order · {fmt(total)}</p>
          </div>
          <button onClick={onCancel} style={{ background:"transparent", border:"none", fontSize:22, color:"#B8A995", cursor:"pointer" }}>×</button>
        </div>

        <div style={{ padding:"16px 20px 32px" }}>
          {step === "choice" && (
            <>
              {/* Guest — primary */}
              <div style={{ background:"#1c1814", border:"0.5px solid rgba(250,246,239,0.1)", borderRadius:12, padding:"1rem 1.25rem", marginBottom:16 }}>
                <p style={{ fontSize:14, fontWeight:600, color:"#FAF6EF", margin:"0 0 4px" }}>Continue as guest</p>
                <p style={{ fontSize:13, color:"#B8A995", margin:"0 0 14px", lineHeight:1.55 }}>No account needed. Your receipt goes to your email.</p>
                <button style={{ width:"100%", padding:"12px", background:"#E8A82E", color:"#080706", border:"none", borderRadius:10, fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"'Inter',sans-serif" }} onClick={() => setStep("guest-email")}>
                  Continue as guest
                </button>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
                <div style={{ flex:1, height:"0.5px", background:"rgba(250,246,239,0.1)" }} />
                <p style={{ fontSize:11, color:"#B8A995", margin:0, whiteSpace:"nowrap" }}>or sign in to save your order history</p>
                <div style={{ flex:1, height:"0.5px", background:"rgba(250,246,239,0.1)" }} />
              </div>
              <button style={socialBtn} onClick={handleGoogleSignIn} disabled={loading}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Continue with Google
              </button>
              <button style={socialBtn} onClick={handleAppleSignIn} disabled={loading}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98l-.09.06c-.22.15-2.19 1.3-2.17 3.87.03 3.06 2.68 4.08 2.71 4.09-.03.07-.42 1.44-1.39 2.61M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" fill="#FAF6EF"/></svg>
                Continue with Apple
              </button>
              <hr style={{ border:"none", borderTop:"0.5px solid rgba(250,246,239,0.08)", margin:"14px 0" }} />
              <p style={{ fontSize:11, color:"#B8A995", textAlign:"center", marginBottom:10 }}>or sign in with email</p>
              <form onSubmit={handleMagicLink}>
                <input type="email" placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)} style={iStyle} required />
                {error && <p style={{ fontSize:12, color:"#F0846A", marginBottom:8 }}>{error}</p>}
                <button type="submit" style={{ width:"100%", padding:"12px", background:"#E8A82E", color:"#080706", border:"none", borderRadius:10, fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"'Inter',sans-serif" }} disabled={loading}>
                  {loading ? "Sending…" : "Send sign-in link"}
                </button>
                <p style={{ fontSize:11, color:"#B8A995", textAlign:"center", marginTop:8 }}>No password — we email you a one-tap link.</p>
              </form>
            </>
          )}

          {step === "guest-email" && (
            <>
              <button onClick={() => { setStep("choice"); setError(null); }} style={{ background:"transparent", border:"none", color:"#B8A995", fontSize:13, cursor:"pointer", padding:"0 0 14px", display:"flex", alignItems:"center", gap:4 }}>← Back</button>
              <p style={{ fontSize:16, fontWeight:500, color:"#FAF6EF", marginBottom:4, fontFamily:"'Fraunces',serif" }}>Where should we send your receipt?</p>
              <p style={{ fontSize:13, color:"#B8A995", marginBottom:16, lineHeight:1.55 }}>We'll email your order confirmation and order tracking link.</p>
              <form onSubmit={handleGuestContinue}>
                <label style={{ fontSize:11, fontWeight:600, letterSpacing:"0.15em", textTransform:"uppercase", color:"#B8A995", marginBottom:5, display:"block" }}>Your email</label>
                <input type="email" placeholder="you@email.com" value={guestEmail}
                  onChange={e => { setGuestEmail(e.target.value); setReturning(null); }}
                  onBlur={e => checkReturning(e.target.value)}
                  style={iStyle} required autoFocus />
                {returning && (
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, background:"rgba(232,168,46,0.1)", border:"0.5px solid rgba(232,168,46,0.3)", borderRadius:10, padding:"10px 14px", marginBottom:12 }}>
                    <p style={{ fontSize:12.5, color:"#FAF6EF", lineHeight:1.4, margin:0 }}>
                      Welcome back! You've ordered with us {returning.totalOrders} time{returning.totalOrders===1?"":"s"}{returning.favouriteName ? ` — usually ${returning.favouriteName}` : ""}.
                    </p>
                    <button type="button" onClick={() => onViewAccount?.()} style={{ background:"transparent", border:"none", color:"#E8A82E", fontSize:12, fontWeight:600, cursor:"pointer", flexShrink:0, whiteSpace:"nowrap" }}>
                      View past orders
                    </button>
                  </div>
                )}
                {error && <p style={{ fontSize:12, color:"#F0846A", marginBottom:8 }}>{error}</p>}
                <button type="submit" style={{ width:"100%", padding:"13px", background:"#E8A82E", color:"#080706", border:"none", borderRadius:10, fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"'Inter',sans-serif" }} disabled={loading}>
                  {loading ? "Redirecting to payment…" : `Continue to payment · ${fmt(total)}`}
                </button>
              </form>
            </>
          )}

          {step === "magic-sent" && (
            <div style={{ textAlign:"center", padding:"24px 0" }}>
              <div style={{ fontSize:48, marginBottom:16 }}>✉</div>
              <p style={{ fontSize:18, fontWeight:500, color:"#FAF6EF", marginBottom:8, fontFamily:"'Fraunces',serif" }}>Check your email</p>
              <p style={{ fontSize:14, color:"#B8A995", lineHeight:1.6, marginBottom:20 }}>We sent a sign-in link to <strong style={{ color:"#FAF6EF" }}>{email}</strong>. Tap it and you'll go straight to checkout.</p>
              <button style={{ background:"transparent", border:"1px solid rgba(250,246,239,0.15)", color:"#FAF6EF", padding:"9px 20px", borderRadius:10, fontSize:13, cursor:"pointer", fontFamily:"'Inter',sans-serif" }} onClick={() => { setStep("choice"); setError(null); }}>
                Try a different method
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Cart persistence — survives refresh/accidental navigation ────
const CART_STORAGE_KEY = "rani_cart_v1";
const CART_MAX_AGE_MS  = 6 * 60 * 60 * 1000; // don't resurrect a cart from days ago

function loadStoredCart() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return {};
    const { cart, savedAt } = JSON.parse(raw);
    if (!cart || !savedAt || Date.now() - savedAt > CART_MAX_AGE_MS) return {};
    return cart;
  } catch { return {}; }
}

// Remembers the last email a guest checked out with, so returning guests are
// recognized on the Account page and during checkout without re-typing it.
const GUEST_EMAIL_KEY = "rani_guest_email";
const loadGuestEmail  = () => { try { return localStorage.getItem(GUEST_EMAIL_KEY) || null; } catch { return null; } };
const saveGuestEmail  = email => { try { localStorage.setItem(GUEST_EMAIL_KEY, email); } catch {} };

// ── Main App ─────────────────────────────────────────────────────
export default function RaniMahal() {
  const [view, setView] = useState("menu"); // "menu" | "account"
  const [activeSection, setActiveSection] = useState("appetizers");
  const [cart, setCart]         = useState(loadStoredCart);
  const [modalItem, setModalItem] = useState(null);
  const [notice, setNotice]     = useState(null);
  const [drawerOpen,       setDrawerOpen]       = useState(false);
  const [showCheckoutGate, setShowCheckoutGate] = useState(false);
  const [tipPct,  setTipPct]  = useState(0);   // 0, 0.15, 0.2, 0.25, or "custom"
  const [tipCustom, setTipCustom] = useState("");
  const [guestEmail, setGuestEmail] = useState(loadGuestEmail);
  const noticeTimer = useRef(null);
  const [cloudImages, setCloudImages] = useState({});

  // Load images from cloud on mount — falls back to localStorage in dev.
  // Must be state, not a ref: a ref write doesn't trigger a re-render, so
  // images that finish loading after the initial paint would never show up.
  useEffect(() => {
    fetch("/api/images/list")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.images) setCloudImages(data.images); })
      .catch(() => {}); // silent fail — localStorage fallback handles it
  }, []);

  // Persist cart on every change so a refresh doesn't wipe the order
  useEffect(() => {
    try {
      if (Object.keys(cart).length === 0) localStorage.removeItem(CART_STORAGE_KEY);
      else localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ cart, savedAt: Date.now() }));
    } catch {} // storage full/unavailable — cart still works in-memory
  }, [cart]);

  const updateCart = useCallback(updater => setCart(prev => updater(prev)), []);

  const commitItem = useCallback((item, qty, spice, note) => {
    updateCart(prev => {
      const key = item.id+"_1";
      if (qty===0) { const n={...prev}; delete n[key]; return n; }
      return { ...prev, [key]:{ name:item.name, price:item.price, qty, spice, note, baseId:item.id } };
    });
  }, []);

  const adjustQty = useCallback((baseId, delta) => {
    updateCart(prev => {
      const key = baseId+"_1";
      if (!prev[key] && delta<0) return prev;
      const entry = prev[key] || { name:ITEM_MAP[baseId]?.name??baseId, price:ITEM_MAP[baseId]?.price??0, qty:0, spice:null, note:"", baseId };
      const qty = Math.max(0, entry.qty+delta);
      if (qty===0) { const n={...prev}; delete n[key]; return n; }
      return { ...prev, [key]:{ ...entry, qty } };
    });
  }, []);

  const upsellQty = useCallback((id, delta) => {
    const item = QA[id]; if (!item) return;
    updateCart(prev => {
      const entry = prev[id] || { name:item.name, price:item.price, qty:0, spice:null, note:"", baseId:id };
      const qty = Math.max(0, entry.qty+delta);
      if (qty===0) { const n={...prev}; delete n[id]; return n; }
      return { ...prev, [id]:{ ...entry, qty } };
    });
  }, []);

  const stripQty = useCallback((id, delta) => upsellQty(id, delta), [upsellQty]);

  // Rebuilds the cart from a past order. Re-prices every line against the
  // *current* menu/quick-add catalog rather than trusting the old order's
  // price — a menu item may have changed price (or been removed) since.
  const reorderFromOrder = useCallback((order) => {
    if (!order?.items?.length) return;
    const next = {};
    let skipped = 0;
    order.items.forEach(item => {
      const isQA = item.baseId?.startsWith("qa-");
      const canonical = isQA ? QA[item.baseId] : ITEM_MAP[item.baseId];
      if (!canonical) { skipped++; return; }
      const key = isQA ? item.baseId : item.baseId + "_1";
      next[key] = { name:canonical.name, price:canonical.price, qty:item.qty, spice:item.spice ?? null, note:item.note ?? "", baseId:item.baseId };
    });
    setCart(next);
    setView("menu");
    setDrawerOpen(true);
    if (skipped > 0) {
      showNotice(`Heads up — ${skipped} item${skipped>1?"s":""} from that order ${skipped>1?"aren't":"isn't"} on the menu anymore, so ${skipped>1?"they were":"it was"} left out.`);
    }
  }, []);

  const showNotice = (msg) => {
    clearTimeout(noticeTimer.current);
    setNotice(msg);
    noticeTimer.current = setTimeout(() => setNotice(null), 6000);
  };

  const dismissNotice = () => { setNotice(null); clearTimeout(noticeTimer.current); };

  const handleCheckout = () => {
    if (itemCount === 0) return;
    setDrawerOpen(false);
    setShowCheckoutGate(true);
  };

  const entries   = Object.values(cart);
  const itemCount = entries.reduce((s,v)=>s+v.qty, 0);
  const subtotal  = entries.reduce((s,v)=>s+v.price*v.qty, 0);
  const tax       = subtotal*TAX;
  const tip       = tipPct === "custom" ? Math.max(0, parseFloat(tipCustom) || 0) : subtotal * tipPct;
  // CC fee gross-up: ensures Stripe's cut of the grossed-up total
  // exactly equals the fee we add — restaurant receives full subtotal+tax+tip
  const ccFee     = itemCount > 0 ? parseFloat(((subtotal + tax + tip + 0.30) / (1 - 0.029) - (subtotal + tax + tip)).toFixed(2)) : 0;
  const total     = subtotal + tax + tip + ccFee;
  const section   = SECTIONS.find(s=>s.id===activeSection);

  if (view === "account") {
    return (
      <AccountPortal
        guestEmail={guestEmail}
        onStartOrder={() => setView("menu")}
        onReorder={reorderFromOrder}
      />
    );
  }

  return (
    <div style={{ background:"#080706", minHeight:"100vh", color:"#FAF6EF" }}>
      <style>{css}</style>

      {/* ── Header — Option C: Gold rule minimal ── */}
      <header style={{ background:"#080706", position:"sticky", top:0, zIndex:100, borderBottom:"0.5px solid rgba(250,246,239,0.08)" }}>
        {/* Name + info row */}
        <div style={{ padding:"12px 20px 10px", display:"flex", alignItems:"flex-end", justifyContent:"space-between", gap:16, borderBottom:"1.5px solid #E8A82E" }}>
          {/* Left — name + tagline stacked */}
          <div>
            <h1 style={{ fontFamily:"'Great Vibes',cursive", fontSize:34, fontWeight:400, color:"#FAF6EF", lineHeight:1, marginBottom:2 }}>Rani Mahal</h1>
            <p style={{ fontFamily:"'Inter',sans-serif", fontSize:10, fontWeight:500, letterSpacing:"0.16em", textTransform:"uppercase", color:"#E8A82E" }}>Fine Indian Cuisine</p>
          </div>
          {/* Right — location + phone stacked, account entry point */}
          <div style={{ textAlign:"right", flexShrink:0, display:"flex", alignItems:"flex-end", gap:14 }}>
            <div>
              <p style={{ fontFamily:"'Inter',sans-serif", fontSize:10, fontWeight:500, letterSpacing:"0.12em", textTransform:"uppercase", color:"#B8A995", lineHeight:1.6 }}>Est. 2006 · Mamaroneck, NY</p>
              <a href="tel:9148359066" style={{ fontFamily:"'Inter',sans-serif", fontSize:11, fontWeight:500, color:"#E8A82E", letterSpacing:"0.04em", textDecoration:"none" }}>(914) 835-9066</a>
            </div>
            <button onClick={() => setView("account")} aria-label="Your account" style={{ width:34, height:34, flexShrink:0, background:"transparent", border:"0.5px solid rgba(250,246,239,0.18)", color:"#FAF6EF", borderRadius:"50%", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:2 }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" />
              </svg>
            </button>
          </div>
        </div>
        {/* Order type + ETA — shown before menu browsing, not buried at checkout */}
        <div style={{ padding:"9px 20px", display:"flex", alignItems:"center", justifyContent:"center", gap:8, background:"#12100e", borderBottom:"0.5px solid rgba(250,246,239,0.06)", flexWrap:"wrap" }}>
          <span style={{ fontSize:11, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", color:"#FAF6EF" }}>Pickup</span>
          <span style={{ width:3, height:3, borderRadius:"50%", background:"#B8A995", flexShrink:0 }} />
          <span style={{ fontSize:11, color:"#E8A82E", fontWeight:500 }}>Ready in about 25–35 min</span>
          <span style={{ width:3, height:3, borderRadius:"50%", background:"#B8A995", flexShrink:0 }} />
          <span style={{ fontSize:11, color:"#B8A995" }}>327 Mamaroneck Ave, Mamaroneck NY</span>
        </div>
        {/* Nav row */}
        <div style={{ overflowX:"auto", scrollbarWidth:"none" }}>
          <div style={{ display:"flex", minWidth:"max-content", padding:"10px 14px", gap:7 }}>
            {SECTIONS.map(s => {
              const active = activeSection === s.id;
              return (
                <button key={s.id} onClick={() => setActiveSection(s.id)}
                  style={{ background: active ? "#E8A82E" : "transparent", border: active ? "none" : "0.5px solid rgba(250,246,239,0.15)", color: active ? "#080706" : "#B8A995", fontSize:12, fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase", padding:"9px 18px", borderRadius:24, transition:"all 0.15s", whiteSpace:"nowrap", cursor:"pointer", fontFamily:"'Inter',sans-serif", minHeight:40 }}>
                  {s.title}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* ── Menu (dark) ── */}
      <div style={{ maxWidth:1100, margin:"0 auto", padding:"0 1rem 140px" }}>
        <div style={{ paddingTop:"2rem" }}>
          {/* Section header */}
          <div style={{ marginBottom:"1.5rem", textAlign:"center" }}>
            <p style={{ fontSize:11, fontWeight:500, letterSpacing:"0.25em", textTransform:"uppercase", color:"#E8A82E", marginBottom:4 }}>{section?.eyebrow}</p>
            <h2 style={{ fontFamily:"'Fraunces',serif", fontSize:32, fontWeight:500, color:"#FAF6EF", lineHeight:1.1 }}>{section?.title}</h2>
            {section?.note && <p style={{ fontSize:13, color:"#B8A995", marginTop:4 }}>{section.note}</p>}
          </div>
          {/* Items — no wrapper background, cards are self-contained */}
          {section?.subsections.map(sub=>(
            <div key={sub.label||"main"} style={{ marginBottom:sub.label?"2rem":0 }}>
              {sub.label && (
                <p style={{ fontSize:11, fontWeight:500, letterSpacing:"0.2em", textTransform:"uppercase", color:"#B8A995", paddingBottom:8, borderBottom:"0.5px solid rgba(232,168,46,0.2)", marginBottom:10, textAlign:"center" }}>{sub.label}</p>
              )}
              <div style={{ background:"#12100e", borderRadius:12, overflow:"hidden", boxShadow:"0 1px 6px rgba(0,0,0,0.3), 0 0 0 0.5px rgba(250,246,239,0.06)" }}>
                {sub.ids.map(id=>{
                  const item = ITEM_MAP[id]; if(!item) return null;
                  return <ItemCard key={id} item={item} cartEntry={cart[id+"_1"]} onOpen={setModalItem} imageUrl={cloudImages[id] ?? localStorage.getItem("img_"+id) ?? null} />;
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Checkout gate — account / guest screen */}
      {showCheckoutGate && (
        <CheckoutGate
          cart={cart}
          total={total}
          tip={tip}
          onCancel={() => { setShowCheckoutGate(false); setDrawerOpen(true); }}
          onGuestIdentified={email => { setGuestEmail(email); saveGuestEmail(email); }}
          onViewAccount={() => { setShowCheckoutGate(false); setView("account"); }}
        />
      )}

      {/* Modal */}
      {modalItem && <ItemModal item={modalItem} cart={cart} onClose={()=>setModalItem(null)} onCommit={commitItem} onUpsellQty={upsellQty} imageUrl={cloudImages[modalItem.id] ?? localStorage.getItem("img_"+modalItem.id) ?? null} />}

      {/* System notice (e.g. reorder skipped some items) */}
      <Notice message={notice} onDismiss={dismissNotice} />

      {/* Mobile cart bar (dark) */}
      {itemCount>0 && (
        <div style={{ position:"fixed", bottom:0, left:0, right:0, background:"#12100e", padding:"12px 1.25rem", zIndex:200, borderTop:"0.5px solid rgba(250,246,239,0.1)", boxShadow:"0 -4px 24px rgba(0,0,0,0.35)", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
          <div>
            <p style={{ fontSize:13, color:"#B8A995", letterSpacing:"0.06em" }}>{itemCount} {itemCount===1?"item":"items"}</p>
            <p style={{ fontFamily:"'Fraunces',serif", fontSize:22, color:"#FAF6EF", fontWeight:500 }}>{fmt(subtotal)}</p>
          </div>
          <button onClick={()=>setDrawerOpen(true)}
            style={{ background:"#E8A82E", border:"none", color:"#080706", fontSize:14, fontWeight:600, padding:"12px 22px", borderRadius:30, cursor:"pointer" }}>
            View order →
          </button>
        </div>
      )}

      {/* Cart drawer (dark) */}
      {drawerOpen && (
        <>
          <div onClick={()=>setDrawerOpen(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:300 }} />
          <div style={{ position:"fixed", bottom:0, left:0, right:0, background:"#12100e", borderRadius:"16px 16px 0 0", zIndex:400, maxHeight:"85vh", overflowY:"auto" }}>
            <div style={{ width:36, height:4, background:"rgba(250,246,239,0.15)", borderRadius:2, margin:"12px auto 0" }} />
            <div style={{ padding:"1rem 1.25rem", display:"flex", justifyContent:"space-between", alignItems:"center", borderBottom:"0.5px solid rgba(250,246,239,0.08)" }}>
              <span style={{ fontFamily:"'Fraunces',serif", fontSize:22, fontWeight:500, color:"#FAF6EF" }}>Your order</span>
              <button onClick={()=>setDrawerOpen(false)} style={{ background:"transparent", border:"none", fontSize:22, color:"#B8A995", cursor:"pointer" }}>×</button>
            </div>
            {entries.length===0 ? (
              <p style={{ padding:"2.5rem 1.25rem", textAlign:"center", color:"#B8A995", fontSize:14 }}>Your cart is empty.</p>
            ) : (
              <>
                {entries.map((entry,i)=><CartRow key={i} entry={entry} onQty={adjustQty} />)}
                <CompleteMealRail cart={cart} onQty={stripQty} />
                <TipSelector tipPct={tipPct} setTipPct={setTipPct} tipCustom={tipCustom} setTipCustom={setTipCustom} subtotal={subtotal} />
                <div style={{ padding:"0.75rem 1.25rem", borderTop:"0.5px solid rgba(250,246,239,0.07)" }}>
                  {[
                    ["Subtotal", subtotal, false],
                    ["Tax (est. 8.375%)", tax, false],
                    ["Tip", tip, false],
                    ["Credit card processing fee", ccFee, false],
                    ["Total", total, true],
                  ].map(([l,v,isTotal])=>(
                    <div key={l} style={{ display:"flex", justifyContent:"space-between", fontSize:isTotal?16:14, fontWeight:isTotal?500:400, color:isTotal?"#FAF6EF":"#B8A995", padding:"3px 0", borderTop:isTotal?"0.5px solid rgba(250,246,239,0.08)":"none", marginTop:isTotal?6:0 }}>
                      <span>{l}</span><span>{fmt(v)}</span>
                    </div>
                  ))}
                </div>
                <div style={{ padding:"0 1.25rem 2rem" }}>
                  <button onClick={handleCheckout}
                    style={{ display:"block", width:"100%", padding:14, background:"#E8A82E", border:"none", color:"#080706", fontSize:15, fontWeight:600, borderRadius:8, cursor:"pointer" }}>
                    Proceed to checkout — {fmt(total)}
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
