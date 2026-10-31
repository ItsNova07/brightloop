import { useState } from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "../../api/api.js";
import { Button, FormField } from "../../components";
import { AuthLayout } from "./AuthLayout.jsx";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (!email) {
      setError("Enter the email you log in with.");
      return;
    }
    setSubmitting(true);
    try {
      await forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Reset your password"
      description={sent ? null : "We'll email you a link to set a new password."}
      footer={
        <p>
          <Link to="/login">Back to log in</Link>
        </p>
      }
    >
      {sent ? (
        <p className="form-alert form-alert-success" role="status">
          If {email} has an account, a reset link is on its way. Check your inbox.
        </p>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {error && (
            <p className="form-alert" role="alert">
              {error}
            </p>
          )}
          <FormField label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Button type="submit" size="lg" loading={submitting}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
