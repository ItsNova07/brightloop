import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext.jsx";
import { RequireRole } from "./auth/RequireRole.jsx";
import { AppShell } from "./layout/AppShell.jsx";
import { homePathFor, NAV_ITEMS } from "./layout/menu.js";
import { StateMessage } from "./components";

import { Login } from "./pages/auth/Login.jsx";
import { Signup } from "./pages/auth/Signup.jsx";
import { ForgotPassword } from "./pages/auth/ForgotPassword.jsx";
import { ResetPassword } from "./pages/auth/ResetPassword.jsx";
import { Dashboard } from "./pages/Dashboard.jsx";
import { Customers } from "./pages/Customers.jsx";
import { Staff } from "./pages/Staff.jsx";
import { Account } from "./pages/Account.jsx";
import { Plans } from "./pages/Plans.jsx";
import { PlansAndPayment } from "./pages/portal/PlansAndPayment.jsx";
import { Subscriptions, Quotations, Invoices, Payments, Discounts, MySubscriptions, MyInvoices } from "./pages/OperationalPages.jsx";
import { NotFound } from "./pages/Placeholder.jsx";

// ------------------------------------------------------------------
// Path → page. Teammates: when your page is ready, import it above
// and replace its <Placeholder /> here. Permissions come from menu.js.
// ------------------------------------------------------------------
const PAGES = {
  "/dashboard": <Dashboard />,
  "/subscriptions": <Subscriptions />,
  "/plans": <Plans />,
  "/quotations": <Quotations />,
  "/invoices": <Invoices />,
  "/payments": <Payments />,
  "/discounts": <Discounts />,
  "/customers": <Customers />,
  "/staff": <Staff />,
  "/portal": <MySubscriptions />,
  "/portal/plans": <PlansAndPayment />,
  "/portal/invoices": <MyInvoices />,
  "/account": <Account />,
};

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route
        element={
          <RequireRole>
            <AppShell />
          </RequireRole>
        }
      >
        {NAV_ITEMS.map((item) => (
          <Route
            key={item.path}
            path={item.path}
            element={<RequireRole roles={item.roles}>{PAGES[item.path] ?? <NotFound />}</RequireRole>}
          />
        ))}
        {/* Old address for the customer profile, now part of My account */}
        <Route path="/portal/profile" element={<Navigate to="/account" replace />} />
        <Route path="/" element={<HomeRedirect />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

function HomeRedirect() {
  const { role, ready } = useAuth();
  if (!ready) return <StateMessage kind="loading" />;
  return <Navigate to={homePathFor(role)} replace />;
}
