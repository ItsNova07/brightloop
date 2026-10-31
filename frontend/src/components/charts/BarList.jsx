// Ranked horizontal bars for a few categories (plans, products, regions).
// One colour for every bar: the length carries the value.
//
//   <BarList
//     rows={[{ key: "pro", label: "Pro", value: 239952, detail: "48 subscribers" }, ...]}
//     format={formatMoney}
//     label="MRR by plan"
//   />
//
// Rows are shown in the order given; pass them sorted if order matters.
export function BarList({ rows, format, label, showShare = true }) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  const total = rows.reduce((sum, row) => sum + row.value, 0);

  return (
    <ul className="barlist" aria-label={label}>
      {rows.map((row, i) => {
        const share = total ? Math.round((row.value / total) * 100) : 0;
        return (
          <li key={row.key} className="barlist-row" style={{ "--i": i }}>
            <div className="barlist-head">
              <span className="barlist-name">{row.label}</span>
              <span className="barlist-value">
                {format(row.value)}
                {showShare && <span className="barlist-share"> {share}%</span>}
              </span>
            </div>
            <div className="barlist-track" aria-hidden="true">
              <span className="barlist-bar" style={{ width: `${(row.value / max) * 100}%` }} />
            </div>
            {row.detail && <span className="barlist-detail">{row.detail}</span>}
          </li>
        );
      })}
    </ul>
  );
}
