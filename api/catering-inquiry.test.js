import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing handler
vi.mock("../lib/kv.js", () => ({
  kv: {
    set: vi.fn().mockResolvedValue("OK"),
    zadd: vi.fn().mockResolvedValue(1),
  },
}));

vi.mock("../lib/notifications.js", () => ({
  sendEmail: vi.fn().mockResolvedValue({ id: "mock_email" }),
  sendStaffSMS: vi.fn().mockResolvedValue({ id: "mock_sms" }),
  escapeHtml: (s) => String(s || ""),
}));

vi.mock("../lib/rateLimit.js", () => ({
  overLimit: vi.fn().mockResolvedValue(false),
  clientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

vi.mock("../lib/sentry.js", () => ({
  captureServerError: vi.fn(),
}));

import handler from "./catering-inquiry.js";
import { sendEmail, sendStaffSMS } from "../lib/notifications.js";
import { kv } from "../lib/kv.js";

function createMockReqRes(body, method = "POST") {
  const req = {
    method,
    body,
    headers: { "x-forwarded-for": "127.0.0.1" },
  };
  let statusCode = 200;
  let jsonResponse = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      jsonResponse = data;
      return this;
    },
  };
  return { req, res, getStatus: () => statusCode, getJson: () => jsonResponse };
}

describe("catering-inquiry anti-spam and validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks past dates (e.g. Unix 1970 payload)", async () => {
    const { req, res, getStatus, getJson } = createMockReqRes({
      name: "Dneodmw Ndwmnbwir",
      contact: "ri.t.ihu.s43.3@gmail.com",
      eventDate: "1970-05-31",
      headcount: "25",
      occasion: "Spam",
      notes: "Test",
    });

    await handler(req, res);
    expect(getStatus()).toBe(400);
    expect(getJson().error).toMatch(/valid upcoming event date/i);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendStaffSMS).not.toHaveBeenCalled();
  });

  it("blocks gibberish alphanumeric headcounts (e.g. UCrgvZOFRTelqNeHK)", async () => {
    const { req, res, getStatus, getJson } = createMockReqRes({
      name: "Dneodmw Ndwmnbwir",
      contact: "ri.t.ihu.s43.3@gmail.com",
      eventDate: "2026-11-15",
      headcount: "UCrgvZOFRTelqNeHK",
      occasion: "Spam",
      notes: "Test",
    });

    await handler(req, res);
    expect(getStatus()).toBe(400);
    expect(getJson().error).toMatch(/estimated guest headcount/i);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendStaffSMS).not.toHaveBeenCalled();
  });

  it("silently traps bots that fill the invisible honeypot field", async () => {
    const { req, res, getStatus, getJson } = createMockReqRes({
      name: "Spam Bot",
      contact: "spambot@example.com",
      website: "https://spam-link.com", // Filled honeypot
      eventDate: "2026-11-15",
      headcount: "50",
      notes: "Buy crypto",
    });

    await handler(req, res);
    // Returns 200 to deceive the bot, but sends ZERO emails or SMS
    expect(getStatus()).toBe(200);
    expect(getJson().ok).toBe(true);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendStaffSMS).not.toHaveBeenCalled();
    expect(kv.set).not.toHaveBeenCalled();
  });

  it("silently traps bot requests submitted too quickly (< 1.2 seconds)", async () => {
    const { req, res, getStatus, getJson } = createMockReqRes({
      name: "Fast Submitter",
      contact: "bot@fast.com",
      eventDate: "2026-11-15",
      headcount: "50",
      renderedAt: Date.now() - 200, // 200ms elapsed
    });

    await handler(req, res);
    expect(getStatus()).toBe(200);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendStaffSMS).not.toHaveBeenCalled();
    expect(kv.set).not.toHaveBeenCalled();
  });

  it("accepts and notifies staff on valid legitimate inquiry", async () => {
    const { req, res, getStatus, getJson } = createMockReqRes({
      name: "Sarah Jenkins",
      contact: "sarah.jenkins@gmail.com",
      eventDate: "2026-10-15",
      headcount: "35",
      occasion: "Birthday Dinner",
      packageInterest: "The Maharani Feast",
      notes: "Vegetarian options needed",
      renderedAt: Date.now() - 15000, // 15 seconds elapsed
    });

    await handler(req, res);
    expect(getStatus()).toBe(200);
    expect(getJson().ok).toBe(true);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendStaffSMS).toHaveBeenCalledTimes(1);
    expect(kv.set).toHaveBeenCalledTimes(1);
  });
});
