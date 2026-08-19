import { describe, it, expect } from "vitest";
import { getTimeSlots, isWithinServiceWindow, nyDateTimeToUtcMs } from "./hours.js";

// Regression coverage for a real production timing gap: delivery slots
// were offered (and accepted server-side) with the same 20-minute lead
// time as pickup, even though every delivery zone quotes a 45-60 minute
// window at minimum. A customer could pick a delivery slot barely half as
// far out as the restaurant's own quoted delivery time.

const DINNER_WINDOW = { opens: "17:00", closes: "21:30" };
// A Wednesday, well inside dinner service, away from any DST boundary.
const DATE = "2026-08-19";
const nowAt = (hhmm) => new Date(nyDateTimeToUtcMs(DATE, hhmm));

describe("getTimeSlots — mode-aware minimum lead time", () => {
  it("pickup's first available slot is ~20 minutes out", () => {
    const slots = getTimeSlots(DATE, DINNER_WINDOW, nowAt("19:00"), "pickup");
    expect(slots[0]).toBe("19:30"); // 19:00 + 20min = 19:20, rounded up to :30
  });

  it("delivery's first available slot is ~45 minutes out, later than pickup's", () => {
    const slots = getTimeSlots(DATE, DINNER_WINDOW, nowAt("19:00"), "delivery");
    expect(slots[0]).toBe("19:45"); // 19:00 + 45min = 19:45, already on the grid
  });

  it("defaults to the pickup (shorter) lead time when orderMode is omitted", () => {
    const slots = getTimeSlots(DATE, DINNER_WINDOW, nowAt("19:00"));
    expect(slots[0]).toBe("19:30");
  });

  it("a delivery order placed well before opening still starts 45 min after opening, not 15", () => {
    // Ordered during the afternoon break — the now-based lead time alone
    // (2:30pm + 45min = 3:15pm) would trivially clear the 5pm opening, so
    // this only passes if the opening buffer itself is also mode-aware.
    const slots = getTimeSlots(DATE, DINNER_WINDOW, nowAt("14:30"), "delivery");
    expect(slots[0]).toBe("17:45");
  });

  it("a pickup order placed during the same break keeps its original 15-min opening ramp", () => {
    const slots = getTimeSlots(DATE, DINNER_WINDOW, nowAt("14:30"), "pickup");
    expect(slots[0]).toBe("17:15");
  });
});

describe("isWithinServiceWindow — mode-aware minimum lead time (the real security boundary)", () => {
  it("rejects a delivery slot only 25 minutes out — the exact gap a real order slipped through", () => {
    const now = nowAt("16:50");
    expect(isWithinServiceWindow(DATE, "17:15", now, "delivery")).toBe(false);
  });

  it("accepts that same 25-minutes-out slot for pickup", () => {
    const now = nowAt("16:50");
    expect(isWithinServiceWindow(DATE, "17:15", now, "pickup")).toBe(true);
  });

  it("accepts a delivery slot 50 minutes out, once it also clears the opening buffer", () => {
    const now = nowAt("16:50"); // 10 min before open — target must clear BOTH now+45 and open+45
    expect(isWithinServiceWindow(DATE, "17:45", now, "delivery")).toBe(true);
  });

  it("defaults to the pickup lead time when orderMode is omitted", () => {
    const now = nowAt("16:50");
    expect(isWithinServiceWindow(DATE, "17:15", now)).toBe(true);
  });

  it("rejects a delivery order placed well before opening (e.g. during the afternoon break) for a slot too close to opening", () => {
    // Ordered hours in advance, so the now-based check is trivially fine —
    // this is the case the opening-buffer check exists to catch on its own.
    const duringBreak = nowAt("14:30");
    expect(isWithinServiceWindow(DATE, "17:15", duringBreak, "delivery")).toBe(false);
    expect(isWithinServiceWindow(DATE, "17:45", duringBreak, "delivery")).toBe(true);
  });

  it("does not change pickup's opening buffer for a break-time order", () => {
    const duringBreak = nowAt("14:30");
    expect(isWithinServiceWindow(DATE, "17:15", duringBreak, "pickup")).toBe(true);
  });
});
