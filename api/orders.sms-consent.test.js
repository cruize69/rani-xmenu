import { describe, it, expect, vi, beforeEach } from "vitest";

// Regression test for a real live consent violation fixed this session:
// order-status SMS used to fire for every order with a phone number,
// checkbox or not. This locks the gate in — status-update SMS must only
// ever go out when the order carries smsConsent === true.

vi.mock("../lib/auth.js", () => ({
  checkManagerAuth: vi.fn(async () => ({ ok: true })),
}));

vi.mock("../lib/sentry.js", () => ({ captureServerError: vi.fn() }));
vi.mock("../lib/errorAlerts.js", () => ({ reportPaidOrderBuildFailed: vi.fn() }));
vi.mock("../lib/syncStripe.js", () => ({
  getStripe: vi.fn(),
  syncStripeSessions: vi.fn(),
  getOrCreateOrderForSession: vi.fn(),
}));
vi.mock("../lib/notifications.js", () => ({
  sendOrderEmail: vi.fn(async () => {}),
  sendCustomerReceiptEmail: vi.fn(async () => {}),
  sendOrderSMS: vi.fn(async () => {}),
  sendCustomerStatusEmail: vi.fn(async () => {}),
}));

let mockOrder;
vi.mock("../lib/orders.js", () => ({
  ORDER_STATUS: { NEW: "new", SCHEDULED: "scheduled", DONE: "done", REFUNDED: "refunded" },
  updateOrder: vi.fn(async (id, fields) => ({ ...mockOrder, ...fields })),
  getOrder: vi.fn(async () => mockOrder),
  buildOrder: vi.fn(),
  saveOrder: vi.fn(),
  getOrdersByDate: vi.fn(),
  buildDailySummary: vi.fn(),
  getNYDateString: vi.fn(() => "2026-08-19"),
  getOrdersVersion: vi.fn(),
  publicOrderView: vi.fn(),
}));

const { default: handler } = await import("./orders.js");

function makeRes() {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

describe("PATCH /api/orders — SMS consent gating", () => {
  beforeEach(() => {
    process.env.TWILIO_API_KEY_SID = "test-key-sid";
    process.env.TWILIO_ACCOUNT_SID = "test-account-sid";
    process.env.TWILIO_API_KEY_SECRET = "test-secret";
    process.env.TWILIO_FROM = "+15551234567";
    global.fetch = vi.fn(async () => ({ ok: true, text: async () => "" }));
    mockOrder = { id: "order-1", customerPhone: "+15559876543", status: "done" };
  });

  it("does NOT send SMS when smsConsent is false", async () => {
    mockOrder.smsConsent = false;
    const req = { method: "PATCH", headers: { "x-manager-secret": "irrelevant-mocked" }, body: { id: "order-1", status: "done" } };
    await handler(req, makeRes());
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("does NOT send SMS when smsConsent is missing entirely", async () => {
    const req = { method: "PATCH", headers: { "x-manager-secret": "irrelevant-mocked" }, body: { id: "order-1", status: "done" } };
    await handler(req, makeRes());
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("sends SMS only when smsConsent is true", async () => {
    mockOrder.smsConsent = true;
    const req = { method: "PATCH", headers: { "x-manager-secret": "irrelevant-mocked" }, body: { id: "order-1", status: "done" } };
    await handler(req, makeRes());
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url] = global.fetch.mock.calls[0];
    expect(url).toContain("api.twilio.com");
  });
});
