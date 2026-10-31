# Brightloop frontend

React + Vite frontend for the subscription management system.

## Run it

    npm install
    npm run dev

Open http://localhost:5173. While mock data is on, log in with:

| Role     | Email                    | Password |
|----------|--------------------------|----------|
| Admin    | admin@brightloop.test    | demo123  |
| Staff    | staff@brightloop.test    | demo123  |
| Customer | customer@brightloop.test | demo123  |

## Connecting the backend

1. Start the FastAPI server on port 8000. Vite forwards every `/api/...` request to it, so `/api/auth/login` reaches `http://localhost:8000/auth/login`.
2. In `src/api/api.js`, set the area you want to go live to `false` in `MOCK`.
3. Check `ENDPOINTS` and `LOGIN_USES_FORM` in the same file against the backend routes. My account also expects `PATCH /users/me` (body `{ name }`). Password changes go through Forgot password on the login page.

The dashboard charts need two additions to the summary routes:
- `/invoices/summary` returns `months` (the last 6 months up to `to_date`, oldest first, each `{ month: "2026-10", revenue, outstanding, overdue_amount }`) and `collection` (`{ paid, unpaid, overdue }` for invoices issued between the dates).
- `/subscriptions/summary?to_date=` returns:
  - `active_by_month`: `[{ month, count }]`
  - `mrr` and `mrr_by_month` (`[{ month, mrr }]`). Yearly plans count as a twelfth per month.
  - `mrr_movement` for the month of `to_date`: `{ month, start, new_mrr, new_count, expansion_mrr, expansion_count, contraction_mrr, contraction_count, churn_mrr, churn_count, end }`. `start + new + expansion − contraction − churn` should equal `end`.
  - `plans`: `[{ plan_name, subscribers, mrr }]`
  - `renewals_next_30_days`: `[{ id, date, customer_name, plan_name, billing_cycle, amount }]`

Plans and the customer's Plans & payment page use:
- `GET /plans` (add `?public_only=true` for customers), `POST /plans`, `PATCH /plans/{id}`. A plan is `{ id, name, description, price, billing_cycle, features: [], trial_days, is_public, subscriber_count }`. Only admins may create or change plans. Plans are hidden with `is_public: false`, never deleted.
- `GET /subscriptions/me` returns `{ plan_id, plan_name, status, next_billing_date, scheduled_plan_id, scheduled_plan_name }`. `POST /subscriptions/me/change-plan` with `{ plan_id }` schedules the switch for the next billing date, and sending the current plan cancels it.
- `GET /payment-methods/me`, `POST /payment-methods/me/{id}/default`, `DELETE /payment-methods/me/{id}`. A method is `{ id, type: "card" | "upi" | "netbanking", brand, last4, expiry, upi_id, bank_name, is_default }`. Card numbers never go through this app: they're added in the payment gateway's own window, which hands back only the brand and last 4 digits.

The fake responses in `src/api/mockData.js` show the field names each page expects.

## Adding your page

1. Build it in `src/pages/`, using the shared components from `src/components`.
2. In `src/App.jsx`, swap its `<Placeholder />` in `PAGES` for your component.
3. Need a new menu link? Add one line to `src/layout/menu.js`, with the roles allowed to see it.

Get data only through functions in `src/api/api.js`, and use `useApi()` so loading and error states work the same way everywhere.

## Shared components

- `Button`: `variant` is primary, secondary, danger or ghost. Also takes `size` and `loading`.
- `FormField`: label, input, hint and error. Set `as="select"` or `as="textarea"` for those inputs.
- `Table`: takes `columns` and `rows`, and handles loading, empty and error states itself.
- `StatusBadge`: `status="paid"`, `"overdue"`, `"draft"` and so on.
- `Card`, `PageHeader`, `StateMessage`, `BillingRing`
- `Modal`: give a Cancel button `data-close` so it animates out, for example `<Button variant="secondary" data-close>Cancel</Button>`.
- `useToast()`: call `toast("Invoice sent")` after an action, or `toast(message, "error")` when it fails.
- `Skeleton`: a shimmering placeholder while something loads. `Table` already uses one.
- Charts, in `src/components/charts`:
  - `ColumnChart`: one value per month or category, with hover tooltips.
  - `Sparkline`: a tiny trend line for a card.
  - `SegmentedBar`: one total split into parts, like paid, due and overdue.
  - `DivergingBars`: gains and losses either side of zero.
  - `BarList`: a few categories ranked by value, like plans.
  - `CalendarHeatmap`: the next N days, shaded by how many things fall on each day.
  Each file's top comment shows how to use it.

All animations live in `src/motion.css`, and they all switch off when someone turns on "reduce motion" in their system settings.

All colours and spacing are tokens in `src/theme.css`. Use `var(--teal)`, not hex codes.
