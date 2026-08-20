// lib/backupRestore.js
// Shared logic behind the Sales Dashboard's Backup & Restore tab, plus the
// weekly api/cron/backup-orders.js. Two distinct operations:
//
//   Backup  — read-only, safe to run anytime, as often as you like.
//   Restore — a MERGE, never a replace. For every order in the backup
//             file: if it's missing live, add it; if it exists live but
//             the backup's copy is newer (by the order's own createdAt),
//             overwrite; otherwise leave the live copy alone. Nothing
//             live that's absent from the backup is ever touched or
//             deleted. This is deliberate — see the Sales Dashboard UI
//             copy and the design conversation this came out of: a true
//             "wipe and replace" restore is one fat-fingered tap away
//             from being worse than the disaster it exists to prevent.
//
// Every derived index (orders:date:*, account-orders:*, customers:last-
// order, account-order-count:*) is rebuilt per-order using idempotent-safe
// operations (zadd, lrem+lpush+ltrim, conditional incr) rather than backed
// up separately — so a restored order is exactly as discoverable
// (account history, daily queue, loyalty count) as one that arrived
// normally through checkout, and there's no separate "index" backup that
// could go stale relative to the orders it's supposed to describe.

import { kv } from "./kv.js";
import { put, list } from "@vercel/blob";
import { getOrder, customerKeyForOrder } from "./orders.js";
import { encryptJSON, decryptJSON } from "./backupCrypto.js";

const BLOB_PREFIX = "backups/orders/";
const RESTORE_BATCH_SIZE = 150;

// ── Backup ────────────────────────────────────────────────────────

/** Every order ever placed, encrypted, uploaded as one file. */
export async function runFullOrderBackup() {
  if (!process.env.BACKUP_ENCRYPTION_KEY) {
    throw new Error("BACKUP_ENCRYPTION_KEY is not set — refusing to upload an unencrypted PII dump.");
  }

  const dateKeys = [];
  let cursor = "0";
  do {
    const [next, batch] = await kv.scan(cursor, { match: "orders:date:*", count: 200 });
    cursor = next;
    dateKeys.push(...batch);
  } while (String(cursor) !== "0");

  const dates = dateKeys.map((k) => k.slice("orders:date:".length)).sort();

  const orderIdBatches = await Promise.all(
    dates.map((d) => kv.zrange(`orders:date:${d}`, 0, -1))
  );
  const allIds = orderIdBatches.flat();

  // Fetch in chunks rather than one giant Promise.all — a year of orders
  // is tens of thousands of ids, and firing that many concurrent KV reads
  // in one batch risks hitting Upstash's per-second request ceiling.
  const orders = [];
  const FETCH_CHUNK = 300;
  for (let i = 0; i < allIds.length; i += FETCH_CHUNK) {
    const chunk = allIds.slice(i, i + FETCH_CHUNK);
    const fetched = await Promise.all(chunk.map(getOrder));
    orders.push(...fetched.filter(Boolean));
  }

  const payload = {
    kind: "full",
    backedUpAt: new Date().toISOString(),
    orderCount: orders.length,
    dateRange: dates.length ? { from: dates[0], to: dates[dates.length - 1] } : null,
    orders,
  };

  const encrypted = encryptJSON(payload);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const pathname = `${BLOB_PREFIX}full_${stamp}_${orders.length}orders.json.enc`;
  const blob = await put(pathname, encrypted, { access: "public", contentType: "text/plain" });

  return { pathname: blob.pathname, url: blob.url, orderCount: orders.length, dateRange: payload.dateRange };
}

/** Just the last N days — what the weekly cron calls; kept separate from
 * the full manual backup so the two can't accidentally be confused. */
export async function runIncrementalOrderBackup(orders, dateRange) {
  const payload = { kind: "incremental", backedUpAt: new Date().toISOString(), orderCount: orders.length, dateRange, orders };
  const encrypted = encryptJSON(payload);
  const today = payload.backedUpAt.slice(0, 10);
  const pathname = `${BLOB_PREFIX}${today}_${orders.length}orders.json.enc`;
  return put(pathname, encrypted, { access: "public", contentType: "text/plain" });
}

/** Every backup blob, newest first. */
export async function listOrderBackups() {
  const { blobs } = await list({ prefix: BLOB_PREFIX });
  return blobs
    .map((b) => ({ pathname: b.pathname, url: b.url, size: b.size, uploadedAt: b.uploadedAt }))
    .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
}

async function fetchAndDecryptBackup(pathname) {
  const { blobs } = await list({ prefix: pathname });
  const match = blobs.find((b) => b.pathname === pathname);
  if (!match) throw new Error("Backup file not found.");
  const res = await fetch(match.url);
  if (!res.ok) throw new Error(`Failed to fetch backup file (HTTP ${res.status}).`);
  const encrypted = await res.text();
  return decryptJSON(encrypted);
}

// ── Restore ───────────────────────────────────────────────────────

/** Live stats for the "here's what you have vs. what's in this file"
 * comparison — cheap: reads zset cardinalities, never fetches full orders. */
export async function getLiveOrderStats() {
  let cursor = "0";
  let dateKeys = [];
  do {
    const [next, batch] = await kv.scan(cursor, { match: "orders:date:*", count: 200 });
    cursor = next;
    dateKeys.push(...batch);
  } while (String(cursor) !== "0");

  const dates = dateKeys.map((k) => k.slice("orders:date:".length)).sort();
  const counts = await Promise.all(dateKeys.map((k) => kv.zcard(k)));
  const orderCount = counts.reduce((s, c) => s + c, 0);

  return {
    orderCount,
    dateRange: dates.length ? { from: dates[0], to: dates[dates.length - 1] } : null,
  };
}

/** Decrypts the file and returns its stats + the live comparison, without
 * writing anything. What the dashboard shows before the confirm step. */
export async function previewRestore(pathname) {
  const backup = await fetchAndDecryptBackup(pathname);
  const live = await getLiveOrderStats();
  return {
    backup: { orderCount: backup.orderCount, dateRange: backup.dateRange, backedUpAt: backup.backedUpAt, kind: backup.kind },
    live,
  };
}

/**
 * Processes one batch starting at `cursor` (an index into the backup's
 * orders array). Returns the next cursor (null when done) and running
 * counts. Stateless between calls by design — re-fetches and re-decrypts
 * the backup file every call rather than caching a parsed copy in KV.
 * Slightly wasteful (a few ms of AES decrypt per batch) but means a
 * restore can be safely resumed/retried from any point with zero session
 * state to go stale or leak.
 */
export async function restoreBatch(pathname, cursor = 0) {
  const backup = await fetchAndDecryptBackup(pathname);
  const orders = backup.orders || [];
  const slice = orders.slice(cursor, cursor + RESTORE_BATCH_SIZE);

  let added = 0, updated = 0, skipped = 0;

  for (const order of slice) {
    if (!order?.id) { skipped++; continue; }

    const existing = await getOrder(order.id);
    const isNew = !existing;
    const backupNewer = existing && new Date(order.updatedAt || order.createdAt) > new Date(existing.updatedAt || existing.createdAt);

    if (!isNew && !backupNewer) { skipped++; continue; }

    await kv.set(`order:${order.id}`, JSON.stringify(order));

    const createdMs = new Date(order.createdAt || Date.now()).getTime();
    if (order.date) {
      await kv.zadd(`orders:date:${order.date}`, { score: createdMs, member: order.id });
    }

    // Move-to-front-and-dedupe: safe to run per-order regardless of what
    // order the backup's records happen to be processed in — a real order
    // arriving normally later will naturally re-sort ahead of anything
    // restored, same as it always has.
    if (order.clerkUserId) {
      const key = `account-orders:${order.clerkUserId}`;
      await kv.lrem(key, 0, order.id);
      await kv.lpush(key, order.id);
      await kv.ltrim(key, 0, 199);
      if (isNew) await kv.incr(`account-order-count:${order.clerkUserId}`).catch(() => {});
    }
    if (order.customerEmail) {
      const key = `account-orders:guest:${order.customerEmail.toLowerCase().trim()}`;
      await kv.lrem(key, 0, order.id);
      await kv.lpush(key, order.id);
      await kv.ltrim(key, 0, 199);
    }
    const custKey = customerKeyForOrder(order);
    if (custKey) {
      await kv.zadd("customers:last-order", { score: createdMs, member: custKey });
    }

    if (isNew) added++; else updated++;
  }

  const nextCursor = cursor + RESTORE_BATCH_SIZE;
  const done = nextCursor >= orders.length;

  return {
    added, updated, skipped,
    processed: slice.length,
    total: orders.length,
    nextCursor: done ? null : nextCursor,
    done,
  };
}
