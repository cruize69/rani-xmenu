// FeastCard.jsx — Family Meal / Group Meal hero cards, first section a
// customer sees. Named "Feast*" internally (this file, lib/feasts.js) as
// implementation vocabulary only — the customer-facing names are "Family
// Meal" and "Group Meal", chosen specifically to not collide with the
// catering menu's "Rani Feast" tier in search or in a customer's head. See
// the Family Feasts implementation plan for the full design rationale;
// this file follows its Section 2c spec closely — every choice here
// (single hero image slot instead of per-dish thumbnails, full transparent
// item list instead of a collapsed "see more", 48px CTA, button state
// change after adding, 320px-safe layout) is deliberate, not a default.
// Don't casually change the structure without re-reading that spec first.
import { useState } from "react";
import { CameraGlyph } from "./MenuItemCard.jsx";
import { ITEM_MAP } from "../../lib/menu.js";

const fmt = (n) => "$" + Number(n).toFixed(2);

// Compact receipt-style line — qty + name only, no price, no description.
// Keeps every row on one line at 320px even for the longest real dish
// names in these bundles ("Dal Maharani Makhni", "Tandoori Medley").
function FeastItemRow({ baseId, qty }) {
  const item = ITEM_MAP[baseId];
  if (!item) return null;
  return (
    <li style={{
      display: "flex", alignItems: "baseline", gap: 6, padding: "7px 0",
      borderBottom: "0.5px solid rgba(250,246,239,0.06)", fontFamily: "'Inter',sans-serif", fontSize: 12.5, color: "#B8A995",
    }}>
      <span style={{ color: "#E8A82E", fontWeight: 700, flexShrink: 0 }}>{qty}×</span>
      <span style={{ color: "#FAF6EF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</span>
    </li>
  );
}

export function FeastCard({ feast, onAdd }) {
  const [justAdded, setJustAdded] = useState(false);
  const savings = feast.aLaCarteTotal - feast.price;
  const savingsPct = Math.round((savings / feast.aLaCarteTotal) * 100);

  const handleAdd = () => {
    onAdd(feast);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 2400);
  };

  return (
    <div style={{
      background: "#12100e", border: `1.5px solid ${feast.flagship ? "rgba(232,168,46,0.4)" : "rgba(250,246,239,0.09)"}`,
      borderRadius: 16, overflow: "hidden", position: "relative",
      boxShadow: feast.flagship ? "0 4px 24px rgba(232,168,46,0.08)" : "none",
    }}>
      {feast.flagship && (
        <span style={{
          position: "absolute", top: 14, left: 16, zIndex: 2, background: "#E8A82E", color: "#080706",
          fontFamily: "'Inter',sans-serif", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.06em",
          textTransform: "uppercase", padding: "4px 10px", borderRadius: 20,
        }}>
          Most Popular
        </span>
      )}

      {/* Hero image slot — one per card, not one per dish. Real photography
          for these specific dishes is the single highest-leverage visual
          investment once available (see the plan's Section 2c); until
          then this reuses the app's existing placeholder language so an
          unphotographed card still reads as considered, not broken. */}
      {feast.heroImage ? (
        <img
          src={feast.heroImage}
          alt={feast.name}
          style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" }}
        />
      ) : (
        <div style={{
          width: "100%", aspectRatio: "16/9", background: "repeating-linear-gradient(135deg,rgba(232,168,46,0.07) 0px,rgba(232,168,46,0.07) 1px,transparent 1px,transparent 10px)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
        }}>
          <CameraGlyph size={28} />
          <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 10.5, fontWeight: 600, letterSpacing: "0.03em", color: "rgba(232,168,46,0.6)" }}>
            Photo coming soon
          </span>
        </div>
      )}

      <div style={{ padding: "18px 16px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontFamily: "'Fraunces',serif", fontSize: 19, fontWeight: 500, color: "#FAF6EF", margin: 0 }}>{feast.name}</p>
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, letterSpacing: "0.04em", color: "#8A7560", marginTop: 3 }}>FEEDS {feast.feeds}</p>
          </div>
          {/* Price block grouped as one flex item so it can never wrap away
              from its own strikethrough companion at 320px — if the row
              runs out of width, this whole block drops to its own line
              intact rather than the strikethrough orphaning elsewhere. */}
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontFamily: "'Fraunces',serif", fontSize: 26, fontWeight: 600, color: "#E8A82E", lineHeight: 1 }}>{fmt(feast.price)}</div>
            <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, color: "#6b6152", textDecoration: "line-through", marginTop: 3 }}>{fmt(feast.aLaCarteTotal)}</div>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
          <span style={{
            display: "inline-block", background: "rgba(60,122,78,0.14)", color: "#6FBF87",
            border: "0.5px solid rgba(60,122,78,0.35)", fontFamily: "'Inter',sans-serif", fontSize: 11, fontWeight: 600,
            padding: "4px 10px", borderRadius: 20,
          }}>
            Save {fmt(savings)} ({savingsPct}%)
          </span>
          {/* Feast item rows below don't list rice — entrees come with it
              automatically per lib/menu.js's "All entrees served with
              aromatic basmati rice" — so this is called out here as its
              own highlighted pill instead of buried prose, since a
              customer skimming the item list has no other way to know a
              feast this size doesn't need a separate rice order. */}
          <span style={{
            display: "inline-block", background: "rgba(232,168,46,0.18)", color: "#E8A82E",
            border: "0.5px solid rgba(232,168,46,0.5)", fontFamily: "'Inter',sans-serif", fontSize: 11, fontWeight: 700,
            padding: "4px 10px", borderRadius: 20,
          }}>
            🍚 Rice Included
          </span>
        </div>

        <ul style={{ listStyle: "none", margin: "14px 0 0", padding: 0, borderTop: "0.5px solid rgba(250,246,239,0.08)" }}>
          {feast.items.map((it) => <FeastItemRow key={it.baseId} baseId={it.baseId} qty={it.qty} />)}
        </ul>

        <button
          onClick={handleAdd}
          style={{
            width: "100%", marginTop: 16, minHeight: 48, background: justAdded ? "#3C7A4E" : "#E8A82E",
            color: justAdded ? "#FAF6EF" : "#080706", border: "none", borderRadius: 24, fontFamily: "'Inter',sans-serif",
            fontSize: 14, fontWeight: 700, letterSpacing: "0.01em", cursor: "pointer", transition: "background 0.2s",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          {justAdded ? "✓ Added — Add Another" : "➕ Add to Cart"}
        </button>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 10, fontFamily: "'Inter',sans-serif", fontSize: 11, color: "#6FBF87" }}>
          🚚 Free delivery on this meal, always
        </div>
        <p style={{ textAlign: "center", fontFamily: "'Fraunces',serif", fontStyle: "italic", fontSize: 12, color: "#8A7560", marginTop: 8, lineHeight: 1.5 }}>
          Real menu items, real prices — this is what {fmt(feast.price)} actually gets you.
        </p>
      </div>
    </div>
  );
}

export function FeastSection({ feasts, onAdd }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {feasts.map((feast) => <FeastCard key={feast.id} feast={feast} onAdd={onAdd} />)}
    </div>
  );
}
