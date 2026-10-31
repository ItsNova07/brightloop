from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, selectinload

from app.core.deps import require_role
from app.db import get_db
from app.modules.invoices import service
from app.modules.invoices.billing import run_billing
from app.modules.invoices.models import Invoice
from app.modules.invoices.schemas import BillingRunOut, InvoiceDetail, InvoicePage, InvoiceSummary

# Billing, invoices and the summary are for admin and staff only
router = APIRouter(tags=["Invoices"], dependencies=[Depends(require_role("admin", "staff"))])


def get_invoice_or_404(db: Session, invoice_id: int) -> Invoice:
    invoice = (
        db.query(Invoice)
        .options(selectinload(Invoice.lines), selectinload(Invoice.subscription))
        .filter(Invoice.id == invoice_id)
        .first()
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice


def apply_rule(db: Session, invoice: Invoice, action) -> InvoiceDetail:
    try:
        action(invoice)
    except service.InvoiceRuleError as error:
        raise HTTPException(status_code=400, detail=str(error))
    db.commit()
    db.refresh(invoice)
    return service.to_detail(db, invoice)


@router.post("/billing/run", response_model=BillingRunOut)
def run_billing_now(db: Session = Depends(get_db)):
    result = run_billing(db)
    message = f"{result.created} invoice{'s' if result.created != 1 else ''} created"
    if result.created == 0:
        message = "Nothing to bill: every active subscription is already invoiced up to today"
    return BillingRunOut(
        created=result.created,
        invoice_ids=result.invoice_ids,
        skipped=result.skipped,
        message=message,
    )


# Must stay above /invoices/{invoice_id}, or "summary" is read as an invoice id
@router.get("/invoices/summary", response_model=InvoiceSummary)
def invoice_summary(
    from_date: date | None = None,
    to_date: date | None = None,
    db: Session = Depends(get_db),
):
    if from_date and to_date and to_date < from_date:
        raise HTTPException(status_code=400, detail="to_date must be on or after from_date")
    return service.summary(db, from_date, to_date)


@router.get("/invoices", response_model=InvoicePage)
def list_invoices(
    status: Literal["draft", "confirmed", "paid", "cancelled"] | None = None,
    customer: str | None = Query(default=None, max_length=100, description="Name or email contains"),
    subscription_id: int | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
    overdue: bool | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    if from_date and to_date and to_date < from_date:
        raise HTTPException(status_code=400, detail="to_date must be on or after from_date")
    items, total = service.list_invoices(
        db,
        status=status,
        customer=customer,
        subscription_id=subscription_id,
        from_date=from_date,
        to_date=to_date,
        overdue=overdue,
        page=page,
        page_size=page_size,
    )
    return InvoicePage(
        items=[service.to_row(invoice) for invoice in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/invoices/{invoice_id}", response_model=InvoiceDetail)
def get_invoice(invoice_id: int, db: Session = Depends(get_db)):
    return service.to_detail(db, get_invoice_or_404(db, invoice_id))


@router.post("/invoices/{invoice_id}/confirm", response_model=InvoiceDetail)
def confirm_invoice(invoice_id: int, db: Session = Depends(get_db)):
    return apply_rule(db, get_invoice_or_404(db, invoice_id), service.confirm)


@router.post("/invoices/{invoice_id}/cancel", response_model=InvoiceDetail)
def cancel_invoice(invoice_id: int, db: Session = Depends(get_db)):
    return apply_rule(db, get_invoice_or_404(db, invoice_id), service.cancel)


@router.post("/invoices/{invoice_id}/send", response_model=InvoiceDetail)
def send_invoice(invoice_id: int, db: Session = Depends(get_db)):
    return apply_rule(db, get_invoice_or_404(db, invoice_id), service.send)
