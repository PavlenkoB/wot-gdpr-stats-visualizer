/**
 * Reading a timeline date, and ordering entries by it.
 *
 * ## What an instant is, and is not
 *
 * Wall-clock seconds since 1970-01-01T00:00:00, the same quantity the Playtime
 * aggregator already computes, read through the SAME function
 * (`parseSessionTimestamp`) so one range check serves every date in the app. A
 * Wargaming timestamp is the clock the game recorded, not an instant, so nothing
 * here constructs a `Date` and nothing here claims a time zone: the same string
 * sorts the same way on every machine, and the date the reader SEES is the
 * export's own text (kept on the entry, never reformatted).
 *
 * ## An unparseable date is "undated", not a wrong date
 *
 * A date this module cannot read makes its entry undated, which the comparator
 * puts after every dated entry, and the entry keeps the export's text for
 * display. That is the honest outcome: a date format nobody has read yet is
 * shown as the export wrote it rather than guessed at, and a date shape that
 * fails to parse is visible as a sorting oddity rather than as a wrong claim.
 *
 * ## The four shapes are this plan's whole vocabulary
 *
 *   1. `YYYY-MM-DD HH:MM:SS` — space or `T` separator, optional fraction, optional `Z`;
 *   2. `DD.MM.YYYY HH:MM`   — DAY FIRST, no seconds;
 *   3. `YYYY-MM-DD`         — at midnight;
 *   4. `DD.MM.YYYY`         — DAY FIRST, at midnight.
 *
 * Shapes 1 and 2 are handed straight to `parseSessionTimestamp`; 3 and 4 are
 * ANCHORED here (four digits, dash, two, dash, two; two digits, dot, two, dot,
 * four) and turned into one of the first two by appending midnight, so the
 * shared range check applies to all four and a month above 12 is excluded
 * rather than swapped with the day — `05.13.2024` is not 13 May and is not 5
 * January, it is a date nobody wrote (RESEARCH Pitfall 8, T-12-14).
 *
 * A shape outside these four — a numeric offset, another field order — is
 * deliberately NOT read here. Plan 12-11 checked every date shape the header
 * capture records (`DATE_SHAPES`): each timeline date column is
 * `YYYY-MM-DD HH:MM:SS.mmm`, which is shape 1 (space separator, seconds and a
 * fraction, no zone), so NO widening was needed. `timeline-mapping.test.ts`
 * asserts that every mapped date column's recorded shape parses a made-up
 * example, so a future capture that records a shape outside the four fails
 * there, by file, column and shape, instead of silently undating a file.
 *
 * ## Why the length is capped before any pattern
 *
 * A date cell is untrusted zip content. Anchored patterns with no nested
 * quantifiers cannot backtrack catastrophically, but a 100 KB cell still costs a
 * scan it does not need; over 40 characters is not a date in any of the four
 * shapes, so it is rejected before the first regex runs (T-12-14).
 */

import { parseSessionTimestamp } from '../playtime/playtime-aggregate.ts';

/** The longest input any of the four shapes can be, plus room for whitespace. */
const MAX_INSTANT_LENGTH = 40;

/** `YYYY-MM-DD`, anchored, no nested quantifiers. */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** `DD.MM.YYYY`, anchored, DAY FIRST, no nested quantifiers. */
const DOTTED_DATE_RE = /^\d{2}\.\d{2}\.\d{4}$/;

/**
 * One date as the export wrote it, as wall-clock seconds, or null when this
 * plan's four shapes do not cover it.
 *
 * Never throws, never constructs a `Date`, and treats blank, absent and
 * over-long input as undated rather than as an error.
 */
export function parseTimelineInstant(text: string | null | undefined): number | null {
  if (typeof text !== 'string' || text.length > MAX_INSTANT_LENGTH) return null;
  const trimmed = text.trim();
  if (trimmed === '') return null;

  // The two date-time shapes, read by the function every other date in the app
  // is read by.
  const stamped = parseSessionTimestamp(trimmed);
  if (stamped !== null) return stamped;

  // The two date-only shapes, anchored here and completed into shape 1 or 2 so
  // the ONE range check applies to them too.
  if (ISO_DATE_RE.test(trimmed)) return parseSessionTimestamp(`${trimmed} 00:00:00`);
  if (DOTTED_DATE_RE.test(trimmed)) return parseSessionTimestamp(`${trimmed} 00:00`);

  return null;
}

/**
 * Everything the chronology compares on, so the comparator is a pure function
 * of plain numbers rather than of rows, cells or dates.
 *
 * `accountRank` is the entry's account's position in the identity header, which
 * is what breaks a tie between two accounts' entries at the same instant
 * (UI-SPEC Recorded Choice 2). `sequence` is the entry's position in the
 * builder's input, which makes the order total: two distinct entries can never
 * compare equal.
 */
export interface TimelineSortKey {
  /** Wall-clock seconds, or `null` for an undated entry. */
  readonly instant: number | null;
  readonly kindRank: number;
  readonly fileRank: number;
  readonly accountRank: number;
  readonly sequence: number;
}

/**
 * Newest first, undated last, then kind, file, account and input position.
 *
 * The order is TOTAL: every field is compared, so the comparator returns 0 for
 * the same key and nothing else, and sorting a list twice gives one answer
 * whether or not the engine's sort is stable. That is what makes the pane's
 * plain and windowed modes show the same row in the same place.
 */
export function compareTimelineKeys(a: TimelineSortKey, b: TimelineSortKey): number {
  if (a.instant !== b.instant) {
    // An undated entry is `null`, which is not comparable as a number, so it is
    // handled before the subtraction rather than after it.
    if (a.instant === null) return 1;
    if (b.instant === null) return -1;
    return b.instant - a.instant;
  }
  if (a.kindRank !== b.kindRank) return a.kindRank - b.kindRank;
  if (a.fileRank !== b.fileRank) return a.fileRank - b.fileRank;
  if (a.accountRank !== b.accountRank) return a.accountRank - b.accountRank;
  return a.sequence - b.sequence;
}
