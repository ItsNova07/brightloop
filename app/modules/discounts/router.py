from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import require_role
from app.db import get_db
from app.models import Product
from app.modules.discounts.models import Discount
from app.modules.discounts.schemas import DiscountCreate, DiscountOut
from app.modules.discounts.service import discount_status

STAFF = require_role("admin", "staff")
ADMIN = require_role("admin")

# Admin and staff can view discounts; only the admin can create or change them
router = APIRouter(prefix="/discounts", tags=["Discounts"], dependencies=[Depends(STAFF)])


def to_out(discount: Discount) -> DiscountOut:
    fields = {column.name: getattr(discount, column.name) for column in Discount.__table__.columns}
    return DiscountOut(**fields, status=discount_status(discount))


def check_product(db: Session, product_id: int | None) -> None:
    if product_id is not None and not db.get(Product, product_id):
        raise HTTPException(status_code=400, detail="The selected product does not exist")


@router.get("", response_model=list[DiscountOut])
def list_discounts(db: Session = Depends(get_db)):
    return [to_out(d) for d in db.query(Discount).order_by(Discount.id.desc()).all()]


@router.get("/{discount_id}", response_model=DiscountOut)
def get_discount(discount_id: int, db: Session = Depends(get_db)):
    discount = db.get(Discount, discount_id)
    if not discount:
        raise HTTPException(status_code=404, detail="Discount not found")
    return to_out(discount)


@router.post("", response_model=DiscountOut, status_code=201, dependencies=[Depends(ADMIN)])
def create_discount(data: DiscountCreate, db: Session = Depends(get_db)):
    check_product(db, data.product_id)
    discount = Discount(**data.model_dump(), used_count=0)
    db.add(discount)
    db.commit()
    db.refresh(discount)
    return to_out(discount)


@router.put("/{discount_id}", response_model=DiscountOut, dependencies=[Depends(ADMIN)])
def update_discount(discount_id: int, data: DiscountCreate, db: Session = Depends(get_db)):
    discount = db.get(Discount, discount_id)
    if not discount:
        raise HTTPException(status_code=404, detail="Discount not found")
    check_product(db, data.product_id)
    if data.usage_limit is not None and data.usage_limit < discount.used_count:
        raise HTTPException(
            status_code=400,
            detail=f"Usage limit cannot be lower than times already used ({discount.used_count})",
        )
    for field_name, value in data.model_dump().items():
        setattr(discount, field_name, value)
    db.commit()
    db.refresh(discount)
    return to_out(discount)
