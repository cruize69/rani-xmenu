// api/catering-inquiry.js
// POST /api/catering-inquiry
// Body: { name, contact, eventDate, headcount, occasion, notes }
//
// Catering doesn't get a self-serve checkout — the research behind this
// (see the lifecycle-marketing analysis) confirmed it's genuinely a
// phone/quote business: $420 average ticket at 7-15% margin vs 2-6% for
// normal service, and every real comparable operator quotes rather than
// carts. This endpoint is deliberately just a qualified-lead capture: it
// stores the inquiry and alerts staff immediately, the same way a new
// order does, so a human calls back — nothing here touches Stripe.

import { kv } from "../lib/kv.js";
import crypto from "crypto";
import { sendEmail, sendStaffSMS, escapeHtml } from "../lib/notifications.js";
import { overLimit, clientIp } from "../lib/rateLimit.js";
import { captureServerError } from "../lib/sentry.js";

function normalizePhone(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (String(raw).startsWith("+") && digits.length >= 10) return `+${digits}`;
  return null;
}

function cateringInquiryEmailHtml({ name, contact, eventDate, headcount, occasion, packageInterest, notes }) {
  const row = (label, value) => value
    ? `<tr><td style="padding:8px 0;font-size:12px;color:#8A7560;width:120px;vertical-align:top;">${label}</td><td style="padding:8px 0;font-size:14px;color:#FAF6EF;">${escapeHtml(value)}</td></tr>`
    : "";
  return `
  <div style="font-family:'Inter',sans-serif;background:#080706;padding:32px 16px;color:#FAF6EF;">
    <div style="max-width:520px;margin:0 auto;background:#12100e;border:1px solid rgba(232,168,46,0.35);border-radius:18px;padding:32px 24px;">
      <p style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#E8A82E;font-weight:700;margin:0 0 16px;">New Catering Inquiry</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        ${row("Name", name)}
        ${row("Contact", contact)}
        ${row("Event date", eventDate)}
        ${row("Headcount", headcount)}
        ${row("Occasion", occasion)}
        ${row("Package", packageInterest)}
        ${row("Notes", notes)}
      </table>
      <p style="font-size:12px;color:#8A7560;margin:20px 0 0;">Reply directly to the customer using the contact info above — this inbox is not monitored by the customer.</p>
    </div>
  </div>`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { name, contact, eventDate, headcount, occasion, packageInterest, notes } = req.body || {};

  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "Please enter your name." });
  }
  if (!contact || typeof contact !== "string" || !contact.trim()) {
    return res.status(400).json({ error: "Please enter an email or phone number so we can reach you." });
  }

  // No account/order to key a rate limit on (this is often someone's FIRST
  // contact with us), so the caller's IP is the only signal available —
  // same tradeoff accepted elsewhere in this codebase for the same
  // reason. This exists purely to bound cost (staff email/SMS spam), not
  // to gate legitimate inquiries.
  if (await overLimit(`catering-rl:ip:${clientIp(req)}`, 5, 60 * 60)) {
    return res.status(429).json({ error: "Too many inquiries submitted. Please call us directly at (914) 835-9066." });
  }

  const clean = (v, n) => (typeof v === "string" ? v.slice(0, n).trim() : "");
  const inquiry = {
    id: `catering_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
    name: clean(name, 100),
    contact: clean(contact, 150),
    eventDate: clean(eventDate, 40),
    headcount: clean(headcount, 20),
    occasion: clean(occasion, 100),
    packageInterest: clean(packageInterest, 50),
    notes: clean(notes, 1000),
    createdAt: new Date().toISOString(),
  };

  try {
    await kv.set(`catering-inquiry:${inquiry.id}`, JSON.stringify(inquiry), { ex: 180 * 24 * 60 * 60 });
    await kv.zadd("catering-inquiries", { score: Date.now(), member: inquiry.id });
  } catch (e) {
    console.error("Failed to store catering inquiry:", e);
    // Storage failing shouldn't block the staff alert below — a lead
    // that reaches an inbox but not KV is still a lead staff can act on.
  }

  const looksLikeEmail = inquiry.contact.includes("@");
  const staffEmail = sendEmail({
    to: ["ranimahal327@gmail.com", "riyadhjuwel@gmail.com"],
    subject: `Catering inquiry — ${inquiry.name}${inquiry.eventDate ? ` (${inquiry.eventDate})` : ""}`,
    html: cateringInquiryEmailHtml(inquiry),
  }).catch(e => {
    console.error("Catering inquiry staff email failed:", e);
    captureServerError(e, { route: "catering-inquiry", stage: "staff_email" });
  });

  const smsLine = `Rani Mahal: Catering inquiry from ${inquiry.name} — ${looksLikeEmail ? inquiry.contact : normalizePhone(inquiry.contact) || inquiry.contact}${inquiry.eventDate ? `, event ${inquiry.eventDate}` : ""}. Check email for full details.`;
  const staffSms = sendStaffSMS(smsLine).catch(e => {
    console.error("Catering inquiry staff SMS failed:", e);
    captureServerError(e, { route: "catering-inquiry", stage: "staff_sms" });
  });

  await Promise.all([staffEmail, staffSms]);

  return res.status(200).json({ ok: true });
}
