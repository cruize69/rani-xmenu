import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./kv.js", () => ({
  kv: {
    get: vi.fn(),
    set: vi.fn().mockResolvedValue("OK"),
    zrange: vi.fn().mockResolvedValue([]),
    zadd: vi.fn().mockResolvedValue(1),
    incr: vi.fn().mockResolvedValue(1),
    del: vi.fn().mockResolvedValue(1),
  },
}));

import {
  ORDER_STATUS,
  isPickupOrderReadyForAutoDone,
  autoResolveReadyPickupOrders,
  PICKUP_AUTO_READY_MINUTES,
} from "./orders.js";
import { kv } from "./kv.js";

describe("Pickup Auto-Ready Resolution (25m threshold)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("verifies default auto-ready threshold is 25 minutes", () => {
    expect(PICKUP_AUTO_READY_MINUTES).toBe(25);
  });

  it("identifies pickup order as ready when 25 minutes have elapsed", () => {
    const now = Date.now();
    const order = {
      id: "order_123",
      orderMode: "pickup",
      status: ORDER_STATUS.NEW,
      createdAt: new Date(now - 25 * 60 * 1000 - 5000).toISOString(), // 25m 5s ago
    };

    expect(isPickupOrderReadyForAutoDone(order, now)).toBe(true);
  });

  it("keeps pickup order in progress when under 25 minutes (e.g. 15 mins)", () => {
    const now = Date.now();
    const order = {
      id: "order_123",
      orderMode: "pickup",
      status: ORDER_STATUS.NEW,
      createdAt: new Date(now - 15 * 60 * 1000).toISOString(), // 15m ago
    };

    expect(isPickupOrderReadyForAutoDone(order, now)).toBe(false);
  });

  it("does NOT auto-mark delivery orders as ready (delivery requires driver handoff)", () => {
    const now = Date.now();
    const deliveryOrder = {
      id: "order_del_123",
      orderMode: "delivery",
      status: ORDER_STATUS.NEW,
      createdAt: new Date(now - 35 * 60 * 1000).toISOString(), // 35m ago
    };

    expect(isPickupOrderReadyForAutoDone(deliveryOrder, now)).toBe(false);
  });

  it("does NOT auto-mark orders that are already done or refunded", () => {
    const now = Date.now();
    const doneOrder = {
      id: "order_done_123",
      orderMode: "pickup",
      status: ORDER_STATUS.DONE,
      createdAt: new Date(now - 30 * 60 * 1000).toISOString(),
    };

    expect(isPickupOrderReadyForAutoDone(doneOrder, now)).toBe(false);
  });

  it("respects scheduled order time for pickup", () => {
    const now = Date.now();
    const scheduledFuture = {
      id: "order_sched_1",
      orderMode: "pickup",
      status: ORDER_STATUS.NEW,
      scheduledAtMs: now + 30 * 60 * 1000, // 30m in future
      createdAt: new Date(now - 40 * 60 * 1000).toISOString(),
    };
    expect(isPickupOrderReadyForAutoDone(scheduledFuture, now)).toBe(false);

    const scheduledDue = {
      id: "order_sched_2",
      orderMode: "pickup",
      status: ORDER_STATUS.NEW,
      scheduledAtMs: now - 1000, // Just reached scheduled time
      createdAt: new Date(now - 40 * 60 * 1000).toISOString(),
    };
    expect(isPickupOrderReadyForAutoDone(scheduledDue, now)).toBe(true);
  });

  it("sweeps order list, updates KV, and fires notification callback", async () => {
    const now = Date.now();
    const expiredOrder = {
      id: "order_expired",
      orderMode: "pickup",
      status: ORDER_STATUS.NEW,
      customerName: "Alex",
      customerPhone: "+19145550123",
      smsConsent: true,
      customerEmail: "alex@example.com",
      createdAt: new Date(now - 26 * 60 * 1000).toISOString(), // 26m ago
    };
    const freshOrder = {
      id: "order_fresh",
      orderMode: "pickup",
      status: ORDER_STATUS.NEW,
      createdAt: new Date(now - 5 * 60 * 1000).toISOString(), // 5m ago
    };

    kv.get.mockImplementation(async (key) => {
      if (key === "order:order_expired") return expiredOrder;
      if (key === "order:order_fresh") return freshOrder;
      return null;
    });

    const notifyMock = vi.fn().mockResolvedValue(true);
    const result = await autoResolveReadyPickupOrders([expiredOrder, freshOrder], notifyMock);

    expect(result[0].status).toBe(ORDER_STATUS.DONE);
    expect(result[0].autoReady).toBe(true);
    expect(result[1].status).toBe(ORDER_STATUS.NEW);

    expect(notifyMock).toHaveBeenCalledTimes(1);
    expect(notifyMock).toHaveBeenCalledWith(expect.objectContaining({
      id: "order_expired",
      status: ORDER_STATUS.DONE,
      autoReady: true,
    }));
  });
});
