// ── Server-side Sentry — general error tracking/dashboard (Layer 1) ──
// Distinct from lib/errorAlerts.js (Layer 2, the instant "call this
// customer back" SMS/email workflow). This is for reviewing what actually
// broke, with stack traces, over time — Sentry's free tier (5k events/mo)
// covers this without hand-building a log viewer.
//
// A no-op everywhere until SENTRY_DSN is set, exactly like the existing
// Twilio/Resend graceful-degradation pattern in lib/notifications.js — so
// this can ship now and just start working the moment the env var is added.

import * as Sentry from "@sentry/node";

let initialized = false;

function ensureInit() {
  if (initialized || !process.env.SENTRY_DSN) return;
  Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0, environment: process.env.VERCEL_ENV || "development" });
  initialized = true;
}

export function captureServerError(err, context = {}) {
  console.error(err); // always log regardless of Sentry being configured
  if (!process.env.SENTRY_DSN) return;
  ensureInit();
  Sentry.captureException(err, { extra: context });
}
