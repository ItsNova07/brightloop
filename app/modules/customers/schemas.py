from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.modules.users.schemas import Email, Username


class _Address(BaseModel):
    address_line1: str | None = Field(default=None, max_length=200)
    address_line2: str | None = Field(default=None, max_length=200)
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=100)
    postal_code: str | None = Field(default=None, max_length=20)
    country: str | None = Field(default=None, max_length=100)


class CustomerCreate(_Address):
    username: Username
    name: str = Field(min_length=1, max_length=150)
    email: Email
    phone: str | None = Field(default=None, max_length=30)


class CustomerUpdate(_Address):
    """Admin/staff. username is immutable, so it is rejected here."""
    model_config = ConfigDict(extra="forbid")
    name: str | None = Field(default=None, min_length=1, max_length=150)
    email: Email | None = None
    phone: str | None = Field(default=None, max_length=30)
    is_active: bool | None = None


class CustomerSelfUpdate(_Address):
    """Customers may change only these fields."""
    model_config = ConfigDict(extra="forbid")
    name: str | None = Field(default=None, min_length=1, max_length=150)
    phone: str | None = Field(default=None, max_length=30)


class CustomerOut(_Address):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    has_login: bool = False
    name: str
    email: str
    phone: str | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class CustomerPage(BaseModel):
    items: list[CustomerOut]
    total: int
    page: int
    page_size: int
