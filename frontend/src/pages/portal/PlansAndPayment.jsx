import { useState } from "react";
import {
  changeMyPlan,
  getMyPaymentMethods,
  getMySubscription,
  getPlans,
  removePaymentMethod,
  setDefaultPaymentMethod,
} from "../../api/api.js";
import { useApi } from "../../hooks/useApi.js";
import { formatDate, formatMoney } from "../../utils/format.js";
import { Button, Card, Modal, PageHeader, Skeleton, StateMessage, StatusBadge, useToast } from "../../components";
import { PlanCard, cycleWord } from "../plans/PlanCard.jsx";

// Customer portal: the plans on offer (with theirs marked), and how they pay.
export function PlansAndPayment() {
  return (
    <>
      <PageHeader title="Plans & payment" description="Compare plans, switch yours, and choose how you pay." />
      <PlanChooser />
      <PaymentMethods />
    </>
  );
}

// ---------------- Plans ----------------

function PlanChooser() {
  const toast = useToast();
  const plans = useApi(() => getPlans({ public_only: true }), []);
  const subscription = useApi(() => getMySubscription(), []);
  const [switchingTo, setSwitchingTo] = useState(null);

  const loading = plans.loading || subscription.loading;
  const error = plans.error || subscription.error;
  const current = subscription.data;
  const currentPlan = plans.data?.find((p) => p.id === current?.plan_id);

  function handleSwitched(updated, plan) {
    subscription.setData(updated);
    setSwitchingTo(null);
    toast(
      updated.scheduled_plan_id
        ? `You'll move to ${plan.name} on ${formatDate(updated.next_billing_date)}`
        : `Switch cancelled. You'll stay on ${updated.plan_name}`
    );
  }

  async function cancelSwitch() {
    try {
      handleSwitched(await changeMyPlan(current.plan_id), currentPlan);
    } catch (err) {
      toast(err.message, "error");
    }
  }

  return (
    <section className="portal-section" aria-labelledby="plans-title">
      <div className="portal-section-head">
        <h2 className="section-title" id="plans-title">
          Plans
        </h2>
        {current && (
          <p className="portal-section-note">
            You're on <strong>{current.plan_name}</strong>.{" "}
            {current.scheduled_plan_id ? (
              <>
                You'll move to <strong>{current.scheduled_plan_name}</strong> on {formatDate(current.next_billing_date)}.{" "}
                <button type="button" className="link-btn" onClick={cancelSwitch}>
                  Cancel switch
                </button>
              </>
            ) : (
              <>It renews on {formatDate(current.next_billing_date)}.</>
            )}
          </p>
        )}
      </div>

      {error ? (
        <Card>
          <StateMessage
            kind="error"
            message={error.message}
            onRetry={() => {
              plans.reload();
              subscription.reload();
            }}
          />
        </Card>
      ) : loading && !plans.data ? (
        <div className="plan-grid">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height="320px" className="plan-skeleton" />
          ))}
        </div>
      ) : plans.data.length === 0 ? (
        <Card>
          <StateMessage kind="empty" title="No plans available right now" message="Check back soon, or contact us to talk about a plan." />
        </Card>
      ) : (
        <div className="plan-grid">
          {plans.data.map((plan, i) => {
            const isCurrent = plan.id === current?.plan_id;
            const isScheduled = plan.id === current?.scheduled_plan_id;
            return (
              <PlanCard
                key={plan.id}
                index={i}
                plan={plan}
                highlight={isCurrent}
                badge={isCurrent ? <StatusBadge status="current" /> : isScheduled && <StatusBadge status="scheduled" />}
                footer={
                  isCurrent ? (
                    <span className="plan-subscribers">
                      {current.scheduled_plan_id ? `Until ${formatDate(current.next_billing_date)}` : `Renews ${formatDate(current.next_billing_date)}`}
                    </span>
                  ) : isScheduled ? (
                    <span className="plan-subscribers">Starts {formatDate(current.next_billing_date)}</span>
                  ) : (
                    <Button variant="secondary" size="sm" onClick={() => setSwitchingTo(plan)}>
                      Switch to {plan.name}
                    </Button>
                  )
                }
              />
            );
          })}
        </div>
      )}

      {switchingTo && (
        <SwitchPlanDialog
          plan={switchingTo}
          currentPlan={currentPlan}
          nextBillingDate={current?.next_billing_date}
          onClose={() => setSwitchingTo(null)}
          onSwitched={handleSwitched}
        />
      )}
    </section>
  );
}

function SwitchPlanDialog({ plan, currentPlan, nextBillingDate, onClose, onSwitched }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    setSaving(true);
    setError("");
    try {
      onSwitched(await changeMyPlan(plan.id), plan);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title={`Switch to ${plan.name}?`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" data-close>
            Keep {currentPlan?.name ?? "my plan"}
          </Button>
          <Button onClick={confirm} loading={saving}>
            Switch plan
          </Button>
        </>
      }
    >
      {error && (
        <p className="form-alert" role="alert">
          {error}
        </p>
      )}
      <div className="switch-compare">
        {currentPlan && (
          <div className="switch-plan">
            <span className="switch-label">Now</span>
            <strong>{currentPlan.name}</strong>
            <span>
              {formatMoney(currentPlan.price)}/{cycleWord(currentPlan.billing_cycle)}
            </span>
          </div>
        )}
        <svg className="switch-arrow" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M4 10h12M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="switch-plan switch-plan-new">
          <span className="switch-label">From {formatDate(nextBillingDate)}</span>
          <strong>{plan.name}</strong>
          <span>
            {formatMoney(plan.price)}/{cycleWord(plan.billing_cycle)}
          </span>
        </div>
      </div>
      <p className="switch-note">
        You keep {currentPlan?.name ?? "your plan"} until {formatDate(nextBillingDate)}. Your first {plan.name} invoice comes on that day.
      </p>
    </Modal>
  );
}

// ---------------- Payment methods ----------------

const ACCEPTED = [
  { key: "upi", title: "UPI", text: "Any UPI app" },
  { key: "card", title: "Cards", text: "Debit and credit cards" },
  { key: "netbanking", title: "Net banking", text: "All major banks" },
  { key: "bank", title: "Bank transfer", text: "For Enterprise invoices" },
];

function PaymentMethods() {
  const toast = useToast();
  const { data, loading, error, reload, setData } = useApi(() => getMyPaymentMethods(), []);
  const [busyId, setBusyId] = useState(null);
  const [adding, setAdding] = useState(false);

  async function makeDefault(method) {
    setBusyId(method.id);
    try {
      setData(await setDefaultPaymentMethod(method.id));
      toast(`${methodName(method)} is now your default`);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(method) {
    if (!window.confirm(`Remove ${methodName(method)}?`)) return;
    setBusyId(method.id);
    try {
      await removePaymentMethod(method.id);
      setData((list) => list.filter((m) => m.id !== method.id));
      toast(`${methodName(method)} removed`);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="portal-section" aria-labelledby="payment-title">
      <div className="portal-section-head">
        <h2 className="section-title" id="payment-title">
          Payment methods
        </h2>
      </div>

      <div className="payment-layout">
        <Card
          title="Your saved methods"
          description="Your default method is charged automatically on each renewal."
          actions={
            <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
              Add payment method
            </Button>
          }
        >
          {error ? (
            <StateMessage kind="error" message={error.message} onRetry={reload} />
          ) : loading && !data ? (
            <div className="mrr-loading">
              <Skeleton height="56px" />
              <Skeleton height="56px" />
            </div>
          ) : data.length === 0 ? (
            <StateMessage
              kind="empty"
              title="No saved payment method"
              message="Add one so renewals are paid automatically."
              action={<Button onClick={() => setAdding(true)}>Add payment method</Button>}
            />
          ) : (
            <ul className="method-list">
              {data.map((method, i) => (
                <li key={method.id} className={`method ${method.is_default ? "method-default" : ""}`} style={{ "--i": i }}>
                  <MethodIcon type={method.type} />
                  <div className="method-text">
                    <p className="method-name">
                      {methodName(method)}
                      {method.is_default && <span className="method-default-tag">Default</span>}
                    </p>
                    <p className="method-detail">{methodDetail(method)}</p>
                  </div>
                  <div className="method-actions">
                    {!method.is_default && (
                      <Button variant="ghost" size="sm" loading={busyId === method.id} onClick={() => makeDefault(method)}>
                        Make default
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={method.is_default || busyId === method.id}
                      title={method.is_default ? "Make another method the default first" : undefined}
                      onClick={() => remove(method)}
                    >
                      Remove
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Ways you can pay" description="Pay invoices with any of these.">
          <ul className="accepted-list">
            {ACCEPTED.map((way, i) => (
              <li key={way.key} style={{ "--i": i }}>
                <MethodIcon type={way.key} />
                <span>
                  <strong>{way.title}</strong>
                  <span>{way.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {adding && <AddMethodDialog onClose={() => setAdding(false)} />}
    </section>
  );
}

// Card details are never typed into this app. In the live version this
// button opens the payment gateway's secure window instead.
function AddMethodDialog({ onClose }) {
  return (
    <Modal
      open
      title="Add a payment method"
      onClose={onClose}
      footer={
        <Button variant="secondary" data-close>
          Close
        </Button>
      }
    >
      <p className="add-method-text">
        To keep your details safe, cards and UPI are added in our payment partner's secure window, not in this app. We only
        keep the last 4 digits or your UPI ID.
      </p>
      <p className="info-note" role="status">
        Coming soon: this opens once online payments are connected.
      </p>
    </Modal>
  );
}

function methodName(method) {
  if (method.type === "card") return `${method.brand ?? "Card"} ending ${method.last4}`;
  if (method.type === "upi") return "UPI";
  if (method.type === "netbanking") return method.bank_name ? `${method.bank_name} net banking` : "Net banking";
  return "Payment method";
}

function methodDetail(method) {
  if (method.type === "card") return `Expires ${method.expiry}`;
  if (method.type === "upi") return method.upi_id;
  return "";
}

// Simple generic icons, no bank or card brand logos.
function MethodIcon({ type }) {
  const paths = {
    card: (
      <>
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <path d="M3 10h18M7 15h4" />
      </>
    ),
    upi: (
      <>
        <rect x="7" y="3" width="10" height="18" rx="2" />
        <path d="M11 18h2" />
      </>
    ),
    netbanking: (
      <>
        <path d="M4 10l8-5 8 5" />
        <path d="M6 10v7M10 10v7M14 10v7M18 10v7M4 19h16" />
      </>
    ),
    bank: (
      <>
        <path d="M4 8h16M4 16h16" />
        <path d="M16 4l4 4-4 4M8 12l-4 4 4 4" />
      </>
    ),
  };
  return (
    <span className={`method-icon method-icon-${type}`} aria-hidden="true">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {paths[type] ?? paths.card}
      </svg>
    </span>
  );
}
