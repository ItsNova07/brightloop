// Shimmering placeholder shown while data loads, shaped like what's coming.
//   <Skeleton width="7ch" height="1em" />
//   <SkeletonRows rows={5} columns={4} />   (used by Table while loading)
export function Skeleton({ width = "100%", height = "0.875rem", round = false, className = "" }) {
  return (
    <span
      className={`skeleton ${round ? "skeleton-round" : ""} ${className}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

const WIDTHS = ["70%", "45%", "60%", "35%", "55%", "40%"];

export function SkeletonRows({ rows = 5, columns = 4 }) {
  return (
    <div className="skeleton-rows" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="skeleton-row" style={{ "--i": row }}>
          {Array.from({ length: columns }, (_, col) => (
            <Skeleton key={col} width={WIDTHS[(row + col) % WIDTHS.length]} />
          ))}
        </div>
      ))}
    </div>
  );
}
