import crypto from "crypto";

// Constant-time secret comparison — a plain !== leaks timing information
// proportional to how many leading characters match, which a network
// attacker can exploit to brute-force MANAGER_SECRET character-by-character.
export function isManagerSecretValid(provided) {
  const expected = process.env.MANAGER_SECRET ?? "";
  if (!provided || typeof provided !== "string") return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
