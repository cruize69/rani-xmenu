import { describe, it, expect } from "vitest";
import { nyWeekdayAndHour, buildDailyBreakdown, buildWeeklyBreakdown, buildDayOfWeek, buildHourly } from "./analytics.js";
import { getNYDateString } from "../lib/orders.js";

function order({ id, date, createdAt, total = 50, subtotal = 45, tax = 5, tip = 0, status = "done", discountAmount = 0, refundedTotal = 0 }) {
  return { id, date, createdAt, total, subtotal, tax, tip, status, discountAmount, refundedTotal, items: [] };
}

describe("nyWeekdayAndHour", () => {
  it("converts a late-evening UTC timestamp to the correct NY weekday and hour", () => {
    // 2026-08-23T02:30:00Z = 2026-08-22 22:30 EDT (10:30pm Saturday) — a
    // naive new Date(iso).getDay()/.getHours() would read this as Sunday,
    // 2am (the UTC calendar day), exactly the bug this function fixes.
    const { weekday, hour } = nyWeekdayAndHour("2026-08-23T02:30:00Z");
    expect(weekday).toBe("Sat");
    expect(hour).toBe(22);
  });

  it("handles the UTC midnight boundary without an hour-24 edge case", () => {
    // 2026-01-01T05:00:00Z = 2026-01-01 00:00 EST — hourCycle:"h23" must
    // read this as hour 0, not ICU's occasional "24" for midnight.
    const { hour } = nyWeekdayAndHour("2026-01-01T05:00:00Z");
    expect(hour).toBe(0);
  });
});

describe("buildDayOfWeek / buildHourly — NY-local bucketing", () => {
  it("buckets a late-evening order into the NY weekday, not the UTC one", () => {
    const orders = [order({ id: "1", date: "2026-08-22", createdAt: "2026-08-23T02:30:00Z" })];
    const dow = buildDayOfWeek(orders);
    expect(dow.find(d => d.label === "Sat").count).toBe(1);
    expect(dow.find(d => d.label === "Sun").count).toBe(0);
  });

  it("buckets a late-evening order into the NY hour, not the UTC one", () => {
    const orders = [order({ id: "1", date: "2026-08-22", createdAt: "2026-08-23T02:30:00Z" })];
    const grid = buildHourly(orders);
    const cell = grid.find(c => c.day === "Sat" && c.hourNum === 22);
    expect(cell.count).toBe(1);
  });
});

describe("buildDailyBreakdown", () => {
  it("rolls up orders by order.date, computing net/AOV/discounts per day", () => {
    // getNYDateString, not toISOString().slice(0,10) — the function under
    // test computes "today" in NY-local time, and those two disagree for
    // several hours around midnight UTC (roughly 7pm-midnight Eastern);
    // using the same basis here is what keeps this test from flaking
    // depending on what time of day it happens to run.
    const todayStr = getNYDateString();
    const orders = [
      order({ id: "1", date: todayStr, createdAt: `${todayStr}T18:00:00Z`, total: 60, discountAmount: 5 }),
      order({ id: "2", date: todayStr, createdAt: `${todayStr}T19:00:00Z`, total: 40 }),
    ];
    const rows = buildDailyBreakdown(orders, 7);
    const todayRow = rows[0]; // most recent first
    expect(todayRow.orders).toBe(2);
    expect(todayRow.gross).toBe(100);
    expect(todayRow.aov).toBe(50);
    expect(todayRow.discounts).toBe(5);
  });

  it("excludes refunded orders from the orders count but still nets out their refund from gross", () => {
    const todayStr = getNYDateString();
    const orders = [
      order({ id: "1", date: todayStr, createdAt: `${todayStr}T18:00:00Z`, total: 60, status: "refunded", refundedTotal: 60 }),
    ];
    const rows = buildDailyBreakdown(orders, 7);
    expect(rows[0].orders).toBe(0);
    expect(rows[0].net).toBe(0);
  });

  it("computes day-over-day % change relative to the chronologically previous day", () => {
    const todayStr = getNYDateString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = getNYDateString(yesterday);
    const orders = [
      order({ id: "1", date: yesterdayStr, createdAt: `${yesterdayStr}T18:00:00Z`, total: 100 }),
      order({ id: "2", date: todayStr, createdAt: `${todayStr}T18:00:00Z`, total: 120 }),
    ];
    const rows = buildDailyBreakdown(orders, 7);
    expect(rows[0].dodChangePct).toBe(20);
  });

  it("returns exactly one row per day up to the requested count, most recent first", () => {
    const rows = buildDailyBreakdown([], 5);
    expect(rows).toHaveLength(5);
    // Strictly descending calendar dates
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].date < rows[i - 1].date).toBe(true);
    }
  });
});

describe("buildWeeklyBreakdown", () => {
  it("groups days into Monday-start weeks and flags partial weeks", () => {
    // A known Monday and the Sunday right before it (different weeks).
    const orders = [
      order({ id: "1", date: "2026-08-17", createdAt: "2026-08-17T18:00:00Z", total: 100 }), // Monday
      order({ id: "2", date: "2026-08-16", createdAt: "2026-08-16T18:00:00Z", total: 50 }),  // Sunday (prior week)
    ];
    const rows = buildWeeklyBreakdown(orders, 30);
    const weekOf17 = rows.find(w => w.weekStart === "2026-08-17");
    const weekOf10 = rows.find(w => w.weekStart === "2026-08-10");
    expect(weekOf17).toBeTruthy();
    expect(weekOf10).toBeTruthy();
    expect(weekOf17.net).toBe(100);
    expect(weekOf10.net).toBe(50);
  });

  it("computes week-over-week % change relative to the chronologically previous week", () => {
    const orders = [
      order({ id: "1", date: "2026-08-10", createdAt: "2026-08-10T18:00:00Z", total: 100 }), // week of Aug 10
      order({ id: "2", date: "2026-08-17", createdAt: "2026-08-17T18:00:00Z", total: 150 }), // week of Aug 17 (+50%)
    ];
    const rows = buildWeeklyBreakdown(orders, 30);
    const weekOf17 = rows.find(w => w.weekStart === "2026-08-17");
    expect(weekOf17.wowChangePct).toBe(50);
  });

  it("marks the boundary weeks partial when the requested range cuts them off mid-week", () => {
    // A 3-day range can't possibly contain 3 full Monday-start weeks.
    const rows = buildWeeklyBreakdown([], 3);
    expect(rows.every(w => w.isPartial)).toBe(true);
  });
});
