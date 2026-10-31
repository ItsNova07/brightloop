import { useState } from "react";
import { createStaff, getUsers } from "../api/api.js";
import { useApi } from "../hooks/useApi.js";
import { Button, Card, FormField, Modal, PageHeader, StatusBadge, Table, useToast } from "../components";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const columns = [
  { key: "name", header: "Name", render: (row) => <span className="cell-strong">{row.name}</span> },
  { key: "email", header: "Email" },
  { key: "role", header: "Role", render: (row) => <StatusBadge status={row.role} /> },
];

// Admin only: see team accounts and add staff.
export function Staff() {
  const { data, loading, error, reload, setData } = useApi(() => getUsers(), []);
  const [adding, setAdding] = useState(false);
  const toast = useToast();
  const team = (data || []).filter((user) => user.role !== "customer");

  return (
    <>
      <PageHeader
        title="Staff"
        description="People who can manage billing. Customers sign up on their own."
        actions={<Button onClick={() => setAdding(true)}>Add staff member</Button>}
      />
      <Card>
        <Table
          columns={columns}
          rows={team}
          loading={loading}
          error={error}
          onRetry={reload}
          caption="Staff accounts"
          emptyTitle="No staff yet"
          emptyMessage="Add a staff member so someone else can manage billing."
        />
      </Card>
      {adding && (
        <StaffForm
          onClose={() => setAdding(false)}
          onSaved={(user) => {
            setData((list) => [...(list || []), { ...user, name: user.name || user.full_name }]);
            setAdding(false);
            toast(`${user.name || user.full_name} can now log in as staff`);
          }}
        />
      )}
    </>
  );
}

function StaffForm({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [saving, setSaving] = useState(false);
  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  async function handleSubmit(event) {
    event.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = "Enter their name.";
    if (!EMAIL_PATTERN.test(form.email)) next.email = "Enter a valid email.";
    if (form.password.length < 8) next.password = "Use at least 8 characters.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    setServerError("");
    try {
      onSaved(await createStaff({ name: form.name.trim(), email: form.email.trim(), password: form.password }));
    } catch (err) {
      setServerError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title="Add staff member"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" data-close>
            Cancel
          </Button>
          <Button type="submit" form="staff-form" loading={saving}>
            Add staff member
          </Button>
        </>
      }
    >
      <form id="staff-form" className="form-grid" onSubmit={handleSubmit} noValidate>
        {serverError && (
          <p className="form-alert span-2" role="alert">
            {serverError}
          </p>
        )}
        <FormField label="Name" value={form.name} onChange={update("name")} error={errors.name} required />
        <FormField label="Email" type="email" value={form.email} onChange={update("email")} error={errors.email} required />
        <FormField
          label="Temporary password"
          type="password"
          autoComplete="new-password"
          hint="Share it with them. They can change it with Forgot password."
          value={form.password}
          onChange={update("password")}
          error={errors.password}
          className="span-2"
          required
        />
      </form>
    </Modal>
  );
}
