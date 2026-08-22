import { describe, it, expect } from "vitest";
import { sanitizeDeliveryAddress, chunkStringByBytes, MAX_CART_METADATA_CHUNKS } from "./sanitize.js";

describe("sanitizeDeliveryAddress", () => {
  it("returns null for non-object inputs", () => {
    expect(sanitizeDeliveryAddress(null)).toBeNull();
    expect(sanitizeDeliveryAddress(undefined)).toBeNull();
    expect(sanitizeDeliveryAddress("123 Main St")).toBeNull();
  });

  it("sanitizes and trims normal address fields", () => {
    const raw = {
      street: "  123 Main St  ",
      apt: " 4B ",
      city: " Mamaroneck ",
      zip: " 10543 ",
      notes: " Ring bell twice ",
    };
    const res = sanitizeDeliveryAddress(raw);
    expect(res).toEqual({
      street: "123 Main St",
      apt: "4B",
      city: "Mamaroneck",
      zip: "10543",
      notes: "Ring bell twice",
    });
  });

  it("sheds notes when UTF-8 byte length exceeds 480 bytes (e.g. multi-byte emojis)", () => {
    // 75 emojis = 300 UTF-8 bytes in notes + 90 bytes street + JSON keys = ~490 bytes.
    const raw = {
      street: "123 Main St ".padEnd(95, "A"),
      apt: "4B",
      city: "Mamaroneck".padEnd(45, "B"),
      zip: "10543",
      notes: "🍕".repeat(80),
    };
    const res = sanitizeDeliveryAddress(raw);
    expect(res.notes).toBe("");
    expect(Buffer.byteLength(JSON.stringify(res), "utf8")).toBeLessThanOrEqual(480);
  });

  it("safely truncates street if multi-byte characters in street/city exceed 480 bytes", () => {
    const raw = {
      street: "🍕".repeat(100), // 400 bytes
      apt: "4B",
      city: "✨".repeat(40), // 120 bytes
      zip: "10543",
      notes: "some note",
    };
    const res = sanitizeDeliveryAddress(raw);
    expect(Buffer.byteLength(JSON.stringify(res), "utf8")).toBeLessThanOrEqual(480);
  });
});

describe("chunkStringByBytes / cart metadata chunking", () => {
  it("keeps every chunk within Stripe's 500-char-per-value limit", () => {
    // Simulate a cart with several stacked Family/Grand Feasts plus extras —
    // the scenario that produced the original "594 characters" Stripe error.
    const bigCart = JSON.stringify(
      Array.from({ length: 60 }, (_, i) => ({
        baseId: `item-example-${i}`,
        name: `Example Item Number ${i}`,
        price: 11.95,
        qty: 2,
        spice: "Mild",
        note: "",
      }))
    );
    const chunks = chunkStringByBytes(bigCart, 450);
    for (const chunk of chunks) {
      expect(Buffer.byteLength(chunk, "utf8")).toBeLessThanOrEqual(500);
    }
    // Rejoining every chunk must losslessly reconstruct the original JSON —
    // this is the exact property that broke when the writer's chunk count
    // could exceed the reader's hardcoded read loop.
    expect(chunks.join("")).toBe(bigCart);
  });

  it("writer's chunk cap and reader's read loop must agree (MAX_CART_METADATA_CHUNKS)", () => {
    // A cart that produces exactly the max allowed chunks must round-trip.
    const chunks = Array.from({ length: MAX_CART_METADATA_CHUNKS }, (_, i) => `chunk${i}-`);
    const cartJson = chunks.join("");
    const rechunked = chunkStringByBytes(cartJson, Math.ceil(cartJson.length / MAX_CART_METADATA_CHUNKS));
    expect(rechunked.length).toBeLessThanOrEqual(MAX_CART_METADATA_CHUNKS);

    // Guards the Stripe 50-metadata-key ceiling: create-checkout.js writes
    // ~20 fixed non-cart keys, so cart chunks must leave headroom under 50.
    expect(MAX_CART_METADATA_CHUNKS).toBeLessThanOrEqual(30);
  });
});
