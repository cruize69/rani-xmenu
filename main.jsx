import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import RaniMahal, { ErrorBoundary } from "./RaniMahal.jsx";
import StaffGate from "./StaffGate.jsx";
import { captureUtmFromUrl } from "./src/utils/analytics.js";
import { installGlobalErrorReporting } from "./src/utils/errorReport.js";
import { initSentryClient } from "./src/utils/sentryClient.js";

// No-op until VITE_SENTRY_DSN is set — see src/utils/sentryClient.js.
initSentryClient();

// Capture ?utm_source= etc. once at boot, before RaniMahal.jsx's own effects
// strip other query params — this only reads, never mutates the URL, so it
// has no ordering dependency on anything else that touches location.search.
captureUtmFromUrl();

// Catches any unhandled JS error/rejection anywhere on the ordering site —
// see lib/errorAlerts.js for what happens with it server-side.
installGlobalErrorReporting();

// Order confirmation is public — Stripe's success_url redirects here.
const OrderSuccess = lazy(() => import("./OrderSuccess.jsx"));

// Rani Royal Club explainer — public and linkable so the program can be
// pointed at from receipts, Google Business, and social. Previously its
// mechanics were only visible after signing in, so nothing could link to it.
const Rewards = lazy(() => import("./Rewards.jsx"));

// Privacy/Terms — public, linked from checkout SMS consent + A2P registration.
const PrivacyPolicy  = lazy(() => import("./Legal.jsx").then(m => ({ default: m.PrivacyPolicy })));
const TermsOfService = lazy(() => import("./Legal.jsx").then(m => ({ default: m.TermsOfService })));

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
  "/privacy": () => <PrivacyPolicy />,
  "/terms":   () => <TermsOfService />,
  "/rewards": () => <Rewards />,
  "/club":    () => <Rewards />,
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

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Suspense fallback={
      <div style={{ background: "#0F0800", height: "100vh", width: "100vw", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Georgia, serif", color: "#C8853A" }}>
        Loading...
      </div>
    }>
      {renderRoute ? renderRoute() : <ErrorBoundary><MaybeClerkProvider><RaniMahal /></MaybeClerkProvider></ErrorBoundary>}
    </Suspense>
  </React.StrictMode>
);
