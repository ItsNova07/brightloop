import { useState } from "react";
import { useElementWidth } from "../../hooks/useElementWidth.js";

// One whole split into parts, like billed money that is paid, due or late.
//
//   <SegmentedBar
//     parts={[
//       { key: "paid", label: "Paid", value: 26889, tone: "paid" },
//       { key: "unpaid", label: "Due soon", value: 151989, tone: "owed" },
//       { key: "overdue", label: "Overdue", value: 5998, tone: "late" },
//     ]}
//     format={formatMoney}
//     label="Billed this period"
//   />
//
// Each block shows its share when there's room. Hover or focus a block for
// its name and amount. A part at zero draws nothing.
// tone: "paid" | "owed" | "late" | "teal"
const MIN_LABEL_WIDTH = 46;

export function SegmentedBar({ parts, format, label }) {
  const [ref, width] = useElementWidth();
  const [active, setActive] = useState(null);
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  const visible = parts.filter((part) => part.value > 0);
  const gaps = Math.max(0, visible.length - 1) * 2;
  const share = (part) => (total ? part.value / total : 0);

  let offset = 0;
  const blocks = visible.map((part) => {
    const blockWidth = Math.max(2, share(part) * (width - gaps));
    const block = { ...part, left: offset, width: blockWidth };
    offset += blockWidth + 2;
    return block;
  });
  const activeBlock = blocks.find((block) => block.key === active);

  return (
    <div className="segmented">
      <div
        className="segmented-bar"
        ref={ref}
        role="img"
        aria-label={`${label}: ${visible.map((p) => `${p.label} ${format(p.value)}, ${percent(share(p))}`).join("; ")}`}
      >
        {width > 0 &&
          blocks.map((block, i) => (
            <div
              key={block.key}
              className={`segment segment-${block.tone} ${active === block.key ? "segment-active" : ""}`}
              style={{ left: block.left, width: block.width, "--i": i }}
              tabIndex={0}
              aria-label={`${block.label}: ${format(block.value)}, ${percent(share(block))}`}
              onPointerEnter={() => setActive(block.key)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(block.key)}
              onBlur={() => setActive(null)}
            >
              {block.width >= MIN_LABEL_WIDTH && <span aria-hidden="true">{percent(share(block))}</span>}
            </div>
          ))}
        {activeBlock && (
          <div
            className="chart-tooltip chart-tooltip-above"
            style={{ left: Math.min(Math.max(activeBlock.left + activeBlock.width / 2, 70), width - 70) }}
            aria-hidden="true"
          >
            <strong>{format(activeBlock.value)}</strong>
            <span>
              {activeBlock.label}, {percent(share(activeBlock))}
            </span>
          </div>
        )}
      </div>

      <ul className="segmented-legend">
        {parts.map((part) => (
          <li key={part.key}>
            <span className={`legend-swatch segment-${part.tone}`} aria-hidden="true" />
            {part.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

function percent(fraction) {
  if (fraction > 0 && fraction < 0.01) return "<1%";
  return `${Math.round(fraction * 100)}%`;
}
