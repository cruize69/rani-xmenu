import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import RaniMahal, { ErrorBoundary } from "./RaniMahal.jsx";
import StaffGate from "./StaffGate.jsx";
import { captureUtmFromUrl } from "./src/utils/analytics.js";
import { installGlobalErrorReporting } from "./src/utils/errorReport.js";
import { initSentryClient } from "./src/utils/sentryClient.js";
import { CookieConsentBanner } from "./src/components/CookieConsentBanner.jsx";

// No-op until VITE_SENTRY_DSN is set — see src/utils/sentryClient.js.
initSentryClient();

// Capture ?utm_source= etc. once at boot, before RaniMahal.jsx's own effects
// strip other query params — this only reads, never mutates the URL, so it
// has no ordering dependency on anything else that touches location.search.
captureUtmFromUrl();

// Catches any unhandled JS error/rejection anywhere on the ordering site —
// see lib/errorAlerts.js for what happens with it server-side.
installGlobalErrorReporting();

// Prevent iOS Safari pinch-to-zoom, and — the part that actually matters —
// guarantee it's never a one-way trip if a pinch gets through anyway.
//
// Full prevention isn't something any web page can 100% guarantee on
// modern iOS: Apple has deliberately kept pinch-zoom available since iOS
// 10 even when a page sets user-scalable=no, specifically for
// accessibility, and `gesturestart` is a legacy WebKit-only event that
// doesn't fire for every pinch. A previous attempt here tried hard-
// blocking every 2-finger touchmove unconditionally — that's not
// verifiably effective at stopping the INITIAL zoom (native pinch
// recognition can begin above the level JS touch handlers see), and it
// actively made things worse: once a zoom had already started, the same
// blanket block also swallowed the pinch-OUT gesture someone would use to
// undo it, which is what "stuck, can't get back out" actually was.
//
// So the strategy here is recovery, not prevention: gesturestart/dblclick
// stay as a soft first layer, but the real fix is watching
// window.visualViewport for an actual zoomed-in scale and snapping it
// back to 1.0 the moment a gesture ends — never fighting an in-progress
// pinch (which would feel broken and janky), only cleaning up
// immediately after. The reset itself is the standard iOS trick: toggling
// the viewport meta's user-scalable value forces Safari to recompute and
// drop back to scale 1, then it's restored to "no" on the next frame.
if (typeof document !== "undefined") {
  document.addEventListener("gesturestart", (e) => e.preventDefault(), { passive: false });
  document.addEventListener("dblclick", (e) => {
    // Only prevent double click zoom on buttons, inputs, and interactive surfaces
    if (e.target.closest && (e.target.closest("button") || e.target.closest("a") || e.target.closest("input"))) {
      e.preventDefault();
    }
  }, { passive: false });

  const resetIOSZoom = () => {
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return;
    const original = meta.getAttribute("content");
    if (!original || !original.includes("user-scalable=no")) return;
    meta.setAttribute("content", original.replace("user-scalable=no", "user-scalable=yes"));
    requestAnimationFrame(() => meta.setAttribute("content", original));
  };

  if (window.visualViewport) {
    const maybeReset = () => {
      // >1.02 (not >1) — visualViewport.scale carries float rounding noise
      // even at "normal" zoom, so a hair-trigger threshold would reset on
      // every legitimate resize (keyboard opening, orientation change).
      if (window.visualViewport.scale > 1.02) resetIOSZoom();
    };
    // Fires after the gesture is actually over, not mid-pinch — this is
    // what makes the reset feel like "it snapped back," not "it fought me."
    document.addEventListener("touchend", maybeReset, { passive: true });
    document.addEventListener("gestureend", maybeReset, { passive: true });
  }
}

// Order confirmation is public — Stripe's success_url redirects here.
const OrderSuccess = lazy(() => import("./OrderSuccess.jsx"));

// Rani Royal Club explainer — public and linkable so the program can be
// pointed at from receipts, Google Business, and social. Previously its
// mechanics were only visible after signing in, so nothing could link to it.
const Rewards = lazy(() => import("./Rewards.jsx"));

// Catering lead capture — public, linkable. Genuinely a phone/quote
// business (see Catering.jsx), so this is a lead form, not a checkout.
const Catering = lazy(() => import("./Catering.jsx"));

// Privacy/Terms are NOT SPA routes — vercel.json rewrites /privacy and
// /terms straight to static public/privacy.html and public/terms.html
// BEFORE the catch-all SPA rewrite ever sees them. That's deliberate: a
// client-rendered route here means the raw HTTP response for a Twilio/TCR
// carrier-review crawler (which typically does not execute JS) is an empty
// <div id="root"></div> with zero policy text and a generic "Order Online"
// title indistinguishable from the homepage — a real rejection cause
// ("a compliant privacy policy can not be verified"), independent of
// whether the actual required clauses are correct. Static HTML guarantees
// the real text is in the initial response no matter what fetches it.

// Internal tools — code-split so their JS never ships to customer visits,
// and gated behind StaffGate (see StaffGate.jsx for why).
const OrderManager     = lazy(() => import("./OrderManager.jsx"));
const KitchenDisplay   = lazy(() => import("./KitchenDisplay.jsx"));
const TvKitchenDisplay = lazy(() => import("./TvKitchenDisplay.jsx"));
const ImageManager     = lazy(() => import("./ImageManager.jsx"));
const SalesDashboard   = lazy(() => import("./SalesDashboard.jsx"));

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function MaybeClerkProvider({ children }) {
  if (!CLERK_PUBLISHABLE_KEY) return children;
  return <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>{children}</ClerkProvider>;
}

const ROUTES = {
  "/order-success": () => <MaybeClerkProvider><OrderSuccess /></MaybeClerkProvider>,
  "/rewards": () => <Rewards />,
  "/catering": () => <Catering />,
  "/manager":    () => <StaffGate><OrderManager /></StaffGate>,
  "/kitchen":    () => <StaffGate><KitchenDisplay /></StaffGate>,
  "/kitchen-tv": () => <StaffGate><TvKitchenDisplay /></StaffGate>,
  "/tv-kitchen": () => <StaffGate><TvKitchenDisplay /></StaffGate>,
  "/images":     () => <StaffGate><ImageManager /></StaffGate>,
  "/sales":      () => <StaffGate><SalesDashboard /></StaffGate>,
  "/dashboard":  () => <StaffGate><SalesDashboard /></StaffGate>,
};

// ranimahal.cc (the marketing site) reverse-proxies /order/:path* to this
// app's origin (see its next.config.ts) so the whole business lives under
// one public domain. Vercel's rewrite forwards the REQUEST with /order
// stripped (the origin here really does receive /rewards, /order-success,
// etc., exactly as before), but the BROWSER's address bar still shows the
// original /order/... URL — and this router reads window.location from
// the browser, not from what the origin was asked for. Without stripping
// the same prefix here, every proxied route would fail to match ROUTES
// and silently fall back to the home page. ranimahal.food itself (this
// app's own domain, kept alive for anything already printed/texted with
// it) never has this prefix, so stripping it only when present is safe
// for both entry points.
const rawPath = window.location.pathname.replace(/\/+$/, "") || "/";
const path = rawPath === "/order" ? "/" : rawPath.startsWith("/order/") ? rawPath.slice(6) : rawPath;
const renderRoute = ROUTES[path];

// Staff tools are already behind StaffGate's password and aren't where
// analytics consent is relevant — the banner only shows on customer-
// facing routes (home, order-success, rewards, catering).
const STAFF_PATHS = ["/manager", "/kitchen", "/kitchen-tv", "/tv-kitchen", "/images", "/sales", "/dashboard"];
const isStaffRoute = STAFF_PATHS.includes(path);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {!isStaffRoute && <CookieConsentBanner />}
    <Suspense fallback={
      <div style={{ background: "#0F0800", height: "100vh", width: "100vw", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Georgia, serif", color: "#C8853A" }}>
        Loading...
      </div>
    }>
      {renderRoute ? renderRoute() : <ErrorBoundary><MaybeClerkProvider><RaniMahal /></MaybeClerkProvider></ErrorBoundary>}
    </Suspense>
  </React.StrictMode>
);
