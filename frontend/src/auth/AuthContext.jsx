import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as api from "../api/api.js";

const AuthContext = createContext(null);

// Wraps the whole app. Any component can call useAuth() to get:
//   user      → { id, name, email, role } or null
//   role      → "admin" | "staff" | "customer" | null
//   ready     → false while we check a saved login on page load
//   login(email, password, { beforeEnter }), logout(), updateUser(changes)
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  // On first load, if a token was saved, ask the backend who it belongs to.
  useEffect(() => {
    if (!api.tokenStore.get()) {
      setReady(true);
      return;
    }
    api
      .getCurrentUser()
      .then(setUser)
      .catch(() => api.tokenStore.clear())
      .finally(() => setReady(true));
  }, []);

  // api.js fires this when the backend answers 401 (token expired).
  useEffect(() => {
    const handleLoggedOut = () => setUser(null);
    window.addEventListener("brightloop:logged-out", handleLoggedOut);
    return () => window.removeEventListener("brightloop:logged-out", handleLoggedOut);
  }, []);

  // beforeEnter (optional) runs after the password is accepted but before the
  // app switches to the logged-in view, so the login screen can finish an
  // animation first.
  const login = useCallback(async (email, password, { beforeEnter } = {}) => {
    const { token } = await api.login(email, password);
    api.tokenStore.set(token);
    const current = await api.getCurrentUser();
    if (beforeEnter) await beforeEnter(current);
    setUser(current);
    return current;
  }, []);

  const logout = useCallback(() => {
    api.tokenStore.clear();
    setUser(null);
  }, []);

  // After the user edits their own details, refresh what the app shows.
  const updateUser = useCallback((changes) => setUser((current) => (current ? { ...current, ...changes } : current)), []);

  const value = useMemo(
    () => ({ user, role: user?.role ?? null, ready, login, logout, updateUser }),
    [user, ready, login, logout, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
