import json

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core import audit
from app.modules.users.models import User

from .models import Customer
from .schemas import CustomerCreate, CustomerSelfUpdate, CustomerUpdate


def list_customers(db: Session, q: str | None, include_inactive: bool, page: int, page_size: int):
    stmt = select(Customer)
    if not include_inactive:
        stmt = stmt.where(Customer.is_active.is_(True))
    if q and q.strip():
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Customer.name.ilike(like), Customer.email.ilike(like),
                              Customer.username.ilike(like), Customer.phone.ilike(like)))
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    items = db.scalars(stmt.order_by(Customer.id.desc())
                       .offset((page - 1) * page_size).limit(page_size)).all()
    return items, total


def create_customer(db: Session, actor: User, data: CustomerCreate) -> Customer:
    if db.scalar(select(Customer.id).where(Customer.username == data.username)) or \
            db.scalar(select(User.id).where(User.username == data.username)):
        raise HTTPException(409, "This username is already taken")
    customer = Customer(**data.model_dump())
    db.add(customer)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "This username is already taken")
    audit.log(db, actor.username, "customer_created", "customer", customer.id, customer.username)
    db.commit()
    return customer


def get_by_username(db: Session, username: str) -> Customer:
    customer = db.scalar(select(Customer).where(Customer.username == username.strip().lower()))
    if not customer:
        raise HTTPException(404, "Customer not found")
    return customer


def get_permitted(db: Session, user: User, customer_id: int) -> Customer:
    """Admin/staff: any record. Customer: only the one linked to their login.
    Ownership is checked BEFORE the lookup so ids can't be probed."""
    if user.role == "customer":
        own_id = db.scalar(select(Customer.id).where(Customer.user_id == user.id))
        if own_id != customer_id:
            raise HTTPException(403, "You can only access your own customer record")
    customer = db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(404, "Customer not found")
    return customer


def update_customer(db: Session, user: User, customer: Customer, body: dict) -> Customer:
    schema = CustomerSelfUpdate if user.role == "customer" else CustomerUpdate
    try:
        data = schema.model_validate(body).model_dump(exclude_unset=True)
    except ValidationError as e:
        raise HTTPException(422, json.loads(e.json(include_context=False)))
    for k, v in data.items():
        setattr(customer, k, v)
    if user.role != "customer":
        audit.log(db, user.username, "customer_updated", "customer", customer.id, ",".join(data))
    db.commit()
    return customer


def update_self(db: Session, customer: Customer, data: CustomerSelfUpdate) -> Customer:
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(customer, k, v)
    db.commit()
    return customer


def deactivate(db: Session, actor: User, customer_id: int) -> None:
    """Soft delete: keeps history for subscriptions/invoices and disables the linked login."""
    customer = db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(404, "Customer not found")
    customer.is_active = False
    if customer.user:
        customer.user.is_active = False
    audit.log(db, actor.username, "customer_deactivated", "customer", customer.id)
    db.commit()
