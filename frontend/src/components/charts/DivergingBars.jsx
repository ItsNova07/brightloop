// Gains and losses either side of a zero line, one row each.
// Gains grow to the right in teal, losses to the left in orange.
//
//   <DivergingBars
//     rows={[
//       { key: "new", label: "New", value: 24985, detail: "5 subscriptions" },
//       { key: "churn", label: "Cancellations", value: -13986, detail: "3 subscriptions" },
//     ]}
//     format={formatMoney}
//     label="How MRR changed"
//   />
//
// The signed amount sits at the end of each bar; `detail` shows under the label.
// The longest bar takes about two thirds of its side, leaving room for the amount.
export function DivergingBars({ rows, format, label }) {
  const maxAbs = Math.max(...rows.map((row) => Math.abs(row.value)), 1);

  return (
    <ul className="diverging" aria-label={label}>
      {rows.map((row, i) => {
        const gain = row.value >= 0;
        const size = (Math.abs(row.value) / maxAbs) * 100;
        const signed = `${gain ? "+" : "−"}${format(Math.abs(row.value))}`;
        return (
          <li key={row.key} className="diverging-row" style={{ "--i": i }}>
            <div className="diverging-label">
              <span className="diverging-name">{row.label}</span>
              {row.detail && <span className="diverging-detail">{row.detail}</span>}
            </div>
            <div className="diverging-track" aria-hidden="true">
              <div className="diverging-half diverging-half-loss">
                {!gain && (
                  <>
                    <span className="diverging-value">{signed}</span>
                    <span className="diverging-bar diverging-bar-loss" style={{ width: `calc(${size}% * 0.68)` }} />
                  </>
                )}
              </div>
              <span className="diverging-zero" />
              <div className="diverging-half diverging-half-gain">
                {gain && (
                  <>
                    <span className="diverging-bar diverging-bar-gain" style={{ width: `calc(${size}% * 0.68)` }} />
                    <span className="diverging-value">{signed}</span>
                  </>
                )}
              </div>
            </div>
            <span className="visually-hidden">
              {row.label}: {signed}
              {row.detail ? `, ${row.detail}` : ""}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
