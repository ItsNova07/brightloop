import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { resetPassword } from "../../api/api.js";
import { Button, useToast } from "../../components";
import { AuthLayout } from "./AuthLayout.jsx";
import { PasswordField } from "./PasswordField.jsx";

// The email link should point to /reset-password?token=...
export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const navigate = useNavigate();
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setServerError("");
    const next = {};
    if (password.length < 8) next.password = "Use at least 8 characters.";
    if (confirm !== password) next.confirm = "Passwords don't match.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      await resetPassword(token, password);
      toast("Password updated. Log in with your new password.");
      navigate("/login", { replace: true });
    } catch (err) {
      setServerError(err.message);
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <AuthLayout title="This link doesn't work" description="The reset link is missing its code. Request a new one.">
        <Link to="/forgot-password" className="btn btn-primary btn-lg">
          Request a new link
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Choose a new password"
      footer={
        <p>
          <Link to="/login">Back to log in</Link>
        </p>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {serverError && (
          <p className="form-alert" role="alert">
            {serverError}
          </p>
        )}
        <PasswordField
          label="New password"
          autoComplete="new-password"
          hint="At least 8 characters."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          required
        />
        <PasswordField
          label="Confirm new password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={errors.confirm}
          required
        />
        <Button type="submit" size="lg" loading={submitting}>
          Save new password
        </Button>
      </form>
    </AuthLayout>
  );
}
