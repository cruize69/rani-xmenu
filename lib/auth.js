import crypto from "crypto";
import { overLimit, clientIp } from "./rateLimit.js";

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

// Every manager-gated endpoint must call this instead of
// isManagerSecretValid() directly. A correct secret always succeeds
// immediately (no throttling of legitimate staff use); only WRONG guesses
// count against the per-IP limit, so this converts "unlimited-rate offline
// brute force against a shared static password" into "at most 10 guesses/hr
// per IP" without adding any friction for staff who already know it.
export async function checkManagerAuth(req) {
  if (isManagerSecretValid(req.headers["x-manager-secret"])) return { ok: true };
  const locked = await overLimit(`mgr-auth-fail:${clientIp(req)}`, 10, 3600);
  return { ok: false, status: locked ? 429 : 401, error: locked ? "Too many attempts — try again later." : "Unauthorized" };
}

// Every api/cron/*.js target must call this. Previously the check was
// `if (process.env.CRON_SECRET) { ...verify... }` — skipped entirely
// (fail OPEN) whenever the env var was unset, which it was in production:
// anyone could curl these URLs directly and trigger real SMS/email sends,
// voucher minting, and order-queue changes. This fails CLOSED instead —
// a missing CRON_SECRET now blocks every request rather than none.
export function isCronSecretValid(req) {
  const expected = process.env.CRON_SECRET ?? "";
  const provided = (req.headers["authorization"] ?? "").replace(/^Bearer /, "");
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
