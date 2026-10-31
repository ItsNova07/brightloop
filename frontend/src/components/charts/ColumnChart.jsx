import { useState } from "react";
import { useElementWidth } from "../../hooks/useElementWidth.js";

// Vertical columns for one series over time (revenue per month, etc.).
//
//   <ColumnChart
//     data={[{ label: "Oct", value: 41879 }, ...]}
//     format={formatMoney}            // full value, for tooltips and labels
//     formatAxis={formatMoneyCompact} // short value, for the left axis
//     label="Revenue by month"        // read out by screen readers
//   />
//
// Hover or keyboard-focus a column to see its exact value. The latest and the
// highest column are labelled on their caps; the axis covers the rest.
const HEIGHT = 220;
const PAD = { top: 24, right: 8, bottom: 28, left: 52 };
const MAX_BAR = 24;

export function ColumnChart({ data, format, formatAxis = format, label }) {
  const [ref, width] = useElementWidth();
  const [active, setActive] = useState(null);

  const plotWidth = Math.max(0, width - PAD.left - PAD.right);
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const ticks = niceTicks(Math.max(...data.map((d) => d.value), 1));
  const top = ticks[ticks.length - 1];
  const band = data.length ? plotWidth / data.length : 0;
  const barWidth = Math.min(MAX_BAR, band * 0.5);
  const y = (value) => PAD.top + plotHeight - (value / top) * plotHeight;
  const maxIndex = data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0);
  const labelled = new Set([data.length - 1, maxIndex]);

  return (
    <div className="column-chart" ref={ref}>
      {width > 0 && (
        <svg width={width} height={HEIGHT} role="img" aria-label={label}>
          {ticks.map((tick) => (
            <g key={tick}>
              <line className="chart-grid" x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} />
              <text className="chart-axis" x={PAD.left - 10} y={y(tick)} dy="0.32em" textAnchor="end">
                {formatAxis(tick)}
              </text>
            </g>
          ))}

          {data.map((d, i) => {
            const cx = PAD.left + band * i + band / 2;
            const barTop = y(d.value);
            const barHeight = PAD.top + plotHeight - barTop;
            const isActive = active === i;
            return (
              <g key={d.label} className={`chart-column ${isActive ? "chart-column-active" : ""}`} style={{ "--i": i }}>
                {barHeight > 0 && <path className="chart-bar" d={roundedTopBar(cx - barWidth / 2, barTop, barWidth, barHeight)} />}
                {labelled.has(i) && d.value > 0 && !isActive && (
                  <text className="chart-value" x={cx} y={barTop - 8} textAnchor="middle">
                    {formatAxis(d.value)}
                  </text>
                )}
                <text className="chart-axis" x={cx} y={HEIGHT - 8} textAnchor="middle">
                  {d.label}
                </text>
                {/* The whole band is the hover / focus target, not just the thin bar */}
                <rect
                  className="chart-hit"
                  x={cx - band / 2}
                  y={PAD.top}
                  width={band}
                  height={plotHeight}
                  tabIndex={0}
                  role="img"
                  aria-label={`${d.label}: ${format(d.value)}`}
                  onPointerEnter={() => setActive(i)}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                />
              </g>
            );
          })}
        </svg>
      )}

      {active !== null && width > 0 && (
        <div
          className="chart-tooltip"
          style={{
            left: clamp(PAD.left + band * active + band / 2, 70, width - 70),
            top: y(data[active].value) - 12,
          }}
          aria-hidden="true"
        >
          <strong>{format(data[active].value)}</strong>
          <span>{data[active].fullLabel ?? data[active].label}</span>
        </div>
      )}
    </div>
  );
}

// A bar with 4px rounded corners at the top and a square base.
function roundedTopBar(x, y, w, h) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

// 3–5 round tick values from 0 up past the max (0, 50K, 100K, 150K…)
function niceTicks(max) {
  const rough = max / 4;
  const power = Math.pow(10, Math.floor(Math.log10(rough)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= rough);
  const count = Math.ceil(max / step);
  return Array.from({ length: count + 1 }, (_, i) => i * step);
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));
