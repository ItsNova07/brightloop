import { MOCK } from "../api/api.js";
import { Logo } from "./Sidebar.jsx";

// Only shows the menu button and logo on small screens.
// On every screen it shows which backend areas are still using mock data,
// so nobody demos fake numbers by accident.
export function TopBar({ menuOpen, onToggleMenu }) {
  const mocked = Object.entries(MOCK)
    .filter(([, isMock]) => isMock)
    .map(([area]) => area);

  return (
    <header className="topbar">
      <button
        type="button"
        className="icon-btn topbar-menu"
        onClick={onToggleMenu}
        aria-expanded={menuOpen}
        aria-label={menuOpen ? "Close menu" : "Open menu"}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
          {menuOpen ? (
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          ) : (
            <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          )}
        </svg>
      </button>
      <span className="topbar-logo">
        <Logo />
      </span>

      {mocked.length > 0 && (
        <p className="mock-note" title="Set these to false in src/api/api.js once the backend is ready">
          Sample data: {mocked.join(", ")}
        </p>
      )}
    </header>
  );
}
