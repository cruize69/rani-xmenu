import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useUser, useClerk } from "@clerk/clerk-react";
import { MENU_ITEMS, ITEM_MAP, QA, TAX_RATE, SECTIONS } from "./lib/menu.js";
import AccountPortal from "./AccountPortal.jsx";

// Clerk's hooks throw if called outside <ClerkProvider>, and main.jsx only
// mounts that provider when a publishable key is actually configured — so
// every real Clerk-hook call in this file is isolated inside components
// that only ever mount when this is true, never called unconditionally.
const CLERK_ENABLED = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// ── Fonts — matches the Rani Mahal marketing site (Fraunces / Inter / Great Vibes) ──
const FONT_LINK = "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..600;1,9..144,400..500&family=Great+Vibes&family=Inter:wght@300;400;500;600&display=swap";

// ── Design tokens — same dark palette as the marketing site ───────
const T = {
  ink: "#080706", surface: "#12100e", surface2: "#1c1814", line: "#342820",
  saffron: "#E8A82E", saffronDeep: "#C8871A", chili: "#D9482C",
  bone: "#FAF6EF", muted: "#B8A995",
};

// ── Menu data (MENU_ITEMS, ITEM_MAP, QA, TAX_RATE, SECTIONS) — imported from lib/menu.js, shared with the backend ──

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

// Quick-add ids have no photo of their own — each maps to the real menu
// item it represents, so the rail reuses the same shared photo library
// (ImageManager -> /api/images/list) rather than needing separate images.
const QA_ITEM_ID = {
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
};

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
@keyframes navArrowAttract {
  0%   { opacity:0; transform:translateX(-6px); }
  15%  { opacity:1; transform:translateX(0); }
  30%  { transform:translateX(6px); }
  45%  { transform:translateX(0); }
  60%  { transform:translateX(6px); }
  75%  { transform:translateX(0); }
  90%  { opacity:1; }
  100% { opacity:0; transform:translateX(-6px); }
}
`;

// ── Components ───────────────────────────────────────────────────

// Horizontally-scrolling section tabs (Appetizers, Soups & Salads, ...).
// Left/right edge arrows are hidden by default and only appear on hover —
// they're a discoverability hint, not a primary control, since the row
// itself is directly touch-scrollable. On a first visit, if the visitor
// hasn't scrolled the row within a couple seconds and there's more to see,
// the right arrow gives itself one brief attention-grabbing wiggle so
// touch users (who never get a hover state) still learn it's scrollable.
function SectionNav({ sections, activeSection, onSelect }) {
  const scrollerRef = useRef(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [attract, setAttract] = useState(false);
  const hasInteracted = useRef(false);

  const updateArrows = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => { hasInteracted.current = true; updateArrows(); };
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updateArrows);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", updateArrows);
    };
  }, [updateArrows]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!hasInteracted.current && canRight) {
        setAttract(true);
        window.setTimeout(() => setAttract(false), 2600);
      }
    }, 2500);
    return () => clearTimeout(t);
  }, [canRight]);

  const scrollBy = (dir) => {
    hasInteracted.current = true;
    setAttract(false);
    scrollerRef.current?.scrollBy({ left: dir * scrollerRef.current.clientWidth * 0.7, behavior: "smooth" });
  };

  return (
    <div style={{ position:"relative" }} onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}>
      <div ref={scrollerRef} style={{ overflowX:"auto", scrollbarWidth:"none" }}>
        <div style={{ display:"flex", minWidth:"max-content", padding:"10px 14px", gap:7 }}>
          {sections.map(s => {
            const active = activeSection === s.id;
            return (
              <button key={s.id} onClick={() => onSelect(s.id)}
                style={{ background: active ? "#E8A82E" : "transparent", border: active ? "none" : "0.5px solid rgba(250,246,239,0.15)", color: active ? "#080706" : "#B8A995", fontSize:12, fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase", padding:"9px 18px", borderRadius:24, transition:"all 0.15s", whiteSpace:"nowrap", cursor:"pointer", fontFamily:"'Inter',sans-serif", minHeight:40 }}>
                {s.title}
              </button>
            );
          })}
        </div>
      </div>
      {canLeft && (
        <button
          aria-label="Scroll sections left"
          onClick={() => scrollBy(-1)}
          style={{ position:"absolute", left:0, top:0, bottom:0, width:44, display:"flex", alignItems:"center", justifyContent:"flex-start", background:"linear-gradient(to right, #080706 30%, rgba(8,7,6,0))", border:"none", padding:0, cursor:"pointer", opacity: hovering ? 1 : 0, transition:"opacity 0.2s", zIndex:2 }}>
          <span style={{ width:28, height:28, marginLeft:6, borderRadius:"50%", background:"rgba(232,168,46,0.14)", border:"0.5px solid rgba(232,168,46,0.35)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E8A82E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </span>
        </button>
      )}
      {canRight && (
        <button
          aria-label="Scroll sections right"
          onClick={() => scrollBy(1)}
          style={{ position:"absolute", right:0, top:0, bottom:0, width:44, display:"flex", alignItems:"center", justifyContent:"flex-end", background:"linear-gradient(to left, #080706 30%, rgba(8,7,6,0))", border:"none", padding:0, cursor:"pointer", opacity: (hovering || attract) ? 1 : 0, transition: attract ? "none" : "opacity 0.2s", zIndex:2 }}>
          <span style={{ width:28, height:28, marginRight:6, borderRadius:"50%", background: attract ? "#E8A82E" : "rgba(232,168,46,0.14)", border: attract ? "none" : "0.5px solid rgba(232,168,46,0.35)", display:"flex", alignItems:"center", justifyContent:"center", animation: attract ? "navArrowAttract 2.6s ease-in-out 1" : "none" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={attract ? "#080706" : "#E8A82E"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
          </span>
        </button>
      )}
    </div>
  );
}

// Icon shared by both the inline and floating "jump to section" triggers —
// three descending-width lines read as "list of sections" without being
// confused for the account (person) or cart icons already in the header.
function JumpIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="14" y2="17" />
    </svg>
  );
}

// Bottom sheet — every section listed vertically with its item count, so
// jumping to Drinks or Sides doesn't mean swiping through the whole
// horizontal pill bar first. Selecting a section closes the sheet and
// scrolls back to top, since sections swap content in place rather than
// scrolling to an anchor.
function SectionJumpSheet({ sections, activeSection, onSelect, onClose, sectionPhotos }) {
  return (
    <div onClick={e => e.target===e.currentTarget && onClose()} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.65)", zIndex:600, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
      <div style={{ background:"#12100e", borderRadius:"16px 16px 0 0", width:"100%", maxWidth:540, maxHeight:"88vh", display:"flex", flexDirection:"column" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"1.1rem 1.25rem 0.75rem", flexShrink:0 }}>
          <p style={{ fontFamily:"'Fraunces',serif", fontSize:19, fontWeight:500, color:"#FAF6EF" }}>Jump to section</p>
          <button onClick={onClose} aria-label="Close" style={{ width:32, height:32, borderRadius:"50%", background:"rgba(250,246,239,0.08)", border:"none", fontSize:18, color:"#FAF6EF", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>×</button>
        </div>
        {/* 3-column thumbnail grid — sized so all 11 sections land in a
            single screen (no internal scroll on typical phone heights);
            overflowY:auto stays only as a safety net on very short
            viewports rather than something the layout is meant to lean on. */}
        <div style={{ padding:"0.25rem 0.875rem 1.25rem", overflowY:"auto", display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:8 }}>
          {sections.map(s => {
            const count = s.subsections.reduce((a, sub) => a + sub.ids.length, 0);
            const photo = sectionPhotos[s.id];
            const active = s.id === activeSection;
            return (
              <button key={s.id} onClick={() => onSelect(s.id)}
                style={{ position:"relative", aspectRatio:"1/1", borderRadius:12, overflow:"hidden", border: active ? "2px solid #E8A82E" : "0.5px solid rgba(250,246,239,0.1)", padding:0, cursor:"pointer", background:"#1c1814" }}>
                {photo ? (
                  <div style={{ position:"absolute", inset:0, backgroundImage:`url(${photo})`, backgroundSize:"cover", backgroundPosition:"center" }} />
                ) : (
                  <div style={{ position:"absolute", inset:0, background:"repeating-linear-gradient(135deg,rgba(232,168,46,0.08) 0px,rgba(232,168,46,0.08) 1px,transparent 1px,transparent 8px)" }} />
                )}
                <div style={{ position:"absolute", inset:0, background:"linear-gradient(to top, rgba(8,7,6,0.92) 0%, rgba(8,7,6,0.55) 42%, rgba(8,7,6,0.05) 75%)" }} />
                {active && <div style={{ position:"absolute", top:6, right:6, width:8, height:8, borderRadius:"50%", background:"#E8A82E" }} />}
                <div style={{ position:"absolute", left:0, right:0, bottom:0, padding:"6px 8px" }}>
                  <p style={{ fontFamily:"'Fraunces',serif", fontSize:12.5, fontWeight:500, lineHeight:1.2, color: active ? "#E8A82E" : "#FAF6EF" }}>{s.title}</p>
                  <p style={{ fontSize:9.5, color:"#B8A995", marginTop:1 }}>{count} items</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

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
      style={{ background:"#12100e", padding:"16px 12px", display:"flex", gap:6, alignItems:"flex-start", cursor:"pointer", position:"relative", borderBottom:"0.5px solid rgba(250,246,239,0.07)", transition:"background 0.1s" }}>
      {/* Info */}
      <div style={{ flex:1, minWidth:0, order:1 }}>
        <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", gap:8, marginBottom:4 }}>
          <p style={{ fontFamily:"'Fraunces',serif", fontSize:16, fontWeight:500, color:"#FAF6EF", lineHeight:1.3, flex:1, minWidth:0 }}>{item.name}</p>
          <p style={{ fontSize:15, fontWeight:600, color:"#FAF6EF", whiteSpace:"nowrap", flexShrink:0 }}>{fmt(item.price)}</p>
        </div>
        <p style={{ fontFamily:"'Fraunces',serif", fontStyle:"italic", fontSize:15, color:"#B8A995", lineHeight:1.6, marginBottom:item.badge ? 4 : 0, display:"-webkit-box", WebkitLineClamp:3, WebkitBoxOrient:"vertical", overflow:"hidden" }}>{item.desc}</p>
        {item.badge && <Badge type={item.badge} label={item.badge==="bestseller"?"Most Loved":item.badge==="chef"?"Chef's selection":"Spicy"} />}
      </div>
      {/* Photo — the crop box clips overflow for its rounded corners, so the
          qty badge lives in an unclipped wrapper around it, not inside it,
          otherwise its corner overhang gets cut off by that same clip. This
          size (110) is funded by trimming the row's gap (12→6) and its
          *horizontal* padding only (16→12; vertical padding stays 16, so
          row rhythm is untouched) — not by taking width from the text
          column, which keeps every item name's wrap state unchanged. */}
      <div style={{ width:110, height:110, flexShrink:0, order:2, position:"relative" }}>
        <div style={{ width:"100%", height:"100%", borderRadius:10, backgroundColor:"#1c1814", backgroundSize:"cover", backgroundPosition:"center", overflow:"hidden", backgroundImage: imageUrl ? `url(${imageUrl})` : "none" }}>
          {!imageUrl && (
            <div style={{ width:"100%", height:"100%", background:"repeating-linear-gradient(135deg,rgba(232,168,46,0.08) 0px,rgba(232,168,46,0.08) 1px,transparent 1px,transparent 8px)" }} />
          )}
        </div>
        {qty > 0 && (
          <div style={{ position:"absolute", top:-7, right:-7, width:22, height:22, borderRadius:"50%", background:"#E8A82E", color:"#080706", fontSize:11, fontWeight:600, display:"flex", alignItems:"center", justifyContent:"center", zIndex:2, boxShadow:"0 0 0 2px #12100e" }}>{qty}</div>
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
        {/* Photo hero — full-bleed down through the name/desc/price zone.
            Photos are shot on dark backgrounds, so instead of a hard cut or
            overlaying text straight on the image (image fatigue), a bottom
            fade blends the photo into the modal's own solid background —
            by the time the text starts it's sitting on flat #12100e, not
            on the photo itself. */}
        <div style={{ width:"100%", height:340, background: photo?`url(${photo}) center/cover`:"#1c1814", position:"relative", flexShrink:0 }}>
          {!photo && <span style={{ position:"absolute", top:"38%", left:"50%", transform:"translate(-50%,-50%)", fontSize:40, opacity:0.3, color:"#E8A82E" }}>⬡</span>}
          <div style={{ position:"absolute", left:0, right:0, bottom:0, height:230, background:"linear-gradient(to top, #12100e 0%, #12100e 38%, rgba(18,16,14,0) 100%)" }} />
          <button onClick={onClose} style={{ position:"absolute", top:12, right:12, width:32, height:32, borderRadius:"50%", background:"rgba(8,7,6,0.75)", border:"none", fontSize:18, color:"#FAF6EF", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1 }}>×</button>
          <div style={{ position:"absolute", left:"1.25rem", right:"1.25rem", bottom:18 }}>
            <h2 style={{ fontFamily:"'Fraunces',serif", fontSize:26, fontWeight:500, color:"#FAF6EF", marginBottom:6 }}>{item.name}</h2>
            <p style={{ fontFamily:"'Fraunces',serif", fontStyle:"italic", fontSize:15, color:"#B8A995", lineHeight:1.6, marginBottom:12 }}>{item.desc}</p>
            <p style={{ fontSize:17, fontWeight:500, color:"#FAF6EF" }}>{fmt(item.price)}</p>
          </div>
        </div>
        {/* Body */}
        <div style={{ padding:"1.25rem" }}>
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

function CartRow({ entry, onQty, onRemove }) {
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
      <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4, flexShrink:0 }}>
        <span style={{ fontSize:14, fontWeight:500, color:"#FAF6EF", whiteSpace:"nowrap" }}>{fmt(entry.price*entry.qty)}</span>
        <button
          onClick={() => onRemove(entry.baseId)}
          aria-label={`Remove ${entry.name} from cart`}
          style={{ width:24, height:24, background:"transparent", border:"none", color:"#B8A995", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", padding:0 }}
          onMouseEnter={e => e.currentTarget.style.color="#D9482C"}
          onMouseLeave={e => e.currentTarget.style.color="#B8A995"}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 7h16" />
            <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
            <path d="M10 11v6M14 11v6" />
          </svg>
        </button>
      </div>
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

function CompleteMealRail({ cart, onQty, images }) {
  if (cartCount(cart) === 0) return null;
  const items = rankedQuickAdds(cart);

  return (
    <div style={{ borderTop:"0.5px solid rgba(250,246,239,0.07)", padding:"12px 0" }}>
      <p style={{ fontSize:11, fontWeight:500, letterSpacing:"0.15em", textTransform:"uppercase", color:"#E8A82E", marginBottom:10, padding:"0 1.25rem" }}>Complete your meal</p>
      <div style={{ display:"flex", gap:8, overflowX:"auto", padding:"0 1.25rem 4px", scrollbarWidth:"none" }}>
        {items.map(item => {
          const qty = cart[item.id]?.qty ?? 0;
          // Quick-adds share the same photo library as the full menu (see
          // QA_ITEM_ID) rather than needing separate photography.
          const imageUrl = images?.[QA_ITEM_ID[item.id]] ?? null;
          return (
            // Full-bleed photo — the whole card is the image, text sits on
            // a gradient scrim over the bottom of it, so the photo gets the
            // maximum area this fixed-width rail card can offer instead of
            // splitting space between a photo strip and a separate text panel.
            <div key={item.id} style={{ flexShrink:0, width:126, height:150, position:"relative", borderRadius:12, overflow:"hidden", backgroundColor:"#12100e", backgroundSize:"cover", backgroundPosition:"center", backgroundImage: imageUrl ? `url(${imageUrl})` : "none" }}>
              {!imageUrl && (
                <div style={{ position:"absolute", inset:0, background:"repeating-linear-gradient(135deg,rgba(232,168,46,0.08) 0px,rgba(232,168,46,0.08) 1px,transparent 1px,transparent 8px)" }} />
              )}
              {item.star && (
                <span style={{ position:"absolute", top:6, left:6, zIndex:2, fontSize:8, fontWeight:600, letterSpacing:"0.05em", color:"#080706", background:"#E8A82E", padding:"2px 6px", borderRadius:10 }}>MOST LOVED</span>
              )}
              <div style={{ position:"absolute", inset:0, background:"linear-gradient(to top, rgba(8,7,6,0.95) 0%, rgba(8,7,6,0.8) 34%, rgba(8,7,6,0.05) 68%, rgba(8,7,6,0) 100%)" }} />
              <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:10 }}>
                <p style={{ fontSize:12.5, fontWeight:500, color:"#FAF6EF", lineHeight:1.3, marginBottom:6 }}>{item.name}</p>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <span style={{ fontSize:12, color:"#FAF6EF" }}>{fmt(item.price)}</span>
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

// Only ever mounted when CLERK_ENABLED (see that constant's comment) — opens
// Clerk's own hosted sign-in modal, which shows whichever methods are
// enabled in the Clerk dashboard (Google + email, currently). Once the
// visitor is signed in, hands the real Clerk user id back up so checkout
// can attribute the order to their account instead of treating it as a guest.
function ClerkSignInButton({ style, disabled, onSignedIn }) {
  const { isSignedIn, user } = useUser();
  const clerk = useClerk();
  const firedRef = useRef(false);

  useEffect(() => {
    if (isSignedIn && user && !firedRef.current) {
      firedRef.current = true;
      onSignedIn(user.id);
    }
  }, [isSignedIn, user]);

  return (
    <button style={style} disabled={disabled} onClick={() => clerk.openSignIn({ fallbackRedirectUrl: window.location.href })}>
      <span style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
        <svg width="14" height="14" viewBox="0 0 384 512" fill="currentColor" aria-hidden="true">
          <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
        </svg>
        <svg width="15" height="15" viewBox="0 0 18 18" aria-hidden="true">
          <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" />
          <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
          <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
          <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
        </svg>
      </span>
      Sign in to save your order history
    </button>
  );
}

// ── Checkout gate (inline — no separate import needed) ───────────
function CheckoutGate({ cart, total, tip, onCancel, onGuestIdentified, onViewAccount }) {
  const [step,       setStep]       = useState("choice");
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
              {CLERK_ENABLED && (
                <>
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
                    <div style={{ flex:1, height:"0.5px", background:"rgba(250,246,239,0.1)" }} />
                    <p style={{ fontSize:11, color:"#B8A995", margin:0, whiteSpace:"nowrap" }}>or sign in to save your order history</p>
                    <div style={{ flex:1, height:"0.5px", background:"rgba(250,246,239,0.1)" }} />
                  </div>
                  {error && <p style={{ fontSize:12, color:"#F0846A", marginBottom:8 }}>{error}</p>}
                  <ClerkSignInButton style={socialBtn} disabled={loading} onSignedIn={clerkUserId => goToStripe({ clerkUserId })} />
                </>
              )}
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
  const [showSectionSheet, setShowSectionSheet] = useState(false);

  // One random photo per section for the jump-to-section sheet, picked once
  // per visit and then frozen — reopening the sheet during the same session
  // must keep showing the same set rather than reshuffling every time,
  // which reads as flickery/inconsistent rather than intentional variety.
  // Locks in on the first render where cloudImages has actually loaded, via
  // a ref rather than state, so freezing doesn't itself trigger a re-render.
  const sectionPhotosRef = useRef(null);
  if (!sectionPhotosRef.current && Object.keys(cloudImages).length > 0) {
    const map = {};
    SECTIONS.forEach(s => {
      const candidates = s.subsections.flatMap(sub => sub.ids).filter(id => cloudImages[id]);
      map[s.id] = candidates.length ? cloudImages[candidates[Math.floor(Math.random() * candidates.length)]] : null;
    });
    sectionPhotosRef.current = map;
  }
  const sectionPhotos = sectionPhotosRef.current ?? {};

  // Floating "jump to section" duplicate — the header row it normally lives
  // in is sticky and never actually scrolls away, but once you're deep in a
  // long section's items, a thumb-reachable floating trigger near the
  // bottom of the screen is friction-free in a way reaching back up to the
  // top isn't. rAF-throttled so this doesn't run a state update per pixel.
  const [showFloatingJump, setShowFloatingJump] = useState(false);
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setShowFloatingJump(window.scrollY > 200);
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const jumpToSection = (id) => {
    setActiveSection(id);
    setShowSectionSheet(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Load images from cloud on mount — falls back to localStorage in dev.
  // Must be state, not a ref: a ref write doesn't trigger a re-render, so
  // images that finish loading after the initial paint would never show up.
  useEffect(() => {
    fetch("/api/images/list")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.images) setCloudImages(data.images); })
      .catch(() => {}); // silent fail — localStorage fallback handles it
  }, []);

  // Cart preload from an external link (e.g. the marketing site's "Order
  // this" buttons): ?add=item-id[,item-id2,...]. Runs once on mount, after
  // the persisted cart has already loaded, so it adds on top rather than
  // replacing anything. Never trusts a price from the URL — always re-derives
  // from MENU_ITEMS/QA, same as every other cart-add path in this file.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const addParam = params.get("add");
    if (!addParam) return;

    const ids = addParam.split(",").map(s => s.trim()).filter(Boolean);
    const addedNames = [];

    setCart(prev => {
      const next = { ...prev };
      ids.forEach(id => {
        const isQA = id.startsWith("qa-");
        const canonical = isQA ? QA[id] : ITEM_MAP[id];
        if (!canonical) return;
        const key = isQA ? id : id + "_1";
        const existing = next[key];
        next[key] = {
          name: canonical.name, price: canonical.price,
          qty: (existing?.qty ?? 0) + 1,
          spice: existing?.spice ?? null, note: existing?.note ?? "",
          baseId: id,
        };
        addedNames.push(canonical.name);
      });
      return next;
    });

    // Deliberately don't open the cart drawer here — a visitor arriving
    // from the marketing site's "Order this" links wants to keep browsing,
    // not have their view blocked by an interruption they didn't ask for.
    // The toast plus the persistent mobile cart bar (itemCount>0, already
    // rendered below) are enough confirmation without breaking that flow.
    if (addedNames.length === 1) {
      showNotice(`${addedNames[0]} added to your cart — ready when you are.`);
    } else if (addedNames.length > 1) {
      showNotice(`${addedNames.length} items added to your cart — ready when you are.`);
    }

    // Drop ?add= from the URL so a refresh or back-navigation can't re-add it
    params.delete("add");
    const rest = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (rest ? `?${rest}` : "") + window.location.hash);
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

  // Single source of truth for cart-key derivation: quick-add items are
  // stored under their bare id ("qa-garlic-naan"), regular menu items under
  // id+"_1". Every qty-changing path (main cart rows, quick-add chips, the
  // "Complete your meal" rail) must agree on this or an id ends up editing
  // a different key than the one actually holding that item's line — which
  // is exactly what happened before this was unified: adjusting a quick-add
  // item's qty from the main cart list silently created a second, broken
  // $0 entry instead of touching the real one.
  const cartKeyFor = (baseId) => (baseId.startsWith("qa-") ? baseId : baseId + "_1");

  const adjustQty = useCallback((baseId, delta) => {
    updateCart(prev => {
      const key = cartKeyFor(baseId);
      if (!prev[key] && delta<0) return prev;
      const isQA = baseId.startsWith("qa-");
      const source = isQA ? QA[baseId] : ITEM_MAP[baseId];
      const entry = prev[key] || { name:source?.name??baseId, price:source?.price??0, qty:0, spice:null, note:"", baseId };
      const qty = Math.max(0, entry.qty+delta);
      if (qty===0) { const n={...prev}; delete n[key]; return n; }
      return { ...prev, [key]:{ ...entry, qty } };
    });
  }, []);

  // One-click full removal, regardless of current quantity — used by the
  // cart drawer's remove button so removing a qty-5 item doesn't take 5 taps.
  const removeItem = useCallback((baseId) => {
    updateCart(prev => {
      const key = cartKeyFor(baseId);
      if (!prev[key]) return prev;
      const n = { ...prev }; delete n[key]; return n;
    });
  }, []);

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
            <h1 style={{ fontFamily:"'Great Vibes',cursive", fontSize:"clamp(22px, 8vw, 34px)", fontWeight:400, color:"#FAF6EF", lineHeight:1, marginBottom:2, whiteSpace:"nowrap" }}>Rani Mahal</h1>
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
        {/* Nav row — jump-to-section trigger first, then the scrolling pills */}
        <div style={{ display:"flex", alignItems:"center", gap:4 }}>
          <button onClick={() => setShowSectionSheet(true)} aria-label="Jump to section"
            style={{ width:36, height:36, marginLeft:10, flexShrink:0, borderRadius:"50%", background:"rgba(232,168,46,0.14)", border:"0.5px solid rgba(232,168,46,0.35)", color:"#E8A82E", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
            <JumpIcon />
          </button>
          <div style={{ flex:1, minWidth:0 }}>
            <SectionNav sections={SECTIONS} activeSection={activeSection} onSelect={setActiveSection} />
          </div>
        </div>
      </header>

      {/* ── Menu (dark) ── */}
      <div style={{ maxWidth:1100, margin:"0 auto", padding:"0 1rem 140px" }}>
        <div style={{ paddingTop:"2rem" }}>
          {/* Section header — Appetizers has no eyebrow shown and no note,
              so this would otherwise be an empty div still claiming its
              full marginBottom for nothing, leaving a large blank gap
              above "Vegetarian". Collapse the margin when there's nothing
              to show. */}
          <div style={{ marginBottom: (section?.id !== "appetizers" || section?.note) ? "1.5rem" : "0.5rem", textAlign:"center" }}>
            {section?.id !== "appetizers" && (
              <p style={{ fontSize:11, fontWeight:500, letterSpacing:"0.25em", textTransform:"uppercase", color:"#E8A82E", marginBottom:4 }}>{section?.eyebrow}</p>
            )}
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
      {modalItem && <ItemModal item={modalItem} cart={cart} onClose={()=>setModalItem(null)} onCommit={commitItem} onUpsellQty={adjustQty} imageUrl={cloudImages[modalItem.id] ?? localStorage.getItem("img_"+modalItem.id) ?? null} />}

      {/* Jump-to-section sheet */}
      {showSectionSheet && (
        <SectionJumpSheet sections={SECTIONS} activeSection={activeSection} onSelect={jumpToSection} onClose={() => setShowSectionSheet(false)} sectionPhotos={sectionPhotos} />
      )}

      {/* Floating jump-to-section trigger — appears once scrolled past the
          header, sits above the mobile cart bar when one is showing so the
          two never overlap. */}
      {showFloatingJump && (
        <button onClick={() => setShowSectionSheet(true)} aria-label="Jump to section"
          style={{ position:"fixed", left:16, bottom: itemCount>0 ? 92 : 20, width:52, height:52, borderRadius:"50%", background:"#12100e", border:"1.5px solid #E8A82E", color:"#E8A82E", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", zIndex:190, boxShadow:"0 6px 20px rgba(0,0,0,0.4)" }}>
          <JumpIcon size={20} />
        </button>
      )}

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
                {entries.map((entry,i)=><CartRow key={i} entry={entry} onQty={adjustQty} onRemove={removeItem} />)}
                <CompleteMealRail cart={cart} onQty={adjustQty} images={cloudImages} />
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
