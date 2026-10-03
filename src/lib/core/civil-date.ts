/**
 * Civil-date arithmetic as pure integer functions.
 *
 * ## Why no `Date` constructor here (D-01)
 *
 * Every timestamp in the app is read as the wall clock the game recorded it,
 * never as an instant. The viewer is offline by construction: there is no
 * network, no clock call and no timezone anywhere in the ingest path, and a
 * browser or worker running in a different zone must produce the same numbers
 * as the export that was written on the player's machine.
 *
 * `new Date('2020-06-01 12:00:00')` would parse that string in the HOST's
 * local zone, so the same export would aggregate to different day and hour
 * buckets on two machines. `Date.UTC` avoids the zone but still routes through
 * the `Date` type, whose time-value range and normalisation rules we would be
 * depending on for a domain that is pure calendar arithmetic.
 *
 * The algorithms below are Howard Hinnant's `days_from_civil` /
 * `civil_from_days`, which are exact integer arithmetic with no floating point
 * and no library: the era-based form is valid for every year we could ever
 * read out of a CSV. Plan 04-01's own test suite cross-checks them against
 * `Date.UTC` for the year range a Sessions.csv can plausibly contain, so the
 * two paths are independent rather than a reference and a copy of each other.
 *
 * Day 0 is 1970-01-01 throughout — the same epoch the `86400`-second day
 * length implies — and a "day number" here means midnight UTC of that civil
 * date, which is a label, never an instant. Hour buckets are
 * `weekday * 24 + hourOfDay` over the same numbering.
 */

/** Days in each month of a non-leap year, indexed by `m - 1`. */
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

/** True when `y` is a leap year in the proleptic Gregorian calendar. */
export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/**
 * Length of month `m` (1-12) in year `y`.
 *
 * Callers validate `m` before calling — `parseSessionTimestamp` rejects
 * anything outside 1-12 — so an out-of-range `m` here is a caller bug, not
 * bad input, and is not defended against.
 */
export function daysInMonth(y: number, m: number): number {
  if (m === 2 && isLeapYear(y)) return 29;
  return DAYS_IN_MONTH[m - 1]!;
}

/** Length of year `y` in days. */
export function daysInYear(y: number): number {
  return isLeapYear(y) ? 366 : 365;
}

/**
 * Days from 1970-01-01 to the civil date `y`-`m`-`d` (`m` 1-12).
 *
 * Shifts the year so that March starts the year, which makes the leap day
 * land at the END of the internal year and removes every special case.
 */
export function daysFromCivil(y: number, m: number, d: number): number {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** The civil date `z` days after 1970-01-01. The exact inverse of `daysFromCivil`. */
export function civilFromDays(z: number): { y: number; m: number; d: number } {
  z += 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365,
  );
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  return { y: m <= 2 ? y + 1 : y, m, d };
}

/** Weekday of day number `day`, Monday = 0 … Sunday = 6. 1970-01-01 was a Thursday. */
export const weekdayOfDay = (day: number): number => (((day + 3) % 7) + 7) % 7;
