// api/cron/backup-orders.js
// Vercel Cron target — runs weekly. Vercel KV (Upstash Redis) is the ONLY
// datastore for every order this restaurant has ever taken — there is no
// relational database, no export, no secondary write path anywhere else
// in this codebase. If that one Redis instance were ever lost or the
// account suspended, every order record would be gone permanently; Stripe
// would still have the payment records, but the restaurant's own
// operational history would not exist anywhere. This closes that gap.
//
// Backs up the last 8 days of orders (one day of overlap past the 7-day
// cadence, so a single missed/failed run can't leave a silent gap between
// backups) as one encrypted JSON blob per run. Encrypted before upload —
// see lib/backupCrypto.js for why: Vercel Blob has no private-access tier,
// so an unencrypted dump of customer names/phones/emails/addresses would
// be reachable by anyone who ever obtained or guessed the URL.

import { put } from "@vercel/blob";
import { getOrdersByDate, getNYDateString } from "../../lib/orders.js";
import { encryptJSON } from "../../lib/backupCrypto.js";
import { isCronSecretValid } from "../../lib/auth.js";
import { recordCronRun } from "../../lib/cronStatus.js";
import { captureServerError } from "../../lib/sentry.js";
import { sendEmail, sendStaffSMS } from "../../lib/notifications.js";

const STAFF_EMAILS = ["ranimahal327@gmail.com", "riyadhjuwel@gmail.com", "ajalil001@gmail.com"];

// reportCheckoutError (lib/errorAlerts.js) only fires when there's an
// identifiable CUSTOMER lead on file — silently no-ops otherwise, which is
// exactly wrong here: this is an operational failure with no customer
// involved at all. Alert staff directly instead, unconditionally.
async function alertStaffBackupFailed(message) {
  await Promise.allSettled([
    sendEmail({
      to: STAFF_EMAILS,
      subject: "⚠️ Weekly order backup failed",
      html: `<p>The weekly encrypted order-data backup (api/cron/backup-orders.js) failed to run.</p><p><strong>Error:</strong> ${message}</p><p>This does not affect live ordering — it only means this week's backup snapshot wasn't taken. Worth a look if it happens more than once in a row.</p>`,
    }),
    sendStaffSMS(`Rani Mahal: Weekly order backup failed — ${message.slice(0, 100)}. Live ordering is unaffected.`),
  ]);
}

const BACKUP_WINDOW_DAYS = 8;

function addDaysToDateStr(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  if (!isCronSecretValid(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    if (!process.env.BACKUP_ENCRYPTION_KEY) {
      // Fail loud, not silent-and-skip — an unnoticed missing key means
      // every "successful" run since would have quietly backed up nothing.
      const msg = "backup-orders: BACKUP_ENCRYPTION_KEY is not set — refusing to upload an unencrypted PII dump.";
      console.error(msg);
      captureServerError(new Error(msg));
      await alertStaffBackupFailed("BACKUP_ENCRYPTION_KEY is not set in production.").catch(() => {});
      await recordCronRun("backup-orders", { ok: false, error: "missing_encryption_key" });
      return res.status(500).json({ error: msg });
    }

    const today = getNYDateString();
    const dateStrs = Array.from({ length: BACKUP_WINDOW_DAYS }, (_, i) => addDaysToDateStr(today, -i));

    const dayResults = await Promise.all(dateStrs.map((d) => getOrdersByDate(d)));
    const orders = dayResults.flat();

    const payload = {
      backedUpAt: new Date().toISOString(),
      dateRange: { from: dateStrs[dateStrs.length - 1], to: dateStrs[0] },
      orderCount: orders.length,
      orders,
    };

    const encrypted = encryptJSON(payload);
    const pathname = `backups/orders/${today}_${orders.length}orders.json.enc`;
    const blob = await put(pathname, encrypted, {
      access: "public", // Vercel Blob has no other tier — content is encrypted, see header comment
      contentType: "text/plain",
    });

    const result = { ok: true, orderCount: orders.length, dateRange: payload.dateRange, blobUrl: blob.url };
    await recordCronRun("backup-orders", result);
    return res.status(200).json(result);
  } catch (err) {
    console.error("backup-orders cron failed:", err);
    captureServerError(err);
    // A silently-failing backup is worse than no backup at all — nobody
    // would notice the safety net was gone until they actually needed it.
    await alertStaffBackupFailed(err.message || String(err)).catch(() => {});
    await recordCronRun("backup-orders", { ok: false, error: err.message || String(err) });
    return res.status(500).json({ error: "Backup failed" });
  }
}
