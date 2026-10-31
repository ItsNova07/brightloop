BRIGHTLOOP - CONNECTED PAGE PATCH

This update replaces sidebar placeholder screens with API-backed list screens.

Pages connected:
- Subscriptions (GET /api/subscriptions)
- Quotations (GET /api/quotations)
- Invoices (GET /api/invoices)
- Payments (GET /api/payments)
- Discounts (GET /api/discounts)
- Customer: My subscriptions (new secure GET /api/me/subscriptions)
- Customer: My invoices (GET /api/me/invoices)

The new list pages show actual backend records. If the database is empty, they
show an empty-state message. If a request fails, they show the API error and a
retry action.

APPLYING THE UPDATE
1. Stop both development servers (Ctrl+C in each terminal).
2. Make a backup of your current Brightloop folder.
3. Extract this ZIP into the existing project folder and allow files to merge/
   overwrite. Do not delete your local .env file.
4. Start the backend from the project root:
   .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
5. Start the frontend in a second PowerShell window:
   cd frontend
   npm run dev
6. Refresh http://localhost:5173 and sign in again if prompted.

NOTE
The existing customer "Plans & payment" page still uses sample data for the
customer's selected subscription and saved payment methods. This backend
version does not yet implement the required /api/subscriptions/me and
/api/payment-methods/me endpoints. The staff-side list pages above use the
real backend endpoints.

The Python backend source was checked with compileall. A production frontend
build could not be verified here because npm dependency installation timed
out; run `npm install` in the frontend directory on your machine if required.
