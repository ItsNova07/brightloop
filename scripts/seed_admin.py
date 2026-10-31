"""Create the first admin from environment values (no credentials live in source).

    ADMIN_USERNAME=... ADMIN_EMAIL=... ADMIN_PASSWORD=... python -m scripts.seed_admin
or put them in your local .env. The login tables are created automatically if missing.
"""
import sys

from sqlalchemy import select

from app.auth_models import User
from app.core.config import get_settings
from app.core.database import Base, SessionLocal, engine
from app.core.security import hash_password, normalize_username, validate_password


def main() -> int:
    Base.metadata.create_all(bind=engine)  # same tables as migration 0001, so no alembic step needed
    s = get_settings()
    if not (s.admin_username and s.admin_email and s.admin_password):
        print("Set ADMIN_USERNAME, ADMIN_EMAIL and ADMIN_PASSWORD (env or .env) first.")
        return 1
    username = normalize_username(s.admin_username)
    validate_password(s.admin_password)
    with SessionLocal() as db:
        if db.scalar(select(User.id).where(User.username == username)):
            print(f"User '{username}' already exists; nothing to do.")
            return 0
        db.add(User(username=username, email=s.admin_email.strip().lower(), full_name="Administrator",
                    password_hash=hash_password(s.admin_password), role="admin"))
        db.commit()
    print(f"Admin '{username}' created.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
