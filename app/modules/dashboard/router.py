from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import require_role
from app.db import get_db
from app.modules.dashboard.service import subscription_summary

router = APIRouter(prefix="/dashboard", tags=["Dashboard"], dependencies=[Depends(require_role("admin", "staff"))])


@router.get("/subscriptions")
def dashboard_subscriptions(to_date: date | None = None, db: Session = Depends(get_db)):
    """Active subscriptions, MRR (now and for the last 6 months), MRR by plan and upcoming renewals."""
    return subscription_summary(db, to_date)
