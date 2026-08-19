import { describe, it, expect, beforeAll } from "vitest";
import { encryptJSON, decryptJSON } from "./backupCrypto.js";

describe("backupCrypto", () => {
  beforeAll(() => {
    process.env.BACKUP_ENCRYPTION_KEY = "test-key-for-vitest-only";
  });

  it("round-trips a payload unchanged", () => {
    const payload = { kind: "full", orderCount: 2, orders: [{ id: "a" }, { id: "b" }] };
    const encrypted = encryptJSON(payload);
    expect(typeof encrypted).toBe("string");
    expect(decryptJSON(encrypted)).toEqual(payload);
  });

  it("returns null when BACKUP_ENCRYPTION_KEY is unset", () => {
    const saved = process.env.BACKUP_ENCRYPTION_KEY;
    delete process.env.BACKUP_ENCRYPTION_KEY;
    expect(encryptJSON({ a: 1 })).toBeNull();
    process.env.BACKUP_ENCRYPTION_KEY = saved;
  });

  it("throws on decrypt if the key is unset", () => {
    const encrypted = encryptJSON({ a: 1 });
    const saved = process.env.BACKUP_ENCRYPTION_KEY;
    delete process.env.BACKUP_ENCRYPTION_KEY;
    expect(() => decryptJSON(encrypted)).toThrow();
    process.env.BACKUP_ENCRYPTION_KEY = saved;
  });

  it("rejects a tampered ciphertext (auth tag mismatch)", () => {
    const encrypted = encryptJSON({ secret: "customer data" });
    const raw = Buffer.from(encrypted, "base64");
    raw[raw.length - 1] ^= 0xff; // flip last byte of ciphertext
    const tampered = raw.toString("base64");
    expect(() => decryptJSON(tampered)).toThrow();
  });
});
