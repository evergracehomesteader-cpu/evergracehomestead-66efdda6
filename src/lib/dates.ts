// Date-only helpers.
//
// Database DATE columns come back as "YYYY-MM-DD" strings with no time
// component. `new Date("2026-05-14")` parses those as UTC midnight, which
// renders as the PREVIOUS day in US timezones (May 13 in CDT) — the classic
// off-by-one breeding-date bug. Always use parseDateOnly() for date-only
// values so the displayed calendar date matches what was entered.
//
// Full timestamps (created_at, etc.) should keep `new Date()` — those are
// real instants and UTC->local display is correct for them.
export function parseDateOnly(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  return new Date(value);
}

/** A Date object as "YYYY-MM-DD" in local time. */
export function toISODateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Today's date as "YYYY-MM-DD" in local time (toISOString is UTC and flips
 * to tomorrow after 7pm Central). Use for <input type="date"> defaults. */
export function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Format a "YYYY-MM-DD" date-only string without timezone surprises. */
export function formatDateOnly(value: string | null | undefined): string {
  if (!value) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return value;
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
}
