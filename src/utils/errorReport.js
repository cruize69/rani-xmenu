// ── Client-side hook into the instant "customer is stuck" alert system ──
// See lib/errorAlerts.js on the server for what actually happens with
// these reports. This file only ever fires-and-forgets a small POST —
// it must never itself throw or block the UI it's reporting on.

import { captureClientError } from "./sentryClient.js";

const DRAFT_ID_KEY = "rani_draft_id";

function getDraftId() {
  try {
    return localStorage.getItem(DRAFT_ID_KEY) || null;
  } catch {
    return null;
  }
}

export function reportError(source, message, context = {}) {
  try {
    captureClientError(message, { source, ...context }); // general tracking (Sentry, if configured) — independent of the alert below
    const draftId = getDraftId();
    if (!draftId) return; // nothing to correlate an instant alert to
    fetch("/api/report-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draftId, source, message: String(message).slice(0, 500), context }),
      keepalive: true, // survives a navigation/redirect that's about to happen (e.g. Stripe redirect failing)
    }).catch(() => {});
  } catch {}
}

// Global safety net — catches anything not explicitly wrapped elsewhere.
// Tagged "client-runtime" so it's clearly distinct from the deliberate
// checkout-path reports (source: "checkout", "create-checkout", etc.)
// which are the ones that actually matter most for the callback workflow.
export function installGlobalErrorReporting() {
  if (typeof window === "undefined") return;
  window.addEventListener("error", e => {
    reportError("client-runtime", e?.error?.message || e?.message || "Unknown script error", {
      filename: e?.filename ?? "",
      line: e?.lineno ?? "",
    });
  });
  window.addEventListener("unhandledrejection", e => {
    reportError("client-runtime", e?.reason?.message || String(e?.reason) || "Unhandled promise rejection", {});
  });
}
