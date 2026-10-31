import { useMemo } from "react";
import { toIsoDate } from "../../utils/format.js";

// A month-style grid of upcoming days. Each day is shaded by how many entries
// fall on it: 1, 2, 3, then 4 or more (darker = more). Its label also gives
// their total value.
// Days line up under their weekday, starting today.
//
//   <CalendarHeatmap
//     days={30}
//     entries={[{ date: "2026-11-03", value: 4999 }, ...]}   // several entries per day are added up
//     selected={selectedDate}
//     onSelect={setSelectedDate}
//     format={formatMoney}
//     label="Renewals in the next 30 days"
//   />
//
// Each day is a button: click or press Enter to select it.
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const LEVELS = 4;

export function CalendarHeatmap({ days = 30, entries, selected, onSelect, format, label }) {
  const { cells, leading } = useMemo(() => buildCells(days, entries), [days, entries]);

  return (
    <div className="calendar">
      <div className="calendar-grid" role="group" aria-label={label}>
        {WEEKDAYS.map((day) => (
          <span key={day} className="calendar-weekday" aria-hidden="true">
            {day}
          </span>
        ))}
        {Array.from({ length: leading }, (_, i) => (
          <span key={`blank-${i}`} className="calendar-blank" aria-hidden="true" />
        ))}
        {cells.map((cell, i) => {
          const level = Math.min(cell.count, LEVELS); // 1, 2, 3, then 4 or more
          const isSelected = cell.date === selected;
          return (
            <button
              key={cell.date}
              type="button"
              className={`calendar-day calendar-level-${level} ${isSelected ? "calendar-day-selected" : ""} ${
                i === 0 ? "calendar-day-today" : ""
              }`}
              style={{ "--i": i }}
              onClick={() => onSelect(cell.date)}
              aria-pressed={isSelected}
              aria-label={`${cell.longLabel}${i === 0 ? ", today" : ""}: ${
                cell.count ? `${cell.count} ${cell.count === 1 ? "renewal" : "renewals"}, ${format(cell.value)}` : "nothing due"
              }`}
            >
              <span className="calendar-date">{cell.dayOfMonth}</span>
              {cell.dayOfMonth === 1 && <span className="calendar-month">{cell.monthLabel}</span>}
              {cell.count > 0 && <span className="calendar-count">{cell.count}</span>}
            </button>
          );
        })}
      </div>

      <div className="calendar-scale" aria-hidden="true">
        <span>Less</span>
        {Array.from({ length: LEVELS + 1 }, (_, level) => (
          <span key={level} className={`calendar-swatch calendar-level-${level}`} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

function buildCells(days, entries) {
  const totals = new Map();
  for (const entry of entries) {
    const current = totals.get(entry.date) || { value: 0, count: 0 };
    totals.set(entry.date, { value: current.value + entry.value, count: current.count + 1 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const short = new Intl.DateTimeFormat("en-IN", { month: "short" });
  const long = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long" });

  const cells = Array.from({ length: days }, (_, i) => {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    const date = toIsoDate(day);
    const total = totals.get(date) || { value: 0, count: 0 };
    return {
      date,
      dayOfMonth: day.getDate(),
      monthLabel: short.format(day),
      longLabel: long.format(day),
      ...total,
    };
  });

  // Monday-first weekday of today, so the first tile sits in the right column
  const leading = (today.getDay() + 6) % 7;
  return { cells, leading };
}
