"""One router for everything Member 2 owns. The owner of the shared main.py mounts this:
    app.include_router(member2_api_router)
"""
from fastapi import APIRouter

from app.modules.customers.router import me_router, router as customers_router
from app.modules.users.router import auth_router, users_router

api_router = APIRouter()
for r in (auth_router, users_router, customers_router, me_router):
    api_router.include_router(r)
