from decimal import ROUND_HALF_UP, Decimal

ZERO = Decimal("0.00")


def money(value) -> Decimal:
    """Round any number to 2 decimal places, the way money should be."""
    return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def tax_amount(amount, rate) -> Decimal:
    """Tax on an amount, e.g. tax_amount(1000, 18) -> 180.00"""
    return money(Decimal(str(amount)) * Decimal(str(rate)) / 100)


def split_proportionally(total: Decimal, weights: list[Decimal]) -> list[Decimal]:
    """Split a total across items in proportion to their weights.

    The last item absorbs any rounding paisa, so the parts always add up exactly.
    """
    total = money(total)
    weight_sum = sum(weights, Decimal("0"))
    if not weights or weight_sum <= 0 or total <= 0:
        return [ZERO for _ in weights]
    parts = [money(total * weight / weight_sum) for weight in weights[:-1]]
    parts.append(money(total - sum(parts, Decimal("0"))))
    return parts
