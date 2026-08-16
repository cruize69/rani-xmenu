// ── Shared input sanitizers ──────────────────────────────────────────
// Extracted from create-checkout.js so every code path that persists a
// customer-supplied delivery address (checkout, abandoned-cart capture via
// api/cart/save-draft.js and api/cart/send-cart-link.js) applies the same
// field caps — previously only checkout did, so the abandoned-cart lead
// path stored this object completely unbounded/unvalidated.

// An unbounded delivery address (or one with extra fields) can grow past
// what downstream storage/encoding expects — cap each field and always
// return a plain, fixed-shape object rather than passing the input through.
export function sanitizeDeliveryAddress(a) {
  if (!a || typeof a !== "object") return null;
  const s = (v, n) => (typeof v === "string" ? v.slice(0, n).trim() : "");
  const addr = {
    street: s(a.street, 100),
    apt:    s(a.apt, 30),
    city:   s(a.city, 50),
    zip:    s(a.zip, 10),
    notes:  s(a.notes, 150),
  };
  // Belt-and-braces: if anything above still pushes the JSON over a
  // downstream limit (Stripe metadata, KV value size), shed the note
  // (recoverable) instead of the address (not).
  if (JSON.stringify(addr).length > 480) addr.notes = "";
  return addr;
}
