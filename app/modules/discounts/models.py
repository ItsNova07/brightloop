from datetime import date
from decimal import Decimal

from sqlalchemy import Boolean, Date, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Discount(Base):
    __tablename__ = "discounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    discount_type: Mapped[str] = mapped_column(String(10))  # "fixed" or "percent"
    value: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    min_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    min_quantity: Mapped[int] = mapped_column(Integer, default=0)
    start_date: Mapped[date] = mapped_column(Date, index=True)
    end_date: Mapped[date] = mapped_column(Date, index=True)
    usage_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)  # empty = unlimited
    used_count: Mapped[int] = mapped_column(Integer, default=0)
    # Empty = applies to the whole subscription
    product_id: Mapped[int | None] = mapped_column(
        ForeignKey("products.id"), nullable=True, index=True
    )
    active: Mapped[bool] = mapped_column(Boolean, default=True)
