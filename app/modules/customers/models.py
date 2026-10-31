from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, String, event, inspect
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.modules.users.models import User


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Customer(Base):
    """`username` is the cross-database reference other modules store as `customer_username`.
    `user_id` links to the login (nullable: staff may create a record before a login exists)."""

    __tablename__ = "customers"
    __table_args__ = (CheckConstraint("username = lower(username)", name="ck_customers_username_lower"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), unique=True)
    username: Mapped[str] = mapped_column(String(30), unique=True, index=True)  # immutable
    name: Mapped[str] = mapped_column(String(150), index=True)
    email: Mapped[str] = mapped_column(String(255), index=True)  # contact email, may differ from login
    phone: Mapped[str | None] = mapped_column(String(30))
    address_line1: Mapped[str | None] = mapped_column(String(200))
    address_line2: Mapped[str | None] = mapped_column(String(200))
    city: Mapped[str | None] = mapped_column(String(100))
    state: Mapped[str | None] = mapped_column(String(100))
    postal_code: Mapped[str | None] = mapped_column(String(20))
    country: Mapped[str | None] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)  # soft delete
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user: Mapped[User | None] = relationship()

    @property
    def has_login(self) -> bool:
        return self.user_id is not None


@event.listens_for(Customer, "before_update")
def _username_is_immutable(mapper, connection, target):
    if inspect(target).attrs.username.history.has_changes():
        raise ValueError("username cannot be changed after creation")
