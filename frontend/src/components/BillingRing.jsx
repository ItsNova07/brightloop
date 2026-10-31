// The Brightloop ring: shows how far through its billing cycle a
// subscription is. It fills up as renewal gets closer, turns amber in the
// last 7 days, and pulses softly when renewal is 3 days away or less.
//
//   <BillingRing daysLeft={3} cycleDays={30} />
//   <BillingRing daysLeft={12} cycleDays={30} delay={120} />   (ms, to stagger a list)
export function BillingRing({ daysLeft, cycleDays = 30, size = 36, delay = 0 }) {
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const elapsed = Math.min(1, Math.max(0, (cycleDays - daysLeft) / cycleDays));
  const tone = daysLeft <= 0 ? "late" : daysLeft <= 7 ? "owed" : "teal";
  const urgent = daysLeft <= 3;
  const center = size / 2;

  return (
    <svg
      className={`ring ring-${tone} ${urgent ? "ring-urgent" : ""}`}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`${Math.round(elapsed * 100)}% through the billing cycle, ${daysLeft} days to renewal`}
      style={{ "--c": circumference, "--delay": `${delay}ms` }}
    >
      {urgent && <circle className="ring-halo" cx={center} cy={center} r={radius} fill="none" strokeWidth={stroke} />}
      <circle className="ring-track" cx={center} cy={center} r={radius} strokeWidth={stroke} fill="none" />
      <circle
        className="ring-fill"
        cx={center}
        cy={center}
        r={radius}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - elapsed)}
        transform={`rotate(-90 ${center} ${center})`}
      />
    </svg>
  );
}
