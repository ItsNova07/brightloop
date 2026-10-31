from datetime import date
from decimal import Decimal
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, EmailStr

BillingPeriod = Literal["daily", "weekly", "monthly", "yearly"]
SubscriptionStatus = Literal["draft", "quotation", "confirmed", "closed"]  # active only via /activate


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class ProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    description: str | None = None
    category: str | None = None
    base_price: Decimal = Field(ge=0)
    is_active: bool = True


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = None
    category: str | None = None
    base_price: Decimal | None = Field(default=None, ge=0)
    is_active: bool | None = None


class ProductOut(ORMModel):
    id: int
    name: str
    description: str | None
    category: str | None
    base_price: Decimal
    is_active: bool


class VariantCreate(BaseModel):
    product_id: int
    name: str = Field(min_length=1, max_length=120)
    sku: str = Field(min_length=1, max_length=80)
    attributes: dict | None = None
    price_extra: Decimal = Field(default=Decimal("0.00"), ge=0)
    stock: int = Field(default=0, ge=0)
    is_active: bool = True


class VariantUpdate(BaseModel):
    name: str | None = None
    sku: str | None = None
    attributes: dict | None = None
    price_extra: Decimal | None = Field(default=None, ge=0)
    stock: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


class VariantOut(ORMModel):
    id: int
    product_id: int
    name: str
    sku: str
    attributes: dict | None
    price_extra: Decimal
    stock: int
    is_active: bool


class PlanCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = None
    price: Decimal = Field(ge=0)
    billing_period: BillingPeriod = "monthly"
    payment_terms: int = Field(default=0, ge=0)
    features: list | None = None
    is_active: bool = True


class PlanUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    price: Decimal | None = Field(default=None, ge=0)
    billing_period: BillingPeriod | None = None
    payment_terms: int | None = Field(default=None, ge=0)
    features: list | None = None
    is_active: bool | None = None


class PlanOut(ORMModel):
    id: int
    name: str
    description: str | None
    price: Decimal
    billing_period: str
    payment_terms: int
    features: list | None
    is_active: bool


class TaxCreate(BaseModel):
    name: str
    rate: Decimal = Field(ge=0, le=100)
    is_active: bool = True


class TaxOut(ORMModel):
    id: int
    name: str
    rate: Decimal
    is_active: bool


class SubscriptionLineCreate(BaseModel):
    product_id: int
    variant_id: int | None = None
    description: str | None = None
    quantity: int = Field(default=1, gt=0)
    unit_price: Decimal = Field(ge=0)
    tax_id: int | None = None


class SubscriptionLineOut(ORMModel):
    id: int
    subscription_id: int
    product_id: int
    variant_id: int | None
    description: str | None
    quantity: int
    unit_price: Decimal
    tax_id: int | None


class SubscriptionCreate(BaseModel):
    subscription_number: str = Field(min_length=1, max_length=40)
    customer_username: str = Field(min_length=1, max_length=100)
    customer_name: str = Field(min_length=1, max_length=150)
    customer_email: str | None = None
    plan_id: int | None = None
    status: SubscriptionStatus = "draft"
    start_date: date | None = None
    end_date: date | None = None
    payment_terms: int = Field(default=0, ge=0)
    notes: str | None = None
    lines: list[SubscriptionLineCreate] = []


class SubscriptionUpdate(BaseModel):
    customer_name: str | None = None
    customer_username: str | None = None
    customer_email: str | None = None
    plan_id: int | None = None
    status: SubscriptionStatus | None = None
    start_date: date | None = None
    end_date: date | None = None
    payment_terms: int | None = Field(default=None, ge=0)
    notes: str | None = None


class SubscriptionOut(ORMModel):
    id: int
    subscription_number: str
    customer_name: str
    customer_username: str
    customer_email: str | None
    plan_id: int | None
    status: str
    start_date: date | None
    end_date: date | None
    next_invoice_date: date | None
    payment_terms: int
    notes: str | None
    lines: list[SubscriptionLineOut]
