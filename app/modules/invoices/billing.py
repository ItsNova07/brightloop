"""The billing engine: turns due subscriptions into invoices.

How it works, in plain words:
  1. Find active subscriptions whose next_invoice_date is today or earlier.
  2. For each one, make an invoice for that period (lines, discount, tax, totals).
  3. Move next_invoice_date forward by the plan's billing period.
  4. Repeat until next_invoice_date is in the future, so missed days are caught up.

Running it twice can never double-bill: the database refuses a second invoice
for the same subscription and period_start.
"""

import calendar
from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models import Subscription, SubscriptionLine
from app.modules.discounts.models import Discount
from app.modules.discounts.service import (
    BillableLine,
    calculate_discounts,
    load_active_discounts,
    mark_used,
)
from app.modules.invoices.models import Invoice, InvoiceLine
from app.modules.money import ZERO, money, tax_amount

MAX_PERIODS_PER_RUN = 400  # safety stop, e.g. a daily plan that was never billed
BATCH_SIZE = 500  # subscriptions loaded and saved together


@dataclass
class BillingResult:
    created: int = 0
    invoice_ids: list[int] = field(default_factory=list)
    skipped: list[dict] = field(default_factory=list)


def add_months(start: date, months: int, anchor_day: int) -> date:
    """Move a date by whole months, keeping the original day where the month allows it.

    Billing on the 31st goes Jan 31 -> Feb 28 -> Mar 31, not drifting to the 28th.
    """
    month_index = start.month - 1 + months
    year = start.year + month_index // 12
    month = month_index % 12 + 1
    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, min(anchor_day, last_day))


def next_period_start(current: date, billing_period: str, anchor_day: int) -> date:
    if billing_period == "daily":
        return current + timedelta(days=1)
    if billing_period == "weekly":
        return current + timedelta(weeks=1)
    if billing_period == "yearly":
        return add_months(current, 12, anchor_day)
    return add_months(current, 1, anchor_day)  # monthly is the default


def build_invoice(
    db: Session,
    subscription: Subscription,
    period_start: date,
    period_end: date,
    discounts_available: list[Discount],
) -> Invoice:
    lines: list[SubscriptionLine] = list(subscription.lines)
    amounts = [money(Decimal(str(line.unit_price)) * line.quantity) for line in lines]

    discounts = calculate_discounts(
        db,
        [BillableLine(line.product_id, line.quantity, amount) for line, amount in zip(lines, amounts)],
        on_date=period_start,
        available=discounts_available,
    )

    invoice = Invoice(
        subscription_id=subscription.id,
        customer_name=subscription.customer_name,
        customer_username=subscription.customer_username,
        customer_email=subscription.customer_email,
        period_start=period_start,
        period_end=period_end,
        invoice_date=period_start,
        due_date=period_start + timedelta(days=subscription.payment_terms or 0),
        status="draft",
    )

    subtotal = discount_total = tax_total = ZERO
    for line, amount, line_discount in zip(lines, amounts, discounts.per_line):
        rate = Decimal(str(line.tax.rate)) if line.tax else ZERO
        line_tax = tax_amount(amount - line_discount, rate)
        invoice.lines.append(
            InvoiceLine(
                product_id=line.product_id,
                variant_id=line.variant_id,
                description=line.description,
                quantity=line.quantity,
                unit_price=line.unit_price,
                amount=amount,
                discount_amount=line_discount,
                tax_name=line.tax.name if line.tax else None,
                tax_rate=rate,
                tax_amount=line_tax,
                line_total=money(amount - line_discount + line_tax),
            )
        )
        subtotal += amount
        discount_total += line_discount
        tax_total += line_tax

    invoice.subtotal = money(subtotal)
    invoice.discount_total = money(discount_total)
    invoice.tax_total = money(tax_total)
    invoice.total = money(subtotal - discount_total + tax_total)
    invoice.amount_paid = ZERO

    mark_used(discounts.used)  # counted in memory, so usage limits hold within this run
    db.add(invoice)
    return invoice


def bill_subscription(
    db: Session,
    subscription: Subscription,
    today: date,
    already_billed: set[tuple[int, date]],
    discounts_available: list[Discount],
    result: BillingResult,
) -> list[Invoice]:
    if subscription.plan is None:
        result.skipped.append({"subscription": subscription.subscription_number, "reason": "No plan set"})
        return []
    if not subscription.lines:
        result.skipped.append({"subscription": subscription.subscription_number, "reason": "No product lines"})
        return []

    billing_period = subscription.plan.billing_period
    anchor_day = (subscription.start_date or subscription.next_invoice_date).day
    created: list[Invoice] = []

    for _ in range(MAX_PERIODS_PER_RUN):
        period_start = subscription.next_invoice_date
        if period_start is None or period_start > today:
            break
        if subscription.end_date and period_start > subscription.end_date:
            break  # contract has ended: nothing more to bill

        following = next_period_start(period_start, billing_period, anchor_day)
        period_end = following - timedelta(days=1)
        if subscription.end_date:
            period_end = min(period_end, subscription.end_date)

        if (subscription.id, period_start) not in already_billed:
            created.append(build_invoice(db, subscription, period_start, period_end, discounts_available))
            already_billed.add((subscription.id, period_start))

        subscription.next_invoice_date = following

    return created


def run_billing(db: Session, today: date | None = None) -> BillingResult:
    today = today or date.today()
    result = BillingResult()
    discounts_available = load_active_discounts(db)

    due_ids = [
        row.id
        for row in db.query(Subscription.id)
        .filter(Subscription.status == "active", Subscription.next_invoice_date <= today)
        .order_by(Subscription.id)
        .all()
    ]

    for batch_start in range(0, len(due_ids), BATCH_SIZE):
        batch_ids = due_ids[batch_start : batch_start + BATCH_SIZE]
        subscriptions = (
            db.query(Subscription)
            .options(
                selectinload(Subscription.lines).selectinload(SubscriptionLine.tax),
                selectinload(Subscription.plan),
            )
            .filter(Subscription.id.in_(batch_ids))
            .order_by(Subscription.id)
            .all()
        )
        already_billed = {
            (row.subscription_id, row.period_start)
            for row in db.query(Invoice.subscription_id, Invoice.period_start)
            .filter(Invoice.subscription_id.in_(batch_ids))
            .all()
        }

        batch_invoices: list[Invoice] = []
        for subscription in subscriptions:
            batch_invoices += bill_subscription(
                db, subscription, today, already_billed, discounts_available, result
            )

        try:
            db.flush()  # one save for the whole batch: gives every invoice its id
            for invoice in batch_invoices:
                invoice.number = f"INV-{invoice.id:04d}"
            db.commit()
        except IntegrityError:
            # Another billing run saved the same periods at the same moment.
            # Nothing from this batch is kept, and running billing again finishes the job.
            db.rollback()
            discounts_available = load_active_discounts(db)
            result.skipped.append(
                {"subscriptions": len(batch_ids), "reason": "Billed by another run at the same time, run again"}
            )
            continue

        result.created += len(batch_invoices)
        result.invoice_ids += [invoice.id for invoice in batch_invoices]

    return result
