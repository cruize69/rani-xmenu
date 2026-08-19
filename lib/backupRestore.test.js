import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

// Exercises restoreBatch's merge decision — the core safety property of the
// whole Backup & Restore feature: add if missing, update only if the
// backup's copy is strictly newer, otherwise leave the live record alone.
// Live Redis/Blob are mocked so this runs the real decision logic against
// controlled fixtures instead of depending on production data state.

const kvStore = new Map();

// Mirrors real @vercel/kv's behavior: values round-trip through JSON
// automatically, so callers get back an object regardless of whether they
// passed set() a plain object or an already-JSON.stringify'd string — this
// matters here because restoreBatch/getOrder rely on that round-trip.
vi.mock("@vercel/kv", () => ({
  kv: {
    set: vi.fn(async (key, val) => {
      kvStore.set(key, typeof val === "string" ? JSON.parse(val) : val);
    }),
    get: vi.fn(async (key) => kvStore.get(key) ?? null),
    zadd: vi.fn(async () => {}),
    lrem: vi.fn(async () => {}),
    lpush: vi.fn(async () => {}),
    ltrim: vi.fn(async () => {}),
    incr: vi.fn(async () => 1),
  },
}));

vi.mock("@vercel/blob", () => ({
  list: vi.fn(async ({ prefix }) => ({
    blobs: [{ pathname: prefix, url: "https://example.test/backup.enc" }],
  })),
  put: vi.fn(async (pathname, _body) => ({ pathname, url: "https://example.test/" + pathname })),
}));

import { encryptJSON } from "./backupCrypto.js";
import { restoreBatch } from "./backupRestore.js";

const liveOrders = {
  "order-untouched": { id: "order-untouched", createdAt: "2026-08-01T00:00:00Z", date: "2026-08-01" },
  "order-stale-live": { id: "order-stale-live", createdAt: "2026-08-01T00:00:00Z", updatedAt: "2026-08-01T00:00:00Z", date: "2026-08-01" },
};

beforeAll(() => {
  process.env.BACKUP_ENCRYPTION_KEY = "test-key-for-vitest-only";
});

beforeEach(() => {
  kvStore.clear();
  for (const [id, order] of Object.entries(liveOrders)) {
    kvStore.set(`order:${id}`, order);
  }
});

function mockBackupFile(orders) {
  const encrypted = encryptJSON({ kind: "full", orderCount: orders.length, orders });
  global.fetch = vi.fn(async () => ({ ok: true, text: async () => encrypted }));
}

describe("restoreBatch merge semantics", () => {
  it("adds an order that doesn't exist live", async () => {
    mockBackupFile([{ id: "order-brand-new", createdAt: "2026-08-02T00:00:00Z", date: "2026-08-02" }]);
    const result = await restoreBatch("backups/orders/test.json.enc", 0);
    expect(result.added).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.skipped).toBe(0);
    expect(kvStore.has("order:order-brand-new")).toBe(true);
  });

  it("updates an order live only when the backup copy is strictly newer", async () => {
    mockBackupFile([{
      id: "order-stale-live",
      createdAt: "2026-08-01T00:00:00Z",
      updatedAt: "2026-08-05T00:00:00Z", // newer than live's 08-01
      date: "2026-08-01",
    }]);
    const result = await restoreBatch("backups/orders/test.json.enc", 0);
    expect(result.updated).toBe(1);
    expect(result.added).toBe(0);
    expect(result.skipped).toBe(0);
  });

  it("skips an order live that is not older than the backup copy — never overwrites with stale or equal data", async () => {
    mockBackupFile([{
      id: "order-untouched",
      createdAt: "2026-08-01T00:00:00Z",
      updatedAt: "2026-08-01T00:00:00Z", // same as live — not strictly newer
      date: "2026-08-01",
    }]);
    const result = await restoreBatch("backups/orders/test.json.enc", 0);
    expect(result.skipped).toBe(1);
    expect(result.added).toBe(0);
    expect(result.updated).toBe(0);
  });

  it("never deletes or touches a live order absent from the backup file", async () => {
    mockBackupFile([]); // empty backup
    await restoreBatch("backups/orders/test.json.enc", 0);
    expect(kvStore.has("order:order-untouched")).toBe(true);
    expect(kvStore.has("order:order-stale-live")).toBe(true);
  });

  it("skips malformed entries without an id instead of throwing", async () => {
    mockBackupFile([{ notAnId: true }, { id: "order-brand-new-2", createdAt: "2026-08-02T00:00:00Z" }]);
    const result = await restoreBatch("backups/orders/test.json.enc", 0);
    expect(result.skipped).toBe(1);
    expect(result.added).toBe(1);
  });
});
