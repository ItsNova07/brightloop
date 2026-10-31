// ------------------------------------------------------------------
// The single source of truth for navigation AND route permissions.
// Adding a page = add one line here, then map its path to a component
// in App.jsx. The sidebar and the route guard both read this list.
// ------------------------------------------------------------------
const STAFF = ["admin", "staff"];
const ADMIN = ["admin"];
const CUSTOMER = ["customer"];

export const NAV_SECTIONS = [
  {
    label: "Overview",
    items: [{ path: "/dashboard", label: "Dashboard", roles: STAFF }],
  },
  {
    label: "Billing",
    items: [
      { path: "/subscriptions", label: "Subscriptions", roles: STAFF },
      { path: "/plans", label: "Plans", roles: STAFF },
      { path: "/quotations", label: "Quotations", roles: STAFF },
      { path: "/invoices", label: "Invoices", roles: STAFF },
      { path: "/payments", label: "Payments", roles: STAFF },
      { path: "/discounts", label: "Discounts", roles: STAFF },
    ],
  },
  {
    label: "People",
    items: [
      { path: "/customers", label: "Customers", roles: STAFF },
      { path: "/staff", label: "Staff", roles: ADMIN },
    ],
  },
  {
    label: "My account",
    items: [
      { path: "/portal", label: "My subscriptions", roles: CUSTOMER },
      { path: "/portal/plans", label: "Plans & payment", roles: CUSTOMER },
      { path: "/portal/invoices", label: "My invoices", roles: CUSTOMER },
      { path: "/account", label: "My account", roles: CUSTOMER },
    ],
  },
];

// Pages every logged-in user can open, reached from the sidebar's user block
// rather than a menu section (customers also see it in their menu above).
export const ACCOUNT_PATH = "/account";
const EVERYONE = ["admin", "staff", "customer"];

export const NAV_ITEMS = [
  ...NAV_SECTIONS.flatMap((section) => section.items).filter((item) => item.path !== ACCOUNT_PATH),
  { path: ACCOUNT_PATH, label: "My account", roles: EVERYONE },
];

// Only the sections and links this role is allowed to see.
export function menuFor(role) {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.roles.includes(role)),
  })).filter((section) => section.items.length > 0);
}

export function rolesFor(path) {
  return NAV_ITEMS.find((item) => item.path === path)?.roles;
}

export function homePathFor(role) {
  return role === "customer" ? "/portal" : "/dashboard";
}
