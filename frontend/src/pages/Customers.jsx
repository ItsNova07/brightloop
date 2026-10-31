import { useState } from "react";
import { createCustomer, deleteCustomer, getCustomers, updateCustomer } from "../api/api.js";
import { useApi } from "../hooks/useApi.js";
import { Button, Card, FormField, Modal, PageHeader, Table, useToast } from "../components";

const EMPTY_FORM = { name: "", email: "", phone: "", company: "", address: "" };
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function Customers() {
  const { data, loading, error, reload, setData } = useApi(() => getCustomers(), []);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null); // null = closed, {} = new, {id,...} = edit
  const [deletingId, setDeletingId] = useState(null);
  const toast = useToast();

  const query = search.trim().toLowerCase();
  const rows = (data || []).filter((c) =>
    [c.name, c.email, c.company].some((value) => String(value || "").toLowerCase().includes(query))
  );

  async function handleDelete(customer) {
    if (!window.confirm(`Delete ${customer.name}? This can't be undone.`)) return;
    setDeletingId(customer.id);
    try {
      await deleteCustomer(customer.id);
      setData((list) => list.filter((c) => c.id !== customer.id));
      toast(`${customer.name} deleted`);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setDeletingId(null);
    }
  }

  function handleSaved(saved, isNew) {
    setData((list) => (isNew ? [saved, ...list] : list.map((c) => (c.id === saved.id ? saved : c))));
    setEditing(null);
    toast(isNew ? `${saved.name} added` : "Changes saved");
  }

  const columns = [
    {
      key: "name",
      header: "Customer",
      render: (row) => (
        <>
          <span className="cell-strong">{row.name}</span>
          {row.company && row.company !== row.name && (
            <>
              <br />
              <span className="cell-muted">{row.company}</span>
            </>
          )}
        </>
      ),
    },
    { key: "email", header: "Email" },
    { key: "phone", header: "Phone", render: (row) => row.phone || "—" },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (row) => (
        <div className="cell-actions">
          <Button variant="ghost" size="sm" onClick={() => setEditing(row)}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" loading={deletingId === row.id} onClick={() => handleDelete(row)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Customers"
        description="Everyone you bill. Add a customer before creating their subscription or quotation."
        actions={<Button onClick={() => setEditing({})}>Add customer</Button>}
      />

      <Card>
        <div className="toolbar">
          <FormField
            label="Search customers"
            type="search"
            placeholder="Name, email or company"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="toolbar-search"
          />
        </div>
        <Table
          columns={columns}
          rows={rows}
          loading={loading}
          error={error}
          onRetry={reload}
          caption="Customers"
          emptyTitle={query ? "No customers match that search" : "No customers yet"}
          emptyMessage={query ? "Try a different name or email." : "Add your first customer to start billing them."}
          emptyAction={!query && <Button onClick={() => setEditing({})}>Add customer</Button>}
        />
      </Card>

      {editing && <CustomerForm customer={editing} onClose={() => setEditing(null)} onSaved={handleSaved} />}
    </>
  );
}

function CustomerForm({ customer, onClose, onSaved }) {
  const isNew = !customer.id;
  const [form, setForm] = useState({ ...EMPTY_FORM, ...customer });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [saving, setSaving] = useState(false);

  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  async function handleSubmit(event) {
    event.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = "Enter the customer's name.";
    if (!EMAIL_PATTERN.test(form.email)) next.email = "Enter a valid email.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    setServerError("");
    const details = {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      company: form.company.trim(),
      address: form.address.trim(),
    };
    try {
      const saved = isNew ? await createCustomer(details) : await updateCustomer(customer.id, details);
      onSaved(saved, isNew);
    } catch (err) {
      setServerError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title={isNew ? "Add customer" : `Edit ${customer.name}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" data-close>
            Cancel
          </Button>
          <Button type="submit" form="customer-form" loading={saving}>
            {isNew ? "Add customer" : "Save changes"}
          </Button>
        </>
      }
    >
      <form id="customer-form" className="form-grid" onSubmit={handleSubmit} noValidate>
        {serverError && (
          <p className="form-alert span-2" role="alert">
            {serverError}
          </p>
        )}
        <FormField label="Name" value={form.name} onChange={update("name")} error={errors.name} required />
        <FormField label="Email" type="email" value={form.email} onChange={update("email")} error={errors.email} required />
        <FormField label="Phone" type="tel" value={form.phone} onChange={update("phone")} />
        <FormField label="Company" value={form.company} onChange={update("company")} />
        <FormField as="textarea" label="Billing address" value={form.address} onChange={update("address")} className="span-2" />
      </form>
    </Modal>
  );
}
