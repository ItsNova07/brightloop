import { useState } from "react";
import { useAuth } from "../auth/AuthContext.jsx";
import { Link } from "react-router-dom";
import { getInvoices, getInvoiceSummary, getSubscriptionSummary } from "../api/api.js";
import { useApi } from "../hooks/useApi.js";
import { useCountUp } from "../hooks/useCountUp.js";
import { MrrCard, PlanMixCard, RenewalCalendarCard } from "./dashboard/SubscriptionCards.jsx";
import {
  daysSince,
  daysUntil,
  formatCount,
  formatDate,
  formatMoney,
  formatMoneyCompact,
  formatMonthLong,
  formatMonthShort,
  toIsoDate,
} from "../utils/format.js";
import {
  BillingRing,
  Button,
  Card,
  ColumnChart,
  FormField,
  PageHeader,
  SegmentedBar,
  Skeleton,
  Sparkline,
  StateMessage,
  StatusBadge,
  Table,
} from "../components";

const PAGE_SIZE = 8;

// Each option maps to the invoice list filters agreed with the backend.
const STATUS_FILTERS = {
  all: { label: "All statuses", query: {} },
  overdue: { label: "Overdue", query: { overdue: true } },
  confirmed: { label: "Unpaid", query: { status: "confirmed" } },
  paid: { label: "Paid", query: { status: "paid" } },
  draft: { label: "Draft", query: { status: "draft" } },
  cancelled: { label: "Cancelled", query: { status: "cancelled" } },
};
const STATUS_OPTIONS = Object.entries(STATUS_FILTERS).map(([value, f]) => ({ value, label: f.label }));

const CYCLE_DAYS = { monthly: 30, quarterly: 91, yearly: 365 };

const invoiceColumns = [
  {
    key: "number",
    header: "Invoice",
    render: (row) => (
      <>
        <span className="cell-strong">{row.number}</span>
        <br />
        <span className="cell-muted">{row.customer_name}</span>
      </>
    ),
  },
  { key: "invoice_date", header: "Issued", render: (row) => formatDate(row.invoice_date) },
  {
    key: "due_date",
    header: "Due",
    render: (row) => (
      <>
        {formatDate(row.due_date)}
        {row.is_overdue && (
          <>
            <br />
            <span className="cell-muted">{daysSince(row.due_date)} days late</span>
          </>
        )}
      </>
    ),
  },
  { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} overdue={row.is_overdue} /> },
  { key: "balance_due", header: "Balance", align: "right", render: (row) => formatMoney(row.balance_due) },
];

export function Dashboard() {
  // `dates` is what's typed in the inputs; `range` is the last valid range,
  // which is what the data is loaded for. An invalid range never hits the API.
  const [dates, setDates] = useState(defaultRange);
  const [range, setRange] = useState(defaultRange);
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  const rangeError = dates.from && dates.to && dates.from > dates.to ? "Start date must be before the end date." : "";

  function changeDate(key, value) {
    const next = { ...dates, [key]: value };
    setDates(next);
    if (next.from && next.to && next.from <= next.to) {
      setRange(next);
      setPage(1);
    }
  }

  const { user } = useAuth();
  const subscriptions = useApi(() => getSubscriptionSummary({ to_date: range.to }), [range.to]);
  const summary = useApi(() => getInvoiceSummary({ from_date: range.from, to_date: range.to }), [range.from, range.to]);
  const invoices = useApi(
    () =>
      getInvoices({
        ...STATUS_FILTERS[status].query,
        from_date: range.from,
        to_date: range.to,
        page,
        page_size: PAGE_SIZE,
      }),
    [status, range.from, range.to, page]
  );

  const periodText = `${formatDate(range.from)} to ${formatDate(range.to)}`;

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${user.name.split(" ")[0]}`}
        description={`Here's how billing is going on ${todayText()}.`}
        actions={
          <div className="filters">
            <FormField label="From" type="date" value={dates.from} max={dates.to} onChange={(e) => changeDate("from", e.target.value)} />
            <FormField
              label="To"
              type="date"
              value={dates.to}
              min={dates.from}
              onChange={(e) => changeDate("to", e.target.value)}
              error={rangeError}
            />
          </div>
        }
      />

      <section className="metrics" aria-label="Key numbers">
        <Metric
          index={0}
          label="Active subscriptions"
          note="Right now"
          state={subscriptions}
          amount={(d) => d.active_count}
          trend={(d) => d.active_by_month.map((m) => ({ month: m.month, value: m.count }))}
          upIsGood
          format={formatCount}
        />
        <Metric
          index={1}
          label="Revenue"
          note="In these dates"
          state={summary}
          amount={(d) => d.revenue}
          trend={(d) => d.months.map((m) => ({ month: m.month, value: m.revenue }))}
          upIsGood
          format={formatMoney}
        />
        <Metric
          index={2}
          label="Outstanding"
          note="Still owed"
          tone="owed"
          state={summary}
          amount={(d) => d.outstanding}
          trend={(d) => d.months.map((m) => ({ month: m.month, value: m.outstanding }))}
          format={formatMoney}
        />
        <Metric
          index={3}
          label="Overdue"
          tone="late"
          state={summary}
          amount={(d) => d.overdue_amount}
          trend={(d) => d.months.map((m) => ({ month: m.month, value: m.overdue_amount }))}
          format={formatMoney}
          note={(d) => `${formatCount(d.overdue_count)} ${d.overdue_count === 1 ? "invoice" : "invoices"} late`}
        />
      </section>

      <section className="dashboard-section" aria-labelledby="section-subscriptions">
        <h2 className="section-title" id="section-subscriptions">
          Subscriptions
        </h2>
        <div className="dashboard-grid">
          <MrrCard state={subscriptions} />
          <PlanMixCard state={subscriptions} />
        </div>
        <div className="dashboard-grid">
          <RenewalCalendarCard state={subscriptions} />
          <Card title="Renewing soon" description="The ring fills as each billing cycle runs out.">
            <RenewalList state={subscriptions} />
          </Card>
        </div>
      </section>

      <section className="dashboard-section" aria-labelledby="section-billing">
        <h2 className="section-title" id="section-billing">
          Billing
        </h2>
        <div className="dashboard-grid">
          <RevenueCard state={summary} toMonth={range.to.slice(0, 7)} />
          <CollectionCard state={summary} periodText={periodText} />
        </div>
        <Card
          className="dashboard-wide"
          title="Invoices"
          description={`Issued ${periodText}`}
          actions={
            <FormField
              as="select"
              label="Status"
              options={STATUS_OPTIONS}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="inline-select"
            />
          }
        >
          <Table
            columns={invoiceColumns}
            rows={invoices.data?.items}
            loading={invoices.loading}
            error={invoices.error}
            onRetry={invoices.reload}
            caption="Invoices"
            emptyTitle={status === "all" ? "No invoices in these dates" : `No ${STATUS_FILTERS[status].label.toLowerCase()} invoices in these dates`}
            emptyMessage="Widen the date range or pick another status."
            pagination={{ page, pageSize: PAGE_SIZE, total: invoices.data?.total, onPageChange: setPage }}
          />
          <Link className="btn btn-ghost btn-sm card-link" to="/invoices">
            Open invoices
          </Link>
        </Card>
      </section>
    </>
  );
}

// One metric, as its own Card, with its own loading and error state.
// The number counts up on first load and rolls to the new value when the
// filters change. Below it: the change since last month and a 6-month trend.
// upIsGood decides whether a rise shows green (revenue) or red (overdue).
function Metric({ index, label, note, amount, trend, upIsGood = false, format, tone, state }) {
  const { data, loading, error, reload } = state;
  const target = data ? amount(data) : undefined;
  const shown = useCountUp(target);
  const points = data && trend ? trend(data) : [];

  return (
    <Card className={`metric ${tone ? `metric-${tone}` : ""} ${loading && data ? "metric-refreshing" : ""}`} style={{ "--i": index }}>
      <p className="metric-label">{label}</p>
      {error ? (
        <div className="metric-error" role="alert">
          <p>Couldn't load this.</p>
          <button type="button" className="link-btn" onClick={reload}>
            Try again
          </button>
        </div>
      ) : (
        <>
          <p className="metric-value" aria-busy={loading}>
            {data ? (
              <>
                <span aria-hidden="true">{format(shown)}</span>
                <span className="visually-hidden">{format(target)}</span>
              </>
            ) : (
              <Skeleton width="7ch" height="0.9em" />
            )}
          </p>
          <div className="metric-foot">
            <div className="metric-foot-text">
              {points.length >= 2 && <Delta points={points} upIsGood={upIsGood} />}
              <p className="metric-note">{typeof note === "function" ? (data ? note(data) : "\u00a0") : note}</p>
            </div>
            {points.length >= 2 && (
              <Sparkline
                values={points.map((p) => p.value)}
                tone={tone || "teal"}
                label={`${label}, last 6 months: ${points.map((p) => `${formatMonthShort(p.month)} ${format(p.value)}`).join(", ")}`}
              />
            )}
          </div>
        </>
      )}
    </Card>
  );
}

// "▲ 4% vs Sep", green when the change is good news, red when it isn't.
function Delta({ points, upIsGood }) {
  const latest = points[points.length - 1].value;
  const previous = points[points.length - 2].value;
  const versus = formatMonthShort(points[points.length - 2].month);
  if (!previous) return null;
  const change = (latest - previous) / previous;
  const rounded = Math.round(Math.abs(change) * 100);
  if (rounded === 0) return <p className="delta delta-flat">No change vs {versus}</p>;
  const up = change > 0;
  const good = up === upIsGood;
  return (
    <p className={`delta ${good ? "delta-good" : "delta-bad"}`}>
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
        <path d={up ? "M5 1.5L9 8H1z" : "M5 8.5L1 2h8z"} fill="currentColor" />
      </svg>
      <span className="visually-hidden">{up ? "Up" : "Down"} </span>
      {rounded}% vs {versus}
    </p>
  );
}

function RevenueCard({ state, toMonth }) {
  const { data, loading, error, reload } = state;
  const [asTable, setAsTable] = useState(false);
  const rows = data
    ? data.months.map((m) => ({ id: m.month, label: formatMonthShort(m.month), fullLabel: formatMonthLong(m.month), value: m.revenue }))
    : [];

  return (
    <Card
      title="Revenue by month"
      description={`Payments received in the 6 months up to ${formatMonthLong(toMonth)}.`}
      actions={
        data && (
          <Button variant="ghost" size="sm" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>
            {asTable ? "Show chart" : "Show table"}
          </Button>
        )
      }
    >
      {error ? (
        <StateMessage kind="error" message={error.message} onRetry={reload} />
      ) : !data ? (
        <Skeleton height="220px" className="chart-skeleton" />
      ) : asTable ? (
        <Table
          columns={[
            { key: "fullLabel", header: "Month" },
            { key: "value", header: "Revenue", align: "right", render: (row) => formatMoney(row.value) },
          ]}
          rows={rows}
          caption="Revenue by month"
        />
      ) : (
        <div className={loading ? "chart-refreshing" : ""} key={toMonth}>
          <ColumnChart data={rows} format={formatMoney} formatAxis={formatMoneyCompact} label="Revenue by month" />
        </div>
      )}
    </Card>
  );
}

function CollectionCard({ state, periodText }) {
  const { data, loading, error, reload } = state;
  const collection = data?.collection;
  const billed = collection ? collection.paid + collection.unpaid + collection.overdue : 0;
  const collected = billed ? Math.round((collection.paid / billed) * 100) : 0;

  return (
    <Card title="Collection" description={`How much of what was billed ${periodText} has been paid.`}>
      {error ? (
        <StateMessage kind="error" message={error.message} onRetry={reload} />
      ) : !data ? (
        <div className="collection">
          <Skeleton width="40%" height="2rem" />
          <Skeleton height="28px" />
        </div>
      ) : billed === 0 ? (
        <StateMessage kind="empty" title="Nothing billed in these dates" message="Widen the date range to see collection." />
      ) : (
        <div className={`collection ${loading ? "chart-refreshing" : ""}`}>
          <p className="collection-headline">
            <span className="collection-percent">{collected}%</span> collected
          </p>
          <p className="collection-sub">
            {formatMoney(collection.paid)} of {formatMoney(billed)} billed
          </p>
          <SegmentedBar
            key={periodText}
            label="Billed in these dates"
            format={formatMoney}
            parts={[
              { key: "paid", label: "Paid", value: collection.paid, tone: "paid" },
              { key: "unpaid", label: "Not due yet", value: collection.unpaid, tone: "owed" },
              { key: "overdue", label: "Overdue", value: collection.overdue, tone: "late" },
            ]}
          />
        </div>
      )}
    </Card>
  );
}

function RenewalList({ state }) {
  const { data, loading, error, reload } = state;
  if (loading) return <RenewalSkeleton />;
  if (error) return <StateMessage kind="error" message={error.message} onRetry={reload} />;
  if (data.renewing_soon.length === 0) {
    return <StateMessage kind="empty" title="No renewals coming up" message="Subscriptions due to renew will appear here." />;
  }

  return (
    <ul className="renewals">
      {data.renewing_soon.map((sub, i) => {
        const daysLeft = daysUntil(sub.next_billing_date);
        const delay = 120 + i * 90;
        return (
          <li key={sub.id} className="renewal" style={{ "--delay": `${delay}ms` }}>
            <BillingRing daysLeft={daysLeft} cycleDays={CYCLE_DAYS[sub.billing_cycle] ?? 30} delay={delay} />
            <div className="renewal-text">
              <p className="cell-strong">{sub.customer_name}</p>
              <p className="cell-muted">
                {sub.plan_name}, billed {sub.billing_cycle}
              </p>
            </div>
            <div className="renewal-when">
              <p className={daysLeft <= 7 ? "renewal-days renewal-days-soon" : "renewal-days"}>
                {daysLeft <= 0 ? "Today" : daysLeft === 1 ? "Tomorrow" : `In ${daysLeft} days`}
              </p>
              <p className="cell-muted num">{formatMoney(sub.amount)}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function RenewalSkeleton() {
  return (
    <ul className="renewals" role="status" aria-label="Loading">
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className="renewal renewal-skeleton">
          <Skeleton width="36px" height="36px" round />
          <div className="renewal-text">
            <Skeleton width="60%" />
            <Skeleton width="40%" height="0.75rem" />
          </div>
          <Skeleton width="56px" />
        </li>
      ))}
    </ul>
  );
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// "Saturday, 31 October"
function todayText() {
  return new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
}

// First day of this month → today
function defaultRange() {
  const now = new Date();
  return { from: toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: toIsoDate(now) };
}
