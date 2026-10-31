import { useLayoutEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { ACCOUNT_PATH, menuFor } from "./menu.js";

export function Logo() {
  return (
    <span className="logo">
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
        <circle cx="11" cy="11" r="8" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
        <path d="M11 3a8 8 0 1 1-7.6 5.5" fill="none" stroke="var(--teal)" strokeWidth="3" strokeLinecap="round" />
      </svg>
      Brightloop
    </span>
  );
}

export function Sidebar({ open, onNavigate }) {
  const { user, role, logout } = useAuth();
  const sections = menuFor(role);
  const indicator = useSlidingIndicator();
  let linkIndex = 0;

  return (
    <aside className={`sidebar ${open ? "sidebar-open" : ""}`} aria-label="Main navigation">
      <div className="sidebar-brand">
        <Logo />
      </div>

      <nav className="sidebar-nav" ref={indicator.navRef}>
        <span className={indicator.className} style={indicator.style} aria-hidden="true" />
        {sections.map((section) => (
          <div key={section.label} className="nav-section">
            <p className="nav-section-label" style={{ "--i": linkIndex++ }}>
              {section.label}
            </p>
            <ul>
              {section.items.map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    end
                    onClick={onNavigate}
                    style={{ "--i": linkIndex++ }}
                    className={({ isActive }) => `nav-link ${isActive ? "nav-link-active" : ""}`}
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="sidebar-user">
        <NavLink
          to={ACCOUNT_PATH}
          onClick={onNavigate}
          className={({ isActive }) => `sidebar-account ${isActive ? "sidebar-account-active" : ""}`}
          aria-label={`My account: ${user?.name}`}
        >
          <span className="avatar" aria-hidden="true">
            {initials(user?.name)}
          </span>
          <span className="sidebar-user-text">
            <span className="sidebar-user-name">{user?.name}</span>
            <span className="sidebar-user-role">{capitalise(role)}</span>
          </span>
          <svg className="sidebar-account-chevron" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </NavLink>
        <button type="button" className="sidebar-logout" onClick={logout}>
          Log out
        </button>
      </div>
    </aside>
  );
}

// Measures the active link and moves one highlight behind it, so the
// highlight slides between links instead of jumping. It skips the slide on
// first paint, so the page doesn't open with a highlight flying into place.
function useSlidingIndicator() {
  const navRef = useRef(null);
  const { pathname } = useLocation();
  const [box, setBox] = useState(null);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const nav = navRef.current;
    const active = nav?.querySelector(".nav-link-active");
    if (!active) {
      setBox(null);
      return;
    }
    setBox({ top: active.offsetTop, height: active.offsetHeight });
    if (!ready) requestAnimationFrame(() => setReady(true));
  }, [pathname, ready]);

  return {
    navRef,
    className: `nav-indicator ${box ? "nav-indicator-visible" : ""} ${ready ? "nav-indicator-ready" : ""}`,
    style: box ? { transform: `translateY(${box.top}px)`, height: box.height } : undefined,
  };
}

function initials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

const capitalise = (text = "") => text.charAt(0).toUpperCase() + text.slice(1);
