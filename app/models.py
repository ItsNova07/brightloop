from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import (
    Boolean, CheckConstraint, Date, DateTime, ForeignKey, Integer,
    Numeric, String, Text, UniqueConstraint, JSON, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .db import Base


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str | None] = mapped_column(String(80))
    base_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    variants: Mapped[list["Variant"]] = relationship(back_populates="product", cascade="all, delete-orphan")
    subscription_lines: Mapped[list["SubscriptionLine"]] = relationship(back_populates="product")


class Variant(Base):
    __tablename__ = "variants"
    __table_args__ = (UniqueConstraint("product_id", "sku", name="uq_variant_product_sku"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    sku: Mapped[str] = mapped_column(String(80), nullable=False)
    attributes: Mapped[dict | None] = mapped_column(JSON)
    price_extra: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    stock: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    product: Mapped["Product"] = relationship(back_populates="variants")
    subscription_lines: Mapped[list["SubscriptionLine"]] = relationship(back_populates="variant")


class Plan(Base):
    __tablename__ = "plans"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    billing_period: Mapped[str] = mapped_column(String(20), default="monthly", nullable=False)
    payment_terms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)  # days
    features: Mapped[list | None] = mapped_column(JSON)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class Tax(Base):
    __tablename__ = "taxes"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)  # percentage
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class Subscription(Base):
    __tablename__ = "subscriptions"
    __table_args__ = (
        CheckConstraint(
            "status IN ('draft', 'quotation', 'confirmed', 'active', 'closed')",
            name="ck_subscription_status",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    subscription_number: Mapped[str] = mapped_column(String(40), unique=True, nullable=False, index=True)
    customer_name: Mapped[str] = mapped_column(String(150), nullable=False)
    # Member 2's login username: the shared key between the two databases
    customer_username: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    customer_email: Mapped[str | None] = mapped_column(String(200))
    plan_id: Mapped[int | None] = mapped_column(ForeignKey("plans.id"))
    status: Mapped[str] = mapped_column(String(20), default="draft", nullable=False)
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    next_invoice_date: Mapped[date | None] = mapped_column(Date)
    payment_terms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    plan: Mapped["Plan | None"] = relationship()
    lines: Mapped[list["SubscriptionLine"]] = relationship(
        back_populates="subscription", cascade="all, delete-orphan"
    )


class SubscriptionLine(Base):
    __tablename__ = "subscription_lines"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_line_quantity_positive"),
        CheckConstraint("unit_price >= 0", name="ck_line_unit_price_nonnegative"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    subscription_id: Mapped[int] = mapped_column(ForeignKey("subscriptions.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    variant_id: Mapped[int | None] = mapped_column(ForeignKey("variants.id"))
    description: Mapped[str | None] = mapped_column(Text)
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    # Snapshot of agreed price; should include product base price + variant extra.
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    tax_id: Mapped[int | None] = mapped_column(ForeignKey("taxes.id"))

    subscription: Mapped["Subscription"] = relationship(back_populates="lines")
    product: Mapped["Product"] = relationship(back_populates="subscription_lines")
    variant: Mapped["Variant | None"] = relationship(back_populates="subscription_lines")
    tax: Mapped["Tax | None"] = relationship()
