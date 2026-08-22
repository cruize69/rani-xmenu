// ── Shared input sanitizers ──────────────────────────────────────────
// Extracted from create-checkout.js so every code path that persists a
// customer-supplied delivery address (checkout, abandoned-cart capture via
// api/cart/save-draft.js and api/cart/send-cart-link.js) applies the same
// field caps — previously only checkout did, so the abandoned-cart lead
// path stored this object completely unbounded/unvalidated.

// Stripe caps session metadata at 50 keys total. create-checkout.js uses a
// fixed set of ~20 non-cart keys, so this is the max number of cart_N chunks
// the writer may ever produce — and the max syncStripe.js may ever read back.
// Keeping this in one place is load-bearing: if the writer and reader ever
// disagree on this number, a large-enough cart (e.g. several stacked Family/
// Grand Feasts) silently loses its trailing items on the read side instead
// of erroring, because JSON.parse on a truncated-but-still-comma-joined
// string either throws (caught -> empty cart) or, worse, can still parse if
// the cut happened to land after a complete array element.
export const MAX_CART_METADATA_CHUNKS = 25;

// Truncates a string to a maximum number of UTF-8 bytes without splitting unicode surrogate pairs
export function truncateToUtf8Bytes(str, maxBytes) {
  if (!str) return "";
  let currentBytes = 0;
  let result = "";
  for (const char of str) {
    const charBytes = Buffer.byteLength(char, "utf8");
    if (currentBytes + charBytes > maxBytes) break;
    result += char;
    currentBytes += charBytes;
  }
  return result;
}

// Chunks a string into an array of strings, where each chunk is at most maxBytes long,
// without splitting unicode characters (code points). This prevents invalid UTF-8 errors in downstream systems.
export function chunkStringByBytes(str, maxBytes) {
  if (!str) return [];
  const chunks = [];
  let currentChunk = "";
  let currentBytes = 0;
  
  for (const char of str) {
    const charBytes = Buffer.byteLength(char, "utf8");
    if (currentBytes + charBytes > maxBytes) {
      if (currentChunk.length > 0) chunks.push(currentChunk);
      currentChunk = char;
      currentBytes = charBytes;
    } else {
      currentChunk += char;
      currentBytes += charBytes;
    }
  }
  if (currentChunk.length > 0) chunks.push(currentChunk);
  return chunks;
}

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
