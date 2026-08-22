import { describe, it, expect } from "vitest";
import { extractFeasts, FEASTS } from "./feasts.js";

const familyFeast = FEASTS.find((f) => f.id === "family-feast");
const grandFeast = FEASTS.find((f) => f.id === "grand-feast");

describe("extractFeasts", () => {
  it("extracts a feast-only cart with nothing left over", () => {
    const { appliedFeasts, remaining } = extractFeasts(familyFeast.items);
    expect(appliedFeasts).toHaveLength(1);
    expect(appliedFeasts[0].id).toBe("family-feast");
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
    expect(appliedFeasts.every((f) => f.id === "family-feast")).toBe(true);
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
    expect(appliedFeasts[0].id).toBe("grand-feast");
    expect([...remaining.values()].every((qty) => qty === 0)).toBe(true);
  });

  it("returns nothing applied for an empty cart", () => {
    const { appliedFeasts } = extractFeasts([]);
    expect(appliedFeasts).toHaveLength(0);
  });
});
