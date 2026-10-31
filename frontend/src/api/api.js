import * as mock from "./mockData.js";
import { ApiError } from "./ApiError.js";

// Use sample data for customer subscription and payment methods,
// because those backend endpoints may not be available yet.
export const MOCK = {
  auth: false,
  users: false,
  customers: false,
  invoices: false,
  subscriptions: false,
  plans: false,
  mySubscription: true,
  payments: true,
};

const BASE_URL = import.meta.env.VITE_API_URL || "/api";

// Backend login expects JSON: { identifier, password }
const LOGIN_USES_FORM = false;

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

function readErrorMessage(body, status) {
  if (body && typeof body.detail === "string") return body.detail;

  if (body && Array.isArray(body.detail) && body.detail.length > 0) {
    return body.detail.map((item) => item.msg).join(". ");
  }

  if (status === 0) {
    return "Can't reach the server. Check that the backend is running.";
  }

  if (status >= 500) {
    return "The server hit an error. Try again in a moment.";
  }

  return `Request failed (${status}).`;
}

async function request(path, { method = "GET", body, form } = {}) {
  const headers = {};
  const token = tokenStore.get();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

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
    response = await fetch(BASE_URL + path, {
      method,
      headers,
      body: payload,
    });
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

// ---------------- AUTH ----------------

export async function login(email, password) {
  if (MOCK.auth) return mock.login(email, password);

  const result = LOGIN_USES_FORM
    ? await request(ENDPOINTS.login, {
        method: "POST",
        form: { username: email, password },
      })
    : await request(ENDPOINTS.login, {
        method: "POST",
        body: { identifier: email, password },
      });

  return { token: result.access_token };
}

export function signup(details) {
  if (MOCK.auth) return mock.signup(details);

  return request(ENDPOINTS.signup, {
    method: "POST",
    body: {
      username: usernameFromEmail(details.email),
      name: details.name,
      email: details.email,
      password: details.password,
    },
  });
}

export function usernameFromEmail(email) {
  let name = String(email || "")
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!/^[a-z]/.test(name)) name = `user_${name}`;
  if (name.length < 3) name = `${name}_user`;

  return name.slice(0, 30);
}

export function forgotPassword(email) {
  if (MOCK.auth) return mock.forgotPassword(email);

  return request(ENDPOINTS.forgotPassword, {
    method: "POST",
    body: { email },
  });
}

export function resetPassword(token, newPassword) {
  if (MOCK.auth) return mock.resetPassword(token, newPassword);

  return request(ENDPOINTS.resetPassword, {
    method: "POST",
    body: { token, new_password: newPassword },
  });
}

export async function getCurrentUser() {
  if (MOCK.auth) return mock.getCurrentUser(tokenStore.get());

  const user = await request(ENDPOINTS.me);
  return normaliseUser(user);
}

export async function updateMe(details) {
  if (MOCK.auth) return mock.updateMe(tokenStore.get(), details);

  try {
    const profile = await request(ENDPOINTS.customerMe, {
      method: "PATCH",
      body: { name: details.name },
    });

    return normaliseUser(profile);
  } catch (err) {
    if (err.status === 403) {
      throw new ApiError("Staff and admin names can't be changed here yet.", 403);
    }

    throw err;
  }
}

function normaliseUser(user) {
  return {
    ...user,
    name: user.name || user.full_name || user.email,
  };
}

// ---------------- USERS ----------------

export async function getUsers() {
  if (MOCK.users) return mock.getUsers();

  const users = await request(ENDPOINTS.users);
  return users.map(normaliseUser);
}

export function createStaff(details) {
  if (MOCK.users) return mock.createStaff(details);

  return request(ENDPOINTS.createStaff, {
    method: "POST",
    body: {
      username: usernameFromEmail(details.email),
      full_name: details.name,
      email: details.email,
      password: details.password,
    },
  }).then(normaliseUser);
}

// ---------------- CUSTOMERS ----------------

function toCustomer(customer) {
  return {
    ...customer,
    address: customer.address_line1 || "",
    company: customer.company || "",
  };
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
    body: {
      name: details.name,
      email: details.email,
      phone: details.phone || null,
      address_line1: details.address || null,
    },
  });

  return toCustomer(updated);
}

export function deleteCustomer(id) {
  if (MOCK.customers) return mock.deleteCustomer(id);

  return request(`${ENDPOINTS.customers}/${id}`, {
    method: "DELETE",
  });
}

export async function getMyCustomerProfile() {
  if (MOCK.customers) return mock.getMyCustomerProfile();

  return toCustomer(await request(ENDPOINTS.customerMe));
}

export async function updateMyCustomerProfile(details) {
  if (MOCK.customers) return mock.updateMyCustomerProfile(details);

  const updated = await request(ENDPOINTS.customerMe, {
    method: "PATCH",
    body: {
      phone: details.phone || null,
      address_line1: details.address || null,
    },
  });

  return toCustomer(updated);
}

// ---------------- INVOICES ----------------

export function getInvoices(filters = {}) {
  if (MOCK.invoices) return mock.getInvoices(filters);

  const { customer_id, ...rest } = filters;

  return request(`${ENDPOINTS.invoices}${toQuery(rest)}`);
}

export function getInvoiceSummary({ from_date, to_date } = {}) {
  if (MOCK.invoices) {
    return mock.getInvoiceSummary({ from_date, to_date });
  }

  return request(
    `${ENDPOINTS.invoiceSummary}${toQuery({ from_date, to_date })}`
  );
}

// ---------------- SUBSCRIPTIONS ----------------

export function getSubscriptionSummary({ to_date } = {}) {
  if (MOCK.subscriptions) {
    return mock.getSubscriptionSummary({ to_date });
  }

  return request(
    `${ENDPOINTS.subscriptionSummary}${toQuery({ to_date })}`
  );
}

// ---------------- OPERATIONAL LISTS ----------------

export function getSubscriptions({ status_filter } = {}) {
  return request(
    `${ENDPOINTS.subscriptions}${toQuery({ status_filter })}`
  );
}

export function getQuotations({ expired, page = 1, page_size = 20 } = {}) {
  return request(
    `${ENDPOINTS.quotations}${toQuery({ expired, page, page_size })}`
  );
}

export function getPayments({
  invoice_id,
  method,
  from_date,
  to_date,
  page = 1,
  page_size = 20,
} = {}) {
  return request(
    `${ENDPOINTS.payments}${toQuery({
      invoice_id,
      method,
      from_date,
      to_date,
      page,
      page_size,
    })}`
  );
}

export function getDiscounts() {
  return request(ENDPOINTS.discounts);
}

export function getMyInvoices({ page = 1, page_size = 20 } = {}) {
  return request(
    `${ENDPOINTS.myInvoices}${toQuery({ page, page_size })}`
  );
}

export function getMySubscriptions() {
  return request(ENDPOINTS.mySubscriptions);
}

// ---------------- PLANS ----------------

function toPlan(plan, subscriberCounts = {}) {
  return {
    ...plan,
    price: Number(plan.price),
    billing_cycle: plan.billing_period,
    is_public: plan.is_active,
    features: plan.features || [],
    trial_days: 0,
    subscriber_count: subscriberCounts[plan.id] || 0,
  };
}

function toBackendPlan(details) {
  const body = {};

  if (details.name !== undefined) body.name = details.name;
  if (details.description !== undefined) body.description = details.description;
  if (details.price !== undefined) body.price = details.price;
  if (details.billing_cycle !== undefined) {
    body.billing_period = details.billing_cycle;
  }
  if (details.features !== undefined) body.features = details.features;
  if (details.is_public !== undefined) body.is_active = details.is_public;

  return body;
}

async function activeSubscribersByPlan() {
  try {
    const subscriptions = await request(
      `${ENDPOINTS.subscriptions}${toQuery({ status_filter: "active" })}`
    );

    return subscriptions.reduce(
      (counts, subscription) => ({
        ...counts,
        [subscription.plan_id]:
          (counts[subscription.plan_id] || 0) + 1,
      }),
      {}
    );
  } catch {
    return {};
  }
}

export async function getPlans({ public_only = false } = {}) {
  if (MOCK.plans) return mock.getPlans({ public_only });

  const [plans, counts] = await Promise.all([
    request(ENDPOINTS.plans),
    public_only ? {} : activeSubscribersByPlan(),
  ]);

  return plans
    .map((plan) => toPlan(plan, counts))
    .filter((plan) => !public_only || plan.is_public);
}

export async function createPlan(details) {
  if (MOCK.plans) return mock.createPlan(details);

  const created = await request(ENDPOINTS.plans, {
    method: "POST",
    body: toBackendPlan(details),
  });

  return toPlan(created);
}

export async function updatePlan(id, changes) {
  if (MOCK.plans) return mock.updatePlan(id, changes);

  const [updated, counts] = await Promise.all([
    request(`${ENDPOINTS.plans}/${id}`, {
      method: "PATCH",
      body: toBackendPlan(changes),
    }),
    activeSubscribersByPlan(),
  ]);

  return toPlan(updated, counts);
}

// ---------------- CUSTOMER SUBSCRIPTION ----------------

export function getMySubscription() {
  if (MOCK.mySubscription) return mock.getMySubscription();

  return request(ENDPOINTS.mySubscription);
}

export function changeMyPlan(planId) {
  if (MOCK.mySubscription) return mock.changeMyPlan(planId);

  return request(ENDPOINTS.changeMyPlan, {
    method: "POST",
    body: { plan_id: planId },
  });
}

// ---------------- PAYMENT METHODS ----------------

export function getMyPaymentMethods() {
  if (MOCK.payments) return mock.getMyPaymentMethods();

  return request(ENDPOINTS.myPaymentMethods);
}

export function setDefaultPaymentMethod(id) {
  if (MOCK.payments) return mock.setDefaultPaymentMethod(id);

  return request(`${ENDPOINTS.myPaymentMethods}/${id}/default`, {
    method: "POST",
  });
}

export function removePaymentMethod(id) {
  if (MOCK.payments) return mock.removePaymentMethod(id);

  return request(`${ENDPOINTS.myPaymentMethods}/${id}`, {
    method: "DELETE",
  });
}

// ---------------- QUERY STRING HELPER ----------------

function toQuery(params) {
  const entries = Object.entries(params).filter(
    ([, value]) =>
      value !== undefined && value !== null && value !== ""
  );

  return entries.length
    ? `?${new URLSearchParams(entries).toString()}`
    : "";
}