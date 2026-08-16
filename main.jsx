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

// Zoom handling: deliberately just the passive viewport meta tag
// (index.html) now — no JS-based gesture interception here at all.
//
// Three attempts in this file all tried to fight or "fix" pinch-zoom with
// custom JS (gesturestart interception, then a blanket 2-finger touchmove
// block, then a visualViewport-driven auto-reset), and each one was
// reported as making the actual problem WORSE — culminating in "even
// harder to get back to normal state." The likely reason: gesturestart
// fires at the start of ANY pinch, including the pinch someone uses to
// recover from an existing zoom — unconditionally preventDefault-ing it
// doesn't just fail to stop zooming in, it can block the zoom-OUT
// recovery gesture too, which is a worse trap than doing nothing.
//
// None of those attempts were ever verified against real iOS Safari —
// only against a desktop browser automation tool that doesn't run
// WebKit's actual touch/gesture/zoom engine, which is exactly why each
// one shipped looking "fixed" and wasn't. Rather than add a fourth
// unverified guess, this backs out to the one thing that can't make
// recovery harder: nothing here blocks iOS's own native double-tap-to-
// reset or native pinch-back-out, because nothing here touches gestures
// at all anymore. If pinch-zoom-IN still happens, that's a real, well-
// documented iOS limitation (Apple has kept it available since iOS 10
// specifically for accessibility, regardless of what a page requests) —
// but the platform's own built-in way out should now be unobstructed.
if (typeof document !== "undefined") {
  document.addEventListener("dblclick", (e) => {
    // Only prevent double click zoom on buttons, inputs, and interactive
    // surfaces — a synthesized mouse dblclick, not the native touch
    // double-tap-to-reset-zoom gesture, so this doesn't interfere with
    // recovery the way gesturestart interception did.
    if (e.target.closest && (e.target.closest("button") || e.target.closest("a") || e.target.closest("input"))) {
      e.preventDefault();
    }
  }, { passive: false });
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
