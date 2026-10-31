import { useEffect, useState } from "react";
import { getMyCustomerProfile, updateMe, updateMyCustomerProfile } from "../api/api.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { useApi } from "../hooks/useApi.js";
import { Button, Card, FormField, PageHeader, StateMessage, StatusBadge, useToast } from "../components";

const ROLE_TEXT = {
  admin: "You can manage everything, including staff accounts.",
  staff: "You can manage customers, subscriptions and billing.",
  customer: "You can see your subscriptions, invoices and billing details.",
};

// My account: the same page for every role. Opened from the name at the
// bottom of the sidebar. Customers also get their billing details here.
export function Account() {
  const { user, role, logout } = useAuth();

  return (
    <>
      <PageHeader title="My account" description="Your login details." />
      <div className="account">
        <Card className="account-summary">
          <div className="account-avatar" aria-hidden="true">
            {initials(user.name)}
          </div>
          <div className="account-identity">
            <h2 className="account-name">{user.name}</h2>
            <p className="account-email">{user.email}</p>
            <div className="account-role">
              <StatusBadge status={role} />
              <span>{ROLE_TEXT[role]}</span>
            </div>
          </div>
          <Button variant="secondary" onClick={logout} className="account-logout">
            Log out
          </Button>
        </Card>

        <YourDetails />
        {role === "customer" && <BillingDetails />}
      </div>
    </>
  );
}

function YourDetails() {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user.name);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const unchanged = name.trim() === user.name;

  async function handleSubmit(event) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Enter your name.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const updated = await updateMe({ name: name.trim() });
      updateUser({ name: updated.name });
      toast("Name updated");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Your details" description="Your name appears in the sidebar and on actions you take.">
      <form className="form-grid" onSubmit={handleSubmit} noValidate>
        <FormField label="Name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={error} />
        <FormField label="Email" value={user.email} disabled hint="Ask an admin to change the email you log in with." />
        <div className="span-2">
          <Button type="submit" loading={saving} disabled={unchanged}>
            Save name
          </Button>
        </div>
      </form>
    </Card>
  );
}

// Customers only: the details printed on their invoices.
function BillingDetails() {
  const toast = useToast();
  const { data, loading, error, reload } = useApi(() => getMyCustomerProfile(), []);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (data) setForm({ phone: "", company: "", address: "", ...data });
  }, [data]);

  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setSaveError("");
    try {
      await updateMyCustomerProfile({
        phone: form.phone.trim(),
        company: form.company.trim(),
        address: form.address.trim(),
      });
      toast("Billing details saved");
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Billing details" description="These appear on your invoices.">
      {loading || (!form && !error) ? (
        <StateMessage kind="loading" />
      ) : error ? (
        <StateMessage kind="error" message={error.message} onRetry={reload} />
      ) : (
        <form className="form-grid" onSubmit={handleSubmit} noValidate>
          {saveError && (
            <p className="form-alert span-2" role="alert">
              {saveError}
            </p>
          )}
          <FormField label="Company" value={form.company} onChange={update("company")} />
          <FormField label="Phone" type="tel" value={form.phone} onChange={update("phone")} />
          <FormField as="textarea" label="Billing address" value={form.address} onChange={update("address")} className="span-2" />
          <div className="span-2">
            <Button type="submit" loading={saving}>
              Save billing details
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}

function initials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}
