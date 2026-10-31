"""Fill the database with realistic demo data in one go.

<<<<<<< HEAD
Run from the repo root (where requirements.txt is):
=======
Run from the backend folder:
>>>>>>> 8d9173b2e564fcd208e541743dbe853f25a62fe6
    python seed.py            demo data (about 12 customers)
    python seed.py --big 5000 demo data plus 5,000 extra subscriptions (speed test)
    python seed.py --reset    wipe everything first, then add demo data
"""

import argparse
import random
from datetime import date, timedelta
from decimal import Decimal

from app.main import app  # noqa: F401  creates all tables and switches on foreign keys
from app import models as m
from app import services
<<<<<<< HEAD
from app.core.database import SessionLocal as AuthSession
from app.core.security import hash_password
from app.db import Base, SessionLocal, engine
from app.modules.customers.models import Customer
from app.modules.users.models import User
=======
from app.db import Base, SessionLocal, engine
>>>>>>> 8d9173b2e564fcd208e541743dbe853f25a62fe6
from app.modules.discounts.models import Discount
from app.modules.invoices import service as invoice_service
from app.modules.invoices.billing import run_billing
from app.modules.invoices.models import Invoice
from app.modules.payments.models import Payment
from app.modules.payments.schemas import PaymentCreate
from app.modules.quotations import service as quotation_service
from app.modules.quotations.models import QuotationTemplate, QuotationTemplateLine
from app.modules.quotations.schemas import UseTemplateIn

TODAY = date.today()
random.seed(7)  # same data every time, so the demo is predictable

CUSTOMERS = [
    ("Sharma Traders", "accounts@sharmatraders.in"),
    ("Kayal Studio", "hello@kayalstudio.in"),
    ("Malabar Spices Co", "finance@malabarspices.in"),
    ("Periyar Textiles", "billing@periyartextiles.in"),
    ("Greenleaf Organics", "pay@greenleaf.in"),
    ("Backwater Tours", "admin@backwatertours.in"),
    ("Coastal Logistics", "ap@coastallogistics.in"),
    ("Vembanad Foods", "accounts@vembanadfoods.in"),
    ("Thrissur Motors", "finance@thrissurmotors.in"),
    ("Munnar Tea House", "office@munnartea.in"),
    ("Cochin Dental Care", "billing@cochindental.in"),
    ("Alleppey Boatworks", "accounts@alleppeyboats.in"),
]


def add_catalog(db):
    crm = m.Product(name="Brightloop CRM", category="Software", base_price=Decimal("1000.00"),
                    description="Customer relationship management")
    accounting = m.Product(name="Brightloop Accounting", category="Software", base_price=Decimal("1500.00"),
                           description="Invoicing and books")
    storage = m.Product(name="Extra Storage 100 GB", category="Add-on", base_price=Decimal("200.00"),
                        description="Add-on storage")
    db.add_all([crm, accounting, storage])
    db.flush()

    standard = m.Variant(product_id=crm.id, name="Standard", sku="CRM-STD", price_extra=Decimal("0.00"))
    odoo = m.Variant(product_id=crm.id, name="Odoo", sku="CRM-ODOO", price_extra=Decimal("560.00"),
                     attributes={"brand": "Odoo"})
    db.add_all([standard, odoo])

    monthly = m.Plan(name="Monthly", price=Decimal("1000.00"), billing_period="monthly", payment_terms=15)
    yearly = m.Plan(name="Yearly", price=Decimal("10000.00"), billing_period="yearly", payment_terms=30)
    weekly = m.Plan(name="Weekly", price=Decimal("300.00"), billing_period="weekly", payment_terms=7)
    db.add_all([monthly, yearly, weekly])

    gst = m.Tax(name="GST 18%", rate=Decimal("18.00"))
    db.add(gst)
    db.flush()

    db.add_all([
        Discount(name="Bulk 10% (10+ seats)", discount_type="percent", value=Decimal("10"),
                 min_quantity=10, start_date=TODAY - timedelta(days=365),
                 end_date=TODAY + timedelta(days=365), used_count=0),
        Discount(name="Accounting launch ₹500 off", discount_type="fixed", value=Decimal("500"),
                 product_id=accounting.id, start_date=TODAY - timedelta(days=120),
                 end_date=TODAY + timedelta(days=60), usage_limit=10, used_count=0),
        Discount(name="Diwali 15% (expired)", discount_type="percent", value=Decimal("15"),
                 start_date=TODAY - timedelta(days=400), end_date=TODAY - timedelta(days=300), used_count=0),
    ])
    db.commit()
    return {
        "crm": crm, "accounting": accounting, "storage": storage,
        "standard": standard, "odoo": odoo,
        "monthly": monthly, "yearly": yearly, "weekly": weekly, "gst": gst,
    }


def username_for(name):
    """Sharma Traders -> sharma_traders (matches Member 2's username rules)."""
    return "".join(ch if ch.isalnum() else "_" for ch in name.lower()).strip("_")[:30]


def make_subscription(db, number, name, email, plan, start, lines, status="active"):
    subscription = m.Subscription(
        subscription_number=number, customer_name=name, customer_email=email,
        customer_username=username_for(name),
        plan_id=plan.id, start_date=start, payment_terms=plan.payment_terms, status="draft",
    )
    for product, variant, quantity, tax in lines:
        price = product.base_price + (variant.price_extra if variant else Decimal("0"))
        subscription.lines.append(m.SubscriptionLine(
            product_id=product.id, variant_id=variant.id if variant else None,
            description=f"{product.name}{' - ' + variant.name if variant else ''}",
            quantity=quantity, unit_price=price, tax_id=tax.id,
        ))
    db.add(subscription)
    db.commit()
    if status == "active":
        services.activate_subscription(db, subscription)  # the real activation, so next_invoice_date is set
    else:
        subscription.status = status
        db.commit()
    return subscription


def add_demo_subscriptions(db, c):
    picks = [
        (c["crm"], c["odoo"], 10), (c["crm"], c["standard"], 3), (c["accounting"], None, 5),
        (c["crm"], c["odoo"], 15), (c["accounting"], None, 2), (c["crm"], c["standard"], 12),
    ]
    for index, (name, email) in enumerate(CUSTOMERS):
        product, variant, quantity = picks[index % len(picks)]
        lines = [(product, variant, quantity, c["gst"])]
        if index % 3 == 0:
            lines.append((c["storage"], None, 1, c["gst"]))
        plan = c["yearly"] if index % 5 == 4 else c["monthly"]
        start = TODAY - timedelta(days=20 + index * 9)
        status = "active"
        if index == len(CUSTOMERS) - 1:
            status, start = "quotation", TODAY + timedelta(days=5)
        elif index == len(CUSTOMERS) - 2:
            status, start = "draft", TODAY + timedelta(days=10)
        make_subscription(db, f"SUB-{index + 1:04d}", name, email, plan, start, lines, status)


def add_big_load(db, c, count):
    print(f"Adding {count} extra subscriptions...")
    for i in range(count):
        start = TODAY - timedelta(days=i % 90)
        subscription = m.Subscription(
            subscription_number=f"SUB-L{i + 1:05d}", customer_name=f"Load Test Customer {i % 700}",
            customer_username=f"load_customer_{i % 700}",
            plan_id=c["monthly"].id, status="active", start_date=start,
            next_invoice_date=start, payment_terms=15,
        )
        subscription.lines.append(m.SubscriptionLine(
            product_id=c["crm"].id, variant_id=c["standard"].id, quantity=1 + i % 20,
            unit_price=Decimal("1000.00"), tax_id=c["gst"].id,
        ))
        db.add(subscription)
        if i % 1000 == 999:
            db.commit()
    db.commit()


def add_quotation_templates(db, c):
    """Two ready-made offers, plus one quote created from a template (status: quotation)."""
    starter = QuotationTemplate(
        name="CRM Starter Pack", plan_id=c["monthly"].id, validity_days=30,
        description="10 seats of CRM (Odoo edition) with extra storage",
        lines=[QuotationTemplateLine(product_id=c["crm"].id, variant_id=c["odoo"].id, quantity=10, tax_id=c["gst"].id),
               QuotationTemplateLine(product_id=c["storage"].id, quantity=1, tax_id=c["gst"].id)],
    )
    enterprise = QuotationTemplate(
        name="Enterprise Yearly", plan_id=c["yearly"].id, validity_days=15,
        description="CRM and Accounting for larger teams, billed yearly",
        lines=[QuotationTemplateLine(product_id=c["crm"].id, variant_id=c["standard"].id, quantity=25, tax_id=c["gst"].id),
               QuotationTemplateLine(product_id=c["accounting"].id, quantity=10, tax_id=c["gst"].id)],
    )
    db.add_all([starter, enterprise])
    db.commit()
    quotation_service.use_template(db, enterprise, UseTemplateIn(
        customer_username="kerala_retail_group", customer_name="Kerala Retail Group",
        customer_email="procurement@keralaretail.in",
    ))


<<<<<<< HEAD
# Demo logins (local demo data only, not real accounts)
DEMO_STAFF = ("ravi", "Ravi Menon", "ravi@brightloop.in", "Staff@12345")
DEMO_CUSTOMER_PASSWORD = "Cust@12345"  # for Sharma Traders: accounts@sharmatraders.in


def add_people():
    """Customer records (Member 2's login database) matching the demo subscriptions,
    plus one staff login and one customer login. Safe to run again: existing ones are kept."""
    extra = [("Kerala Retail Group", "procurement@keralaretail.in")]
    with AuthSession() as db:
        def user(username, full_name, email, password, role):
            existing = db.query(User).filter((User.username == username) | (User.email == email)).first()
            if existing:
                return existing
            new = User(username=username, full_name=full_name, email=email, role=role,
                       password_hash=hash_password(password))
            db.add(new)
            db.flush()
            return new

        user(*DEMO_STAFF, role="staff")
        sharma_login = user("sharma_traders", "Sharma Traders", CUSTOMERS[0][1], DEMO_CUSTOMER_PASSWORD, "customer")
        for name, email in CUSTOMERS + extra:
            username = username_for(name)
            if db.query(Customer).filter(Customer.username == username).first():
                continue
            db.add(Customer(username=username, name=name, email=email,
                            user_id=sharma_login.id if username == "sharma_traders" else None))
        db.commit()


=======
>>>>>>> 8d9173b2e564fcd208e541743dbe853f25a62fe6
def confirm_and_collect(db):
    """Confirm the invoices, then pay some fully, some partly, and leave some overdue."""
    invoices = db.query(Invoice).filter(Invoice.status == "draft").order_by(Invoice.id).all()
    for invoice in invoices:
        invoice_service.confirm(invoice)
    db.commit()

    for count, invoice in enumerate(invoices, start=1):
        if invoice.status != "confirmed":
            continue
        roll = random.random()
        pay_date = min(TODAY, invoice.invoice_date + timedelta(days=random.randint(1, 12)))
        method = random.choice(["upi", "bank_transfer", "card", "cheque", "cash"])
        balance = invoice_service.balance_due(invoice)
        if roll < 0.55:
            amount = balance  # paid in full
        elif roll < 0.75:
            amount = (balance / 2).quantize(Decimal("0.01"))  # partly paid
        else:
            continue  # left unpaid: becomes overdue once past its due date
        if amount <= 0:
            continue
        # Same checks as the real API (PaymentCreate validates), saved in batches for speed
        data = PaymentCreate(method=method, amount=amount, payment_date=pay_date, note="Seeded demo payment")
        db.add(Payment(invoice_id=invoice.id, method=data.method, amount=data.amount,
                       payment_date=data.payment_date, note=data.note))
        invoice.amount_paid = Decimal(str(invoice.amount_paid)) + data.amount
        if invoice_service.balance_due(invoice) <= 0:
            invoice.status = "paid"
        if count % 1000 == 0:
            db.commit()
    db.commit()


def main():
    parser = argparse.ArgumentParser(description="Fill the database with demo data")
    parser.add_argument("--reset", action="store_true", help="delete all data first")
    parser.add_argument("--big", type=int, default=0, help="also add this many extra subscriptions")
    args = parser.parse_args()

    if args.reset:
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        print("Database wiped.")

    db = SessionLocal()
    try:
        if db.query(m.Product).first():
            print("The database already has data. Run 'python seed.py --reset' to start fresh.")
            return

        catalog = add_catalog(db)
        add_demo_subscriptions(db, catalog)
        add_quotation_templates(db, catalog)
        if args.big:
            add_big_load(db, catalog, args.big)

        result = run_billing(db)
        print(f"Billing run: {result.created} invoices created")
        confirm_and_collect(db)

<<<<<<< HEAD
        add_people()
=======
>>>>>>> 8d9173b2e564fcd208e541743dbe853f25a62fe6
        summary = invoice_service.summary(db, None, None)
        print("Done. Dashboard numbers:")
        print(f"  Revenue collected: {summary.revenue}")
        print(f"  Outstanding:       {summary.outstanding}")
        print(f"  Overdue invoices:  {summary.overdue_count} ({summary.overdue_amount})")
<<<<<<< HEAD
        print("Demo logins (besides your admin):")
        print(f"  Staff:    {DEMO_STAFF[2]} / {DEMO_STAFF[3]}")
        print(f"  Customer: {CUSTOMERS[0][1]} / {DEMO_CUSTOMER_PASSWORD}  (Sharma Traders)")
=======
>>>>>>> 8d9173b2e564fcd208e541743dbe853f25a62fe6
    finally:
        db.close()


if __name__ == "__main__":
    main()
