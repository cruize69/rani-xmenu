import { describe, it, expect, vi } from "vitest";

// Regression test for a live incident: an order placed after its own print
// trigger time had already passed still got parked in "scheduled" status,
// so it only printed on promote-scheduled-orders.js's next 5-minute cron
// tick instead of immediately — a needless delay that looked like a
// silent failure. buildOrder must now route a scheduledFor order straight
// to "new" whenever printAtMs is already due at creation time.

vi.mock("./kv.js", () => ({ kv: {} }));

const { buildOrder, ORDER_STATUS } = await import("./orders.js");

function stripeSessionStub() {
  return {
    id: "cs_test",
    metadata: {},
    customer_details: { email: "test@example.com", name: "Test Customer", phone: "+15551234567" },
  };
}

describe("buildOrder — scheduled vs. immediate print routing", () => {
  it("stays SCHEDULED when the requested slot is genuinely still in the future", () => {
    const farFuture = new Date(Date.now() + 6 * 60 * 60 * 1000); // 6h from now
    const dateStr = farFuture.toISOString().slice(0, 10);
    const order = buildOrder({
      paymentIntent: { id: "pi_test" },
      stripeSession: stripeSessionStub(),
      cartItems: [{ name: "Naan", price: 5, qty: 1 }],
      orderMode: "pickup",
      scheduledFor: { date: dateStr, time: "20:00" },
    });
    expect(order.status).toBe(ORDER_STATUS.SCHEDULED);
  });

  it("goes straight to NEW when the print trigger has already passed by the time the order is placed", () => {
    // A slot 5 minutes in the past, expressed in real NY-local wall-clock
    // time (not UTC) — e.g. checkout took a few minutes and ate into an
    // early-dinner slot's kitchen-return trigger.
    const justPast = new Date(Date.now() - 5 * 60 * 1000);
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(justPast);
    const get = (t) => parts.find(p => p.type === t).value;
    const dateStr = `${get("year")}-${get("month")}-${get("day")}`;
    const hh = get("hour") === "24" ? "00" : get("hour");
    const mm = get("minute");
    const order = buildOrder({
      paymentIntent: { id: "pi_test" },
      stripeSession: stripeSessionStub(),
      cartItems: [{ name: "Naan", price: 5, qty: 1 }],
      orderMode: "pickup",
      scheduledFor: { date: dateStr, time: `${hh}:${mm}` },
    });
    expect(order.status).toBe(ORDER_STATUS.NEW);
    // scheduledFor/scheduledAtMs must still be populated for display even
    // though the order isn't held — the customer's requested time is real
    // information, just not a reason to delay the kitchen ticket anymore.
    expect(order.scheduledFor).toEqual({ date: dateStr, time: `${hh}:${mm}` });
  });

  it("is NEW immediately for a normal order with no scheduledFor at all", () => {
    const order = buildOrder({
      paymentIntent: { id: "pi_test" },
      stripeSession: stripeSessionStub(),
      cartItems: [{ name: "Naan", price: 5, qty: 1 }],
      orderMode: "pickup",
    });
    expect(order.status).toBe(ORDER_STATUS.NEW);
    expect(order.scheduledFor).toBeNull();
  });
});

describe("buildOrder — discount transparency and math integrity", () => {
  it("correctly extracts 10% welcome discount metadata", () => {
    const session = stripeSessionStub();
    session.metadata = {
      welcomeDiscount: "1",
      discountPct: "0.1",
      discountType: "welcome",
      discountAmount: "3.00",
      originalSubtotal: "30.00",
    };
    const order = buildOrder({
      paymentIntent: { id: "pi_test" },
      stripeSession: session,
      cartItems: [{ name: "Chicken Tikka Masala", price: 27.00, originalPrice: 30.00, qty: 1 }],
      orderMode: "pickup",
    });

    expect(order.welcomeDiscount).toBe(true);
    expect(order.memberDiscount).toBe(false);
    expect(order.discountType).toBe("welcome");
    expect(order.discountAmount).toBe(3.00);
    expect(order.originalSubtotal).toBe(30.00);
    expect(order.subtotal).toBe(27.00);
    expect(order.discountLabel).toContain("10% Welcome Discount");
  });

  it("correctly extracts 5% member discount metadata", () => {
    const session = stripeSessionStub();
    session.metadata = {
      memberDiscount: "1",
      discountPct: "0.05",
      discountType: "member",
      discountAmount: "2.00",
      originalSubtotal: "40.00",
    };
    const order = buildOrder({
      paymentIntent: { id: "pi_test" },
      stripeSession: session,
      cartItems: [{ name: "Biryani", price: 38.00, originalPrice: 40.00, qty: 1 }],
      orderMode: "pickup",
    });

    expect(order.welcomeDiscount).toBe(false);
    expect(order.memberDiscount).toBe(true);
    expect(order.discountType).toBe("member");
    expect(order.discountAmount).toBe(2.00);
    expect(order.originalSubtotal).toBe(40.00);
    expect(order.subtotal).toBe(38.00);
    expect(order.discountLabel).toContain("5% Member Discount");
  });

  it("handles legacy/undiscounted order payloads with 100% backward compatibility", () => {
    const order = buildOrder({
      paymentIntent: { id: "pi_test" },
      stripeSession: stripeSessionStub(),
      cartItems: [{ name: "Samosa", price: 8.00, qty: 2 }],
      orderMode: "pickup",
    });

    expect(order.welcomeDiscount).toBe(false);
    expect(order.memberDiscount).toBe(false);
    expect(order.discountAmount).toBe(0);
    expect(order.discountPct).toBe(0);
    expect(order.discountType).toBeNull();
    expect(order.discountLabel).toBeNull();
    expect(order.originalSubtotal).toBe(16.00);
    expect(order.subtotal).toBe(16.00);
  });

  it("ensures large cart metadata chunks never exceed Stripe 500 char limit and reassemble cleanly", () => {
    const largeCart = [
      { baseId: "item-ctm", name: "Chicken Tikka Masala", price: 21.95, qty: 2, spice: "Medium", note: "Extra sauce please" },
      { baseId: "item-butter-chicken", name: "Butter Chicken", price: 21.95, qty: 2, spice: "Mild", note: "" },
      { baseId: "item-rogan", name: "Lamb Rogan Josh", price: 25.95, qty: 1, spice: "Spicy", note: "" },
      { baseId: "item-palak-paneer", name: "Palak Paneer", price: 17.95, qty: 1, spice: "Medium", note: "" },
      { baseId: "item-dal-maharani", name: "Dal Maharani Makhni", price: 13.95, qty: 2, spice: null, note: "" },
      { baseId: "item-garlic-naan", name: "Garlic Naan", price: 5.50, qty: 4, spice: null, note: "" },
      { baseId: "item-samosa", name: "Samosa", price: 7.95, qty: 3, spice: null, note: "" },
      { baseId: "item-mixed-pickles", name: "Mixed Pickles", price: 4.50, qty: 1, spice: null, note: "" },
    ];

    const cartJson = JSON.stringify(largeCart);
    expect(cartJson.length).toBeGreaterThan(600); // Verify it exceeds 500 chars

    // Replicate create-checkout chunking logic
    const metaCart = {};
    if (Buffer.byteLength(cartJson, "utf8") <= 500) {
      metaCart.cart = cartJson;
    } else {
      const CHUNK_SIZE = 450;
      for (let i = 0, offset = 0; offset < cartJson.length; i++, offset += CHUNK_SIZE) {
        metaCart[`cart_${i}`] = cartJson.slice(offset, offset + CHUNK_SIZE);
      }
    }

    // Assert EVERY metadata value is <= 500 chars (Stripe requirement)
    for (const [key, val] of Object.entries(metaCart)) {
      expect(val.length).toBeLessThanOrEqual(500);
    }

    // Replicate syncStripe reassembly logic
    let reassembled = metaCart.cart;
    if (!reassembled) {
      const chunks = [];
      for (let i = 0; i < 20; i++) {
        const chunk = metaCart[`cart_${i}`];
        if (chunk) chunks.push(chunk);
        else break;
      }
      reassembled = chunks.join("");
    }

    expect(reassembled).toBe(cartJson);
    const parsed = JSON.parse(reassembled);
    expect(parsed.length).toBe(largeCart.length);
    expect(parsed[0].name).toBe("Chicken Tikka Masala");
  });
});
