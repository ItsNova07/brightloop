import { useEffect, useMemo, useState } from "react";
import { useCountUp } from "../../hooks/useCountUp.js";
import { formatCount, formatMoney, formatMonthLong, formatMonthShort } from "../../utils/format.js";
import { BarList, Card, CalendarHeatmap, DivergingBars, Skeleton, Sparkline, StateMessage } from "../../components";

// The subscription half of the dashboard: MRR and what moved it, where it
// comes from by plan, and a calendar of upcoming renewals. All three read
// the same /subscriptions/summary response, passed in as `state`.

// ---------------- Monthly recurring revenue ----------------

export function MrrCard({ state }) {
  const { data, loading, error, reload } = state;
  const movement = data?.mrr_movement;
  const shown = useCountUp(data?.mrr);

  return (
    <Card
      title="Monthly recurring revenue"
      description="What active subscriptions bring in every month, and what changed it."
      className={loading && data ? "chart-refreshing" : ""}
    >
      {error ? (
        <StateMessage kind="error" message={error.message} onRetry={reload} />
      ) : !data ? (
        <div className="mrr-loading">
          <Skeleton width="45%" height="2.25rem" />
          <Skeleton height="140px" />
        </div>
      ) : (
        <>
          <div className="mrr-head">
            <div>
              <p className="mrr-value">
                <span aria-hidden="true">{formatMoney(shown)}</span>
                <span className="visually-hidden">{formatMoney(data.mrr)}</span>
                <span className="mrr-unit">/month</span>
              </p>
              <MrrChange movement={movement} />
            </div>
            <Sparkline
              values={data.mrr_by_month.map((m) => m.mrr)}
              label={`MRR, last 6 months: ${data.mrr_by_month.map((m) => `${formatMonthShort(m.month)} ${formatMoney(m.mrr)}`).join(", ")}`}
            />
          </div>

          <p className="mrr-subhead">What changed in {formatMonthLong(movement.month)}</p>
          <DivergingBars
            label={`How MRR changed in ${formatMonthLong(movement.month)}`}
            format={formatMoney}
            rows={[
              { key: "new", label: "New", value: movement.new_mrr, detail: plural(movement.new_count, "subscription") },
              { key: "upgrades", label: "Upgrades", value: movement.expansion_mrr, detail: plural(movement.expansion_count, "customer") },
              { key: "downgrades", label: "Downgrades", value: -movement.contraction_mrr, detail: plural(movement.contraction_count, "customer") },
              { key: "cancellations", label: "Cancellations", value: -movement.churn_mrr, detail: plural(movement.churn_count, "subscription") },
            ]}
          />
          <p className="mrr-bridge">
            {formatMoney(movement.start)} at the start of the month, {formatMoney(movement.end)} at the end.
          </p>
        </>
      )}
    </Card>
  );
}

function MrrChange({ movement }) {
  const net = movement.end - movement.start;
  const percent = movement.start ? ((net / movement.start) * 100).toFixed(1) : "0.0";
  const up = net >= 0;
  return (
    <p className={`delta ${up ? "delta-good" : "delta-bad"}`}>
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
        <path d={up ? "M5 1.5L9 8H1z" : "M5 8.5L1 2h8z"} fill="currentColor" />
      </svg>
      {up ? "+" : "−"}
      {formatMoney(Math.abs(net))} ({up ? "+" : "−"}
      {Math.abs(percent)}%) this month
    </p>
  );
}

// ---------------- Plan mix ----------------

export function PlanMixCard({ state }) {
  const { data, loading, error, reload } = state;
  const plans = data ? [...data.plans].sort((a, b) => b.mrr - a.mrr) : [];
  const subscribers = plans.reduce((sum, plan) => sum + plan.subscribers, 0);
  const total = plans.reduce((sum, plan) => sum + plan.mrr, 0);

  return (
    <Card
      title="Plan mix"
      description="How much of the monthly revenue each plan brings in."
      className={loading && data ? "chart-refreshing" : ""}
    >
      {error ? (
        <StateMessage kind="error" message={error.message} onRetry={reload} />
      ) : !data ? (
        <div className="mrr-loading">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height="34px" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <StateMessage kind="empty" title="No plans yet" message="Plans appear here once customers subscribe to them." />
      ) : (
        <>
          <BarList
            label="Monthly recurring revenue by plan"
            format={formatMoney}
            rows={plans.map((plan) => ({
              key: plan.plan_name,
              label: plan.plan_name,
              value: plan.mrr,
              detail: `${plural(plan.subscribers, "subscriber")}, ${formatMoney(Math.round(plan.mrr / plan.subscribers))} each`,
            }))}
          />
          <p className="planmix-foot">
            {formatCount(subscribers)} subscribers pay {formatMoney(Math.round(total / subscribers))} a month on average.
          </p>
        </>
      )}
    </Card>
  );
}

// ---------------- Renewal calendar ----------------

export function RenewalCalendarCard({ state }) {
  const { data, loading, error, reload } = state;
  const renewals = useMemo(() => data?.renewals_next_30_days ?? [], [data]);
  const entries = useMemo(() => renewals.map((r) => ({ date: r.date, value: r.amount })), [renewals]);
  const [selected, setSelected] = useState(null);

  // Start on the first day that has something renewing.
  useEffect(() => {
    if (renewals.length && !renewals.some((r) => r.date === selected)) setSelected(renewals[0].date);
  }, [renewals, selected]);

  const total = renewals.reduce((sum, r) => sum + r.amount, 0);
  const dayRenewals = renewals.filter((r) => r.date === selected);
  const dayTotal = dayRenewals.reduce((sum, r) => sum + r.amount, 0);

  return (
    <Card
      title="Renewals in the next 30 days"
      description="Darker days have more renewals. Pick a day to see who renews."
      className={loading && data ? "chart-refreshing" : ""}
    >
      {error ? (
        <StateMessage kind="error" message={error.message} onRetry={reload} />
      ) : !data ? (
        <Skeleton height="240px" />
      ) : renewals.length === 0 ? (
        <StateMessage kind="empty" title="Nothing renews in the next 30 days" message="New renewals will show up here." />
      ) : (
        <div className="renewal-calendar">
          <p className="renewal-calendar-total">
            <strong>{plural(renewals.length, "renewal")}</strong> worth {formatMoney(total)}
          </p>
          <CalendarHeatmap
            days={30}
            entries={entries}
            selected={selected}
            onSelect={setSelected}
            format={formatMoney}
            label="Renewals in the next 30 days"
          />
          <div className="renewal-day" aria-live="polite" key={selected}>
            <p className="renewal-day-title">
              {selected ? longDate(selected) : ""}
              {dayRenewals.length > 0 && <span> {formatMoney(dayTotal)}</span>}
            </p>
            {dayRenewals.length === 0 ? (
              <p className="renewal-day-empty">Nothing renews on this day.</p>
            ) : (
              <ul className="renewal-day-list">
                {dayRenewals.map((r) => (
                  <li key={r.id}>
                    <span className="cell-strong">{r.customer_name}</span>
                    <span className="cell-muted">
                      {r.plan_name}, billed {r.billing_cycle}
                    </span>
                    <span className="num">{formatMoney(r.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

const plural = (n, word) => `${formatCount(n)} ${word}${n === 1 ? "" : "s"}`;

function longDate(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long" }).format(new Date(y, m - 1, d));
}
