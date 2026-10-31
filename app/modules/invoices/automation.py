"""Daily automation: the jobs nobody should have to remember.

Every day (and once when the server starts, to catch up anything missed while it was off):
  1. Billing      create every invoice that is due (the same engine as the Run Billing button)
  2. Auto-close   active subscriptions whose end date has passed, once their last period is billed
  3. Reminders    email customers about overdue invoices, at most once every few days per invoice

It runs inside the server on a background timer, so it needs no cloud service and works offline.
Settings (in .env, all optional):
  AUTOMATION_ENABLED=true          set to false to switch the timer off
  AUTOMATION_INTERVAL_HOURS=24     how often the jobs run
  REMINDER_EVERY_DAYS=3            minimum gap between two reminders for the same invoice
"""

import logging
import os
import threading
from dataclasses import asdict, dataclass, field
from datetime import date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models import Subscription
from app.modules.invoices.billing import run_billing
from app.modules.invoices.models import Invoice
from app.modules.invoices.service import balance_due, overdue_condition

log = logging.getLogger("brightloop.automation")

MAX_REMINDERS_PER_RUN = 100  # keeps one run short even with thousands of overdue invoices


def _env_bool(name: str, default: bool) -> bool:
    return os.getenv(name, str(default)).strip().lower() in ("1", "true", "yes", "on")


def _env_number(name: str, default: float) -> float:
    try:
        value = float(os.getenv(name, default))
        return value if value > 0 else default
    except ValueError:
        return default


@dataclass
class AutomationResult:
    started_at: str = ""
    finished_at: str = ""
    trigger: str = ""
    invoices_created: int = 0
    subscriptions_closed: list[str] = field(default_factory=list)
    reminders_sent: int = 0
    reminders_failed: int = 0
    reminders_skipped_no_email: int = 0
    notes: list[str] = field(default_factory=list)
    error: str | None = None


# ---------- Job 2: auto-close ----------

def close_ended_subscriptions(db: Session, today: date) -> list[str]:
    """Active subscriptions past their end date move to 'closed'.

    Only once their final period has been billed (next_invoice_date is beyond the end date),
    so closing can never skip the last invoice.
    """
    ended = (
        db.query(Subscription)
        .filter(
            Subscription.status == "active",
            Subscription.end_date.is_not(None),
            Subscription.end_date < today,
            or_(Subscription.next_invoice_date.is_(None), Subscription.next_invoice_date > Subscription.end_date),
        )
        .all()
    )
    for subscription in ended:
        subscription.status = "closed"
    db.commit()
    return [s.subscription_number for s in ended]


# ---------- Job 3: overdue reminders ----------

def reminder_text(invoice: Invoice, today: date) -> tuple[str, str]:
    days_late = (today - invoice.due_date).days
    owed = balance_due(invoice)
    subject = f"Payment reminder: {invoice.number} is {days_late} day{'s' if days_late != 1 else ''} overdue"
    body = (
        f"Hello {invoice.customer_name},\n\n"
        f"This is a friendly reminder that invoice {invoice.number} was due on "
        f"{invoice.due_date.strftime('%d %b %Y')} and is now {days_late} day{'s' if days_late != 1 else ''} overdue.\n\n"
        f"  Invoice total:  Rs. {Decimal(str(invoice.total)):,.2f}\n"
        f"  Already paid:   Rs. {Decimal(str(invoice.amount_paid)):,.2f}\n"
        f"  Balance due:    Rs. {owed:,.2f}\n"
        f"  Billing period: {invoice.period_start.strftime('%d %b %Y')} to {invoice.period_end.strftime('%d %b %Y')}\n\n"
        "If you have already paid, please ignore this message. You can see all your invoices "
        "in the Brightloop customer portal.\n\n"
        "Thank you,\nBrightloop Software"
    )
    return subject, body


def send_overdue_reminders(db: Session, today: date, result: AutomationResult) -> None:
    from app.core.email import send_email  # Member 2's helper: never raises, returns True or False

    every_days = int(_env_number("REMINDER_EVERY_DAYS", 3))
    cutoff = datetime.now() - timedelta(days=every_days)
    due_for_reminder = (
        db.query(Invoice)
        .filter(overdue_condition(today), or_(Invoice.reminder_sent_at.is_(None), Invoice.reminder_sent_at < cutoff))
        .order_by(Invoice.due_date.asc(), Invoice.id.asc())
        .limit(MAX_REMINDERS_PER_RUN)
        .all()
    )
    for invoice in due_for_reminder:
        if not invoice.customer_email:
            result.reminders_skipped_no_email += 1
            continue
        subject, body = reminder_text(invoice, today)
        if send_email(invoice.customer_email, subject, body):
            invoice.reminder_sent_at = datetime.now()
            invoice.reminder_count = (invoice.reminder_count or 0) + 1
            result.reminders_sent += 1
        else:
            # The email server isn't reachable (e.g. Mailpit isn't running). Stop for this run
            # instead of trying hundreds of times; nothing is marked, so the next run retries.
            result.reminders_failed += 1
            result.notes.append("Email server not reachable, reminders will be retried on the next run")
            break
    db.commit()


# ---------- All three, in order ----------

def run_daily_jobs(db: Session, trigger: str, today: date | None = None) -> AutomationResult:
    today = today or date.today()
    result = AutomationResult(started_at=datetime.now().isoformat(timespec="seconds"), trigger=trigger)
    try:
        billing = run_billing(db, today)  # first, so the last period is billed before closing
        result.invoices_created = billing.created
        result.notes += [f"Skipped {s.get('subscription', s.get('subscriptions'))}: {s['reason']}" for s in billing.skipped]
        result.subscriptions_closed = close_ended_subscriptions(db, today)
        send_overdue_reminders(db, today, result)
    except Exception as error:  # a scheduled job must never take the server down
        db.rollback()
        log.exception("Automation run failed")
        result.error = str(error)
    result.finished_at = datetime.now().isoformat(timespec="seconds")
    return result


# ---------- The timer inside the server ----------

class AutomationScheduler:
    def __init__(self, session_factory):
        self.session_factory = session_factory
        self.enabled = _env_bool("AUTOMATION_ENABLED", True)
        self.interval_hours = _env_number("AUTOMATION_INTERVAL_HOURS", 24)
        self.last_result: AutomationResult | None = None
        self.next_run_at: datetime | None = None
        self._lock = threading.Lock()  # one run at a time, whether from the timer or the button
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def run_now(self, trigger: str) -> AutomationResult:
        with self._lock:
            db = self.session_factory()
            try:
                self.last_result = run_daily_jobs(db, trigger)
            finally:
                db.close()
        log.info("Automation (%s): %s", trigger, asdict(self.last_result))
        return self.last_result

    def _loop(self) -> None:
        self.run_now("server start")  # catch up anything missed while the server was off
        while True:
            self.next_run_at = datetime.now() + timedelta(hours=self.interval_hours)
            if self._stop.wait(self.interval_hours * 3600):
                return
            self.run_now("daily schedule")

    def start(self) -> None:
        if not self.enabled or self._thread is not None:
            return
        self._thread = threading.Thread(target=self._loop, name="brightloop-automation", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()

    def status(self) -> dict:
        return {
            "enabled": self.enabled,
            "interval_hours": self.interval_hours,
            "running": self._thread is not None and self._thread.is_alive(),
            "next_run_at": self.next_run_at.isoformat(timespec="seconds") if self.next_run_at else None,
            "last_run": asdict(self.last_result) if self.last_result else None,
        }
