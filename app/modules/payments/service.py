from decimal import Decimal

from sqlalchemy.orm import Session

from app.modules.invoices.models import Invoice
from app.modules.invoices.service import InvoiceRuleError, balance_due
from app.modules.money import money
from app.modules.payments.models import Payment
from app.modules.payments.schemas import PaymentCreate, PaymentOut


def record_payment(db: Session, invoice: Invoice, data: PaymentCreate) -> Payment:
    if invoice.status == "draft":
        raise InvoiceRuleError("Confirm the invoice before recording a payment")
    if invoice.status == "cancelled":
        raise InvoiceRuleError("Payments cannot be recorded on a cancelled invoice")
    if invoice.status == "paid":
        raise InvoiceRuleError("This invoice is already fully paid")

    owed = balance_due(invoice)
    amount = money(data.amount)
    if amount > owed:
        raise InvoiceRuleError(f"Payment amount cannot be more than the balance due ({owed})")
    if data.payment_date < invoice.invoice_date:
        raise InvoiceRuleError("Payment date cannot be before the invoice date")

    payment = Payment(
        invoice_id=invoice.id,
        method=data.method,
        amount=amount,
        payment_date=data.payment_date,
        note=data.note,
    )
    db.add(payment)

    invoice.amount_paid = money(Decimal(str(invoice.amount_paid)) + amount)
    if balance_due(invoice) <= 0:
        invoice.status = "paid"

    db.commit()
    db.refresh(payment)
    return payment


def to_out(payment: Payment) -> PaymentOut:
    return PaymentOut(
        id=payment.id,
        invoice_id=payment.invoice_id,
        invoice_number=payment.invoice.number if payment.invoice else None,
        customer_name=payment.invoice.customer_name if payment.invoice else None,
        method=payment.method,
        amount=payment.amount,
        payment_date=payment.payment_date,
        note=payment.note,
    )
