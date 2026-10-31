// One badge for every status in the app, so "Paid" always looks the same
// on invoices, payments and subscriptions.
//
//   <StatusBadge status="paid" />
//   <StatusBadge status={invoice.status} overdue={invoice.is_overdue} />
//
// `overdue` wins over the status, so an unpaid invoice past its due date
// always shows red. Add new statuses to this map instead of styling
// badges inside pages.
const STATUS_STYLES = {
  // Invoices: draft | confirmed | paid | cancelled (+ is_overdue)
  draft: { tone: "neutral", label: "Draft" },
  confirmed: { tone: "owed", label: "Unpaid" },
  paid: { tone: "paid", label: "Paid" },
  cancelled: { tone: "neutral", label: "Cancelled" },
  overdue: { tone: "late", label: "Overdue" },

  // Subscriptions
  active: { tone: "paid", label: "Active" },
  trial: { tone: "owed", label: "Trial" },
  paused: { tone: "neutral", label: "Paused" },
  expired: { tone: "neutral", label: "Expired" },

  // Plans
  shown: { tone: "paid", label: "Shown" },
  hidden: { tone: "neutral", label: "Hidden" },
  current: { tone: "brand", label: "Your plan" },
  scheduled: { tone: "owed", label: "Starting soon" },

  // Quotations
  sent: { tone: "owed", label: "Sent" },
  accepted: { tone: "paid", label: "Accepted" },
  rejected: { tone: "late", label: "Rejected" },

  // Payments
  pending: { tone: "owed", label: "Pending" },
  partial: { tone: "owed", label: "Partly paid" },
  success: { tone: "paid", label: "Successful" },
  failed: { tone: "late", label: "Failed" },

  // Roles
  admin: { tone: "brand", label: "Admin" },
  staff: { tone: "neutral", label: "Staff" },
  customer: { tone: "neutral", label: "Customer" },
};

export function StatusBadge({ status, overdue = false }) {
  const key = overdue ? "overdue" : String(status || "").toLowerCase();
  const style = STATUS_STYLES[key] || { tone: "neutral", label: status || "Unknown" };
  return <span className={`badge badge-${style.tone}`}>{style.label}</span>;
}
