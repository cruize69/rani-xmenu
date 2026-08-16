// ── Lightweight GA4 wrapper ──────────────────────────────────────
// Free (Vercel's own Web Analytics bills per-project on Pro; GA4 doesn't).
// A no-op everywhere until VITE_GA_MEASUREMENT_ID is set, so local dev and
// any preview deploy without the env var never loads or calls anything.

const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || null;
let loaded = false;

// Cookie consent — separate domain from ranimahal.cc (the marketing site),
// so a choice made there can never be read here: cookies/localStorage are
// scoped per-origin by the browser, and .cc/.food aren't subdomains of a
// shared parent that could carry a decision across. This site needs its
// own gate for the same reason the marketing site needs one — GA4 below
// is the same category of tracking either way.
const CONSENT_KEY = "rani_cookie_consent"; // "granted" | "denied" | unset

export function getConsent() {
  try { return localStorage.getItem(CONSENT_KEY); } catch { return null; }
}

export function setConsent(value) {
  try { localStorage.setItem(CONSENT_KEY, value); } catch {}
}

function ensureLoaded() {
  if (!GA_ID || loaded || typeof document === "undefined") return;
  if (getConsent() !== "granted") return; // no consent yet (or declined) — never loads GA
  loaded = true;
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", GA_ID, { send_page_view: true });
}

export function trackEvent(name, params = {}) {
  if (!GA_ID) return;
  ensureLoaded();
  window.gtag?.("event", name, params);
}

// Captures utm_* params from the current URL on first load and persists
// them for the lifetime of this browser session, so a customer who lands
// from a marketing-site link and browses for a while before ordering still
// gets attributed correctly at checkout.
const UTM_KEY = "rm_utm_attribution";
const UTM_PARAMS = ["utm_source", "utm_medium", "utm_campaign"];

export function captureUtmFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const found = {};
    let any = false;
    for (const key of UTM_PARAMS) {
      const v = params.get(key);
      if (v) { found[key] = v.slice(0, 100); any = true; }
    }
    if (any) sessionStorage.setItem(UTM_KEY, JSON.stringify(found));
  } catch {}
}

export function getStoredUtm() {
  try {
    const raw = sessionStorage.getItem(UTM_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
