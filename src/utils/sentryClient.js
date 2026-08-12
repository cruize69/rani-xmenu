// ── Client-side Sentry — mirrors lib/sentry.js's server-side pattern ──
// No-op until VITE_SENTRY_DSN is set.
//
// Loaded via dynamic import, NOT a static one. A static `import * as Sentry`
// put the whole SDK in the entry chunk: 373KB -> 462KB (+87KB raw, ~+30KB
// gzipped) on the critical path of a mobile ordering site, in exchange for
// telemetry that is by definition not needed until something breaks. It now
// lives in its own chunk, fetched once the page is idle.
//
// @sentry/browser rather than @sentry/react: the only API used here is
// init + captureException, and the React-specific package additionally
// pulls in an ErrorBoundary component and profiler this app doesn't use
// (RaniMahal.jsx has its own ErrorBoundary, which already reports).

const DSN = import.meta.env.VITE_SENTRY_DSN || null;

let sentryPromise = null;
const queued = [];

function load() {
  if (!DSN) return null;
  if (!sentryPromise) {
    sentryPromise = import("@sentry/browser")
      .then(Sentry => {
        Sentry.init({ dsn: DSN, tracesSampleRate: 0 });
        // Flush anything that errored before the SDK finished loading.
        while (queued.length) {
          const { err, context } = queued.shift();
          Sentry.captureException(err, { extra: context });
        }
        return Sentry;
      })
      .catch(e => {
        console.error("Sentry failed to load:", e);
        queued.length = 0; // don't grow unbounded if the chunk never arrives
        return null;
      });
  }
  return sentryPromise;
}

// Intentionally does NOT preload the SDK. Even lazily, @sentry/browser is
// ~153KB gzipped — not something to push to every diner on mobile data for
// telemetry that only matters once something breaks. Instant alerting is
// already handled by the near-zero-cost /api/report-error path; Sentry here
// is the debugging dashboard, so it loads on the first actual error.
// The tradeoff, stated plainly: no breadcrumb trail from before that first
// error. The exception, stack, and explicit context still come through.
export function initSentryClient() {
  /* no-op by design — see above. Kept as the documented entry point so the
     boot sequence in main.jsx reads honestly. */
}

export function captureClientError(err, context = {}) {
  if (!DSN) return;
  const error = err instanceof Error ? err : new Error(String(err));
  // Cap the pre-load queue — an error loop before the SDK arrives shouldn't
  // pin unbounded memory.
  if (queued.length < 20) queued.push({ err: error, context });
  load();
}
