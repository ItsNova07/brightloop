from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.modules.discounts.models import Discount
from app.modules.money import ZERO, money, split_proportionally


@dataclass
class BillableLine:
    product_id: int | None
    quantity: int
    amount: Decimal  # quantity x unit price for this line


@dataclass
class DiscountResult:
    total: Decimal = ZERO
    used: list[Discount] = field(default_factory=list)
    per_line: list[Decimal] = field(default_factory=list)  # same order as the lines given


def discount_status(discount: Discount, today: date | None = None) -> str:
    today = today or date.today()
    if not discount.active:
        return "inactive"
    if discount.usage_limit is not None and discount.used_count >= discount.usage_limit:
        return "used_up"
    if today < discount.start_date:
        return "scheduled"
    if today > discount.end_date:
        return "expired"
    return "active"


def _discount_value(discount: Discount, base: Decimal) -> Decimal:
    if base <= 0:
        return ZERO
    if discount.discount_type == "percent":
        amount = base * Decimal(str(discount.value)) / 100
    else:
        amount = Decimal(str(discount.value))
    return money(min(amount, base))  # a fixed discount can't exceed what it applies to


def _meets_minimums(discount: Discount, quantity: int, amount: Decimal) -> bool:
    min_amount = Decimal(str(discount.min_amount or 0))
    return quantity >= (discount.min_quantity or 0) and amount >= min_amount


def load_active_discounts(db: Session) -> list[Discount]:
    """Every discount that could still apply. The billing engine loads this once per run."""
    return (
        db.query(Discount)
        .filter(
            Discount.active.is_(True),
            or_(Discount.usage_limit.is_(None), Discount.used_count < Discount.usage_limit),
        )
        .all()
    )


def _usable_on(discount: Discount, on_date: date) -> bool:
    # Checked in memory, so a usage limit reached earlier in the same run is respected
    has_uses_left = discount.usage_limit is None or (discount.used_count or 0) < discount.usage_limit
    return discount.active and has_uses_left and discount.start_date <= on_date <= discount.end_date


def calculate_discounts(
    db: Session,
    lines: list[BillableLine],
    on_date: date,
    available: list[Discount] | None = None,
) -> DiscountResult:
    """Works out the discount for a set of invoice lines.

    Rule (easy to explain to judges):
      1. Each product gets its single best product discount.
      2. Then the single best subscription-wide discount applies to what's left.
      3. The total discount can never be more than the subtotal.
    """
    amounts = [money(line.amount) for line in lines]
    per_line = [ZERO for _ in lines]
    used: list[Discount] = []
    if available is None:
        available = load_active_discounts(db)
    candidates = [discount for discount in available if _usable_on(discount, on_date)]

    # 1. Product discounts
    product_ids = {line.product_id for line in lines if line.product_id is not None}
    for product_id in product_ids:
        indexes = [i for i, line in enumerate(lines) if line.product_id == product_id]
        quantity = sum(lines[i].quantity for i in indexes)
        base = sum((amounts[i] for i in indexes), ZERO)
        best: tuple[Discount, Decimal] | None = None
        for discount in candidates:
            if discount.product_id != product_id or not _meets_minimums(discount, quantity, base):
                continue
            value = _discount_value(discount, base)
            if value > 0 and (best is None or value > best[1]):
                best = (discount, value)
        if best:
            used.append(best[0])
            shares = split_proportionally(best[1], [amounts[i] for i in indexes])
            for i, share in zip(indexes, shares):
                per_line[i] += share

    # 2. Subscription-wide discount, on what remains after product discounts
    subtotal = sum(amounts, ZERO)
    total_quantity = sum(line.quantity for line in lines)
    remaining = [money(amounts[i] - per_line[i]) for i in range(len(lines))]
    remaining_total = sum(remaining, ZERO)
    best_overall: tuple[Discount, Decimal] | None = None
    for discount in candidates:
        if discount.product_id is not None or not _meets_minimums(discount, total_quantity, subtotal):
            continue
        value = _discount_value(discount, remaining_total)
        if value > 0 and (best_overall is None or value > best_overall[1]):
            best_overall = (discount, value)
    if best_overall:
        used.append(best_overall[0])
        shares = split_proportionally(best_overall[1], remaining)
        per_line = [money(per_line[i] + shares[i]) for i in range(len(lines))]

    total = money(sum(per_line, ZERO))
    return DiscountResult(total=total, used=used, per_line=per_line)


def mark_used(discounts: list[Discount]) -> None:
    """Call this in the same transaction that saves the invoice."""
    for discount in discounts:
        discount.used_count = (discount.used_count or 0) + 1
