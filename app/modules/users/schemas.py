from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.core.security import normalize_username, validate_password

Email = Annotated[EmailStr, AfterValidator(lambda v: v.strip().lower())]
Username = Annotated[str, AfterValidator(normalize_username)]


class _Password(BaseModel):
    @field_validator("password", "new_password", check_fields=False)
    @classmethod
    def _check(cls, v: str) -> str:
        return validate_password(v)


class SignupRequest(_Password):
    username: Username
    name: str = Field(min_length=1, max_length=150)
    email: Email
    password: str
    phone: str | None = Field(default=None, max_length=30)


class LoginRequest(BaseModel):
    identifier: str = Field(description="username or email")
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    email: str
    full_name: str | None = None
    role: str
    is_active: bool


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ForgotPasswordRequest(BaseModel):
    email: Email


class ResetPasswordRequest(_Password):
    token: str
    new_password: str


class MessageOut(BaseModel):
    message: str


class StaffCreate(_Password):
    username: Username
    full_name: str = Field(min_length=1, max_length=150)
    email: Email
    password: str


class UserActiveUpdate(BaseModel):
    is_active: bool
