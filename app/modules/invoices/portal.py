"""Customer portal: a logged-in customer sees only their own invoices.

The username comes from the verified login token (Member 2's current_customer_username),
never from the browser, so one customer can't ask for another customer's invoices.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, selectinload

from app.core.deps import current_customer_username
from app import models as catalog_models
from app.schemas import SubscriptionOut
from app.db import get_db
from app.modules.invoices import service
from app.modules.invoices.models import Invoice
from app.modules.invoices.schemas import InvoiceDetail, InvoicePage

router = APIRouter(prefix="/me", tags=["Customer portal"])

# Drafts aren't final yet, so customers only see invoices once they're confirmed
VISIBLE_TO_CUSTOMER = ("confirmed", "paid", "cancelled")


def own_invoices(db: Session, username: str):
    return db.query(Invoice).filter(
        Invoice.customer_username == username,
        Invoice.status.in_(VISIBLE_TO_CUSTOMER),
    )


@router.get("/invoices", response_model=InvoicePage)
def my_invoices(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    username: str = Depends(current_customer_username),
    db: Session = Depends(get_db),
):
    query = own_invoices(db, username)
    total = query.count()
    items = (
        query.options(selectinload(Invoice.subscription))
        .order_by(Invoice.invoice_date.desc(), Invoice.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return InvoicePage(items=[service.to_row(i) for i in items], total=total, page=page, page_size=page_size)


@router.get("/invoices/{invoice_id}", response_model=InvoiceDetail)
def my_invoice(
    invoice_id: int,
    username: str = Depends(current_customer_username),
    db: Session = Depends(get_db),
):
    invoice = (
        own_invoices(db, username)
        .options(selectinload(Invoice.lines), selectinload(Invoice.subscription))
        .filter(Invoice.id == invoice_id)
        .first()
    )
    if not invoice:
        # Same answer whether it doesn't exist or belongs to someone else, so nothing leaks
        raise HTTPException(status_code=404, detail="Invoice not found")
    return service.to_detail(db, invoice)


@router.get("/subscriptions", response_model=list[SubscriptionOut])
def my_subscriptions(
    username: str = Depends(current_customer_username),
    db: Session = Depends(get_db),
):
    """Return only the subscriptions owned by the authenticated customer."""
    return (
        db.query(catalog_models.Subscription)
        .options(selectinload(catalog_models.Subscription.lines))
        .filter(catalog_models.Subscription.customer_username == username)
        .order_by(catalog_models.Subscription.id.desc())
        .all()
    )
