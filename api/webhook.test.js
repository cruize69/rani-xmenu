import { describe, it, expect } from "vitest";
import Stripe from "stripe";

// Exercises the exact call api/webhook.js makes — stripe.webhooks.constructEvent
// — against a real signed payload, without needing a live Stripe key or a
// running server. This is the one check standing between a real Stripe event
// and a forged POST to /api/webhook claiming an order was paid.
describe("webhook signature verification", () => {
  const stripe = new Stripe("sk_test_not_a_real_key");
  const secret = "whsec_test_secret_for_vitest_only";
  const payload = JSON.stringify({ id: "evt_test", type: "checkout.session.completed", data: { object: { id: "cs_test" } } });

  it("accepts a correctly signed payload", () => {
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
    const event = stripe.webhooks.constructEvent(payload, header, secret);
    expect(event.type).toBe("checkout.session.completed");
  });

  it("rejects a payload signed with the wrong secret", () => {
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_wrong_secret" });
    expect(() => stripe.webhooks.constructEvent(payload, header, secret)).toThrow();
  });

  it("rejects a tampered payload with an otherwise-valid signature", () => {
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
    const tampered = payload.replace("checkout.session.completed", "checkout.session.expired");
    expect(() => stripe.webhooks.constructEvent(tampered, header, secret)).toThrow();
  });

  it("rejects a missing signature header", () => {
    expect(() => stripe.webhooks.constructEvent(payload, undefined, secret)).toThrow();
  });
});
