import { useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext.jsx";
import { MOCK } from "../../api/api.js";
import { DEMO_ACCOUNTS } from "../../api/mockData.js";
import { homePathFor } from "../../layout/menu.js";
import { Button, FormField, useToast } from "../../components";
import { AuthLayout } from "./AuthLayout.jsx";
import { ArrowIcon, PasswordField } from "./PasswordField.jsx";

const DEMO_PASSWORD = "demo123";
const ROLE_LABEL = { admin: "Admin", staff: "Staff", customer: "Customer" };
const SUCCESS_PAUSE = 750; // how long the loop fills before the app opens

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function Login() {
  const { user, login } = useAuth();
  const location = useLocation();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [shakeCount, setShakeCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [entering, setEntering] = useState(false);

  // Once logged in, go back to the page they were trying to open if their
  // role allows it, otherwise to their home page.
  if (user) return <Navigate to={destinationFor(user, location.state?.from)} replace />;

  function fail(message) {
    setError(message);
    setShakeCount((n) => n + 1);
    setSubmitting(false);
  }

  // Password accepted: fill the loop on the button, then open the app.
  async function playSuccess(loggedIn) {
    setEntering(true);
    toast(`Welcome back, ${loggedIn.name.split(" ")[0]}`);
    if (!prefersReducedMotion()) await wait(SUCCESS_PAUSE);
  }

  async function logIn(withEmail, withPassword) {
    setError("");
    setSubmitting(true);
    try {
      await login(withEmail, withPassword, { beforeEnter: playSuccess });
    } catch (err) {
      fail(err.message);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!email || !password) {
      fail("Enter your email and password.");
      return;
    }
    logIn(email.trim(), password);
  }

  const clearError = (setter) => (event) => {
    setter(event.target.value);
    setError("");
  };

  return (
    <AuthLayout
      title="Log in"
      description="Use the email your account was created with."
      footer={
        <p>
          New customer? <Link to="/signup">Create an account</Link>
        </p>
      }
    >
      {/* Two identical shake classes, swapped on each failed try, restart the
          animation without re-mounting the form (which would reset show/hide). */}
      <form
        className={`auth-form ${shakeCount > 0 ? `auth-form-shake-${shakeCount % 2}` : ""} ${entering ? "auth-form-done" : ""}`}
        onSubmit={handleSubmit}
        noValidate
      >
        <FormField
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={clearError(setEmail)}
          required
        />
        <PasswordField
          label="Password"
          autoComplete="current-password"
          placeholder="Your password"
          value={password}
          onChange={clearError(setPassword)}
          required
        />
        <Link to="/forgot-password" className="auth-link-right">
          Forgot password?
        </Link>
        {error && (
          <p className="form-alert" role="alert">
            {error}
          </p>
        )}
        {entering ? (
          <Button type="button" size="lg" disabled className="btn-entering" aria-live="polite">
            <SuccessLoop />
            Opening Brightloop
          </Button>
        ) : (
          <Button type="submit" size="lg" loading={submitting}>
            Log in
            {!submitting && <ArrowIcon />}
          </Button>
        )}
      </form>

      {MOCK.auth && (
        <div className="demo-box">
          <p className="demo-title">Sample data: view the app as</p>
          <div className="demo-buttons">
            {DEMO_ACCOUNTS.slice(0, 3).map((account, i) => (
              <button
                key={account.role}
                type="button"
                className="demo-account"
                style={{ "--i": i }}
                disabled={submitting}
                onClick={() => logIn(account.email, DEMO_PASSWORD)}
              >
                <span className="demo-account-role">{ROLE_LABEL[account.role]}</span>
                <span className="demo-account-name">{account.name}</span>
              </button>
            ))}
          </div>
          <p className="demo-note">
            Or type any sample email with the password <strong>{DEMO_PASSWORD}</strong>.
          </p>
        </div>
      )}
    </AuthLayout>
  );
}

function destinationFor(user, from) {
  const home = homePathFor(user.role);
  if (!from) return home;
  const fromIsTheirs = user.role === "customer" ? from.startsWith("/portal") : !from.startsWith("/portal");
  return fromIsTheirs ? from : home;
}

// A ring that fills while spinning: the "loop" closing as you log in.
function SuccessLoop() {
  return (
    <svg className="btn-success-loop" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <circle cx="9" cy="9" r="7" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2.2" />
      <circle cx="9" cy="9" r="7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
