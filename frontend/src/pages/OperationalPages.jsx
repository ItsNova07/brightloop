import { useState } from "react";
import {
  getSubscriptions,
  getQuotations,
  getInvoices,
  getPayments,
  getDiscounts,
  getMySubscriptions,
  getMyInvoices,
} from "../api/api.js";
import { useApi } from "../hooks/useApi.js";
import { formatDate, formatMoney } from "../utils/format.js";
import { Card, PageHeader, StatusBadge, Table } from "../components";

const PAGE_SIZE = 20;

// Shared data-backed list page. The page itself stays simple; API errors,
// loading and empty states are handled consistently by the shared Table.
function ListPage({ title, description, load, columns, emptyTitle, emptyMessage, paginated = false }) {
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useApi(
    () => load(page),
    [page, load]
  );
  const rows = paginated ? data?.items || [] : Array.isArray(data) ? data : [];

  return (
    <>
      <PageHeader title={title} description={description} />
      <Card>
        <Table
          columns={columns}
          rows={rows}
          loading={loading}
          error={error}
          onRetry={reload}
          emptyTitle={emptyTitle}
          emptyMessage={emptyMessage}
          pagination={paginated && data ? {
            page: data.page || page,
            pageSize: data.page_size || PAGE_SIZE,
            total: data.total || 0,
            onPageChange: setPage,
          } : undefined}
        />
      </Card>
    </>
  );
}

const loadSubscriptions = () => getSubscriptions();
const loadQuotations = (page) => getQuotations({ page, page_size: PAGE_SIZE });
const loadInvoices = (page) => getInvoices({ page, page_size: PAGE_SIZE });
const loadPayments = (page) => getPayments({ page, page_size: PAGE_SIZE });
const loadDiscounts = () => getDiscounts();
const loadMySubscriptions = () => getMySubscriptions();
const loadMyInvoices = (page) => getMyInvoices({ page, page_size: PAGE_SIZE });

const subscriptionColumns = [
  { key: "subscription_number", header: "Subscription", render: (row) => <span className="cell-strong">{row.subscription_number}</span> },
  { key: "customer_name", header: "Customer" },
  { key: "customer_username", header: "Username" },
  { key: "plan_id", header: "Plan ID", render: (row) => row.plan_id ?? "—" },
  { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
  { key: "next_invoice_date", header: "Next invoice", render: (row) => formatDate(row.next_invoice_date) },
];

const quotationColumns = [
  { key: "subscription_number", header: "Quotation" , render: (row) => <span className="cell-strong">{row.subscription_number}</span> },
  { key: "customer_name", header: "Customer" },
  { key: "template_name", header: "Template", render: (row) => row.template_name || "—" },
  { key: "valid_until", header: "Valid until", render: (row) => formatDate(row.valid_until) },
  { key: "total_before_tax", header: "Estimated total", align: "right", render: (row) => formatMoney(row.total_before_tax) },
  { key: "status", header: "Status", render: (row) => <StatusBadge status={row.is_expired ? "expired" : row.subscription_status} /> },
];

const invoiceColumns = [
  { key: "number", header: "Invoice", render: (row) => <span className="cell-strong">{row.number}</span> },
  { key: "customer_name", header: "Customer" },
  { key: "invoice_date", header: "Issued", render: (row) => formatDate(row.invoice_date) },
  { key: "due_date", header: "Due date", render: (row) => formatDate(row.due_date) },
  { key: "total", header: "Total", align: "right", render: (row) => formatMoney(row.total) },
  { key: "balance_due", header: "Balance", align: "right", render: (row) => formatMoney(row.balance_due) },
  { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} overdue={row.is_overdue} /> },
];

const paymentColumns = [
  { key: "invoice_number", header: "Invoice", render: (row) => <span className="cell-strong">{row.invoice_number || `#${row.invoice_id}`}</span> },
  { key: "customer_name", header: "Customer", render: (row) => row.customer_name || "—" },
  { key: "method", header: "Method", render: (row) => String(row.method || "—").replaceAll("_", " ").toUpperCase() },
  { key: "amount", header: "Amount", align: "right", render: (row) => formatMoney(row.amount) },
  { key: "payment_date", header: "Date", render: (row) => formatDate(row.payment_date) },
  { key: "note", header: "Note", render: (row) => row.note || "—" },
];

const discountColumns = [
  { key: "name", header: "Discount", render: (row) => <span className="cell-strong">{row.name}</span> },
  { key: "discount_type", header: "Type", render: (row) => row.discount_type === "percent" ? "Percentage" : "Fixed amount" },
  { key: "value", header: "Value", align: "right", render: (row) => row.discount_type === "percent" ? `${row.value}%` : formatMoney(row.value) },
  { key: "start_date", header: "Starts", render: (row) => formatDate(row.start_date) },
  { key: "end_date", header: "Ends", render: (row) => formatDate(row.end_date) },
  { key: "usage", header: "Used", render: (row) => `${row.used_count ?? 0} / ${row.usage_limit ?? "∞"}` },
  { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
];

export function Subscriptions() {
  return <ListPage title="Subscriptions" description="Every customer's plan, status and next invoice date." load={loadSubscriptions} columns={subscriptionColumns} emptyTitle="No subscriptions yet" emptyMessage="Subscriptions will appear here after they are created." />;
}

export function Quotations() {
  return <ListPage title="Quotations" description="Price proposals you can send and turn into invoices." load={loadQuotations} columns={quotationColumns} paginated emptyTitle="No quotations yet" emptyMessage="Create a quotation from a quotation template to see it here." />;
}

export function Invoices() {
  return <ListPage title="Invoices" description="Bills sent to customers, their payment status and outstanding balances." load={loadInvoices} columns={invoiceColumns} paginated emptyTitle="No invoices yet" emptyMessage="Invoices appear here after billing is run for active subscriptions." />;
}

export function Payments() {
  return <ListPage title="Payments" description="Payments received against customer invoices." load={loadPayments} columns={paymentColumns} paginated emptyTitle="No payments recorded" emptyMessage="Payments will appear here once they are recorded against invoices." />;
}

export function Discounts() {
  return <ListPage title="Discounts" description="Discount rules applied during subscription billing." load={loadDiscounts} columns={discountColumns} emptyTitle="No discounts configured" emptyMessage="Create a discount rule in the billing system to see it here." />;
}

export function MySubscriptions() {
  return <ListPage title="My subscriptions" description="Your subscriptions, their status and upcoming invoice dates." load={loadMySubscriptions} columns={subscriptionColumns.filter((column) => column.key !== "customer_username")} emptyTitle="No subscriptions found" emptyMessage="Your subscriptions will appear here once one has been created for your account." />;
}

export function MyInvoices() {
  return <ListPage title="My invoices" description="Your invoices and payment status." load={loadMyInvoices} columns={invoiceColumns} paginated emptyTitle="No invoices yet" emptyMessage="Your invoices will appear here once they have been issued." />;
}
