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
  // downstream limit (Stripe metadata 500-byte limit, KV value size), shed the note
  // (recoverable) instead of the address (not).
  // Measure raw UTF-8 byte length rather than JS UTF-16 code units (.length)
  // to guarantee safety with multi-byte unicode / emoji characters.
  if (Buffer.byteLength(JSON.stringify(addr), "utf8") > 480) {
    addr.notes = "";
  }
  while (Buffer.byteLength(JSON.stringify(addr), "utf8") > 480 && addr.street.length > 0) {
    addr.street = addr.street.slice(0, -1).trim();
  }
  return addr;
}
