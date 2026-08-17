// Catering.jsx — public catering page: real packages, real pricing, real
// photography where it exists yet (26 of 120 menu items have real uploaded
// photos as of this writing — see /api/images/list), and real self-serve
// "Add to Cart" buttons wired straight into the same cart/checkout the main
// ordering menu uses.
//
// Catering line items (CATERING_ITEMS in lib/menu.js) are priced per
// person — clicking "Add to Cart" redirects to `/?add=<itemId>:<headcount>`,
// the same item-preload mechanism RaniMahal.jsx already supports for any
// other menu item (see its `?add=` handler), so the headcount becomes the
// cart quantity and the existing Stripe checkout, tax, and (already-free-
// above-$99) delivery logic all apply with zero new payment code. Server-
// side validation (api/create-checkout.js) recognizes these ids and raises
// its normal 25-per-line abuse cap specifically for them, since quantity
// here is a guest count, not a plate count.
//
// The phone/quote path (api/catering-inquiry.js) stays as a secondary
// option below the packages — self-serve covers the fixed-package case,
// but a fully custom menu or a big enough event still benefits from a real
// conversation, and pricing opacity research aside, forcing everyone
// through checkout with no human option would be its own kind of friction.
//
// Same in-app-vs-external-visitor pattern as Rewards.jsx: a same-origin
// referrer gets a real "back" control, an external visitor (social, a
// receipt link, Google Business) gets a clean page with no dead control.
import { useState, useEffect } from "react";
import { CameraGlyph } from "./src/components/MenuItemCard.jsx";
import { CATERING_ITEMS, CATERING_MINIMUMS } from "./lib/menu.js";

const FONT_LINK = "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..600;1,9..144,400..500&family=Great+Vibes&family=Inter:wght@300;400;500;600&display=swap";

const input = {
  width: "100%",
  padding: "13px 14px",
  borderRadius: 10,
  border: "1px solid rgba(250,246,239,0.15)",
  background: "#1c1814",
  color: "#FAF6EF",
  fontSize: 16,
  fontFamily: "'Inter',sans-serif",
  outline: "none",
  boxSizing: "border-box",
};
const label = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "#B8A995",
  marginBottom: 6,
};

const CATERING_BY_ID = Object.fromEntries(CATERING_ITEMS.map((i) => [i.id, i]));
const tier = (itemId, label) => ({ itemId, label, price: CATERING_BY_ID[itemId].price, minimum: CATERING_MINIMUMS[itemId] });

// Real, transparent packages — every local competitor checked (10 nearby
// Indian restaurants) is quote-only with zero published pricing, same as
// this page used to be. Publishing real numbers directly addresses
// "pricing opacity," which research on what actually kills catering deals
// flagged as a top-two reason a lead goes cold before ever calling.
// Protein-tiered pricing on Signature/Rani Feast reflects real cost: on
// our own à la carte menu lamb runs $5-8 above the equivalent chicken dish
// and seafood a few dollars above — averaging that across every guest
// regardless of what's served would either overcharge a poultry/veg event
// or undercharge a lamb-heavy one. Price/minimum for every tier come from
// CATERING_ITEMS/CATERING_MINIMUMS (lib/menu.js) — never hardcoded here,
// so this page can't drift from what checkout actually charges.
const PACKAGES = [
  {
    name: "Essentials",
    blurb: "Office lunches, small team meetings",
    items: ["Samosa or Vegetable Pakora", "Chicken Tikka Masala or Chicken Makhni + Palak Paneer", "Dal Maharani Makhni", "Basmati Rice", "Garlic Naan", "Raita"],
    photoId: "item-ctm",
    tiers: [tier("catering-essentials", null)],
  },
  {
    name: "Signature",
    blurb: "Private parties, milestone celebrations, larger office events",
    items: ["Samosa + Chicken Malai Kabab", "3 mains + Palak Paneer", "Dal Maharani Makhni", "Basmati Rice (or Chicken Biryani, +$2/person)", "Garlic + Onion Naan", "Raita + Mango Chutney"],
    photoId: "item-chicken-malai",
    tiers: [
      tier("catering-signature", "Poultry & Veg"),
      tier("catering-signature-seafood", "With Seafood"),
      tier("catering-signature-lamb", "With Lamb"),
    ],
  },
  {
    name: "Rani Feast",
    blurb: "Weddings, large celebrations, the full tandoor experience",
    items: ["Tandoori Chicken or Chicken Tikka starter", "4 mains including a seafood option", "Chicken or Vegetable Biryani", "Dal Maharani Makhni", "Garlic, Onion + Peshwari Naan", "Raita, Mango Chutney + Chef's Special Salad"],
    photoId: "item-tandoori-chicken",
    tiers: [
      tier("catering-feast", "No Lamb"),
      tier("catering-feast-lamb", "With Lamb"),
    ],
  },
];

// The order minimum isn't an arbitrary round number — it's exactly what
// the cheapest real package at its own minimum guest count costs
// (Essentials, 16 guests: 16 x $19.99). Deriving it live from the same
// data the package cards render means this can never drift out of sync
// with what a customer can actually order, the way a hardcoded "$300"
// eventually would once a price or minimum changes.
const ORDER_MINIMUM = Math.min(...PACKAGES.flatMap((p) => p.tiers.map((t) => t.price * t.minimum)));

// The hero banner up top — real footage (not AI/staged), the exact same
// tandoor-flame clip the homepage hero already uses. Served by the
// marketing app's own static assets (ranimahal-marketing/public/videos/)
// — an absolute URL resolves correctly here even though this page is
// served from the backend app, since /videos/* isn't one of the paths
// next.config.ts proxies to /order.
const HERO_VIDEO_URL = "https://ranimahal.cc/videos/tandoor-oven-burning.mp4";
const HERO_POSTER_URL = "https://ranimahal.cc/videos/tandoor-oven-burning-poster.jpg";

// Full-bleed photo across the top of the card — one large, real dish photo
// per package instead of three cramped thumbnails. Falls back to the same
// placeholder pattern as everywhere else on this page.
function PackagePhoto({ url }) {
  return (
    <div style={{ position: "relative", width: "100%", height: 190, background: "#1c1814" }}>
      {url ? (
        <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      ) : (
        <div style={{ width: "100%", height: "100%", background: "repeating-linear-gradient(135deg,rgba(232,168,46,0.08) 0px,rgba(232,168,46,0.08) 1px,transparent 1px,transparent 10px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5 }}>
          <CameraGlyph size={26} />
          <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", color: "rgba(232,168,46,0.55)" }}>Photo coming soon</span>
        </div>
      )}
    </div>
  );
}

function fmt(n) { return "$" + n.toFixed(2); }

// Small +/- stepper — the old "Number of guests" text box used the same
// full-width style as the name/email inputs below and dwarfed everything
// else on the card. This is sized to what it actually is: a quantity.
function Stepper({ value, onChange, min }) {
  const dec = () => onChange(String(Math.max(min, value - 1)));
  const inc = () => onChange(String(value + 1));
  const stepBtn = { width: 34, height: 34, borderRadius: 8, border: "1px solid rgba(250,246,239,0.15)", background: "#1c1814", color: "#FAF6EF", fontSize: 16, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <button type="button" onClick={dec} style={stepBtn} aria-label="Fewer guests">−</button>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: 52, textAlign: "center", padding: "7px 4px", borderRadius: 8, border: "1px solid rgba(250,246,239,0.15)", background: "#1c1814", color: "#FAF6EF", fontSize: 15, fontWeight: 600, fontFamily: "'Inter',sans-serif", outline: "none", boxSizing: "border-box" }}
      />
      <button type="button" onClick={inc} style={stepBtn} aria-label="More guests">+</button>
    </div>
  );
}

function PackageCard({ pkg, images }) {
  const [tierIdx, setTierIdx] = useState(0);
  const activeTier = pkg.tiers[tierIdx];
  const [headcount, setHeadcount] = useState(String(activeTier.minimum));

  // Switching tiers can raise the effective minimum (e.g. Essentials-style
  // single-tier packages never do this, but nothing stops a future tier
  // set from having different minimums per tier) — bump headcount up to
  // stay valid rather than silently leaving it below the new minimum.
  const selectTier = (idx) => {
    setTierIdx(idx);
    const min = pkg.tiers[idx].minimum;
    if (Number(headcount) < min) setHeadcount(String(min));
  };

  const guests = Math.max(0, parseInt(headcount, 10) || 0);
  const belowMinimum = guests < activeTier.minimum;
  const total = activeTier.price * guests;

  const addToCart = () => {
    if (belowMinimum) return;
    window.location.href = `/?add=${activeTier.itemId}:${guests}`;
  };

  return (
    <div style={{ background: "#161310", border: "0.5px solid rgba(232,168,46,0.2)", borderRadius: 18, overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.25)", display: "flex", flexDirection: "column", height: "100%" }}>
      <PackagePhoto url={images[pkg.photoId]} />

      <div style={{ padding: "18px 20px 20px", display: "flex", flexDirection: "column", flex: 1 }}>
        <p style={{ fontFamily: "'Fraunces',serif", fontSize: 21, fontWeight: 500, color: "#FAF6EF", margin: "0 0 4px" }}>{pkg.name}</p>
        <p style={{ fontSize: 12, color: "#8A7F70", margin: "0 0 12px" }}>{pkg.blurb}</p>

        <ul style={{ margin: "0 0 16px", padding: "0 0 0 18px", fontSize: 13.5, color: "#D9CDBB", lineHeight: 1.75 }}>
          {pkg.items.map((item) => <li key={item}>{item}</li>)}
        </ul>

        {pkg.tiers.length > 1 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
            {pkg.tiers.map((t, idx) => (
              <button
                key={t.itemId}
                type="button"
                onClick={() => selectTier(idx)}
                style={{
                  padding: "7px 12px", borderRadius: 20, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                  border: idx === tierIdx ? "1px solid #E8A82E" : "1px solid rgba(250,246,239,0.15)",
                  background: idx === tierIdx ? "rgba(232,168,46,0.14)" : "transparent",
                  color: idx === tierIdx ? "#E8A82E" : "#B8A995",
                  fontFamily: "'Inter',sans-serif",
                }}
              >
                {t.label} · {fmt(t.price)}
              </button>
            ))}
          </div>
        )}

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
          <div>
            <p style={label}>Guests</p>
            <Stepper value={guests} onChange={setHeadcount} min={activeTier.minimum} />
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 11, color: "#8A7F70", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Total</p>
            <p style={{ fontSize: 20, fontWeight: 700, color: "#E8A82E", margin: 0, whiteSpace: "nowrap" }}>{fmt(total)}</p>
          </div>
        </div>

        {belowMinimum && (
          <p style={{ fontSize: 12, color: "#F0846A", margin: "0 0 10px" }}>
            Minimum {activeTier.minimum} guests for this package.
          </p>
        )}

        <button
          type="button"
          onClick={addToCart}
          disabled={belowMinimum}
          style={{
            width: "100%", padding: "13px", borderRadius: 24, fontSize: 14.5, fontWeight: 700, fontFamily: "'Inter',sans-serif",
            background: belowMinimum ? "rgba(232,168,46,0.25)" : "#E8A82E",
            color: "#080706", border: "none", cursor: belowMinimum ? "default" : "pointer",
          }}
        >
          Add to Order · {fmt(activeTier.price)}/person
        </button>
      </div>
    </div>
  );
}

export default function Catering() {
  const [showBack, setShowBack] = useState(false);
  const [images, setImages] = useState({});
  useEffect(() => {
    try {
      setShowBack(!!document.referrer && new URL(document.referrer).origin === window.location.origin);
    } catch {}
    fetch("/api/images/list")
      .then((r) => r.json())
      .then((data) => setImages(data.images || {}))
      .catch(() => {});
  }, []);

  const [form, setForm] = useState({ name: "", contact: "", eventDate: "", headcount: "", occasion: "", packageInterest: "", notes: "" });
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error
  const [error, setError] = useState(null);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) { setError("Please enter your name."); return; }
    if (!form.contact.trim()) { setError("Please enter an email or phone number so we can reach you."); return; }
    setStatus("sending");
    try {
      const res = await fetch("/api/catering-inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong. Please call us instead.");
      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setError(err.message || "Something went wrong. Please call us instead.");
    }
  };

  return (
    <div style={{ background: "#080706", minHeight: "100vh", fontFamily: "'Inter',sans-serif", color: "#FAF6EF" }}>
      <style>{`
        @import url('${FONT_LINK}');
        html,body{background:#080706 !important;color:#FAF6EF;margin:0;padding:0;min-height:100vh}
        *{box-sizing:border-box}
        /* 3 packages laid out side by side on desktop */
        .catering-grid{display:grid;grid-template-columns:repeat(3, minmax(0,1fr));gap:18px;}
        /* A swipeable horizontal carousel on narrower screens, rather than
           a long vertical stack — each card snaps into place and bleeds
           slightly past the page's own padding, the same "peek at the next
           card" pattern most food-delivery apps use for this exact case. */
        @media (max-width: 860px){
          .catering-grid{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:14px;margin:0 -20px;padding:0 20px 6px;-webkit-overflow-scrolling:touch;}
          .catering-grid > *{flex:0 0 84%;scroll-snap-align:center;}
        }
      `}</style>

      {showBack && (
        <div style={{ position: "absolute", top: 0, left: 0, zIndex: 5, padding: "20px 20px 0" }}>
          <button
            onClick={() => window.history.back()}
            style={{ background: "rgba(8,7,6,0.55)", backdropFilter: "blur(8px)", border: "1px solid rgba(250,246,239,0.15)", borderRadius: 20, color: "#FAF6EF", fontSize: 13, cursor: "pointer", padding: "7px 14px", display: "flex", alignItems: "center", gap: 5, fontFamily: "'Inter',sans-serif" }}
          >
            ← Back
          </button>
        </div>
      )}

      {/* Full-bleed hero — real footage of the clay tandoor, same clip the
          homepage hero uses, not a plain text masthead */}
      <div style={{ position: "relative", height: "44vh", minHeight: 280, maxHeight: 420, overflow: "hidden", background: "#1c1814" }}>
        <video
          autoPlay
          loop
          muted
          playsInline
          poster={HERO_POSTER_URL}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        >
          <source src={HERO_VIDEO_URL} type="video/mp4" />
        </video>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(8,7,6,0.35) 0%, rgba(8,7,6,0.55) 55%, #080706 100%)" }} />
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", padding: "0 20px 26px", textAlign: "center" }}>
          <img
            src="/logo/apsara-logo.png"
            alt="Rani Mahal Logo"
            style={{ width: 52, height: 52, objectFit: "contain", marginBottom: 10, filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.5))" }}
          />
          <h1 style={{ fontFamily: "'Fraunces',serif", fontSize: "clamp(30px, 6vw, 44px)", fontWeight: 500, color: "#FAF6EF", margin: "0 0 8px", lineHeight: 1.1, textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}>
            Catering
          </h1>
          <p style={{ fontSize: 14.5, color: "#EDE3D3", lineHeight: 1.6, margin: 0, maxWidth: 480, textShadow: "0 1px 6px rgba(0,0,0,0.5)" }}>
            Diwali parties, weddings, corporate lunches, graduations — pick a package,
            set your headcount, and check out below. Free delivery included.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "36px 20px 72px" }}>

        {/* Packages — real pricing, real photography, and a real "Add to
            Order" button wired straight into the same cart/checkout the
            main ordering menu uses. Every curry's spice level is
            adjustable per guest at no charge on every tier. 3 columns on
            desktop (.catering-grid), a swipeable carousel on mobile. */}
        <div className="catering-grid" style={{ marginBottom: 24 }}>
          {PACKAGES.map((pkg) => <PackageCard key={pkg.name} pkg={pkg} images={images} />)}
        </div>

      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <p style={{ fontSize: 12, color: "#8A7F70", textAlign: "center", margin: "0 0 34px" }}>
          {fmt(ORDER_MINIMUM)} order minimum · free delivery · lead time 48hrs (5+ days for 40+ guests)
        </p>

        {status === "sent" ? (
          <div style={{ background: "rgba(127,190,107,0.10)", border: "1px solid rgba(127,190,107,0.35)", borderRadius: 16, padding: "26px 22px", textAlign: "center" }}>
            <p style={{ fontSize: 17, fontWeight: 600, color: "#9CD684", margin: "0 0 8px" }}>Got it — thank you!</p>
            <p style={{ fontSize: 14, color: "#D9CDBB", lineHeight: 1.6, margin: 0 }}>
              We'll reach out at the contact you gave us, usually within one business day.
              For anything time-sensitive, call us directly at{" "}
              <a href="tel:9148359066" style={{ color: "#E8A82E", fontWeight: 600 }}>(914) 835-9066</a>.
            </p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 13, color: "#8A7F70", textAlign: "center", margin: "0 0 14px" }}>
              Need something custom, or planning something bigger? Tell us about it instead:
            </p>
            <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14, background: "#161310", border: "0.5px solid rgba(232,168,46,0.2)", borderRadius: 16, padding: "22px 20px" }}>
              <div>
                <label style={label} htmlFor="cat-name">Your name *</label>
                <input id="cat-name" style={input} value={form.name} onChange={set("name")} placeholder="Your name" required />
              </div>
              <div>
                <label style={label} htmlFor="cat-contact">Email or phone *</label>
                <input id="cat-contact" style={input} value={form.contact} onChange={set("contact")} placeholder="you@email.com or (914) 555-0123" required />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={label} htmlFor="cat-date">Event date</label>
                  <input id="cat-date" type="date" style={input} value={form.eventDate} onChange={set("eventDate")} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={label} htmlFor="cat-headcount">Headcount</label>
                  <input id="cat-headcount" style={input} value={form.headcount} onChange={set("headcount")} placeholder="~25" inputMode="numeric" />
                </div>
              </div>
              <div>
                <label style={label} htmlFor="cat-occasion">Occasion</label>
                <input id="cat-occasion" style={input} value={form.occasion} onChange={set("occasion")} placeholder="Diwali party, wedding, office lunch…" />
              </div>
              <div>
                <label style={label} htmlFor="cat-package">Package you're interested in</label>
                <select id="cat-package" style={input} value={form.packageInterest} onChange={set("packageInterest")}>
                  <option value="">Not sure yet — let's talk</option>
                  {PACKAGES.map((pkg) => <option key={pkg.name} value={pkg.name}>{pkg.name}</option>)}
                </select>
              </div>
              <div>
                <label style={label} htmlFor="cat-notes">Anything else we should know</label>
                <textarea id="cat-notes" style={{ ...input, minHeight: 80, resize: "vertical", fontFamily: "'Inter',sans-serif" }} value={form.notes} onChange={set("notes")} placeholder="Dietary needs, budget range, venue…" />
              </div>

              {error && (
                <p style={{ fontSize: 13, color: "#F0846A", background: "rgba(240,132,106,0.1)", border: "0.5px solid rgba(240,132,106,0.3)", borderRadius: 8, padding: "8px 12px", margin: 0 }}>{error}</p>
              )}

              <button
                type="submit"
                disabled={status === "sending"}
                style={{ width: "100%", padding: "14px", background: "#E8A82E", color: "#080706", border: "none", borderRadius: 24, fontSize: 15, fontWeight: 700, cursor: status === "sending" ? "default" : "pointer", opacity: status === "sending" ? 0.7 : 1, fontFamily: "'Inter',sans-serif" }}
              >
                {status === "sending" ? "Sending…" : "Request a Quote →"}
              </button>
            </form>
          </>
        )}

        <p style={{ fontSize: 12.5, color: "#8A7F70", marginTop: 22, lineHeight: 1.6, textAlign: "center" }}>
          Prefer to talk it through? Call{" "}
          <a href="tel:9148359066" style={{ color: "#E8A82E", textDecoration: "none", fontWeight: 600 }}>(914) 835-9066</a>
          <br />327 Mamaroneck Ave, Mamaroneck, NY
        </p>
      </div>

      </div>
    </div>
  );
}
