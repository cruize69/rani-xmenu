// lib/backupCrypto.js
// AES-256-GCM encrypt/decrypt for the weekly order-data backup
// (api/cron/backup-orders.js). Vercel Blob's public API has no private/
// access-controlled tier — every blob URL is technically public, just
// unguessable (long random suffix). That's an acceptable tradeoff for a
// product photo; it is NOT acceptable for a JSON dump of customer names,
// phones, emails, and delivery addresses. Encrypting the payload before
// upload means a leaked/guessed URL exposes ciphertext, not PII.
//
// Key comes from BACKUP_ENCRYPTION_KEY (any string — hashed via SHA-256
// into a valid 256-bit key, so it doesn't need to be a precisely-formatted
// hex/base64 value someone has to generate correctly by hand).

import crypto from "crypto";

function deriveKey() {
  const secret = process.env.BACKUP_ENCRYPTION_KEY;
  if (!secret) return null;
  return crypto.createHash("sha256").update(secret).digest();
}

/** Returns null (caller should skip/alert) if BACKUP_ENCRYPTION_KEY isn't set. */
export function encryptJSON(obj) {
  const key = deriveKey();
  if (!key) return null;
  const iv = crypto.randomBytes(12); // GCM standard 96-bit IV
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(obj), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // iv (12 bytes) + authTag (16 bytes) + ciphertext, all base64 — self-
  // contained, no separate metadata file needed to restore.
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

/**
 * Restore utility — not called anywhere in the app today (a restore is a
 * rare, manual, human-triggered operation), but exported so a future
 * one-off script can decrypt a downloaded backup file without having to
 * re-derive this format from scratch:
 *
 *   node -e "import('./lib/backupCrypto.js').then(m => {
 *     const fs = require('fs');
 *     const b64 = fs.readFileSync('backup.txt', 'utf8').trim();
 *     console.log(JSON.stringify(m.decryptJSON(b64), null, 2));
 *   })"
 *
 * (with BACKUP_ENCRYPTION_KEY set in the environment running that script).
 */
export function decryptJSON(base64Payload) {
  const key = deriveKey();
  if (!key) throw new Error("BACKUP_ENCRYPTION_KEY not set — cannot decrypt.");
  const raw = Buffer.from(base64Payload, "base64");
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8"));
}
