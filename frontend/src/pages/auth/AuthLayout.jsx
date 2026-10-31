import { useEffect, useState } from "react";
import { Logo } from "../../layout/Sidebar.jsx";

// Shared frame for login, sign up, forgot and reset password.
// Left: an animated brand panel (same motion as the OSMIC portal login,
// rebuilt in plain CSS). Right: the form, which slides in.
const NAME = "Brightloop";
const TAGLINE = "Every renewal, on time.";

export function AuthLayout({ title, description, children, footer }) {
  return (
    <div className="auth">
      <BrandPanel />
      <div className="auth-panel">
        <div className="auth-form-wrap">
          <h1 className="auth-title">{title}</h1>
          {description && <p className="auth-description">{description}</p>}
          {children}
          {footer && <div className="auth-footer">{footer}</div>}
        </div>
      </div>
    </div>
  );
}

function BrandPanel() {
  return (
    <div className="auth-art">
      <div className="auth-grid" aria-hidden="true" />
      <div className="auth-glow auth-glow-a" aria-hidden="true" />
      <div className="auth-glow auth-glow-b" aria-hidden="true" />

      <div className="auth-art-inner">
        <div className="auth-art-top">
          <Logo />
        </div>

        <div className="auth-hero">
          <p className="auth-kicker">Subscription and billing management</p>
          <p className="auth-name" aria-label={NAME}>
            {NAME.split("").map((letter, i) => (
              <span key={i} className="auth-letter" style={{ "--i": i }} aria-hidden="true">
                {letter}
              </span>
            ))}
          </p>
          <span className="auth-rule" aria-hidden="true" />
          <p className="auth-tagline">
            <Typed text={TAGLINE} />
          </p>
          <p className="auth-blurb">Subscriptions, invoices and payments for your whole team, in one place.</p>
        </div>

        <FlowLines />
      </div>
    </div>
  );
}

// Types the tagline one letter at a time after the name has settled.
// With reduced motion turned on, the full line shows straight away.
function Typed({ text }) {
  const reduceMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [count, setCount] = useState(reduceMotion ? text.length : 0);

  useEffect(() => {
    if (count >= text.length) return;
    const timer = setTimeout(() => setCount((n) => n + 1), count === 0 ? 1800 : 55);
    return () => clearTimeout(timer);
  }, [count, text]);

  return (
    <>
      <span className="visually-hidden">{text}</span>
      <span aria-hidden="true">
        {text.slice(0, count)}
        <span className="auth-caret" />
      </span>
    </>
  );
}

// Slow dashed waves with dots travelling along them, like payments moving.
const WAVES = [
  { id: "wave-a", d: "M0 70 C 120 20, 240 120, 360 70 S 600 20, 720 70", color: "var(--glow)", width: 1.5, dash: "6 10", speed: "auth-flow", opacity: 0.6 },
  { id: "wave-b", d: "M0 95 C 140 50, 260 140, 400 95 S 620 50, 720 95", color: "var(--steel)", width: 1.25, dash: "2 8", speed: "auth-flow-slow", opacity: 0.45 },
  { id: "wave-c", d: "M0 45 C 100 90, 280 0, 420 45 S 640 90, 720 45", color: "var(--owed-glow)", width: 2, dash: "14 12", speed: "auth-flow-slow", opacity: 0.75 },
];

function FlowLines() {
  return (
    <svg className="auth-waves" viewBox="0 0 720 140" preserveAspectRatio="none" aria-hidden="true">
      {WAVES.map((wave, i) => (
        <path
          key={wave.id}
          id={wave.id}
          d={wave.d}
          fill="none"
          stroke={wave.color}
          strokeWidth={wave.width}
          strokeDasharray={wave.dash}
          strokeLinecap="round"
          className={`auth-wave ${wave.speed}`}
          style={{ "--o": wave.opacity, "--d": `${0.4 + i * 0.25}s` }}
        />
      ))}
      {[0, 1, 2].map((i) => (
        <circle key={i} r="3.5" className="auth-dot" opacity="0">
          <animateMotion dur="9s" begin={`${1.5 + i * 3}s`} repeatCount="indefinite">
            <mpath href="#wave-a" />
          </animateMotion>
          <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="9s" begin={`${1.5 + i * 3}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </svg>
  );
}
