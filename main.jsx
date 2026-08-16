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

// Prevent iOS Safari pinch-to-zoom gestures and double-tap zoom that disrupt layout
if (typeof document !== "undefined") {
  document.addEventListener("gesturestart", (e) => e.preventDefault(), { passive: false });
  document.addEventListener("dblclick", (e) => {
    // Only prevent double click zoom on buttons, inputs, and interactive surfaces
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

const path = window.location.pathname.replace(/\/+$/, "") || "/";
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
