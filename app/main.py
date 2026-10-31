"""The one Brightloop backend: login (Member 2), catalog (Member 3) and billing (Member 4).

Two SQLite files, as Member 2 designed:
  member2.db    logins, customers, reset tokens, audit log   (app.core.database)
  hackathon.db  products, plans, subscriptions, invoices...  (app.db)
They are linked by username, never by joining the two databases.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import event

# Member 2: logins and customers
from app import auth_models  # noqa: F401  registers users, customers, reset tokens, audit log
from app.auth_api import api_router as auth_router
from app.core.config import get_settings
from app.core.database import Base as AuthBase
from app.core.database import engine as auth_engine

# Member 3: products, variants, plans, taxes, subscriptions
from app import models  # noqa: F401
from app.db import Base, SessionLocal, engine
from app.routes import router as catalog_router

# Member 4: quotations, discounts, invoices, billing, payments
from app.modules.dashboard.router import router as dashboard_router
from app.modules.discounts import models as discount_models  # noqa: F401
from app.modules.discounts.router import router as discounts_router
from app.modules.invoices import models as invoice_models  # noqa: F401
from app.modules.invoices.automation import AutomationScheduler
from app.modules.invoices.automation_router import router as automation_router
from app.modules.invoices.portal import router as invoice_portal_router
from app.modules.invoices.router import router as invoices_router
from app.modules.payments import models as payment_models  # noqa: F401
from app.modules.payments.router import router as payments_router
from app.modules.quotations import models as quotation_models  # noqa: F401
from app.modules.quotations.router import router as quotations_router


# SQLite ignores foreign keys unless this is switched on for every connection
@event.listens_for(engine, "connect")
def enable_sqlite_foreign_keys(dbapi_connection, connection_record):
    if engine.url.get_backend_name() == "sqlite":
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


Base.metadata.create_all(bind=engine)
AuthBase.metadata.create_all(bind=auth_engine)  # same tables as Member 2's migration 0001

automation = AutomationScheduler(SessionLocal)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Daily billing, auto-close and overdue reminders run in the background while the server is up
    automation.start()
    yield
    automation.stop()


app = FastAPI(title="Brightloop API", version="1.0.0", lifespan=lifespan)
app.state.automation = automation

origins = {o.strip() for o in get_settings().cors_origins.split(",") if o.strip()}
origins |= {"http://localhost:5173", "http://127.0.0.1:5173"}
app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)  # Member 2's routes already start with /api
app.include_router(catalog_router, prefix="/api")
app.include_router(discounts_router, prefix="/api")
app.include_router(invoices_router, prefix="/api")
app.include_router(payments_router, prefix="/api")
app.include_router(invoice_portal_router, prefix="/api")  # customers: /api/me/invoices
app.include_router(quotations_router, prefix="/api")
app.include_router(automation_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")


@app.get("/")
def health_check():
    return {"message": "Brightloop API is running"}


@app.get("/api/health", tags=["health"])
def health():
    return {"status": "ok"}
