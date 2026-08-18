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

// Session tokens replace the raw MANAGER_SECRET as the value browser tabs
// carry around. Format: "<expiryMs>.<hexHmac>" where hmac = HMAC-SHA256(
// MANAGER_SECRET, expiryMs) — signed with the same shared secret so no new
// env var is needed, but the *value staff browsers hold* is no longer the
// password itself: it expires (12h), can't be replayed past that, and
// leaking one (XSS, shoulder-surf of devtools, a stray log line) doesn't
// hand over the master credential the way the raw secret used to.
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

function signExpiry(expiryMs) {
  return crypto.createHmac("sha256", process.env.MANAGER_SECRET ?? "").update(String(expiryMs)).digest("hex");
}

export function mintManagerToken() {
  const expiryMs = Date.now() + TOKEN_TTL_MS;
  return `${expiryMs}.${signExpiry(expiryMs)}`;
}

function isManagerTokenValid(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return false;
  const [expiryStr, sig] = token.split(".");
  const expiryMs = Number(expiryStr);
  if (!Number.isFinite(expiryMs) || Date.now() > expiryMs) return false;
  const expected = signExpiry(expiryMs);
  const a = Buffer.from(sig);
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
//
// Accepts either a session token (what browser staff tools now send on
// every request after logging in via /api/manager-login) or the raw secret
// directly (kept for the standalone print-bridge tool, which isn't a
// browser context and isn't exposed to XSS/devtools-leak risk the same
// way a persistent staff-facing tab is).
export async function checkManagerAuth(req) {
  const provided = req.headers["x-manager-secret"];
  if (isManagerTokenValid(provided) || isManagerSecretValid(provided)) return { ok: true };
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
