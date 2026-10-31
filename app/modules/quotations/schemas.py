from datetime import date

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core.security import normalize_username


class TemplateLineIn(BaseModel):
    product_id: int
    variant_id: int | None = None
    description: str | None = Field(default=None, max_length=500)
    quantity: int = Field(default=1, gt=0, le=100000)
    tax_id: int | None = None


class TemplateIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=1000)
    plan_id: int
    validity_days: int = Field(default=30, ge=1, le=365)
    is_active: bool = True
    lines: list[TemplateLineIn] = Field(min_length=1)

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Name must be at least 2 characters")
        return value


class TemplateLineOut(BaseModel):
    id: int
    product_id: int
    product_name: str | None
    variant_id: int | None
    variant_name: str | None
    description: str | None
    quantity: int
    tax_id: int | None
    unit_price: float  # today's price: product base price + variant extra


class TemplateOut(BaseModel):
    id: int
    name: str
    description: str | None
    plan_id: int
    plan_name: str | None
    billing_period: str | None
    validity_days: int
    is_active: bool
    lines: list[TemplateLineOut]
    estimated_total: float  # before discounts and tax


class UseTemplateIn(BaseModel):
    customer_username: str
    customer_name: str = Field(min_length=1, max_length=150)
    customer_email: EmailStr | None = None
    start_date: date | None = None
    notes: str | None = Field(default=None, max_length=1000)

    @field_validator("customer_username")
    @classmethod
    def check_username(cls, value: str) -> str:
        return normalize_username(value)  # same rules as Member 2's logins

    @field_validator("customer_name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Customer name is required")
        return value


class QuotationOut(BaseModel):
    id: int
    subscription_id: int
    subscription_number: str
    subscription_status: str
    customer_username: str
    customer_name: str
    template_id: int | None
    template_name: str | None
    valid_until: date
    is_expired: bool
    total_before_tax: float


class QuotationPage(BaseModel):
    items: list[QuotationOut]
    total: int
    page: int
    page_size: int
