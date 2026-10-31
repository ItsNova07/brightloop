import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";
import { StateMessage } from "../components";
import { homePathFor } from "../layout/menu.js";

// Guards a route.
//   <RequireRole roles={["admin", "staff"]}><Customers /></RequireRole>
// Not logged in → sent to /login (and brought back after).
// Wrong role   → sent to their own home page.
export function RequireRole({ roles, children }) {
  const { user, role, ready } = useAuth();
  const location = useLocation();

  if (!ready) return <StateMessage kind="loading" message="Checking your login…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(role)) return <Navigate to={homePathFor(role)} replace />;
  return children;
}
