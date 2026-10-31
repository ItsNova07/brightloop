import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signup } from "../../api/api.js";
import { useAuth } from "../../auth/AuthContext.jsx";
import { Button, FormField } from "../../components";
import { AuthLayout } from "./AuthLayout.jsx";
import { PasswordField } from "./PasswordField.jsx";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Sign up creates a customer account. Staff accounts are created by an admin.
export function Signup() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  function validate() {
    const next = {};
    if (!form.name.trim()) next.name = "Enter your name.";
    if (!EMAIL_PATTERN.test(form.email)) next.email = "Enter a valid email, like name@company.com.";
    if (form.password.length < 8) next.password = "Use at least 8 characters.";
    if (form.confirm !== form.password) next.confirm = "Passwords don't match.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setServerError("");
    if (!validate()) return;
    setSubmitting(true);
    try {
      await signup({ name: form.name.trim(), email: form.email.trim(), password: form.password });
      try {
        await login(form.email.trim(), form.password);
        navigate("/portal", { replace: true });
      } catch {
        navigate("/login", { replace: true });
      }
    } catch (err) {
      setServerError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      description="See your subscriptions and pay invoices online."
      footer={
        <p>
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {serverError && (
          <p className="form-alert" role="alert">
            {serverError}
          </p>
        )}
        <FormField label="Full name" autoComplete="name" value={form.name} onChange={update("name")} error={errors.name} required />
        <FormField label="Email" type="email" autoComplete="email" value={form.email} onChange={update("email")} error={errors.email} required />
        <PasswordField
          label="Password"
          autoComplete="new-password"
          hint="At least 8 characters."
          value={form.password}
          onChange={update("password")}
          error={errors.password}
          required
        />
        <PasswordField
          label="Confirm password"
          autoComplete="new-password"
          value={form.confirm}
          onChange={update("confirm")}
          error={errors.confirm}
          required
        />
        <Button type="submit" size="lg" loading={submitting}>
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
