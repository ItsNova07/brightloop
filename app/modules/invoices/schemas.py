from datetime import date, datetime

from pydantic import BaseModel


class InvoiceLineOut(BaseModel):
    id: int
    product_id: int | None
    variant_id: int | None
    description: str | None
    quantity: int
    unit_price: float
    amount: float
    discount_amount: float
    tax_name: str | None
    tax_rate: float
    tax_amount: float
    line_total: float

    model_config = {"from_attributes": True}


class PaymentBrief(BaseModel):
    id: int
    method: str
    amount: float
    payment_date: date
    note: str

    model_config = {"from_attributes": True}


class InvoiceRow(BaseModel):
    id: int
    number: str
    subscription_id: int
    subscription_number: str | None
    customer_name: str
    customer_email: str | None
    invoice_date: date
    due_date: date
    period_start: date
    period_end: date
    status: str
    subtotal: float
    discount_total: float
    tax_total: float
    total: float
    amount_paid: float
    balance_due: float
    is_overdue: bool


class InvoiceDetail(InvoiceRow):
    sent_at: datetime | None
    lines: list[InvoiceLineOut]
    payments: list[PaymentBrief]


class InvoicePage(BaseModel):
    items: list[InvoiceRow]
    total: int
    page: int
    page_size: int


class BillingRunOut(BaseModel):
    created: int
    invoice_ids: list[int]
    skipped: list[dict]
    message: str


class OverdueInvoice(BaseModel):
    id: int
    number: str
    customer_name: str
    due_date: date
    balance_due: float


class MonthTrend(BaseModel):
    month: str  # "2026-10"
    revenue: float  # payments received during the month
    outstanding: float  # unpaid balance on billed invoices at the end of the month
    overdue_amount: float  # the part of that balance already past its due date


class Collection(BaseModel):
    # Of the invoices issued between the chosen dates: how much is paid, still due, or late
    paid: float
    unpaid: float
    overdue: float


class InvoiceSummary(BaseModel):
    revenue: float
    outstanding: float
    overdue_count: int
    overdue_amount: float
    overdue_invoices: list[OverdueInvoice]
    months: list[MonthTrend]  # last 6 months up to to_date, oldest first
    collection: Collection
