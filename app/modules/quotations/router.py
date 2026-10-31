from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app import models as m
from app.core.deps import require_role
from app.db import get_db
from app.modules.quotations import service
from app.modules.quotations.models import Quotation, QuotationTemplate, QuotationTemplateLine
from app.modules.quotations.schemas import QuotationOut, QuotationPage, TemplateIn, TemplateOut, UseTemplateIn

STAFF = require_role("admin", "staff")
ADMIN = require_role("admin")

# Admin and staff can view and use templates; only the admin creates or edits them
router = APIRouter(tags=["Quotations"], dependencies=[Depends(STAFF)])


def load_template(db: Session, template_id: int) -> QuotationTemplate:
    template = (
        db.query(QuotationTemplate)
        .options(
            selectinload(QuotationTemplate.plan),
            selectinload(QuotationTemplate.lines).selectinload(QuotationTemplateLine.product),
            selectinload(QuotationTemplate.lines).selectinload(QuotationTemplateLine.variant),
        )
        .filter(QuotationTemplate.id == template_id)
        .first()
    )
    if not template:
        raise HTTPException(status_code=404, detail="Quotation template not found")
    return template


def load_quotation(db: Session, subscription_id: int) -> Quotation:
    quotation = (
        db.query(Quotation)
        .options(
            selectinload(Quotation.subscription).selectinload(m.Subscription.lines),
            selectinload(Quotation.template),
        )
        .filter(Quotation.subscription_id == subscription_id)
        .first()
    )
    if not quotation:
        raise HTTPException(status_code=404, detail="No quotation found for this subscription")
    return quotation


def save_template(db: Session, template: QuotationTemplate) -> TemplateOut:
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A template with this name already exists")
    return service.template_out(load_template(db, template.id))


# ---------- Templates ----------

@router.get("/quotation-templates", response_model=list[TemplateOut])
def list_templates(active_only: bool = False, db: Session = Depends(get_db)):
    query = db.query(QuotationTemplate).options(
        selectinload(QuotationTemplate.plan),
        selectinload(QuotationTemplate.lines).selectinload(QuotationTemplateLine.product),
        selectinload(QuotationTemplate.lines).selectinload(QuotationTemplateLine.variant),
    )
    if active_only:
        query = query.filter(QuotationTemplate.is_active.is_(True))
    return [service.template_out(t) for t in query.order_by(QuotationTemplate.name).all()]


@router.get("/quotation-templates/{template_id}", response_model=TemplateOut)
def get_template(template_id: int, db: Session = Depends(get_db)):
    return service.template_out(load_template(db, template_id))


@router.post("/quotation-templates", response_model=TemplateOut, status_code=201, dependencies=[Depends(ADMIN)])
def create_template(data: TemplateIn, db: Session = Depends(get_db)):
    try:
        service.check_template(db, data)
    except service.QuotationRuleError as error:
        raise HTTPException(status_code=400, detail=str(error))
    template = QuotationTemplate()
    service.apply_template_data(template, data)
    db.add(template)
    return save_template(db, template)


@router.put("/quotation-templates/{template_id}", response_model=TemplateOut, dependencies=[Depends(ADMIN)])
def update_template(template_id: int, data: TemplateIn, db: Session = Depends(get_db)):
    template = load_template(db, template_id)
    try:
        service.check_template(db, data)
    except service.QuotationRuleError as error:
        raise HTTPException(status_code=400, detail=str(error))
    service.apply_template_data(template, data)
    return save_template(db, template)


@router.post("/quotation-templates/{template_id}/use", response_model=QuotationOut, status_code=201)
def use_template(template_id: int, data: UseTemplateIn, db: Session = Depends(get_db)):
    template = load_template(db, template_id)
    try:
        quotation = service.use_template(db, template, data)
    except service.QuotationRuleError as error:
        raise HTTPException(status_code=400, detail=str(error))
    return service.quotation_out(load_quotation(db, quotation.subscription_id))


# ---------- Quotations ----------

@router.get("/quotations", response_model=QuotationPage)
def list_quotations(
    expired: bool | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(Quotation)
    if expired is True:
        query = query.filter(Quotation.valid_until < date.today())
    elif expired is False:
        query = query.filter(Quotation.valid_until >= date.today())
    total = query.count()
    items = (
        query.options(
            selectinload(Quotation.subscription).selectinload(m.Subscription.lines),
            selectinload(Quotation.template),
        )
        .order_by(Quotation.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return QuotationPage(items=[service.quotation_out(q) for q in items], total=total, page=page, page_size=page_size)


@router.get("/quotations/{subscription_id}", response_model=QuotationOut)
def get_quotation(subscription_id: int, db: Session = Depends(get_db)):
    return service.quotation_out(load_quotation(db, subscription_id))


@router.post("/quotations/{subscription_id}/accept", response_model=QuotationOut)
def accept_quotation(subscription_id: int, db: Session = Depends(get_db)):
    quotation = load_quotation(db, subscription_id)
    try:
        service.accept(quotation)
    except service.QuotationRuleError as error:
        raise HTTPException(status_code=400, detail=str(error))
    db.commit()
    return service.quotation_out(load_quotation(db, subscription_id))
