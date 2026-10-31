"""Subscription numbers for the dashboard, worked out from the real subscriptions.

MRR (monthly recurring revenue) is each subscription's line total turned into a monthly
amount: yearly plans count as a twelfth, weekly as 52/12, daily as 365/12. It is before
discounts and tax, which is the usual way MRR is reported.
"""

from datetime import date, datetime, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session, selectinload

from app.models import Subscription
from app.modules.invoices.billing import next_period_start
from app.modules.invoices.service import last_six_months
from app.modules.money import ZERO, money

PER_MONTH = {
    "daily": Decimal(365) / 12,
    "weekly": Decimal(52) / 12,
    "monthly": Decimal(1),
    "yearly": Decimal(1) / 12,
}
LIVE = ("active", "closed")  # subscriptions that have actually run at some point


def period_amount(subscription: Subscription) -> Decimal:
    """What one billing period costs, before discounts and tax."""
    return money(sum((Decimal(str(line.unit_price)) * line.quantity for line in subscription.lines), ZERO))


def monthly_amount(subscription: Subscription) -> Decimal:
    period = subscription.plan.billing_period if subscription.plan else "monthly"
    return period_amount(subscription) * PER_MONTH.get(period, Decimal(1))


def closed_on(subscription: Subscription) -> date | None:
    if subscription.status != "closed":
        return None
    if subscription.end_date:
        return subscription.end_date
    updated = subscription.updated_at
    return updated.date() if isinstance(updated, datetime) else None


def was_active_on(subscription: Subscription, day: date) -> bool:
    if subscription.status not in LIVE or subscription.start_date is None or subscription.start_date > day:
        return False
    ended = closed_on(subscription)
    return ended is None or ended > day


def _row(subscription: Subscription, when: date) -> dict:
    return {
        "id": subscription.id,
        "customer_name": subscription.customer_name,
        "plan_name": subscription.plan.name if subscription.plan else "No plan",
        "billing_cycle": subscription.plan.billing_period if subscription.plan else "monthly",
        "amount": float(period_amount(subscription)),
        "date": when.isoformat(),
    }


def subscription_summary(db: Session, to_date: date | None = None) -> dict:
    today = date.today()
    end = to_date or today
    subscriptions = (
        db.query(Subscription)
        .options(selectinload(Subscription.lines), selectinload(Subscription.plan))
        .filter(Subscription.status.in_(LIVE))
        .all()
    )
    active = [s for s in subscriptions if s.status == "active"]

    # Active count and MRR at the end of each of the last 6 months
    months = last_six_months(end)
    history = []
    for label, _first, last in months:
        day = min(last, today)
        running = [s for s in subscriptions if was_active_on(s, day)]
        history.append((label, running))
    active_by_month = [{"month": label, "count": len(running)} for label, running in history]
    mrr_by_month = [
        {"month": label, "mrr": float(money(sum((monthly_amount(s) for s in running), ZERO)))}
        for label, running in history
    ]

    # How MRR moved during the latest month: start + new - cancelled = end
    _label, first, last = months[-1]
    before = {s.id for s in subscriptions if was_active_on(s, first - timedelta(days=1))}
    after = {s.id for s in subscriptions if was_active_on(s, min(last, today))}
    by_id = {s.id: s for s in subscriptions}
    started = [by_id[i] for i in after - before]
    stopped = [by_id[i] for i in before - after]
    start_mrr = money(sum((monthly_amount(by_id[i]) for i in before), ZERO))
    new_mrr = money(sum((monthly_amount(s) for s in started), ZERO))
    churn_mrr = money(sum((monthly_amount(s) for s in stopped), ZERO))
    mrr_movement = {
        "month": months[-1][0],
        "start": float(start_mrr),
        "new_mrr": float(new_mrr),
        "new_count": len(started),
        # Seat or plan changes aren't recorded as history yet, so upgrades/downgrades show as 0
        "expansion_mrr": 0.0,
        "expansion_count": 0,
        "contraction_mrr": 0.0,
        "contraction_count": 0,
        "churn_mrr": float(churn_mrr),
        "churn_count": len(stopped),
        "end": float(money(start_mrr + new_mrr - churn_mrr)),
    }

    # MRR by plan, for active subscriptions
    plans: dict[str, dict] = {}
    for s in active:
        name = s.plan.name if s.plan else "No plan"
        entry = plans.setdefault(name, {"plan_name": name, "subscribers": 0, "mrr": ZERO})
        entry["subscribers"] += 1
        entry["mrr"] += monthly_amount(s)
    plan_rows = [{**p, "mrr": float(money(p["mrr"]))} for p in plans.values()]

    # Every renewal in the next 30 days (a weekly plan can renew several times)
    horizon = today + timedelta(days=30)
    renewals = []
    for s in active:
        when = s.next_invoice_date
        if when is None or not s.plan:
            continue
        anchor = (s.start_date or when).day
        while when <= horizon:
            if when >= today and (s.end_date is None or when <= s.end_date):
                renewals.append(_row(s, when))
            when = next_period_start(when, s.plan.billing_period, anchor)
    renewals.sort(key=lambda r: (r["date"], r["customer_name"]))

    soonest = sorted(
        (s for s in active if s.next_invoice_date and s.next_invoice_date >= today),
        key=lambda s: s.next_invoice_date,
    )[:5]
    renewing_soon = [
        {**_row(s, s.next_invoice_date), "next_billing_date": s.next_invoice_date.isoformat()} for s in soonest
    ]

    return {
        "active_count": len(active),
        "active_by_month": active_by_month,
        "mrr": float(money(sum((monthly_amount(s) for s in active), ZERO))),
        "mrr_by_month": mrr_by_month,
        "mrr_movement": mrr_movement,
        "plans": plan_rows,
        "renewing_soon": renewing_soon,
        "renewals_next_30_days": renewals,
    }
