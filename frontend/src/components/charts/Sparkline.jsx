// A tiny trend line for a metric card. The history is drawn in a quiet grey;
// the latest step and its end dot are in the card's colour, so the eye lands
// on "now".
//
//   <Sparkline values={[109, 113, 112, 118, 123, 128]} tone="teal" label="Active subscriptions, last 6 months" />
//
// tone: "teal" | "owed" | "late"
const WIDTH = 96;
const HEIGHT = 32;
const PAD = 5;

export function Sparkline({ values, tone = "teal", label }) {
  if (!values || values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((value, i) => [
    PAD + (i / (values.length - 1)) * (WIDTH - PAD * 2),
    HEIGHT - PAD - ((value - min) / span) * (HEIGHT - PAD * 2),
  ]);
  const path = (list) => list.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [endX, endY] = points[points.length - 1];

  return (
    <svg className={`sparkline sparkline-${tone}`} width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={label}>
      <path className="sparkline-history" d={path(points)} pathLength="1" />
      <path className="sparkline-now" d={path(points.slice(-2))} />
      <circle className="sparkline-dot" cx={endX} cy={endY} r="4" />
    </svg>
  );
}
