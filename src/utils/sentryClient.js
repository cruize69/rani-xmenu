// ── Client-side Sentry — mirrors lib/sentry.js's server-side pattern ──
// No-op until VITE_SENTRY_DSN is set.

import * as Sentry from "@sentry/react";

const DSN = import.meta.env.VITE_SENTRY_DSN || null;
let initialized = false;

export function initSentryClient() {
  if (!DSN || initialized) return;
  Sentry.init({ dsn: DSN, tracesSampleRate: 0 });
  initialized = true;
}

export function captureClientError(err, context = {}) {
  if (!DSN) return;
  initSentryClient();
  Sentry.captureException(err instanceof Error ? err : new Error(String(err)), { extra: context });
}
