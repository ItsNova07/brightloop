import { Button } from "./Button.jsx";
import { StateMessage } from "./StateMessage.jsx";
import { SkeletonRows } from "./Skeleton.jsx";

// A data table with loading, empty and error states built in.
//
//   const columns = [
//     { key: "id", header: "Invoice" },
//     { key: "amount", header: "Amount", align: "right", render: (row) => formatMoney(row.amount) },
//     { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
//   ];
//   <Table columns={columns} rows={data} loading={loading} error={error} onRetry={reload}
//          emptyTitle="No invoices yet" emptyMessage="Invoices appear here once a subscription bills." />
//
// On small screens each row turns into a stacked block, using the column
// headers as labels, so nobody has to scroll sideways.
//
// Paged lists from the backend ({ items, total, page, page_size }):
//   <Table rows={data?.items} pagination={{ page, pageSize: 20, total: data?.total, onPageChange: setPage }} ... />
export function Table({
  pagination,
  columns,
  rows,
  loading = false,
  error = null,
  onRetry,
  rowKey = "id",
  emptyTitle,
  emptyMessage,
  emptyAction,
  caption,
}) {
  if (loading) return <SkeletonRows rows={5} columns={Math.min(columns.length, 5)} />;
  if (error) return <StateMessage kind="error" message={error.message} onRetry={onRetry} />;
  if (!rows || rows.length === 0) {
    return <StateMessage kind="empty" title={emptyTitle} message={emptyMessage} action={emptyAction} />;
  }

  return (
    <div className="table-wrap table-enter">
      <table className="table">
        {caption && <caption className="visually-hidden">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={column.align === "right" ? "align-right" : ""}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[rowKey]}>
              {columns.map((column) => (
                <td
                  key={column.key}
                  data-label={column.header}
                  className={column.align === "right" ? "align-right num" : ""}
                >
                  <span className="cell-value">{column.render ? column.render(row) : row[column.key]}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {pagination && <Pagination {...pagination} />}
    </div>
  );
}

function Pagination({ page, pageSize, total = 0, onPageChange }) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (pageCount <= 1) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <nav className="pagination" aria-label="Pages">
      <p className="pagination-info num">
        Showing {first}–{last} of {total}
      </p>
      <div className="pagination-buttons">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Previous
        </Button>
        <Button variant="secondary" size="sm" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
          Next
        </Button>
      </div>
    </nav>
  );
}
