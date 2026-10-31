from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, selectinload

from app.core.deps import require_role
from app.db import get_db
from app.modules.invoices.models import Invoice
from app.modules.invoices.service import InvoiceRuleError
from app.modules.payments.models import Payment
from app.modules.payments.schemas import PaymentCreate, PaymentMethod, PaymentOut, PaymentPage
from app.modules.payments.service import record_payment, to_out

# Recording and viewing payments is for admin and staff only
router = APIRouter(tags=["Payments"], dependencies=[Depends(require_role("admin", "staff"))])


@router.post("/invoices/{invoice_id}/payments", response_model=PaymentOut, status_code=201)
def create_payment(invoice_id: int, data: PaymentCreate, db: Session = Depends(get_db)):
    invoice = db.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    try:
        payment = record_payment(db, invoice, data)
    except InvoiceRuleError as error:
        raise HTTPException(status_code=400, detail=str(error))
    return to_out(payment)


@router.get("/payments", response_model=PaymentPage)
def list_payments(
    invoice_id: int | None = None,
    method: PaymentMethod | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(Payment)
    if invoice_id:
        query = query.filter(Payment.invoice_id == invoice_id)
    if method:
        query = query.filter(Payment.method == method)
    if from_date:
        query = query.filter(Payment.payment_date >= from_date)
    if to_date:
        query = query.filter(Payment.payment_date <= to_date)

    total = query.count()
    items = (
        query.options(selectinload(Payment.invoice))
        .order_by(Payment.payment_date.desc(), Payment.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return PaymentPage(items=[to_out(p) for p in items], total=total, page=page, page_size=page_size)
