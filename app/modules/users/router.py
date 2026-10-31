from fastapi import APIRouter, BackgroundTasks, Depends
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.core.ratelimit import rate_limit
from app.core.security import create_access_token

from . import service
from .models import User
from .schemas import (ForgotPasswordRequest, LoginRequest, MessageOut, ResetPasswordRequest,
                      SignupRequest, StaffCreate, TokenResponse, UserActiveUpdate, UserOut)

auth_router = APIRouter(prefix="/api/auth", tags=["auth"])
users_router = APIRouter(prefix="/api/users", tags=["users"])


def _token(user: User) -> TokenResponse:
    return TokenResponse(access_token=create_access_token(user), user=UserOut.model_validate(user))


@auth_router.post("/signup", response_model=TokenResponse, status_code=201,
                  dependencies=[Depends(rate_limit("signup", 10))])
def signup(body: SignupRequest, db: Session = Depends(get_db)):
    return _token(service.signup(db, body))


@auth_router.post("/login", response_model=TokenResponse, dependencies=[Depends(rate_limit("login", 10))])
def login(body: LoginRequest, db: Session = Depends(get_db)):
    return _token(service.authenticate(db, body.identifier, body.password))


@auth_router.post("/token", response_model=TokenResponse, include_in_schema=True,
                  dependencies=[Depends(rate_limit("login", 10))])
def token_form(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Form-based login used by the Authorize button in /docs ('username' = username or email)."""
    return _token(service.authenticate(db, form.username, form.password))


@auth_router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@auth_router.post("/forgot-password", response_model=MessageOut,
                  dependencies=[Depends(rate_limit("forgot", 5))])
def forgot_password(body: ForgotPasswordRequest, tasks: BackgroundTasks, db: Session = Depends(get_db)):
    pending = service.request_password_reset(db, body.email)
    if pending:
        tasks.add_task(service.send_reset_email, *pending)
    return MessageOut(message="If that email is registered, a reset link has been sent.")


@auth_router.post("/reset-password", response_model=MessageOut,
                  dependencies=[Depends(rate_limit("reset", 10))])
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    service.reset_password(db, body.token, body.new_password)
    return MessageOut(message="Password updated. You can now log in.")


@users_router.post("/staff", response_model=UserOut, status_code=201)
def create_staff(body: StaffCreate, admin: User = Depends(require_role("admin")),
                 db: Session = Depends(get_db)):
    return service.create_staff(db, admin, body)


@users_router.get("/staff", response_model=list[UserOut])
def list_staff(_: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    return db.scalars(select(User).where(User.role == "staff").order_by(User.id)).all()


@users_router.patch("/{user_id}/active", response_model=UserOut)
def set_active(user_id: int, body: UserActiveUpdate, admin: User = Depends(require_role("admin")),
               db: Session = Depends(get_db)):
    return service.set_active(db, admin, user_id, body.is_active)
