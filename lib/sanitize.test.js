import { describe, it, expect } from "vitest";
import { sanitizeDeliveryAddress } from "./sanitize.js";

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
