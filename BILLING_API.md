# Billing API (Member 4)

All routes start with `/api`. Dates are `"YYYY-MM-DD"`, money is a plain number. Errors are `{ "detail": "message" }` (FastAPI validation errors, code 422, are a list).

## Login required

Every billing route needs `Authorization: Bearer <token>`, from `POST /api/auth/login` with `{ "identifier": "<username or email>", "password": "..." }` (Member 2's auth).

| Who | Can do |
|---|---|
| admin | everything, including create/edit discounts |
| staff | view discounts; run billing; view, confirm, cancel, send invoices; record and view payments; summary |
| customer | none of these (gets 403) |

No token or an expired one gives `401`; the wrong role gives `403`.

## Discounts

| Method | Route | Notes |
|---|---|---|
| GET | `/api/discounts` | Plain array, newest first |
| GET | `/api/discounts/{id}` | |
| POST | `/api/discounts` | Create |
| PUT | `/api/discounts/{id}` | Update (send all fields) |

Body for POST/PUT:

```json
{
  "name": "Bulk 10%",
  "discount_type": "percent",
  "value": 10,
  "min_amount": 0,
  "min_quantity": 10,
  "start_date": "2026-10-01",
  "end_date": "2026-12-31",
  "usage_limit": 100,
  "product_id": null,
  "active": true
}
```

- `discount_type` is `"fixed"` or `"percent"`; percent must be 100 or less
- `usage_limit: null` means unlimited; `product_id: null` means the whole subscription
- Responses add `id`, `used_count` and `status`: `active`, `scheduled`, `expired`, `used_up` or `inactive`

Taxes are Member 3's: `GET`/`POST /api/taxes`.

## Billing

| Method | Route | Notes |
|---|---|---|
| POST | `/api/billing/run` | Creates every invoice that is due. Safe to click twice. |

```json
{ "created": 12, "invoice_ids": [1, 2], "skipped": [], "message": "12 invoices created" }
```

## Invoices

| Method | Route | Notes |
|---|---|---|
| GET | `/api/invoices/summary?from_date=&to_date=` | Dashboard numbers |
| GET | `/api/invoices` | Paginated list with filters |
| GET | `/api/invoices/{id}` | Detail with lines and payments |
| POST | `/api/invoices/{id}/confirm` | draft → confirmed |
| POST | `/api/invoices/{id}/cancel` | Only if nothing has been paid |
| POST | `/api/invoices/{id}/send` | Confirmed or paid only; sets `sent_at` |

List filters: `status` (`draft`, `confirmed`, `paid`, `cancelled`), `customer` (name or email contains), `subscription_id`, `from_date`, `to_date` (on `invoice_date`), `overdue=true`, `page` (from 1), `page_size` (default 20, max 100).

List response:

```json
{
  "items": [
    {
      "id": 1,
      "number": "INV-0001",
      "subscription_id": 1,
      "subscription_number": "SUB-0001",
      "customer_name": "Sharma Traders",
      "customer_email": "sharma@example.com",
      "invoice_date": "2026-10-27",
      "due_date": "2026-11-11",
      "period_start": "2026-10-27",
      "period_end": "2026-11-26",
      "status": "confirmed",
      "subtotal": 15600.0,
      "discount_total": 1560.0,
      "tax_total": 2527.2,
      "total": 16567.2,
      "amount_paid": 10000.0,
      "balance_due": 6567.2,
      "is_overdue": false
    }
  ],
  "total": 134,
  "page": 1,
  "page_size": 20
}
```

Detail adds:

```json
{
  "sent_at": null,
  "lines": [
    {
      "id": 1, "product_id": 1, "variant_id": 1, "description": "CRM - Odoo",
      "quantity": 10, "unit_price": 1560.0, "amount": 15600.0, "discount_amount": 1560.0,
      "tax_name": "GST 18%", "tax_rate": 18.0, "tax_amount": 2527.2, "line_total": 16567.2
    }
  ],
  "payments": [
    { "id": 1, "method": "upi", "amount": 10000.0, "payment_date": "2026-10-31", "note": "" }
  ]
}
```

Summary response:

```json
{
  "revenue": 482000,
  "outstanding": 61500,
  "overdue_count": 9,
  "overdue_amount": 23400,
  "overdue_invoices": [
    { "id": 2207, "number": "INV-2207", "customer_name": "Kayal Studio", "due_date": "2026-10-27", "balance_due": 999 }
  ]
}
```

- `revenue`: payments received, by `payment_date`, inside the date range (all time if no range)
- `outstanding`: unpaid balance on confirmed invoices, as of now
- overdue: confirmed, `balance_due > 0` and `due_date` before today; the list is the 5 oldest

## Payments

| Method | Route | Notes |
|---|---|---|
| POST | `/api/invoices/{id}/payments` | Record a payment |
| GET | `/api/payments` | Paginated: `invoice_id`, `method`, `from_date`, `to_date`, `page`, `page_size` |

Body:

```json
{ "method": "upi", "amount": 10000, "payment_date": "2026-10-31", "note": "First part" }
```

- `method`: `cash`, `bank_transfer`, `upi`, `card`, `cheque` or `other`
- Rejected: amount 0 or less, more than `balance_due`, a future date, a date before the invoice date, or an invoice that is draft, cancelled or already paid
- The invoice becomes `paid` by itself when `balance_due` reaches 0

List rows: `id`, `invoice_id`, `invoice_number`, `customer_name`, `method`, `amount`, `payment_date`, `note`.

## Customer portal

A logged-in **customer** sees only their own invoices. The username comes from their login token, never from the request.

| Method | Route | Notes |
|---|---|---|
| GET | `/api/me/invoices?page=&page_size=` | Same shape as `/api/invoices`; confirmed, paid and cancelled only (no drafts) |
<<<<<<< HEAD
| GET | `/api/me/subscriptions` | Only the authenticated customer's own subscriptions |
=======
>>>>>>> 8d9173b2e564fcd208e541743dbe853f25a62fe6
| GET | `/api/me/invoices/{id}` | Same shape as `/api/invoices/{id}`; 404 if it isn't theirs |

Admin and staff get `403` here (they use `/api/invoices`). Invoices are matched to customers by `customer_username`, copied from the subscription when billing runs. Subscriptions must be created with `customer_username` set to the customer's login username.

## Quotations

Admin and staff only (customers get 403). Only the **admin** can create or edit templates.

| Method | Route | Notes |
|---|---|---|
| GET | `/api/quotation-templates?active_only=` | Plain array |
| GET | `/api/quotation-templates/{id}` | |
| POST | `/api/quotation-templates` | Admin only |
| PUT | `/api/quotation-templates/{id}` | Admin only; send all fields; set `is_active: false` to retire one |
| POST | `/api/quotation-templates/{id}/use` | Creates a subscription in `quotation` status from the template |
| GET | `/api/quotations?expired=&page=&page_size=` | Paginated |
| GET | `/api/quotations/{subscription_id}` | |
| POST | `/api/quotations/{subscription_id}/accept` | `quotation` → `confirmed`; refused once expired |

Template body:

```json
{
  "name": "CRM Starter Pack",
  "description": "10 seats of CRM (Odoo edition)",
  "plan_id": 1,
  "validity_days": 30,
  "is_active": true,
  "lines": [ { "product_id": 1, "variant_id": 2, "quantity": 10, "tax_id": 1 } ]
}
```

Template responses add `plan_name`, `billing_period`, each line's `product_name`, `variant_name` and today's `unit_price`, plus `estimated_total` (before discount and tax).

Use-template body (username follows Member 2's rules: lowercase letters, digits, underscore):

```json
{ "customer_username": "sharma_traders", "customer_name": "Sharma Traders", "customer_email": "accounts@sharmatraders.in", "start_date": null, "notes": null }
```

Quotation response:

```json
{
  "id": 1, "subscription_id": 13, "subscription_number": "SUB-0013", "subscription_status": "quotation",
  "customer_username": "kerala_retail_group", "customer_name": "Kerala Retail Group",
  "template_id": 2, "template_name": "Enterprise Yearly",
  "valid_until": "2026-11-15", "is_expired": false, "total_before_tax": 40000.0
}
```

Full flow: use template → accept → `POST /api/subscriptions/{id}/activate` (Member 3) → `POST /api/billing/run`.

## Automation

The server runs three jobs **by itself**: once when it starts (to catch up anything missed while it was off), then every 24 hours.

1. **Billing:** creates every invoice that is due (same engine as `POST /api/billing/run`)
2. **Auto-close:** active subscriptions past their end date become `closed`, only after their last period is billed
3. **Overdue reminders:** emails the customer about each overdue invoice, at most once every 3 days per invoice (needs Mailpit running locally; if it isn't, the run notes it and retries next time)

| Method | Route | Who |
|---|---|---|
| GET | `/api/automation` | admin, staff: `enabled`, `interval_hours`, `running`, `next_run_at`, `last_run` |
| POST | `/api/automation/run` | admin: run all three now, returns the result |

`last_run` / run result:

```json
{
  "started_at": "2026-10-31T09:35:13", "finished_at": "2026-10-31T09:35:13", "trigger": "server start",
  "invoices_created": 0, "subscriptions_closed": ["SUB-0007"],
  "reminders_sent": 5, "reminders_failed": 0, "reminders_skipped_no_email": 2,
  "notes": [], "error": null
}
```

`trigger` is `server start`, `daily schedule` or `manual`. Invoices also gain `reminder_sent_at` and `reminder_count` in the database. Settings in `.env`: `AUTOMATION_ENABLED`, `AUTOMATION_INTERVAL_HOURS`, `REMINDER_EVERY_DAYS`.
