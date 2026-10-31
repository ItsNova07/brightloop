// Backend contract: money is a plain number in rupees, dates are "YYYY-MM-DD".

const rupees = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const rupeesWithPaise = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 });
const shortDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

const DAY = 24 * 60 * 60 * 1000;

// 4999 → "₹4,999", 4999.5 → "₹4,999.50"
export function formatMoney(amount) {
  const value = Number(amount ?? 0);
  return Number.isInteger(value) ? rupees.format(value) : rupeesWithPaise.format(value);
}

const rupeesCompact = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  notation: "compact",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

// 150000 → "₹1.5L" (Indian lakh/crore), for chart axes and labels
export const formatMoneyCompact = (amount) => rupeesCompact.format(amount ?? 0);

const monthShort = new Intl.DateTimeFormat("en-IN", { month: "short" });
const monthLong = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" });

// "2026-10" → "Oct" / "October 2026"
export const formatMonthShort = (ym) => monthShort.format(parseIsoDate(`${ym}-01`));
export const formatMonthLong = (ym) => monthLong.format(parseIsoDate(`${ym}-01`));

export const formatCount = (n) => new Intl.NumberFormat("en-IN").format(n ?? 0);

// "2026-10-31" → "31 Oct 2026"
export const formatDate = (isoDate) => (isoDate ? shortDate.format(parseIsoDate(isoDate)) : "—");

// Date object → "YYYY-MM-DD" in local time (toISOString would shift it to UTC)
export function toIsoDate(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function daysSince(isoDate) {
  return Math.max(0, Math.round((startOfToday() - parseIsoDate(isoDate)) / DAY));
}

export function daysUntil(isoDate) {
  return Math.round((parseIsoDate(isoDate) - startOfToday()) / DAY);
}

// Parse as a local date, so "2026-10-31" is never shown as 30 Oct in UTC-behind zones
function parseIsoDate(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
