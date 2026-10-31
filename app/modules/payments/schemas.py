from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, field_validator

PaymentMethod = Literal["cash", "bank_transfer", "upi", "card", "cheque", "other"]


class PaymentCreate(BaseModel):
    method: PaymentMethod
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    payment_date: date
    note: str = Field(default="", max_length=255)

    @field_validator("payment_date")
    @classmethod
    def not_in_future(cls, value: date) -> date:
        if value > date.today():
            raise ValueError("Payment date cannot be in the future")
        return value

    @field_validator("note")
    @classmethod
    def clean_note(cls, value: str) -> str:
        return value.strip()


class PaymentOut(BaseModel):
    id: int
    invoice_id: int
    invoice_number: str | None
    customer_name: str | None
    method: str
    amount: float
    payment_date: date
    note: str


class PaymentPage(BaseModel):
    items: list[PaymentOut]
    total: int
    page: int
    page_size: int
