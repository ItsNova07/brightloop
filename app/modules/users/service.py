from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core import audit
from app.core.config import get_settings
from app.core.email import send_email
from app.core.security import (DUMMY_HASH, hash_password, hash_token, new_reset_token, verify_password)
from app.modules.customers.models import Customer

from .models import PasswordResetToken, User
from .schemas import SignupRequest, StaffCreate


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _ensure_free(db: Session, username: str, email: str) -> None:
    if db.scalar(select(User.id).where(User.username == username)):
        raise HTTPException(409, "This username is already taken")
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(409, "An account with this email already exists")


def _commit_or_conflict(db: Session) -> None:
    try:
        db.commit()  # DB unique constraints are the real guard against races
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Username or email is already in use")


def signup(db: Session, data: SignupRequest) -> User:
    """Public signup: always role=customer, plus a linked Customer record sharing the username."""
    _ensure_free(db, data.username, data.email)
    user = User(username=data.username, email=data.email, full_name=data.name,
                password_hash=hash_password(data.password), role="customer")
    db.add(user)
    db.flush()
    db.add(Customer(user_id=user.id, username=user.username, name=data.name,
                    email=data.email, phone=data.phone))
    _commit_or_conflict(db)
    return user


def create_staff(db: Session, admin: User, data: StaffCreate) -> User:
    _ensure_free(db, data.username, data.email)
    user = User(username=data.username, email=data.email, full_name=data.full_name,
                password_hash=hash_password(data.password), role="staff")
    db.add(user)
    db.flush()
    audit.log(db, admin.username, "staff_created", "user", user.id, user.username)
    _commit_or_conflict(db)
    return user


def authenticate(db: Session, identifier: str, password: str) -> User:
    ident = identifier.strip().lower()
    user = db.scalar(select(User).where(or_(User.username == ident, User.email == ident)))
    ok = verify_password(password, user.password_hash if user else DUMMY_HASH)
    if not user or not ok:
        raise HTTPException(401, "Invalid username/email or password")
    if not user.is_active:
        raise HTTPException(403, "This account has been disabled")
    return user


def request_password_reset(db: Session, email: str) -> tuple[str, str] | None:
    """Returns (email, raw_token) to send, or None. Callers answer identically either way."""
    user = db.scalar(select(User).where(User.email == email))
    if not user or not user.is_active:
        return None
    now = datetime.now(timezone.utc)
    db.execute(update(PasswordResetToken)  # only the newest link works
               .where(PasswordResetToken.user_id == user.id, PasswordResetToken.used_at.is_(None))
               .values(used_at=now))
    raw, hashed = new_reset_token()
    db.add(PasswordResetToken(user_id=user.id, token_hash=hashed,
                              expires_at=now + timedelta(minutes=get_settings().reset_token_minutes)))
    db.commit()
    return user.email, raw


def send_reset_email(to: str, raw_token: str) -> None:
    s = get_settings()
    link = f"{s.frontend_url}/reset-password?token={raw_token}"
    send_email(to, "Reset your Brightloop password",
               f"We received a request to reset your password.\n\n{link}\n\n"
               f"This link expires in {s.reset_token_minutes} minutes and can be used once. "
               "If you did not ask for this, ignore this email.")


def reset_password(db: Session, raw_token: str, new_password: str) -> None:
    bad = HTTPException(400, "This reset link is invalid or has expired")
    row = db.scalar(select(PasswordResetToken).where(PasswordResetToken.token_hash == hash_token(raw_token)))
    now = datetime.now(timezone.utc)
    if not row or row.used_at is not None or _aware(row.expires_at) < now:
        raise bad
    user = db.get(User, row.user_id)
    if not user or not user.is_active:
        raise bad
    user.password_hash = hash_password(new_password)
    row.used_at = now  # single use
    audit.log(db, user.username, "password_reset", "user", user.id)
    db.commit()


def set_active(db: Session, admin: User, user_id: int, active: bool) -> User:
    user = db.get(User, user_id)
    if not user or user.role != "staff":
        raise HTTPException(404, "Staff user not found")
    user.is_active = active
    audit.log(db, admin.username, "staff_active_changed", "user", user.id, str(active))
    db.commit()
    return user
