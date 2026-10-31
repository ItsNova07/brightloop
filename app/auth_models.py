"""Imports every Member 2 model so Alembic and create_all see the full schema."""
from app.core.audit import AuditLog  # noqa: F401
from app.modules.customers.models import Customer  # noqa: F401
from app.modules.users.models import PasswordResetToken, User  # noqa: F401
