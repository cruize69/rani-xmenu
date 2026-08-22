import { describe, it, expect } from "vitest";
import { extractFeasts, FEASTS } from "./feasts.js";

const familyFeast = FEASTS.find((f) => f.id === "family-meal");
const grandFeast = FEASTS.find((f) => f.id === "group-meal");

describe("extractFeasts", () => {
  it("extracts a feast-only cart with nothing left over", () => {
    const { appliedFeasts, remaining } = extractFeasts(familyFeast.items);
    expect(appliedFeasts).toHaveLength(1);
    expect(appliedFeasts[0].id).toBe("family-meal");
    expect([...remaining.values()].every((qty) => qty === 0)).toBe(true);
  });

  it("leaves genuine à la carte additions in `remaining`, untouched by feast pricing", () => {
    const cart = [...familyFeast.items, { baseId: "item-samosa", qty: 2 }, { baseId: "item-mango-lassi", qty: 1 }];
    const { appliedFeasts, remaining } = extractFeasts(cart);
    expect(appliedFeasts).toHaveLength(1);
    expect(remaining.get("item-samosa")).toBe(2);
    expect(remaining.get("item-mango-lassi")).toBe(1);
    // Every feast item is fully consumed, not partially left behind
    familyFeast.items.forEach((req) => expect(remaining.get(req.baseId)).toBe(0));
  });

  it("extracts two instances of the same feast when the cart has double quantities", () => {
    const cart = familyFeast.items.map((i) => ({ baseId: i.baseId, qty: i.qty * 2 }));
    const { appliedFeasts, remaining } = extractFeasts(cart);
    expect(appliedFeasts).toHaveLength(2);
    expect(appliedFeasts.every((f) => f.id === "family-meal")).toBe(true);
    expect([...remaining.values()].every((qty) => qty === 0)).toBe(true);
  });

  it("does not apply a feast when the cart is missing even one required item", () => {
    const shortOfOne = familyFeast.items.filter((i) => i.baseId !== "item-raita"); // drop the raita entirely
    const { appliedFeasts, remaining } = extractFeasts(shortOfOne);
    expect(appliedFeasts).toHaveLength(0);
    // Nothing consumed — every item that WAS in the cart stays in remaining at full qty
    shortOfOne.forEach((req) => expect(remaining.get(req.baseId)).toBe(req.qty));
  });

  it("does not apply a feast when a required item's quantity is one short", () => {
    const oneShort = familyFeast.items.map((i) =>
      i.baseId === "item-garlic-naan" ? { ...i, qty: i.qty - 1 } : i
    );
    const { appliedFeasts } = extractFeasts(oneShort);
    expect(appliedFeasts).toHaveLength(0);
  });

  it("applies the bundle even when built by hand-adding the same items, no button involved", () => {
    // Same items, different order, simulating independent additions rather
    // than a single "Add Feast" tap — extraction must not care how the
    // cart was assembled, only what's actually in it.
    const shuffled = [...familyFeast.items].reverse();
    const { appliedFeasts } = extractFeasts(shuffled);
    expect(appliedFeasts).toHaveLength(1);
  });

  it("prefers the larger feast first so a big genuine order isn't fragmented into a worse combination", () => {
    const { appliedFeasts, remaining } = extractFeasts(grandFeast.items);
    expect(appliedFeasts).toHaveLength(1);
    expect(appliedFeasts[0].id).toBe("group-meal");
    expect([...remaining.values()].every((qty) => qty === 0)).toBe(true);
  });

  it("returns nothing applied for an empty cart", () => {
    const { appliedFeasts } = extractFeasts([]);
    expect(appliedFeasts).toHaveLength(0);
  });
});

describe("extractFeasts — Masala Dosa swap for Rani Ki Offering", () => {
  it("applies the bundle when the swappable slot has Masala Dosa instead of Rani Ki Offering", () => {
    const cart = familyFeast.items.map((i) =>
      i.baseId === "item-rani-offering" ? { baseId: "item-masala-dosa", qty: i.qty } : i
    );
    const { appliedFeasts, remaining } = extractFeasts(cart);
    expect(appliedFeasts).toHaveLength(1);
    // The applied feast's items reflect what's actually in the box —
    // Masala Dosa, not the feast definition's default Rani Ki Offering —
    // so checkout prices and labels the real substitution automatically.
    const swappedSlot = appliedFeasts[0].items.find((it) => it.baseId === "item-masala-dosa" || it.baseId === "item-rani-offering");
    expect(swappedSlot.baseId).toBe("item-masala-dosa");
    expect(remaining.get("item-masala-dosa")).toBe(0);
  });

  it("prefers Rani Ki Offering over the swap when both are in the cart, leaving the extra dosa as genuine à la carte", () => {
    const cart = [...familyFeast.items, { baseId: "item-masala-dosa", qty: 1 }];
    const { appliedFeasts, remaining } = extractFeasts(cart);
    expect(appliedFeasts).toHaveLength(1);
    const slot = appliedFeasts[0].items.find((it) => it.baseId === "item-masala-dosa" || it.baseId === "item-rani-offering");
    expect(slot.baseId).toBe("item-rani-offering");
    expect(remaining.get("item-masala-dosa")).toBe(1); // untouched, priced normally
  });

  it("does not apply the bundle if neither the original nor the swap is present in enough quantity", () => {
    const missingSlot = familyFeast.items.filter((i) => i.baseId !== "item-rani-offering");
    const { appliedFeasts } = extractFeasts(missingSlot);
    expect(appliedFeasts).toHaveLength(0);
  });

  it("does not let swapTo leak into a non-swappable slot", () => {
    // item-ctm (Chicken Tikka Masala) has no swapTo — dropping it and
    // substituting an unrelated item must NOT satisfy that slot.
    const cart = familyFeast.items.map((i) =>
      i.baseId === "item-ctm" ? { baseId: "item-samosa", qty: i.qty } : i
    );
    const { appliedFeasts } = extractFeasts(cart);
    expect(appliedFeasts).toHaveLength(0);
  });
});
