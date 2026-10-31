import hashlib
import re
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from .config import get_settings

USERNAME_RE = re.compile(r"^[a-z][a-z0-9_]{2,29}$")
SPECIAL = re.compile(r"[^A-Za-z0-9\s]")


def normalize_username(v: str) -> str:
    """Lowercase + trim, then validate. This is the cross-database customer key."""
    v = v.strip().lower()
    if not USERNAME_RE.match(v):
        raise ValueError("Username must be 3-30 characters: lowercase letters, digits or underscore, "
                         "starting with a letter")
    return v


def validate_password(pw: str) -> str:
    problems = []
    if len(pw) <= 8:
        problems.append("be more than 8 characters")
    if len(pw) > 64:
        problems.append("be at most 64 characters")
    if not re.search(r"[A-Z]", pw):
        problems.append("contain an uppercase letter")
    if not re.search(r"[a-z]", pw):
        problems.append("contain a lowercase letter")
    if not SPECIAL.search(pw):
        problems.append("contain a special character")
    if problems:
        raise ValueError("Password must " + ", ".join(problems))
    return pw


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt(rounds=12)).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode()[:72], hashed.encode())
    except ValueError:
        return False


DUMMY_HASH = hash_password("Dummy#Password1")  # equalises timing for unknown users


@dataclass(frozen=True)
class TokenIdentity:
    """What a verified JWT proves. `username` is the cross-database customer key."""
    username: str
    role: str
    user_id: int


def create_access_token(user) -> str:
    s = get_settings()
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {"sub": user.username, "uid": user.id, "role": user.role, "iss": s.jwt_issuer,
         "iat": now, "exp": now + timedelta(minutes=s.access_token_minutes)},
        s.jwt_secret, algorithm=s.jwt_algorithm)


def decode_access_token(token: str) -> TokenIdentity:
    s = get_settings()
    p = jwt.decode(token, s.jwt_secret, algorithms=[s.jwt_algorithm], issuer=s.jwt_issuer,
                   options={"require": ["exp", "sub", "iss", "role", "uid"]})
    return TokenIdentity(username=p["sub"], role=p["role"], user_id=int(p["uid"]))


def new_reset_token() -> tuple[str, str]:
    raw = secrets.token_urlsafe(32)
    return raw, hash_token(raw)


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()
