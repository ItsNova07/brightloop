from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import current_customer, get_current_user, require_role
from app.modules.users.models import User

from . import service
from .models import Customer
from .schemas import CustomerCreate, CustomerOut, CustomerPage, CustomerSelfUpdate

router = APIRouter(prefix="/api/customers", tags=["customers"])
me_router = APIRouter(prefix="/api/me", tags=["me"])
staff_or_admin = require_role("admin", "staff")


@router.get("", response_model=CustomerPage)
def list_customers(q: str | None = Query(None, description="Search name, username, email or phone"),
                   include_inactive: bool = False, page: int = Query(1, ge=1),
                   page_size: int = Query(20, ge=1, le=100),
                   _: User = Depends(staff_or_admin), db: Session = Depends(get_db)):
    items, total = service.list_customers(db, q, include_inactive, page, page_size)
    return CustomerPage(items=items, total=total, page=page, page_size=page_size)


@router.post("", response_model=CustomerOut, status_code=201)
def create_customer(body: CustomerCreate, user: User = Depends(staff_or_admin), db: Session = Depends(get_db)):
    return service.create_customer(db, user, body)


@router.get("/by-username/{username}", response_model=CustomerOut)
def customer_by_username(username: str, _: User = Depends(staff_or_admin), db: Session = Depends(get_db)):
    """Validate a `customer_username` (Members 3/4 call this instead of joining databases)."""
    return service.get_by_username(db, username)


@router.get("/{customer_id}", response_model=CustomerOut)
def get_customer(customer_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.get_permitted(db, user, customer_id)


@router.patch("/{customer_id}", response_model=CustomerOut)
def update_customer(customer_id: int, body: dict, user: User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    customer = service.get_permitted(db, user, customer_id)
    return service.update_customer(db, user, customer, body)


@router.delete("/{customer_id}", status_code=204)
def delete_customer(customer_id: int, user: User = Depends(staff_or_admin), db: Session = Depends(get_db)):
    service.deactivate(db, user, customer_id)
    return Response(status_code=204)


@me_router.get("/customer", response_model=CustomerOut)
def my_customer(customer: Customer = Depends(current_customer)):
    return customer


@me_router.patch("/customer", response_model=CustomerOut)
def update_my_customer(body: CustomerSelfUpdate, customer: Customer = Depends(current_customer),
                       db: Session = Depends(get_db)):
    return service.update_self(db, customer, body)

# GET /api/me/subscriptions (Member 3) and /api/me/invoices (Member 4) should depend on
# `current_customer_username` from app.core.deps and filter their own tables by it.
