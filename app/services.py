from datetime import date
from sqlalchemy.orm import Session
from . import models


def activate_subscription(db: Session, subscription: models.Subscription) -> models.Subscription:
    """Activate once. Set next_invoice_date to start_date only on first activation."""
    if subscription.status == "closed":
        raise ValueError("A closed subscription cannot be activated.")
    if subscription.status != "active":
        activation_date = subscription.start_date or date.today()
        subscription.start_date = activation_date
        subscription.next_invoice_date = activation_date
        subscription.status = "active"
    db.commit()
    db.refresh(subscription)
    return subscription


def calculate_line_unit_price(db: Session, product_id: int, variant_id: int | None) -> float:
    """Return base product price + variant extra, if a variant is selected."""
    product = db.get(models.Product, product_id)
    if not product:
        raise ValueError("Product not found.")
    total = product.base_price
    if variant_id is not None:
        variant = db.get(models.Variant, variant_id)
        if not variant or variant.product_id != product_id:
            raise ValueError("Variant does not belong to the selected product.")
        total += variant.price_extra
    return float(total)
