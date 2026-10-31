from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, Session, mapped_column

from .database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    actor_username: Mapped[str | None] = mapped_column(String(30), index=True)
    action: Mapped[str] = mapped_column(String(60), index=True)
    target_type: Mapped[str] = mapped_column(String(40))
    target_id: Mapped[int | None] = mapped_column(Integer)
    detail: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True),
                                                 default=lambda: datetime.now(timezone.utc))


def log(db: Session, actor_username: str | None, action: str, target_type: str,
        target_id: int | None, detail: str | None = None) -> None:
    """Adds an audit row; the caller commits so it shares the request's transaction."""
    db.add(AuditLog(actor_username=actor_username, action=action, target_type=target_type,
                    target_id=target_id, detail=detail))
