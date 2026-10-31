from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


class DiscountCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    discount_type: Literal["fixed", "percent"]
    value: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    min_amount: Decimal = Field(default=Decimal("0"), ge=0, max_digits=10, decimal_places=2)
    min_quantity: int = Field(default=0, ge=0)
    start_date: date
    end_date: date
    usage_limit: int | None = Field(default=None, ge=1)
    product_id: int | None = None
    active: bool = True

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Name must be at least 2 characters")
        return value

    @model_validator(mode="after")
    def check_rules(self):
        if self.discount_type == "percent" and self.value > 100:
            raise ValueError("A percentage discount cannot be more than 100")
        if self.end_date < self.start_date:
            raise ValueError("End date must be on or after the start date")
        return self


class DiscountOut(BaseModel):
    id: int
    name: str
    discount_type: str
    value: float
    min_amount: float
    min_quantity: int
    start_date: date
    end_date: date
    usage_limit: int | None
    used_count: int
    product_id: int | None
    active: bool
    status: str  # active, scheduled, expired, used_up, inactive
