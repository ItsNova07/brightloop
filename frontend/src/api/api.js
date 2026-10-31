// ------------------------------------------------------------------
// api.js — the ONLY file that talks to the backend.
// Every page imports functions from here. Pages never call fetch().
//
// HOW PLACEHOLDERS WORK
// Each backend area has its own mock switch below. While a switch is
// true, functions return fake data from mockData.js. When Member 2's
// endpoint for that area is live, set its switch to false. Pages don't
// change at all.
// ------------------------------------------------------------------
import * as mock from "./mockData.js";
import { ApiError } from "./ApiError.js";

export const MOCK = {
  auth: false, // Member 2: /api/auth/*
  users: false, // Member 2: /api/users/staff
  customers: false, // Member 2: /api/customers, /api/me/customer
  invoices: false, // Member 4: /api/invoices, /api/invoices/summary
  subscriptions: false, // dashboard numbers: /api/dashboard/subscriptions
  plans: false, // Member 3: /api/plans
  // Still sample data: the backend has no route for these yet
  mySubscription: true, // customer's own plan + "change my plan"
  payments: true, // customer's saved payment methods
};

// In dev, Vite forwards /api/* to http://localhost:8000 (see vite.config.js).
// For a deployed backend, set VITE_API_URL in a .env file.
const BASE_URL = import.meta.env.VITE_API_URL || "/api";

// FastAPI's OAuth2PasswordRequestForm expects form data with
// "username" + "password". If Member 2 used a JSON body instead
// ({ email, password }), set this to false.
const LOGIN_USES_FORM = false; // Member 2's /auth/login takes JSON: { identifier, password }

// All backend paths in one place. Ask Member 2 if any differ.
const ENDPOINTS = {
  login: "/auth/login",
  signup: "/auth/signup",
  forgotPassword: "/auth/forgot-password",
  resetPassword: "/auth/reset-password",
  me: "/auth/me",
  users: "/users/staff",
  createStaff: "/users/staff",
  customers: "/customers",
  customerMe: "/me/customer",
  invoices: "/invoices",
  invoiceSummary: "/invoices/summary",
  subscriptionSummary: "/dashboard/subscriptions",
  plans: "/plans",
  subscriptions: "/subscriptions",
  quotations: "/quotations",
  payments: "/payments",
  discounts: "/discounts",
  myInvoices: "/me/invoices",
  mySubscriptions: "/me/subscriptions",
  mySubscription: "/subscriptions/me",
  changeMyPlan: "/subscriptions/me/change-plan",
  myPaymentMethods: "/payment-methods/me",
};

const TOKEN_KEY = "brightloop_token";

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export { ApiError };

// FastAPI errors look like { detail: "text" } or
// { detail: [{ loc: [...], msg: "text" }, ...] } for validation.
function readErrorMessage(body, status) {
  if (body && typeof body.detail === "string") return body.detail;
  if (body && Array.isArray(body.detail) && body.detail.length > 0) {
    return body.detail.map((item) => item.msg).join(". ");
  }
  if (status === 0) return "Can't reach the server. Check that the backend is running.";
  if (status >= 500) return "The server hit an error. Try again in a moment.";
  return `Request failed (${status}).`;
}

async function request(path, { method = "GET", body, form } = {}) {
  const headers = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    payload = new URLSearchParams(form).toString();
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(BASE_URL + path, { method, headers, body: payload });
  } catch {
    throw new ApiError(readErrorMessage(null, 0), 0);
  }

  const text = await response.text();
  const data = text ? safeJson(text) : null;

  if (response.status === 401 && token) {
    tokenStore.clear();
    window.dispatchEvent(new Event("brightloop:logged-out"));
  }
  if (!response.ok) {
    throw new ApiError(readErrorMessage(data, response.status), response.status);
  }
  return data;
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { detail: text };
  }
}

// ---------------- Auth ----------------

export async function login(email, password) {
  if (MOCK.auth) return mock.login(email, password);
  const result = LOGIN_USES_FORM
    ? await request(ENDPOINTS.login, { method: "POST", form: { username: email, password } })
    : await request(ENDPOINTS.login, { method: "POST", body: { identifier: email, password } });
  return { token: result.access_token };
}

export function signup(details) {
  if (MOCK.auth) return mock.signup(details);
  return request(ENDPOINTS.signup, {
    method: "POST",
    body: { username: usernameFromEmail(details.email), name: details.name, email: details.email, password: details.password },
  });
}

// The backend identifies people by a username (lowercase letters, digits, underscore,
// starting with a letter, 3-30 characters). The forms only ask for an email, so one is
// made from it: "Accounts.Team@sharma.in" -> "accounts_team".
export function usernameFromEmail(email) {
  let name = String(email || "").split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  if (!/^[a-z]/.test(name)) name = `user_${name}`;
  if (name.length < 3) name = `${name}_user`;
  return name.slice(0, 30);
}

export function forgotPassword(email) {
  if (MOCK.auth) return mock.forgotPassword(email);
  return request(ENDPOINTS.forgotPassword, { method: "POST", body: { email } });
}

export function resetPassword(token, newPassword) {
  if (MOCK.auth) return mock.resetPassword(token, newPassword);
  return request(ENDPOINTS.resetPassword, {
    method: "POST",
    body: { token, new_password: newPassword },
  });
}

// Returns { id, name, email, role } where role is admin | staff | customer
export async function getCurrentUser() {
  if (MOCK.auth) return mock.getCurrentUser(tokenStore.get());
  const user = await request(ENDPOINTS.me);
  return normaliseUser(user);
}

// Update the logged-in user's own details. Returns the updated user.
export async function updateMe(details) {
  if (MOCK.auth) return mock.updateMe(tokenStore.get(), details);
  try {
    const profile = await request(ENDPOINTS.customerMe, { method: "PATCH", body: { name: details.name } });
    return normaliseUser(profile);
  } catch (err) {
    if (err.status === 403) throw new ApiError("Staff and admin names can't be changed here yet.", 403);
    throw err;
  }
}

// Backends often call the name field full_name; accept either.
function normaliseUser(user) {
  return { ...user, name: user.name || user.full_name || user.email };
}

// ---------------- Users (admin) ----------------

export async function getUsers() {
  if (MOCK.users) return mock.getUsers();
  const users = await request(ENDPOINTS.users);
  return users.map(normaliseUser);
}

export function createStaff(details) {
  if (MOCK.users) return mock.createStaff(details);
  return request(ENDPOINTS.createStaff, {
    method: "POST",
    body: { username: usernameFromEmail(details.email), full_name: details.name, email: details.email, password: details.password },
  }).then(normaliseUser);
}

// ---------------- Customers ----------------

// Backend customers have address_line1 and no company field, so address maps to
// address_line1 and company isn't stored yet.
function toCustomer(c) {
  return { ...c, address: c.address_line1 || "", company: c.company || "" };
}

export async function getCustomers() {
  if (MOCK.customers) return mock.getCustomers();
  const page = await request(`${ENDPOINTS.customers}?page_size=100`);
  return page.items.map(toCustomer);
}

export async function createCustomer(details) {
  if (MOCK.customers) return mock.createCustomer(details);
  const created = await request(ENDPOINTS.customers, {
    method: "POST",
    body: {
      username: usernameFromEmail(details.email),
      name: details.name,
      email: details.email,
      phone: details.phone || null,
      address_line1: details.address || null,
    },
  });
  return toCustomer(created);
}

export async function updateCustomer(id, details) {
  if (MOCK.customers) return mock.updateCustomer(id, details);
  const updated = await request(`${ENDPOINTS.customers}/${id}`, {
    method: "PATCH",
    body: { name: details.name, email: details.email, phone: details.phone || null, address_line1: details.address || null },
  });
  return toCustomer(updated);
}

export function deleteCustomer(id) {
  if (MOCK.customers) return mock.deleteCustomer(id);
  return request(`${ENDPOINTS.customers}/${id}`, { method: "DELETE" });
}

export async function getMyCustomerProfile() {
  if (MOCK.customers) return mock.getMyCustomerProfile();
  return toCustomer(await request(ENDPOINTS.customerMe));
}

export async function updateMyCustomerProfile(details) {
  if (MOCK.customers) return mock.updateMyCustomerProfile(details);
  const updated = await request(ENDPOINTS.customerMe, {
    method: "PATCH",
    body: { phone: details.phone || null, address_line1: details.address || null },
  });
  return toCustomer(updated);
}

// ---------------- Invoices ----------------
// Lists come back as { items, total, page, page_size }.
// filters: { status, customer_id, from_date, to_date, overdue, page, page_size }

export function getInvoices(filters = {}) {
  if (MOCK.invoices) return mock.getInvoices(filters);
  const { customer_id, ...rest } = filters; // the backend searches by name/email with ?customer=
  return request(`${ENDPOINTS.invoices}${toQuery(rest)}`);
}

// { revenue, outstanding, overdue_count, overdue_amount, overdue_invoices[],
//   months: [{ month: "2026-10", revenue, outstanding, overdue_amount }]   (last 6 months up to to_date, oldest first)
//   collection: { paid, unpaid, overdue } }                                (invoices issued between the dates)
export function getInvoiceSummary({ from_date, to_date } = {}) {
  if (MOCK.invoices) return mock.getInvoiceSummary({ from_date, to_date });
  return request(`${ENDPOINTS.invoiceSummary}${toQuery({ from_date, to_date })}`);
}

// ---------------- Subscriptions ----------------

// { active_count, active_by_month: [{ month, count }],
//   mrr, mrr_by_month: [{ month, mrr }],
//   mrr_movement: { month, start, new_mrr, new_count, expansion_mrr, expansion_count,
//                   contraction_mrr, contraction_count, churn_mrr, churn_count, end },
//   plans: [{ plan_name, subscribers, mrr }],
//   renewing_soon[], renewals_next_30_days: [{ id, date, customer_name, plan_name, billing_cycle, amount }] }
export function getSubscriptionSummary({ to_date } = {}) {
  if (MOCK.subscriptions) return mock.getSubscriptionSummary({ to_date });
  return request(`${ENDPOINTS.subscriptionSummary}${toQuery({ to_date })}`);
}


// ---------------- Connected operational lists ----------------

export function getSubscriptions({ status_filter } = {}) {
  return request(`${ENDPOINTS.subscriptions}${toQuery({ status_filter })}`);
}

export function getQuotations({ expired, page = 1, page_size = 20 } = {}) {
  return request(`${ENDPOINTS.quotations}${toQuery({ expired, page, page_size })}`);
}

export function getPayments({ invoice_id, method, from_date, to_date, page = 1, page_size = 20 } = {}) {
  return request(`${ENDPOINTS.payments}${toQuery({ invoice_id, method, from_date, to_date, page, page_size })}`);
}

export function getDiscounts() {
  return request(ENDPOINTS.discounts);
}

export function getMyInvoices({ page = 1, page_size = 20 } = {}) {
  return request(`${ENDPOINTS.myInvoices}${toQuery({ page, page_size })}`);
}

export function getMySubscriptions() {
  return request(ENDPOINTS.mySubscriptions);
}

// ---------------- Plans ----------------
// Plan: { id, name, description, price, billing_cycle: "monthly" | "quarterly" | "yearly",
//         features: string[], trial_days, is_public, subscriber_count }

// public_only: true for the customer view (only plans customers can choose)
// Member 3's plans use billing_period and is_active; the pages use billing_cycle and
// is_public. Trial days aren't stored by the backend yet, so they come back as 0.
function toPlan(p, subscriberCounts = {}) {
  return {
    ...p,
    price: Number(p.price),
    billing_cycle: p.billing_period,
    is_public: p.is_active,
    features: p.features || [],
    trial_days: 0,
    subscriber_count: subscriberCounts[p.id] || 0,
  };
}

function toBackendPlan(details) {
  const body = {};
  if (details.name !== undefined) body.name = details.name;
  if (details.description !== undefined) body.description = details.description;
  if (details.price !== undefined) body.price = details.price;
  if (details.billing_cycle !== undefined) body.billing_period = details.billing_cycle;
  if (details.features !== undefined) body.features = details.features;
  if (details.is_public !== undefined) body.is_active = details.is_public;
  return body;
}

async function activeSubscribersByPlan() {
  try {
    const subscriptions = await request(`/subscriptions${toQuery({ status_filter: "active" })}`);
    return subscriptions.reduce((counts, s) => ({ ...counts, [s.plan_id]: (counts[s.plan_id] || 0) + 1 }), {});
  } catch {
    return {};
  }
}

export async function getPlans({ public_only = false } = {}) {
  if (MOCK.plans) return mock.getPlans({ public_only });
  const [plans, counts] = await Promise.all([request(ENDPOINTS.plans), public_only ? {} : activeSubscribersByPlan()]);
  return plans.map((p) => toPlan(p, counts)).filter((p) => !public_only || p.is_public);
}

export async function createPlan(details) {
  if (MOCK.plans) return mock.createPlan(details);
  return toPlan(await request(ENDPOINTS.plans, { method: "POST", body: toBackendPlan(details) }));
}

export async function updatePlan(id, changes) {
  if (MOCK.plans) return mock.updatePlan(id, changes);
  const [updated, counts] = await Promise.all([
    request(`${ENDPOINTS.plans}/${id}`, { method: "PATCH", body: toBackendPlan(changes) }),
    activeSubscribersByPlan(),
  ]);
  return toPlan(updated, counts);
}

// ---------------- Customer: my subscription & payment methods ----------------

// { plan_id, plan_name, status, next_billing_date, scheduled_plan_id, scheduled_plan_name }
// scheduled_* is a switch the customer chose that starts on next_billing_date.
export function getMySubscription() {
  if (MOCK.mySubscription) return mock.getMySubscription();
  return request(ENDPOINTS.mySubscription);
}

// Schedules a switch for the next billing date. Choosing the current plan
// again cancels a scheduled switch.
export function changeMyPlan(planId) {
  if (MOCK.mySubscription) return mock.changeMyPlan(planId);
  return request(ENDPOINTS.changeMyPlan, { method: "POST", body: { plan_id: planId } });
}

// [{ id, type: "card" | "upi" | "netbanking", brand?, last4?, expiry?, upi_id?, bank_name?, is_default }]
// Card numbers never pass through this app: cards are added in the payment
// gateway's own secure window, which returns only brand and last 4 digits.
export function getMyPaymentMethods() {
  if (MOCK.payments) return mock.getMyPaymentMethods();
  return request(ENDPOINTS.myPaymentMethods);
}

export function setDefaultPaymentMethod(id) {
  if (MOCK.payments) return mock.setDefaultPaymentMethod(id);
  return request(`${ENDPOINTS.myPaymentMethods}/${id}/default`, { method: "POST" });
}

export function removePaymentMethod(id) {
  if (MOCK.payments) return mock.removePaymentMethod(id);
  return request(`${ENDPOINTS.myPaymentMethods}/${id}`, { method: "DELETE" });
}

// Builds "?a=1&b=2", skipping empty values so the backend never sees status=""
function toQuery(params) {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== "");
  return entries.length ? `?${new URLSearchParams(entries).toString()}` : "";
}
