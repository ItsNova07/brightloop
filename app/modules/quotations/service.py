from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models as m
from app.modules.money import ZERO, money
from app.modules.quotations.models import Quotation, QuotationTemplate, QuotationTemplateLine
from app.modules.quotations.schemas import (
    QuotationOut,
    TemplateIn,
    TemplateLineOut,
    TemplateOut,
    UseTemplateIn,
)


class QuotationRuleError(Exception):
    """A request that breaks a quotation rule, e.g. accepting an expired quote."""


# ---------- Templates ----------

def line_unit_price(line) -> Decimal:
    """Today's price for a line: product base price plus the variant's extra, if any."""
    price = Decimal(str(line.product.base_price))
    if line.variant is not None:
        price += Decimal(str(line.variant.price_extra))
    return money(price)


def check_template(db: Session, data: TemplateIn) -> None:
    plan = db.get(m.Plan, data.plan_id)
    if not plan:
        raise QuotationRuleError("The selected plan does not exist")
    if not plan.is_active:
        raise QuotationRuleError("The selected plan is not active")
    for number, line in enumerate(data.lines, start=1):
        product = db.get(m.Product, line.product_id)
        if not product:
            raise QuotationRuleError(f"Line {number}: product does not exist")
        if not product.is_active:
            raise QuotationRuleError(f"Line {number}: product '{product.name}' is not active")
        if line.variant_id is not None:
            variant = db.get(m.Variant, line.variant_id)
            if not variant or variant.product_id != line.product_id:
                raise QuotationRuleError(f"Line {number}: variant must belong to the selected product")
            if not variant.is_active:
                raise QuotationRuleError(f"Line {number}: variant '{variant.name}' is not active")
        if line.tax_id is not None and not db.get(m.Tax, line.tax_id):
            raise QuotationRuleError(f"Line {number}: tax does not exist")


def apply_template_data(template: QuotationTemplate, data: TemplateIn) -> None:
    template.name = data.name
    template.description = data.description
    template.plan_id = data.plan_id
    template.validity_days = data.validity_days
    template.is_active = data.is_active
    template.lines = [QuotationTemplateLine(**line.model_dump()) for line in data.lines]


def template_out(template: QuotationTemplate) -> TemplateOut:
    lines = []
    estimated = ZERO
    for line in template.lines:
        price = line_unit_price(line)
        estimated += price * line.quantity
        lines.append(
            TemplateLineOut(
                id=line.id,
                product_id=line.product_id,
                product_name=line.product.name if line.product else None,
                variant_id=line.variant_id,
                variant_name=line.variant.name if line.variant else None,
                description=line.description,
                quantity=line.quantity,
                tax_id=line.tax_id,
                unit_price=price,
            )
        )
    return TemplateOut(
        id=template.id,
        name=template.name,
        description=template.description,
        plan_id=template.plan_id,
        plan_name=template.plan.name if template.plan else None,
        billing_period=template.plan.billing_period if template.plan else None,
        validity_days=template.validity_days,
        is_active=template.is_active,
        lines=lines,
        estimated_total=money(estimated),
    )


# ---------- Using a template ----------

def next_subscription_number(db: Session) -> str:
    candidate = (db.query(func.max(m.Subscription.id)).scalar() or 0) + 1
    while db.query(m.Subscription.id).filter(m.Subscription.subscription_number == f"SUB-{candidate:04d}").first():
        candidate += 1
    return f"SUB-{candidate:04d}"


def use_template(db: Session, template: QuotationTemplate, data: UseTemplateIn) -> Quotation:
    """Creates a subscription in 'quotation' status, filled in from the template."""
    if not template.is_active:
        raise QuotationRuleError("This template is not active")
    if not template.plan or not template.plan.is_active:
        raise QuotationRuleError("This template's plan is no longer active")
    for line in template.lines:
        if not line.product.is_active or (line.variant is not None and not line.variant.is_active):
            raise QuotationRuleError(f"'{line.product.name}' in this template is no longer active")
    if data.start_date and data.start_date < date.today():
        raise QuotationRuleError("Start date cannot be in the past")

    subscription = m.Subscription(
        subscription_number=next_subscription_number(db),
        customer_username=data.customer_username,
        customer_name=data.customer_name,
        customer_email=data.customer_email,
        plan_id=template.plan_id,
        status="quotation",
        start_date=data.start_date,
        payment_terms=template.plan.payment_terms,
        notes=data.notes or f"Created from quotation template '{template.name}'",
    )
    for line in template.lines:
        subscription.lines.append(
            m.SubscriptionLine(
                product_id=line.product_id,
                variant_id=line.variant_id,
                description=line.description
                or f"{line.product.name}{' - ' + line.variant.name if line.variant else ''}",
                quantity=line.quantity,
                unit_price=line_unit_price(line),  # price snapshot, as Member 3's lines expect
                tax_id=line.tax_id,
            )
        )
    quotation = Quotation(
        subscription=subscription,
        template_id=template.id,
        valid_until=date.today() + timedelta(days=template.validity_days),
    )
    db.add(quotation)
    db.commit()
    db.refresh(quotation)
    return quotation


# ---------- Quotations ----------

def is_expired(quotation: Quotation, today: date | None = None) -> bool:
    return (today or date.today()) > quotation.valid_until


def accept(quotation: Quotation) -> None:
    """The customer said yes: Quotation -> Confirmed (then activate it with /activate)."""
    status = quotation.subscription.status
    if status != "quotation":
        raise QuotationRuleError(f"Only subscriptions in 'quotation' status can be accepted (this one is {status})")
    if is_expired(quotation):
        raise QuotationRuleError(f"This quotation expired on {quotation.valid_until.isoformat()}")
    quotation.subscription.status = "confirmed"


def quotation_out(quotation: Quotation) -> QuotationOut:
    subscription = quotation.subscription
    total = sum(
        (money(Decimal(str(line.unit_price)) * line.quantity) for line in subscription.lines), ZERO
    )
    return QuotationOut(
        id=quotation.id,
        subscription_id=subscription.id,
        subscription_number=subscription.subscription_number,
        subscription_status=subscription.status,
        customer_username=subscription.customer_username,
        customer_name=subscription.customer_name,
        template_id=quotation.template_id,
        template_name=quotation.template.name if quotation.template else None,
        valid_until=quotation.valid_until,
        is_expired=is_expired(quotation),
        total_before_tax=money(total),
    )
