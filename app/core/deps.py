"""Auth dependencies shared by every member's routers.

  get_identity              JWT only (no DB): username + role from a verified token
  get_current_user          JWT + Member 2 DB: user must exist and be active
  require_role("admin")     403 unless the DB role matches (401 if not logged in)
  current_customer_username customer's username from the JWT (use to scope subscriptions/invoices)
  current_customer          the logged-in customer's Customer row (Member 2 portal)
"""
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.customers.models import Customer
from app.modules.users.models import User

from .database import get_db
from .security import TokenIdentity, decode_access_token

# tokenUrl powers the "Authorize" button in /docs
oauth2 = OAuth2PasswordBearer(tokenUrl="/api/auth/token", auto_error=False)


def _unauthorized(detail: str = "Not authenticated") -> HTTPException:
    return HTTPException(401, detail, headers={"WWW-Authenticate": "Bearer"})


def get_identity(token: str | None = Depends(oauth2)) -> TokenIdentity:
    if not token:
        raise _unauthorized()
    try:
        return decode_access_token(token)
    except (jwt.PyJWTError, ValueError, KeyError):
        raise _unauthorized("Invalid or expired token")


def get_current_user(identity: TokenIdentity = Depends(get_identity),
                     db: Session = Depends(get_db)) -> User:
    """Role and is_active are re-read from the DB; the token's role is only a hint."""
    user = db.scalar(select(User).where(User.username == identity.username))
    if user is None or not user.is_active:
        raise _unauthorized("Invalid or expired token")
    return user


def require_role(*roles: str):
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(403, "You do not have permission to do this")
        return user

    return checker


def current_customer_username(identity: TokenIdentity = Depends(get_identity)) -> str:
    if identity.role != "customer":
        raise HTTPException(403, "Customer account required")
    return identity.username


def current_customer(user: User = Depends(require_role("customer")),
                     db: Session = Depends(get_db)) -> Customer:
    customer = db.scalar(select(Customer).where(Customer.user_id == user.id))
    if customer is None or not customer.is_active:
        raise HTTPException(403, "No active customer record is linked to this account")
    return customer
