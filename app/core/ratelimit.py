import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

from .config import get_settings

_hits: dict[tuple[str, str], deque] = defaultdict(deque)


def rate_limit(name: str, limit: int, window: int = 60):
    """In-memory sliding window per client IP (fine for a single local process)."""

    def dep(request: Request):
        if not get_settings().rate_limit_enabled:
            return
        key = (name, request.client.host if request.client else "unknown")
        now = time.monotonic()
        q = _hits[key]
        while q and now - q[0] > window:
            q.popleft()
        if len(q) >= limit:
            raise HTTPException(429, "Too many requests. Please try again shortly.",
                                headers={"Retry-After": str(window)})
        q.append(now)

    return dep
