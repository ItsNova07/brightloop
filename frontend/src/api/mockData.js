// ------------------------------------------------------------------
// Fake backend used while MOCK switches in api.js are true.
// Shapes here are the contract: when Member 2 builds an endpoint,
// it should return the same field names.
// ------------------------------------------------------------------
import { ApiError } from "./ApiError.js";
import { toIsoDate } from "../utils/format.js";

const wait = (ms = 450) => new Promise((resolve) => setTimeout(resolve, ms));
const DAY = 24 * 60 * 60 * 1000;
const daysFromToday = (n) => toIsoDate(new Date(Date.now() + n * DAY));

// ---------------- Auth ----------------
// Demo accounts. Password for all of them: demo123

export const DEMO_ACCOUNTS = [
  { id: 1, name: "Bhavya Anil", email: "admin@brightloop.test", role: "admin" },
  { id: 2, name: "Arjun Menon", email: "staff@brightloop.test", role: "staff" },
  { id: 3, name: "Nila Thomas", email: "customer@brightloop.test", role: "customer" },
];
const DEMO_PASSWORD = "demo123";


export async function login(email, password) {
  await wait();
  const account = DEMO_ACCOUNTS.find((a) => a.email === email.trim().toLowerCase());
  if (!account || password !== DEMO_PASSWORD) {
    throw new ApiError("Email or password is incorrect.", 401);
  }
  return { token: `mock-token-${account.id}` };
}

export async function getCurrentUser(token) {
  await wait(200);
  const id = Number(String(token || "").replace("mock-token-", ""));
  const account = DEMO_ACCOUNTS.find((a) => a.id === id);
  if (!account) throw new ApiError("Session expired. Log in again.", 401);
  return account;
}

export async function updateMe(token, { name }) {
  await wait();
  const account = await getCurrentUser(token);
  account.name = name;
  return { ...account };
}

export async function signup({ name, email }) {
  await wait();
  if (DEMO_ACCOUNTS.some((a) => a.email === email.toLowerCase())) {
    throw new ApiError("An account with this email already exists.", 400);
  }
  const account = { id: DEMO_ACCOUNTS.length + 1, name, email: email.toLowerCase(), role: "customer" };
  DEMO_ACCOUNTS.push(account);
  return account;
}

export async function forgotPassword() {
  await wait();
  return { message: "If that email has an account, a reset link is on its way." };
}

export async function resetPassword(token) {
  await wait();
  if (!token) throw new ApiError("This reset link is invalid or has expired.", 400);
  return { message: "Password updated." };
}

// ---------------- Users ----------------

export async function getUsers() {
  await wait();
  return DEMO_ACCOUNTS.map((a) => ({ ...a, is_active: true }));
}

export async function createStaff({ name, email }) {
  await wait();
  if (DEMO_ACCOUNTS.some((a) => a.email === email.toLowerCase())) {
    throw new ApiError("An account with this email already exists.", 400);
  }
  const account = { id: DEMO_ACCOUNTS.length + 1, name, email: email.toLowerCase(), role: "staff" };
  DEMO_ACCOUNTS.push(account);
  return account;
}

// ---------------- Customers ----------------

let customers = [
  { id: 101, name: "Acme Traders", email: "accounts@acme.in", phone: "98470 11223", company: "Acme Traders Pvt Ltd", address: "MG Road, Kochi" },
  { id: 102, name: "Nila Thomas", email: "customer@brightloop.test", phone: "94460 55120", company: "Nila & Co", address: "Kottayam" },
  { id: 103, name: "Periyar Foods", email: "billing@periyarfoods.in", phone: "90370 88341", company: "Periyar Foods LLP", address: "Aluva" },
  { id: 104, name: "Kayal Studio", email: "hello@kayal.studio", phone: "99950 20761", company: "Kayal Studio", address: "Alappuzha" },
  { id: 105, name: "Malabar Logistics", email: "finance@malabarlog.in", phone: "97440 63018", company: "Malabar Logistics", address: "Kozhikode" },
];
let nextCustomerId = 106;

export async function getCustomers() {
  await wait();
  return customers.map((c) => ({ ...c }));
}

export async function createCustomer(details) {
  await wait();
  if (customers.some((c) => c.email === details.email)) {
    throw new ApiError("A customer with this email already exists.", 400);
  }
  const customer = { id: nextCustomerId++, ...details };
  customers = [customer, ...customers];
  return customer;
}

export async function updateCustomer(id, details) {
  await wait();
  customers = customers.map((c) => (c.id === id ? { ...c, ...details } : c));
  return customers.find((c) => c.id === id);
}

export async function deleteCustomer(id) {
  await wait();
  customers = customers.filter((c) => c.id !== id);
  return null;
}

export async function getMyCustomerProfile() {
  await wait();
  return { ...customers.find((c) => c.id === 102) };
}

export async function updateMyCustomerProfile(details) {
  return updateCustomer(102, details);
}

// ---------------- Subscriptions (summary only) ----------------
// Real route assumed: GET /subscriptions/summary

const RENEWING_SOON = [
  { id: 1042, customer_name: "Acme Traders", plan_name: "Pro", billing_cycle: "monthly", next_billing_date: daysFromToday(3), amount: 4999 },
  { id: 1055, customer_name: "Vembanad Resorts", plan_name: "Enterprise", billing_cycle: "monthly", next_billing_date: daysFromToday(6), amount: 14900 },
  { id: 1038, customer_name: "Periyar Foods", plan_name: "Enterprise", billing_cycle: "yearly", next_billing_date: daysFromToday(9), amount: 149000 },
  { id: 1051, customer_name: "Kayal Studio", plan_name: "Basic", billing_cycle: "monthly", next_billing_date: daysFromToday(12), amount: 999 },
  { id: 1047, customer_name: "Malabar Logistics", plan_name: "Pro", billing_cycle: "monthly", next_billing_date: daysFromToday(21), amount: 4999 },
  { id: 1029, customer_name: "Nila & Co", plan_name: "Basic", billing_cycle: "yearly", next_billing_date: daysFromToday(40), amount: 9990 },
];

// Active subscriptions and MRR at the end of each of the last 6 months (oldest first)
const ACTIVE_HISTORY = [109, 113, 112, 118, 123, 128];
const MRR_HISTORY = [512400, 527800, 534100, 549300, 561192, 583991];

// Monthly recurring revenue per plan. Yearly plans count as a twelfth per month.
const PLANS = [
  { plan_name: "Basic", subscribers: 61, mrr: 60939 },
  { plan_name: "Pro", subscribers: 48, mrr: 239952 },
  { plan_name: "Enterprise", subscribers: 19, mrr: 283100 },
];

// How MRR moved during the month: start + new + upgrades − downgrades − cancellations = end
const MOVEMENT = {
  start: 561192,
  new_mrr: 24985,
  new_count: 5,
  expansion_mrr: 15800,
  expansion_count: 4,
  contraction_mrr: 4000,
  contraction_count: 2,
  churn_mrr: 13986,
  churn_count: 3,
  end: 583991,
};

// Every renewal in the next 30 days: the ones in RENEWING_SOON plus more.
const MORE_RENEWALS = [
  [1, "Thekkady Spices", "Basic", "monthly", 999],
  [2, "Munnar Tea Co", "Pro", "monthly", 4999],
  [3, "Kovalam Surf School", "Basic", "monthly", 999],
  [6, "Lulu Crafts", "Pro", "monthly", 4999],
  [6, "Bekal Homestays", "Basic", "monthly", 999],
  [8, "Kochi Metro Cafe", "Pro", "monthly", 4999],
  [10, "Wayanad Organics", "Enterprise", "monthly", 14900],
  [13, "Varkala Yoga", "Basic", "monthly", 999],
  [14, "Calicut Textiles", "Pro", "monthly", 4999],
  [16, "Trivandrum Tech", "Enterprise", "monthly", 14900],
  [17, "Ponmudi Treks", "Basic", "monthly", 999],
  [19, "Thrissur Jewels", "Pro", "monthly", 4999],
  [21, "Kannur Looms", "Basic", "monthly", 999],
  [23, "Kumarakom Boats", "Pro", "monthly", 4999],
  [24, "Athirappilly Stays", "Basic", "monthly", 999],
  [26, "Palakkad Mills", "Enterprise", "monthly", 14900],
  [27, "Idukki Coffee", "Pro", "monthly", 4999],
  [29, "Kollam Cashews", "Basic", "monthly", 999],
];

function upcomingRenewals() {
  const known = RENEWING_SOON.map((sub) => ({
    id: sub.id,
    date: sub.next_billing_date,
    customer_name: sub.customer_name,
    plan_name: sub.plan_name,
    billing_cycle: sub.billing_cycle,
    amount: sub.amount,
  }));
  const more = MORE_RENEWALS.map(([days, customer_name, plan_name, billing_cycle, amount], i) => ({
    id: 2000 + i,
    date: daysFromToday(days),
    customer_name,
    plan_name,
    billing_cycle,
    amount,
  }));
  return [...known, ...more].filter((r) => r.date <= daysFromToday(30)).sort((a, b) => a.date.localeCompare(b.date));
}

export async function getSubscriptionSummary({ to_date } = {}) {
  await wait(500);
  const months = lastSixMonths(to_date);
  return {
    active_count: 128,
    active_by_month: months.map((month, i) => ({ month, count: ACTIVE_HISTORY[i] })),
    mrr: MRR_HISTORY[5],
    mrr_by_month: months.map((month, i) => ({ month, mrr: MRR_HISTORY[i] })),
    mrr_movement: { month: months[5], ...MOVEMENT },
    plans: PLANS,
    renewing_soon: RENEWING_SOON,
    renewals_next_30_days: upcomingRenewals(),
  };
}

// "YYYY-MM" for the 6 months ending with the month of `isoDate` (oldest first)
function lastSixMonths(isoDate) {
  const [year, month] = (isoDate || toIsoDate(new Date())).split("-").map(Number);
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(year, month - 1 - (5 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}

// ---------------- Invoices ----------------
// Contract agreed with the billing backend:
//   status: draft | confirmed | paid | cancelled, plus is_overdue
//   dates "YYYY-MM-DD", money as plain numbers
//   lists: { items, total, page, page_size }

const today = daysFromToday(0);

const INVOICES = [
  ["INV-2214", "Periyar Foods", -1, 14, 149000, 0, "confirmed"],
  ["INV-2213", "Kayal Studio", -2, 13, 999, 0, "draft"],
  ["INV-2212", "Nila & Co", -3, 12, 9990, 9990, "paid"],
  ["INV-2211", "Malabar Logistics", -5, 10, 4999, 2000, "confirmed"],
  ["INV-2210", "Acme Traders", -17, -2, 4999, 0, "confirmed"],
  ["INV-2209", "Vembanad Resorts", -8, 7, 14900, 14900, "paid"],
  ["INV-2208", "Acme Traders", -9, 6, 4999, 4999, "paid"],
  ["INV-2207", "Kayal Studio", -19, -4, 999, 0, "confirmed"],
  ["INV-2206", "Periyar Foods", -12, 3, 24000, 0, "cancelled"],
  ["INV-2193", "Malabar Logistics", -26, -11, 4999, 0, "confirmed"],
  ["INV-2190", "Nila & Co", -28, -13, 9990, 9990, "paid"],
  ["INV-2188", "Vembanad Resorts", -31, -16, 14900, 5000, "confirmed"],
  ["INV-2181", "Acme Traders", -40, -25, 4999, 4999, "paid"],
  ["INV-2176", "Kayal Studio", -46, -31, 999, 999, "paid"],
  ["INV-2170", "Vembanad Resorts", -55, -40, 14900, 14900, "paid"],
].map(([number, customer_name, issued, due, total, amount_paid, status], index) => ({
  id: 9000 + index,
  number,
  customer_id: 101 + (index % 5),
  customer_name,
  invoice_date: daysFromToday(issued),
  due_date: daysFromToday(due),
  total,
  amount_paid,
  balance_due: status === "cancelled" ? 0 : total - amount_paid,
  status,
  is_overdue: status === "confirmed" && daysFromToday(due) < today,
}));

const inRange = (date, from, to) => (!from || date >= from) && (!to || date <= to);

export async function getInvoices({ status, customer_id, from_date, to_date, overdue, page = 1, page_size = 20 } = {}) {
  await wait(500);
  const matches = INVOICES.filter(
    (inv) =>
      (!status || inv.status === status) &&
      (!customer_id || inv.customer_id === Number(customer_id)) &&
      (!overdue || inv.is_overdue) &&
      inRange(inv.invoice_date, from_date, to_date)
  );
  const start = (page - 1) * page_size;
  return { items: matches.slice(start, start + page_size), total: matches.length, page, page_size };
}

// Months before the sample invoices start, so the trend has some history
const REVENUE_HISTORY = { 0: 36400, 1: 31800, 2: 44200, 3: 39900 };
const OUTSTANDING_HISTORY = [96500, 104200, 121800, 118400, 139900];
const OVERDUE_HISTORY = [12400, 9800, 15600, 18900, 16200];

export async function getInvoiceSummary({ from_date, to_date } = {}) {
  await wait(600);
  const sum = (list, key) => list.reduce((total, inv) => total + inv[key], 0);
  const inPeriod = INVOICES.filter((inv) => inRange(inv.invoice_date, from_date, to_date));
  const unpaid = INVOICES.filter((inv) => inv.status === "confirmed");
  const overdue = unpaid.filter((inv) => inv.is_overdue).sort((a, b) => a.due_date.localeCompare(b.due_date));

  const outstanding = sum(unpaid, "balance_due");
  const overdueAmount = sum(overdue, "balance_due");
  const months = lastSixMonths(to_date).map((month, i) => {
    const issued = INVOICES.filter((inv) => inv.invoice_date.startsWith(month));
    const isLast = i === 5;
    return {
      month,
      revenue: issued.length ? sum(issued, "amount_paid") : REVENUE_HISTORY[i] ?? 0,
      outstanding: isLast ? outstanding : OUTSTANDING_HISTORY[i],
      overdue_amount: isLast ? overdueAmount : OVERDUE_HISTORY[i],
    };
  });

  // Of what was billed in the chosen dates: how much is paid, still due, or late
  const billed = inPeriod.filter((inv) => inv.status === "confirmed" || inv.status === "paid");
  const collection = {
    paid: sum(billed, "amount_paid"),
    unpaid: sum(billed.filter((inv) => !inv.is_overdue), "balance_due"),
    overdue: sum(billed.filter((inv) => inv.is_overdue), "balance_due"),
  };

  return {
    revenue: sum(inPeriod, "amount_paid"),
    outstanding,
    overdue_count: overdue.length,
    overdue_amount: overdueAmount,
    overdue_invoices: overdue.slice(0, 5),
    months,
    collection,
  };
}

// ---------------- Plans catalogue ----------------
// Real routes assumed: GET /plans, POST /plans, PATCH /plans/{id}
// is_public = shown to customers. Plans are hidden, never deleted, so
// existing subscribers keep theirs.

let plans = [
  {
    id: 1,
    name: "Basic",
    description: "For small teams getting started with recurring billing.",
    price: 999,
    billing_cycle: "monthly",
    features: ["Up to 50 customers", "Automatic invoices", "Email reminders"],
    trial_days: 14,
    is_public: true,
    subscriber_count: 46,
  },
  {
    id: 2,
    name: "Basic Yearly",
    description: "Basic, paid once a year. Two months free.",
    price: 9990,
    billing_cycle: "yearly",
    features: ["Everything in Basic", "Two months free"],
    trial_days: 0,
    is_public: true,
    subscriber_count: 15,
  },
  {
    id: 3,
    name: "Pro",
    description: "For growing businesses that bill every week.",
    price: 4999,
    billing_cycle: "monthly",
    features: ["Unlimited customers", "Quotations and discounts", "Partial payments", "Priority support"],
    trial_days: 14,
    is_public: true,
    subscriber_count: 48,
  },
  {
    id: 4,
    name: "Enterprise",
    description: "For large teams with custom terms and many staff.",
    price: 14900,
    billing_cycle: "monthly",
    features: ["Everything in Pro", "Unlimited staff accounts", "Bank transfer payments", "Dedicated account manager"],
    trial_days: 0,
    is_public: true,
    subscriber_count: 19,
  },
  {
    id: 5,
    name: "Starter (old)",
    description: "Retired plan. Existing customers keep it.",
    price: 499,
    billing_cycle: "monthly",
    features: ["Up to 10 customers", "Automatic invoices"],
    trial_days: 0,
    is_public: false,
    subscriber_count: 3,
  },
];
let nextPlanId = 6;

export async function getPlans({ public_only = false } = {}) {
  await wait(500);
  return plans.filter((plan) => !public_only || plan.is_public).map((plan) => ({ ...plan, features: [...plan.features] }));
}

export async function createPlan(details) {
  await wait();
  if (plans.some((plan) => plan.name.toLowerCase() === details.name.toLowerCase())) {
    throw new ApiError("A plan with this name already exists.", 400);
  }
  const plan = { id: nextPlanId++, subscriber_count: 0, ...details };
  plans = [...plans, plan];
  return { ...plan };
}

export async function updatePlan(id, changes) {
  await wait();
  plans = plans.map((plan) => (plan.id === id ? { ...plan, ...changes } : plan));
  return { ...plans.find((plan) => plan.id === id) };
}

// ---------------- Customer: my subscription and payment methods ----------------
// Real routes assumed: GET /subscriptions/me, POST /subscriptions/me/change-plan,
// GET /payment-methods/me, POST /payment-methods/me/{id}/default, DELETE /payment-methods/me/{id}

let mySubscription = { plan_id: 2, scheduled_plan_id: null, status: "active", next_billing_date: daysFromToday(40) };

function describeSubscription() {
  const plan = plans.find((p) => p.id === mySubscription.plan_id);
  const next = plans.find((p) => p.id === mySubscription.scheduled_plan_id);
  return { ...mySubscription, plan_name: plan?.name, scheduled_plan_name: next?.name ?? null };
}

export async function getMySubscription() {
  await wait(400);
  return describeSubscription();
}

// The switch is scheduled: the current plan runs until the next billing date.
// Picking the current plan again cancels a scheduled switch.
export async function changeMyPlan(planId) {
  await wait();
  const plan = plans.find((p) => p.id === planId && p.is_public);
  if (!plan) throw new ApiError("That plan isn't available any more.", 400);
  mySubscription = { ...mySubscription, scheduled_plan_id: plan.id === mySubscription.plan_id ? null : plan.id };
  return describeSubscription();
}

let myPaymentMethods = [
  { id: 1, type: "upi", upi_id: "nila@okhdfc", is_default: true },
  { id: 2, type: "card", brand: "Visa", last4: "4417", expiry: "08/28", is_default: false },
];

export async function getMyPaymentMethods() {
  await wait(400);
  return myPaymentMethods.map((m) => ({ ...m }));
}

export async function setDefaultPaymentMethod(id) {
  await wait();
  myPaymentMethods = myPaymentMethods.map((m) => ({ ...m, is_default: m.id === id }));
  return myPaymentMethods.map((m) => ({ ...m }));
}

export async function removePaymentMethod(id) {
  await wait();
  const method = myPaymentMethods.find((m) => m.id === id);
  if (method?.is_default) throw new ApiError("Make another method the default before removing this one.", 400);
  myPaymentMethods = myPaymentMethods.filter((m) => m.id !== id);
  return null;
}
