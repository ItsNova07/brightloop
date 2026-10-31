from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from .db import get_db
from . import models, schemas, services

router = APIRouter()


def commit_or_409(db: Session, message="A record with this unique value already exists."):
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail=message)


# PRODUCTS
@router.post("/products", response_model=schemas.ProductOut, status_code=201)
def create_product(payload: schemas.ProductCreate, db: Session = Depends(get_db)):
    obj = models.Product(**payload.model_dump())
    db.add(obj); commit_or_409(db); db.refresh(obj)
    return obj


@router.get("/products", response_model=list[schemas.ProductOut])
def list_products(db: Session = Depends(get_db)):
    return db.query(models.Product).order_by(models.Product.id).all()


@router.get("/products/{product_id}", response_model=schemas.ProductOut)
def get_product(product_id: int, db: Session = Depends(get_db)):
    obj = db.get(models.Product, product_id)
    if not obj: raise HTTPException(404, "Product not found")
    return obj


@router.patch("/products/{product_id}", response_model=schemas.ProductOut)
def update_product(product_id: int, payload: schemas.ProductUpdate, db: Session = Depends(get_db)):
    obj = db.get(models.Product, product_id)
    if not obj: raise HTTPException(404, "Product not found")
    for key, value in payload.model_dump(exclude_unset=True).items(): setattr(obj, key, value)
    commit_or_409(db); db.refresh(obj)
    return obj


@router.delete("/products/{product_id}", status_code=204)
def delete_product(product_id: int, db: Session = Depends(get_db)):
    obj = db.get(models.Product, product_id)
    if not obj: raise HTTPException(404, "Product not found")
    db.delete(obj); commit_or_409(db, "Product is in use and cannot be deleted.")
    return None


# VARIANTS
@router.post("/variants", response_model=schemas.VariantOut, status_code=201)
def create_variant(payload: schemas.VariantCreate, db: Session = Depends(get_db)):
    if not db.get(models.Product, payload.product_id): raise HTTPException(404, "Product not found")
    obj = models.Variant(**payload.model_dump()); db.add(obj); commit_or_409(db); db.refresh(obj)
    return obj


@router.get("/variants", response_model=list[schemas.VariantOut])
def list_variants(product_id: int | None = None, db: Session = Depends(get_db)):
    q = db.query(models.Variant)
    if product_id is not None: q = q.filter(models.Variant.product_id == product_id)
    return q.order_by(models.Variant.id).all()


@router.patch("/variants/{variant_id}", response_model=schemas.VariantOut)
def update_variant(variant_id: int, payload: schemas.VariantUpdate, db: Session = Depends(get_db)):
    obj = db.get(models.Variant, variant_id)
    if not obj: raise HTTPException(404, "Variant not found")
    for key, value in payload.model_dump(exclude_unset=True).items(): setattr(obj, key, value)
    commit_or_409(db); db.refresh(obj)
    return obj


@router.delete("/variants/{variant_id}", status_code=204)
def delete_variant(variant_id: int, db: Session = Depends(get_db)):
    obj = db.get(models.Variant, variant_id)
    if not obj: raise HTTPException(404, "Variant not found")
    db.delete(obj); commit_or_409(db, "Variant is in use and cannot be deleted.")
    return None


# PLANS
@router.post("/plans", response_model=schemas.PlanOut, status_code=201)
def create_plan(payload: schemas.PlanCreate, db: Session = Depends(get_db)):
    obj = models.Plan(**payload.model_dump()); db.add(obj); commit_or_409(db); db.refresh(obj)
    return obj


@router.get("/plans", response_model=list[schemas.PlanOut])
def list_plans(db: Session = Depends(get_db)):
    return db.query(models.Plan).order_by(models.Plan.id).all()


@router.get("/plans/{plan_id}", response_model=schemas.PlanOut)
def get_plan(plan_id: int, db: Session = Depends(get_db)):
    obj = db.get(models.Plan, plan_id)
    if not obj: raise HTTPException(404, "Plan not found")
    return obj


@router.patch("/plans/{plan_id}", response_model=schemas.PlanOut)
def update_plan(plan_id: int, payload: schemas.PlanUpdate, db: Session = Depends(get_db)):
    obj = db.get(models.Plan, plan_id)
    if not obj: raise HTTPException(404, "Plan not found")
    for key, value in payload.model_dump(exclude_unset=True).items(): setattr(obj, key, value)
    commit_or_409(db); db.refresh(obj)
    return obj


@router.delete("/plans/{plan_id}", status_code=204)
def delete_plan(plan_id: int, db: Session = Depends(get_db)):
    obj = db.get(models.Plan, plan_id)
    if not obj: raise HTTPException(404, "Plan not found")
    db.delete(obj); commit_or_409(db, "Plan is in use and cannot be deleted.")
    return None


# TAXES
@router.post("/taxes", response_model=schemas.TaxOut, status_code=201)
def create_tax(payload: schemas.TaxCreate, db: Session = Depends(get_db)):
    obj = models.Tax(**payload.model_dump()); db.add(obj); commit_or_409(db); db.refresh(obj)
    return obj


@router.get("/taxes", response_model=list[schemas.TaxOut])
def list_taxes(db: Session = Depends(get_db)):
    return db.query(models.Tax).order_by(models.Tax.id).all()


# SUBSCRIPTIONS
@router.post("/subscriptions", response_model=schemas.SubscriptionOut, status_code=201)
def create_subscription(payload: schemas.SubscriptionCreate, db: Session = Depends(get_db)):
    # Activation must go through the dedicated endpoint so dates are initialized.
    if payload.status == "active":
        raise HTTPException(
            status_code=400,
            detail="Use POST /api/subscriptions/{subscription_id}/activate to activate a subscription.",
        )
    data = payload.model_dump(exclude={"lines"})
    obj = models.Subscription(**data)
    for line in payload.lines:
        if not db.get(models.Product, line.product_id):
            raise HTTPException(404, f"Product {line.product_id} not found")
        if line.variant_id is not None:
            variant = db.get(models.Variant, line.variant_id)
            if not variant or variant.product_id != line.product_id:
                raise HTTPException(400, "Variant must belong to the selected product")
        if line.tax_id is not None and not db.get(models.Tax, line.tax_id):
            raise HTTPException(404, f"Tax {line.tax_id} not found")
        obj.lines.append(models.SubscriptionLine(**line.model_dump()))
    db.add(obj); commit_or_409(db); db.refresh(obj)
    return obj


@router.get("/subscriptions", response_model=list[schemas.SubscriptionOut])
def list_subscriptions(status_filter: str | None = None, db: Session = Depends(get_db)):
    q = db.query(models.Subscription)
    if status_filter: q = q.filter(models.Subscription.status == status_filter)
    return q.order_by(models.Subscription.id).all()


@router.get("/subscriptions/{subscription_id}", response_model=schemas.SubscriptionOut)
def get_subscription(subscription_id: int, db: Session = Depends(get_db)):
    obj = db.get(models.Subscription, subscription_id)
    if not obj: raise HTTPException(404, "Subscription not found")
    return obj


@router.patch("/subscriptions/{subscription_id}", response_model=schemas.SubscriptionOut)
def update_subscription(subscription_id: int, payload: schemas.SubscriptionUpdate, db: Session = Depends(get_db)):
    obj = db.get(models.Subscription, subscription_id)
    if not obj: raise HTTPException(404, "Subscription not found")
    updates = payload.model_dump(exclude_unset=True)
    requested_status = updates.pop("status", None)
    if requested_status == "active":
        raise HTTPException(
            status_code=400,
            detail="Use POST /api/subscriptions/{subscription_id}/activate to activate a subscription.",
        )
    for key, value in updates.items(): setattr(obj, key, value)
    if requested_status is not None: obj.status = requested_status
    commit_or_409(db); db.refresh(obj)
    return obj


@router.post("/subscriptions/{subscription_id}/activate", response_model=schemas.SubscriptionOut)
def activate_subscription(subscription_id: int, db: Session = Depends(get_db)):
    obj = db.get(models.Subscription, subscription_id)
    if not obj: raise HTTPException(404, "Subscription not found")
    try: return services.activate_subscription(db, obj)
    except ValueError as exc: raise HTTPException(400, str(exc))
