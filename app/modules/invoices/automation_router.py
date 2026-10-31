from fastapi import APIRouter, Depends, Request

from app.core.deps import require_role

router = APIRouter(prefix="/automation", tags=["Automation"])


@router.get("", dependencies=[Depends(require_role("admin", "staff"))])
def automation_status(request: Request):
    """Whether the daily jobs are switched on, when they run next, and what the last run did."""
    return request.app.state.automation.status()


@router.post("/run", dependencies=[Depends(require_role("admin"))])
def run_automation_now(request: Request):
    """Run billing, auto-close and overdue reminders right now (admin only)."""
    return request.app.state.automation.run_now("manual").__dict__
