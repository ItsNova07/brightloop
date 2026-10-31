from datetime import date, datetime

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class QuotationTemplate(Base):
    """A ready-made offer: a plan plus product lines, valid for a set number of days."""

    __tablename__ = "quotation_templates"
    __table_args__ = (CheckConstraint("validity_days >= 1", name="ck_template_validity_positive"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    plan_id: Mapped[int] = mapped_column(ForeignKey("plans.id"), nullable=False, index=True)
    validity_days: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    plan = relationship("Plan")
    lines: Mapped[list["QuotationTemplateLine"]] = relationship(
        back_populates="template", cascade="all, delete-orphan", order_by="QuotationTemplateLine.id"
    )


class QuotationTemplateLine(Base):
    __tablename__ = "quotation_template_lines"
    __table_args__ = (CheckConstraint("quantity > 0", name="ck_template_line_quantity_positive"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    template_id: Mapped[int] = mapped_column(
        ForeignKey("quotation_templates.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    variant_id: Mapped[int | None] = mapped_column(ForeignKey("variants.id"))
    description: Mapped[str | None] = mapped_column(Text)
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    tax_id: Mapped[int | None] = mapped_column(ForeignKey("taxes.id"))

    template: Mapped["QuotationTemplate"] = relationship(back_populates="lines")
    product = relationship("Product")
    variant = relationship("Variant")


class Quotation(Base):
    """Remembers which subscription came from which template, and until when the offer is valid.

    Kept in its own table so Member 3's subscriptions table doesn't need another column.
    """

    __tablename__ = "quotations"

    id: Mapped[int] = mapped_column(primary_key=True)
    subscription_id: Mapped[int] = mapped_column(
        ForeignKey("subscriptions.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    template_id: Mapped[int | None] = mapped_column(ForeignKey("quotation_templates.id"), index=True)
    valid_until: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    subscription = relationship("Subscription")
    template = relationship("QuotationTemplate")
