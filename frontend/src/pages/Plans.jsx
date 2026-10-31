import { useState } from "react";
import { createPlan, getPlans, updatePlan } from "../api/api.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { useApi } from "../hooks/useApi.js";
import { formatCount } from "../utils/format.js";
import { Button, Card, FormField, Modal, PageHeader, Skeleton, StateMessage, StatusBadge, useToast } from "../components";
import { PlanCard } from "./plans/PlanCard.jsx";

const CYCLES = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Every 3 months" },
  { value: "yearly", label: "Yearly" },
];

// Admin and staff: every plan, including hidden ones. Only admins can
// create, edit, hide or show plans; staff see the same page read-only.
export function Plans() {
  const { role } = useAuth();
  const canEdit = role === "admin";
  const toast = useToast();
  const { data, loading, error, reload, setData } = useApi(() => getPlans(), []);
  const [editing, setEditing] = useState(null); // null = closed, {} = new, plan = edit
  const [togglingId, setTogglingId] = useState(null);

  const plans = data || [];
  const visible = plans.filter((p) => p.is_public);
  const hidden = plans.filter((p) => !p.is_public);

  async function toggleVisibility(plan) {
    setTogglingId(plan.id);
    try {
      const updated = await updatePlan(plan.id, { is_public: !plan.is_public });
      setData((list) => list.map((p) => (p.id === updated.id ? updated : p)));
      toast(updated.is_public ? `${updated.name} is now shown to customers` : `${updated.name} is hidden from customers`);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setTogglingId(null);
    }
  }

  function handleSaved(saved, isNew) {
    setData((list) => (isNew ? [...list, saved] : list.map((p) => (p.id === saved.id ? saved : p))));
    setEditing(null);
    toast(isNew ? `${saved.name} created` : `${saved.name} updated`);
  }

  const renderCard = (plan, i) => (
    <PlanCard
      key={plan.id}
      index={i}
      plan={plan}
      badge={<StatusBadge status={plan.is_public ? "shown" : "hidden"} />}
      footer={
        <>
          <span className="plan-subscribers">{formatCount(plan.subscriber_count)} subscribers</span>
          {canEdit && (
            <span className="plan-actions">
              <Button variant="ghost" size="sm" onClick={() => setEditing(plan)}>
                Edit
              </Button>
              <Button variant="ghost" size="sm" loading={togglingId === plan.id} onClick={() => toggleVisibility(plan)}>
                {plan.is_public ? "Hide" : "Show"}
              </Button>
            </span>
          )}
        </>
      }
    />
  );

  return (
    <>
      <PageHeader
        title="Plans"
        description={
          canEdit
            ? "What customers can subscribe to. Hidden plans stay with the customers who already have them."
            : "What customers can subscribe to. Only an admin can change plans."
        }
        actions={canEdit && <Button onClick={() => setEditing({})}>New plan</Button>}
      />

      {error ? (
        <Card>
          <StateMessage kind="error" message={error.message} onRetry={reload} />
        </Card>
      ) : loading && !data ? (
        <div className="plan-grid">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height="320px" className="plan-skeleton" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <Card>
          <StateMessage
            kind="empty"
            title="No plans yet"
            message="Create a plan so customers have something to subscribe to."
            action={canEdit && <Button onClick={() => setEditing({})}>New plan</Button>}
          />
        </Card>
      ) : (
        <>
          <h2 className="section-title plan-section-title">Shown to customers ({visible.length})</h2>
          {visible.length ? (
            <div className="plan-grid">{visible.map(renderCard)}</div>
          ) : (
            <Card>
              <StateMessage kind="empty" title="No plans are shown to customers" message="Show a plan so customers can choose it." />
            </Card>
          )}
          {hidden.length > 0 && (
            <>
              <h2 className="section-title plan-section-title">Hidden ({hidden.length})</h2>
              <div className="plan-grid">{hidden.map(renderCard)}</div>
            </>
          )}
        </>
      )}

      {editing && <PlanForm plan={editing} onClose={() => setEditing(null)} onSaved={handleSaved} />}
    </>
  );
}

const EMPTY_PLAN = { name: "", description: "", price: "", billing_cycle: "monthly", features: "", trial_days: "0", is_public: true };

function PlanForm({ plan, onClose, onSaved }) {
  const isNew = !plan.id;
  const [form, setForm] = useState(
    isNew
      ? EMPTY_PLAN
      : { ...plan, price: String(plan.price), trial_days: String(plan.trial_days ?? 0), features: plan.features.join("\n") }
  );
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [saving, setSaving] = useState(false);
  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  async function handleSubmit(event) {
    event.preventDefault();
    const price = Number(form.price);
    const trial = Number(form.trial_days || 0);
    const features = form.features
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const next = {};
    if (!form.name.trim()) next.name = "Give the plan a name.";
    if (!form.price || !Number.isFinite(price) || price <= 0) next.price = "Enter a price above zero.";
    if (!Number.isInteger(trial) || trial < 0 || trial > 90) next.trial_days = "Use a whole number from 0 to 90.";
    if (features.length === 0) next.features = "Add at least one feature, one per line.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    setServerError("");
    const details = {
      name: form.name.trim(),
      description: form.description.trim(),
      price,
      billing_cycle: form.billing_cycle,
      features,
      trial_days: trial,
      is_public: form.is_public,
    };
    try {
      onSaved(isNew ? await createPlan(details) : await updatePlan(plan.id, details), isNew);
    } catch (err) {
      setServerError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title={isNew ? "New plan" : `Edit ${plan.name}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" data-close>
            Cancel
          </Button>
          <Button type="submit" form="plan-form" loading={saving}>
            {isNew ? "Create plan" : "Save changes"}
          </Button>
        </>
      }
    >
      <form id="plan-form" className="form-grid" onSubmit={handleSubmit} noValidate>
        {serverError && (
          <p className="form-alert span-2" role="alert">
            {serverError}
          </p>
        )}
        <FormField label="Plan name" value={form.name} onChange={update("name")} error={errors.name} placeholder="Pro" required className="span-2" />
        <FormField
          as="textarea"
          label="Short description"
          value={form.description}
          onChange={update("description")}
          placeholder="Who this plan is for"
          className="span-2"
        />
        <FormField
          label="Price (₹)"
          type="number"
          inputMode="decimal"
          min="1"
          value={form.price}
          onChange={update("price")}
          error={errors.price}
          required
        />
        <FormField as="select" label="Billed" options={CYCLES} value={form.billing_cycle} onChange={update("billing_cycle")} />
        <FormField
          as="textarea"
          label="Features"
          hint="One per line. These show as a checklist on the plan."
          value={form.features}
          onChange={update("features")}
          error={errors.features}
          placeholder={"Unlimited customers\nPriority support"}
          className="span-2"
          required
        />
        <FormField
          label="Free trial (days)"
          type="number"
          min="0"
          max="90"
          value={form.trial_days}
          onChange={update("trial_days")}
          error={errors.trial_days}
          hint="0 for no trial."
        />
        <label className="toggle-field">
          <input type="checkbox" checked={form.is_public} onChange={(e) => setForm({ ...form, is_public: e.target.checked })} />
          <span className="toggle-track" aria-hidden="true" />
          <span>
            <span className="toggle-label">Show to customers</span>
            <span className="toggle-hint">Customers can see and switch to this plan.</span>
          </span>
        </label>
      </form>
    </Modal>
  );
}
