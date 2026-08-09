import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import RaniMahal, { ErrorBoundary } from "./RaniMahal.jsx";
import StaffGate from "./StaffGate.jsx";

// Order confirmation is public — Stripe's success_url redirects here.
const OrderSuccess = lazy(() => import("./OrderSuccess.jsx"));

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
    <Suspense fallback={null}>
      {renderRoute ? renderRoute() : <ErrorBoundary><MaybeClerkProvider><RaniMahal /></MaybeClerkProvider></ErrorBoundary>}
    </Suspense>
  </React.StrictMode>
);
