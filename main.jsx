import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import RaniMahal from "./RaniMahal.jsx";
import StaffGate from "./StaffGate.jsx";

// Order confirmation is public — Stripe's success_url redirects here.
const OrderSuccess = lazy(() => import("./OrderSuccess.jsx"));

// Internal tools — code-split so their JS never ships to customer visits,
// and gated behind StaffGate (see StaffGate.jsx for why).
const OrderManager   = lazy(() => import("./OrderManager.jsx"));
const KitchenDisplay = lazy(() => import("./KitchenDisplay.jsx"));
const ImageManager   = lazy(() => import("./ImageManager.jsx"));
const SalesDashboard = lazy(() => import("./SalesDashboard.jsx"));

const ROUTES = {
  "/order-success": () => <OrderSuccess />,
  "/manager":   () => <StaffGate><OrderManager /></StaffGate>,
  "/kitchen":   () => <StaffGate><KitchenDisplay /></StaffGate>,
  "/images":    () => <StaffGate><ImageManager /></StaffGate>,
  "/dashboard": () => <StaffGate><SalesDashboard /></StaffGate>,
};

const path = window.location.pathname.replace(/\/+$/, "") || "/";
const renderRoute = ROUTES[path];

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Suspense fallback={null}>
      {renderRoute ? renderRoute() : <RaniMahal />}
    </Suspense>
  </React.StrictMode>
);
