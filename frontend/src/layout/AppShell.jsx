import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar.jsx";
import { TopBar } from "./TopBar.jsx";

// Sidebar + top bar around every logged-in page.
// Pages render where <Outlet /> is.
export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  // Close the mobile menu whenever the page changes.
  useEffect(() => setMenuOpen(false), [location.pathname]);

  return (
    <div className="shell">
      <Sidebar open={menuOpen} onNavigate={() => setMenuOpen(false)} />
      {menuOpen && <div className="shell-scrim" onClick={() => setMenuOpen(false)} aria-hidden="true" />}
      <div className="shell-main">
        <TopBar menuOpen={menuOpen} onToggleMenu={() => setMenuOpen((open) => !open)} />
        <main className="shell-content" id="main">
          {/* Keyed by path so each page plays its short entrance */}
          <div key={location.pathname} className="page-enter">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
