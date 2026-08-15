// ── Instant "customer is stuck, call them back" alerting ────────────
// Distinct from general error tracking (Sentry, if configured — see
// lib/sentry.js): this is the specific business workflow of "a customer
// who gave us contact info hit an error and couldn't finish checking
// out — text/email the owner right now so they can call and complete the
// sale by phone instead of silently losing it."
//
// Identity comes from the abandoned-lead record (lib/abandonedCart.js)
// already captured the moment a customer types a phone number or reaches
// the guest-email step — well before checkout, so it's available even if
// the error happens on the very first attempt.

import { kv } from "@vercel/kv";
import { sendEmail, sendStaffSMS, escapeHtml } from "./notifications.js";

const ALERT_COOLDOWN_SEC = 10 * 60; // don't re-text for the same customer more than once per 10 min
const STAFF_EMAILS = ["ranimahal327@gmail.com", "riyadhjuwel@gmail.com", "ajalil001@gmail.com"];

function parseJson(raw) {
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

function formatCartLine(items) {
  return (items ?? []).map(i => `${i.qty}x ${i.name}`).join(", ") || "(cart unknown)";
}

/**
 * Report an error from anywhere in the checkout-critical path. Only
 * escalates to an immediate SMS/email when the customer is identifiable
 * (has a phone or email on file via their draftId's lead) — a stack trace
 * from an anonymous browsing session isn't actionable by phone.
 */
export async function reportCheckoutError({ draftId, source, message, context = {} }) {
  const safeMessage = String(message ?? "Unknown error").slice(0, 500);

  let lead = null;
  if (draftId) {
    try {
      lead = parseJson(await kv.get(`abandoned-lead:${draftId}`));
    } catch {}
  }

  const identifiable = !!(lead?.phone || lead?.email);
  console.error(`[checkout-error:${source}]`, safeMessage, { draftId, identifiable, context });

  if (!identifiable) return { alerted: false, reason: "not_identifiable" };

  const contactKey = (lead.phone || lead.email).toLowerCase();
  const rlKey = `error-alert-rl:${contactKey}`;
  const acquired = await kv.set(rlKey, "1", { nx: true, ex: ALERT_COOLDOWN_SEC });
  if (!acquired) return { alerted: false, reason: "cooldown" };

  const cartLine = formatCartLine(lead.items);
  const contactLine = [
    lead.phone ? `Phone: ${lead.phone}` : null,
    lead.email ? `Email: ${lead.email}` : null,
  ].filter(Boolean).join(" · ");

  // A tel: href is an ATTRIBUTE, not text — escapeHtml is the wrong tool
  // (it wouldn't stop a javascript: or a quote-broken attribute). Strip to
  // dial-safe characters only. Both public, unauthenticated entry points
  // (api/cart/save-draft.js, api/report-error.js) accept a free-text phone.
  const telPhone = String(lead.phone ?? "").replace(/[^0-9+()\-\s]/g, "");

  const summary = `⚠️ Checkout error — customer stuck!\n${contactLine}\nCart: ${cartLine}\nError (${source}): ${safeMessage}\nCall them now to finish the order.`;

  const jobs = [];
  jobs.push(sendEmail({
    to: STAFF_EMAILS,
    subject: `⚠️ Customer stuck at checkout — call ${lead.phone || lead.email}`,
    html: `
      <div style="font-family:sans-serif;padding:20px;background:#fff3e0;border:2px solid #d9482c;border-radius:10px;max-width:520px;">
        <h2 style="color:#d9482c;margin:0 0 12px;">A customer couldn't finish checking out</h2>
        <p style="margin:0 0 6px;"><strong>Contact:</strong> ${escapeHtml(contactLine) || "unknown"}</p>
        <p style="margin:0 0 6px;"><strong>Cart:</strong> ${escapeHtml(cartLine)}</p>
        <p style="margin:0 0 6px;"><strong>Order mode:</strong> ${escapeHtml(lead.orderMode ?? "unknown")}</p>
        <p style="margin:0 0 6px;"><strong>Error source:</strong> ${escapeHtml(source)}</p>
        <p style="margin:0 0 12px;"><strong>Details:</strong> ${escapeHtml(safeMessage)}</p>
        ${telPhone ? `<a href="tel:${telPhone}" style="display:inline-block;background:#d9482c;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:700;">Call ${escapeHtml(lead.phone)}</a>` : ""}
      </div>`,
  }));
  jobs.push(sendStaffSMS(summary.slice(0, 1550)));

  await Promise.allSettled(jobs);
  return { alerted: true };
}

/**
 * The single highest-stakes failure mode: Stripe has ALREADY charged the
 * customer (checkout.session.completed fired) but our own order record
 * failed to build/save — money taken, no order anywhere, kitchen never
 * sees it. Uses Stripe's own verified customer_details directly rather
 * than the pre-checkout lead lookup, since by this point Stripe itself is
 * the more reliable and more complete source of contact info. Bypasses the
 * identifiability check entirely — a completed Stripe session always means
 * a specific charged customer exists.
 */
export async function reportPaidOrderBuildFailed({ session, error }) {
  const phone = session?.customer_details?.phone || null;
  const email = session?.customer_details?.email || null;
  const name = session?.customer_details?.name || "Guest";
  const amount = session?.amount_total ? `$${(session.amount_total / 100).toFixed(2)}` : "unknown amount";

  console.error("[PAID ORDER BUILD FAILED]", { sessionId: session?.id, phone, email, error: error?.message });

  const contactKey = (phone || email || session?.id || "unknown").toLowerCase();
  const rlKey = `error-alert-rl:paid-fail:${contactKey}`;
  const acquired = await kv.set(rlKey, "1", { nx: true, ex: ALERT_COOLDOWN_SEC });
  if (!acquired) return { alerted: false, reason: "cooldown" };

  const contactLine = [phone ? `Phone: ${phone}` : null, email ? `Email: ${email}` : null].filter(Boolean).join(" · ") || "no contact info on file";
  const telPhonePaid = String(phone ?? "").replace(/[^0-9+()\-\s]/g, "");
  const summary = `🚨 URGENT: ${name} was CHARGED ${amount} but no order was created!\n${contactLine}\nStripe session: ${session?.id}\nCall them immediately — the food isn't in the kitchen queue.`;

  const jobs = [];
  jobs.push(sendEmail({
    to: STAFF_EMAILS,
    subject: `🚨 URGENT: Charged ${amount} but order failed — ${name}`,
    html: `
      <div style="font-family:sans-serif;padding:20px;background:#fdecea;border:3px solid #b91c1c;border-radius:10px;max-width:520px;">
        <h2 style="color:#b91c1c;margin:0 0 12px;">Payment succeeded but the order failed to save</h2>
        <p style="margin:0 0 6px;">The customer <strong>${escapeHtml(name)}</strong> was charged <strong>${escapeHtml(amount)}</strong> — Stripe confirms it — but something broke building the order record. It will not appear on any kitchen screen.</p>
        <p style="margin:0 0 6px;"><strong>Contact:</strong> ${escapeHtml(contactLine)}</p>
        <p style="margin:0 0 6px;"><strong>Stripe session:</strong> ${escapeHtml(String(session?.id ?? ""))}</p>
        <p style="margin:0 0 12px;"><strong>Error:</strong> ${escapeHtml(String(error?.message ?? "unknown").slice(0, 400))}</p>
        ${telPhonePaid ? `<a href="tel:${telPhonePaid}" style="display:inline-block;background:#b91c1c;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:700;">Call ${escapeHtml(phone)}</a>` : ""}
      </div>`,
  }));
  jobs.push(sendStaffSMS(summary.slice(0, 1550)));

  await Promise.allSettled(jobs);
  return { alerted: true };
}
