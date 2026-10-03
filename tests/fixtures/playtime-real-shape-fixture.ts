// =============================================================================
// The real-shape export fixture (phase 04, plan 04-14).
//
// WHAT THIS MIRRORS, AND WHAT IT DOES NOT
// The STRUCTURE below was read off the real Wargaming account export inspected
// on 2021-10-12, and it is the structure phase 4 was missing:
//
//   - the WRAPPER folder the download ships in, then the account id, then
//     Activity_history;
//   - playtime kept PER GAME in `{WOT,WOTB,WOWS}_Game_Sessions.csv`, not in
//     one `Sessions.csv`;
//   - the three-column header `STARTED_AT;FINISHED_AT;IP`;
//   - CRLF line endings;
//   - timestamps written `DD.MM.YYYY HH:MM` — dotted, DAY FIRST, to the minute,
//     with no zone and no seconds.
//
// NO ROW CONTENT from that export is kept here or anywhere in this repo. Every
// date, duration and address below is fabricated, per `tests/fixtures/README.md`
// (fixture=synthetic), and the address is the TEST-NET-1 block reserved for
// documentation. The two files that are NOT session files — the `.xlsx`
// duplicate and the `__MACOSX` sidecar — are in the archive because a real one
// carries them, and a fixture that left them out would prove nothing about the
// classifier.
//
// WHY A MODULE AND NOT A SPEC
// One browser spec, two worker describes and one Node oracle check all need the
// SAME rows and the SAME numbers, and Playwright refuses to load a spec that
// imports another spec. So the rows and every number derived from them live
// here, in a plain module with no Playwright or Vitest import and no side effect.
//
// EVERY NUMBER BELOW IS DERIVED BY HAND from `REAL_SHAPE_WOT_ROWS` and
// `REAL_SHAPE_WOWS_ROWS`, in the comment beside it. None of it is read back from
// the UI, and `tests/unit/playtime/playtime-real-shape-fixture.test.ts` recomputes all of
// it with the INDEPENDENT per-second oracle from plan 04-03 — an implementation
// that shares no primitive with the aggregator it checks. A wrong hand number
// fails in Node, in seconds, rather than in a browser run hours later.
//
// WHY THE ROWS ARE CHOSEN THE WAY THEY ARE
//   - 13.03 and 14.03 are a day 13 and a day 14, so a MONTH-FIRST reading would
//     exclude them as month 13 and month 14 and the totals would collapse. They
//     are what proves the dotted stamp is read day first (T-04-28).
//   - 02.11.2020 lands on 2020-11-02, a MONDAY, which is the only source of
//     hour cell 10 and makes the 0.5-hour day legible in a browser.
//   - 13.03.2019 20:00-21:30 and 21:00-22:00 OVERLAP, so a spec that summed
//     durations would read 3.0 hours where the merged answer is 2.0.
//   - one row crosses midnight (14.03 -> 15.03), so seconds land on two days
//     and two weekdays.
//   - one row is ZERO length and is still a session; two are EXCLUDED, one for
//     an end before its start and one for an empty end cell.
//
// Decisions: D-01 (dates and hours as recorded, no zone), D-02 (excluded rows
// are counted and are not sessions), D-05 (duration bins), D-06 (the totals).
// =============================================================================

import { zipSync } from './pinned-zip.ts';

import { SAMPLE_ACCOUNT_ROOT, WRAPPER_FOLDER_NAME } from './export-fixtures.ts';

// -----------------------------------------------------------------------------
// The real shape
// -----------------------------------------------------------------------------

/**
 * The header every real per-game session file carries, verbatim.
 *
 * Three columns and no more: the real export has no server and no platform
 * column, which is why the split stays null on a real export (D-03) and why
 * this plan leaves the per-game split to 04-15.
 */
export const REAL_SHAPE_HEADER = 'STARTED_AT;FINISHED_AT;IP';

/**
 * The address written in the IP column of EVERY row, including the two
 * excluded ones. TEST-NET-1 (RFC 5737), so it can never be a real host.
 *
 * It is present in the data and read by nothing: that is precisely what makes
 * the browser and stored-aggregate privacy assertions able to FAIL (T-04-01).
 * A fixture that only populated it on usable rows could not.
 */
export const REAL_SHAPE_IP = '192.0.2.77';

/** One `[started, finished]` pair, both as the export writes them. */
export type RealShapeRow = readonly [string, string];

/**
 * The WOT rows, in the order the file writes them.
 *
 *   1.  13.03.2019 20:00 -> 21:30   1h 30m  5,400s raw
 *   2.  13.03.2019 21:00 -> 22:00   1h 00m  3,600s raw, OVERLAPS row 1
 *   3.  14.03.2019 23:30 -> 15.03 00:30   1h 00m  3,600s, crosses midnight
 *   4.  02.11.2020 09:05 -> 09:05   zero length
 *   5.  02.11.2020 10:00 -> 10:30   0h 30m  1,800s
 *   6.  03.11.2020 12:00 -> 11:00   EXCLUDED, ends an hour before it starts
 *   7.  04.11.2020 08:00 -> (empty) EXCLUDED, no end
 */
export const REAL_SHAPE_WOT_ROWS: readonly RealShapeRow[] = [
  // 1. The Wednesday-evening session. Wednesday is why cells 68 and 69 exist.
  ['13.03.2019 20:00', '13.03.2019 21:30'],
  // 2. Overlapping row 1. It adds a SESSION and 1,800 NEW seconds; the hour it
  //    shares with row 1 is not counted twice.
  ['13.03.2019 21:00', '13.03.2019 22:00'],
  // 3. Crosses midnight Thursday -> Friday, 30 minutes either side. Cells 95
  //    and 96, and the second of the two March days.
  ['14.03.2019 23:30', '15.03.2019 00:30'],
  // 4. Zero length: a session that held no play and still counts as one. It is
  //    the only reason a "0 sessions-worth" day appears in the answer key.
  ['02.11.2020 09:05', '02.11.2020 09:05'],
  // 5. The half-hour Monday session: the only source of cell 10.
  ['02.11.2020 10:00', '02.11.2020 10:30'],
  // 6. EXCLUDED: an end before the start.
  ['03.11.2020 12:00', '03.11.2020 11:00'],
  // 7. EXCLUDED: an empty finish cell. This is what a 2020 file row for a
  //    session that was cut off looks like, and it is why the excluded pill is
  //    on this fixture at all.
  ['04.11.2020 08:00', ''],
];

/**
 * The WOWS rows.
 *
 *   1.  13.03.2019 21:30 -> 23:00   1h 30m  5,400s, OVERLAPS the WOT span
 *   2.  20.06.2021 18:00 -> 18:20   0h 20m  1,200s
 *
 * Row 1 is chosen to overlap the WOT Wednesday evening, which is what makes the
 * two-game total (17,400) smaller than the sum of the two game totals (19,200)
 * — the D-02 non-additivity, on the real shape.
 */
export const REAL_SHAPE_WOWS_ROWS: readonly RealShapeRow[] = [
  // 1. Overlaps the WOT rows 1 and 2 for 30 minutes on 13.03.2019.
  ['13.03.2019 21:30', '13.03.2019 23:00'],
  // 2. Two years later and on a Sunday, so the calendar's 2020 gap line and the
  //    WOWS-only cell 162 are both exercised by it.
  ['20.06.2021 18:00', '20.06.2021 18:20'],
];

/** No rows: a file the export ships as a header and nothing else. */
const NO_ROWS: readonly RealShapeRow[] = [];

/**
 * Render one per-game session file: the header, then one CRLF-terminated line
 * per row, every line ending CRLF and no leading blank line.
 *
 * The line ending is CRLF because that is what the real export writes, and a
 * fixture that normalised it to LF would stop covering the shape the importer
 * actually meets. An empty row list gives a header-only file, which is the
 * state `WOTB_Game_Sessions.csv` ships in for an account that never played
 * that game.
 */
export function buildRealShapeCsv(rows: readonly RealShapeRow[]): string {
  let out = REAL_SHAPE_HEADER + '\r\n';
  for (const [started, finished] of rows) {
    out += `${started};${finished};${REAL_SHAPE_IP}\r\n`;
  }
  return out;
}

/** What a caller may override, one row list per game file. */
export interface RealShapeExportOptions {
  /** `WOT_Game_Sessions.csv`. Defaults to {@link REAL_SHAPE_WOT_ROWS}. */
  wot?: readonly RealShapeRow[];
  /** `WOTB_Game_Sessions.csv`. Defaults to header-only. */
  wotb?: readonly RealShapeRow[];
  /** `WOWS_Game_Sessions.csv`. Defaults to header-only. */
  wows?: readonly RealShapeRow[];
}

/**
 * The `.xlsx` sibling the real export ships beside the csv.
 *
 * A real one is a SpreadsheetML or OOXML package; a parse attempt on these
 * sixteen bytes would yield garbage. The classifier inflates `.csv` entries
 * only, so the file must never reach the session-row list — and that is
 * asserted rather than assumed (T-04-31). The two leading `PK` bytes are kept
 * because a fixture whose duplicate did not even look like a zip would not be
 * the same shape.
 */
const XLSX_DUPLICATE_BYTES = new Uint8Array([
  0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02, 0x1f, 0x07, 0x00, 0x08, 0x00,
]);

/**
 * Zip a real-shape export: the wrapper folder, then the account id, then
 * `Activity_history` holding the three per-game csv files, the xlsx duplicate
 * and the `__MACOSX` sidecar.
 *
 * The wrapper folder is the one `buildWrapperExport` uses, because a real
 * download is re-zipped by the user's OS into a `personal_data_export` folder
 * and the importer has to find the account id through it.
 */
export function buildRealShapeExport(options: RealShapeExportOptions = {}): Uint8Array {
  const wot = options.wot ?? REAL_SHAPE_WOT_ROWS;
  const wotb = options.wotb ?? NO_ROWS;
  const wows = options.wows ?? NO_ROWS;

  const activity = `${WRAPPER_FOLDER_NAME}/${SAMPLE_ACCOUNT_ROOT}/Activity_history`;
  const encode = (text: string): Uint8Array => new TextEncoder().encode(text);
  return zipSync({
    [`${activity}/WOT_Game_Sessions.csv`]: encode(buildRealShapeCsv(wot)),
    [`${activity}/WOTB_Game_Sessions.csv`]: encode(buildRealShapeCsv(wotb)),
    [`${activity}/WOWS_Game_Sessions.csv`]: encode(buildRealShapeCsv(wows)),
    [`${activity}/WOT_Game_Sessions.xlsx`]: XLSX_DUPLICATE_BYTES,
    [`__MACOSX/${WRAPPER_FOLDER_NAME}/${SAMPLE_ACCOUNT_ROOT}/Activity_history/._WOT_Game_Sessions.csv`]:
      new Uint8Array(0),
  });
}

/** The export with rows in WOT and WOWS: the two-game shape. */
export function buildTwoGameExport(): Uint8Array {
  return buildRealShapeExport({ wot: REAL_SHAPE_WOT_ROWS, wows: REAL_SHAPE_WOWS_ROWS });
}

/**
 * An export whose three game files are all header-only, which the importer
 * must report as "the files were there and none of them had a usable row".
 */
export function buildHeaderOnlyRealShapeExport(): Uint8Array {
  return buildRealShapeExport({ wot: NO_ROWS, wotb: NO_ROWS, wows: NO_ROWS });
}

// -----------------------------------------------------------------------------
// The answer keys
// -----------------------------------------------------------------------------

/**
 * One slice's figures and the two strings the UI spells them with.
 *
 * The same shape as the hand fixture's `HandSlice`, with the two charts' own
 * totals beside it, so a spec can read every expected number from ONE constant
 * and never compute one from the page it is checking.
 */
export interface RealShapeSlice {
  /** Merged playtime, in seconds. */
  seconds: number;
  /** Usable sessions, including the overlapping and zero-length ones. */
  sessions: number;
  /** Rows counted and not turned into sessions (D-02). */
  excluded: number;
  /** Days at least one usable session started on. */
  activeDays: number;
  /** The hours tile's text, `formatHours(seconds)`. */
  hoursText: string;
  /** The status live region's text after choosing this slice. */
  announcement: string;
  /** Active day numbers, ascending, from `Date.UTC`. */
  dayIndex: readonly number[];
  /** Merged seconds per day, parallel to `dayIndex`. */
  daySeconds: readonly number[];
  /** Usable sessions starting on each day, parallel to `dayIndex`. */
  daySessions: readonly number[];
  /** The twelve duration bins, one session per bin. */
  bins: readonly number[];
  /** Non-zero weekday-hour cells under the `overlap` basis, cell to seconds. */
  hourOverlapNonZero: Readonly<Record<number, number>>;
  /** Non-zero weekday-hour cells under the `start` basis, cell to seconds. */
  hourStartNonZero: Readonly<Record<number, number>>;
  /** Every calendar cell drawn, summed over the active years. */
  calendarCells: number;
  /** The active years, ascending, which is what the gap line sits between. */
  years: readonly number[];
}

/**
 * The WOT file alone: 12,600s over 5 usable sessions, 2 excluded, 3 active days.
 *
 * Merged, by hand: rows 1 and 2 overlap, so together they cover 20:00 to 22:00
 * = 7,200s; row 3 crosses midnight for 3,600s; row 4 is zero; row 5 is 1,800s.
 * 7,200 + 3,600 + 0 + 1,800 = 12,600, which is 3.5 hours exactly.
 *
 * Days: 2019-03-13 takes rows 1 and 2 for 7,200s over 2 sessions; 2019-03-14
 * takes row 3 for 3,600s over 1; 2020-11-02 takes row 4's zero and row 5's
 * 1,800s for 1,800s over 2.
 *
 * Bins, from the RAW lengths: 5,400 and 3,600 and 3,600 all fall in bin 7 (the
 * 1-2 hour bucket, whose inclusive lower bound is 3,600), 0 in bin 0 (under a
 * minute) and 1,800 in bin 6 (the inclusive lower bound of 30-60 minutes).
 *
 * Cells, where the cell is the WEEKDAY times 24 plus the hour with Monday 0:
 * 2019-03-13 is a Wednesday, 03-14 a Thursday, 03-15 a Friday and 2020-11-02 a
 * Monday. Under `overlap` row 1's tail puts 3,600 in cell 68 and 1,800 in
 * cell 69, row 2 adds its 1,800 new seconds to cell 69, row 3 splits 1,800 into
 * cell 95 and 1,800 into cell 96, and row 5 puts 1,800 in cell 10. Under
 * `start` each session's whole increment lands in the cell it STARTED in, which
 * is why cell 69 holds 1,800 rather than 3,600 and cell 68 holds all 5,400.
 *
 * 731 cells: 2019 is 365 days and 2020 is a leap year at 366, and every day of
 * both is drawn whether or not it held a session.
 */
export const REAL_SHAPE_WOT: RealShapeSlice = {
  seconds: 12_600,
  sessions: 5,
  excluded: 2,
  activeDays: 3,
  hoursText: '3.5 hours',
  announcement: 'Showing WOT: 3.5 hours, 5 sessions, 3 active days.',
  dayIndex: [17968, 17969, 18568],
  daySeconds: [7200, 3600, 1800],
  daySessions: [2, 1, 2],
  bins: [1, 0, 0, 0, 0, 0, 1, 3, 0, 0, 0, 0],
  hourOverlapNonZero: { 10: 1800, 68: 3600, 69: 3600, 95: 1800, 96: 1800 },
  hourStartNonZero: { 10: 1800, 68: 5400, 69: 1800, 95: 3600 },
  calendarCells: 731,
  years: [2019, 2020],
};

/**
 * The WOWS file alone: 6,600s over 2 sessions, none excluded, 2 active days.
 *
 * 5,400 + 1,200 = 6,600, which is 1.833 hours and reads "1.8 hours".
 *
 * Days: 2019-03-13 for 5,400s over 1 session and 2021-06-20 for 1,200s over 1.
 * 2021-06-20 is a SUNDAY, so its cell is 6 times 24 plus 18 = 162.
 *
 * Bins: 5,400 in bin 7 and 1,200 in bin 5, the inclusive lower bound of the
 * 20-30 minute bucket.
 *
 * 730 cells: 2019 and 2021, 365 days each, with all of 2020 collapsed into a
 * single empty run between them.
 */
export const REAL_SHAPE_WOWS: RealShapeSlice = {
  seconds: 6600,
  sessions: 2,
  excluded: 0,
  activeDays: 2,
  hoursText: '1.8 hours',
  announcement: 'Showing WOWS: 1.8 hours, 2 sessions, 2 active days.',
  dayIndex: [17968, 18798],
  daySeconds: [5400, 1200],
  daySessions: [1, 1],
  bins: [0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0],
  hourOverlapNonZero: { 69: 1800, 70: 3600, 162: 1200 },
  hourStartNonZero: { 69: 5400, 162: 1200 },
  calendarCells: 730,
  years: [2019, 2021],
};

/**
 * BOTH files, merged into the All slice as D-02 requires.
 *
 * 17,400s over 7 sessions, 2 excluded, 4 active days, which is 4.833 hours and
 * reads "4.8 hours".
 *
 * 12,600 plus 6,600 is 19,200, and the total is 1,800 LESS than that: the WOWS
 * row 13.03.2019 21:30-23:00 overlaps the WOT span by exactly 30 minutes, and
 * the union counts that half hour once. The two per-game totals are right AND
 * the All total is right at the same time — which is what makes the overlap
 * note under the split table worth having.
 *
 * 2019-03-13 therefore holds 10,800s over 3 sessions, 2019-03-14 3,600s over
 * 1, 2020-11-02 1,800s over 2 and 2021-06-20 1,200s over 1. Bin 7 now holds the
 * four raw 1-hour-plus lengths, and bin 5 the WOWS half hour.
 *
 * 1,096 cells: 365 of 2019, 366 of 2020 and 365 of 2021.
 */
export const REAL_SHAPE_ALL: RealShapeSlice = {
  seconds: 17_400,
  sessions: 7,
  excluded: 2,
  activeDays: 4,
  hoursText: '4.8 hours',
  announcement: 'Showing all sessions: 4.8 hours, 7 sessions, 4 active days.',
  dayIndex: [17968, 17969, 18568, 18798],
  daySeconds: [10800, 3600, 1800, 1200],
  daySessions: [3, 1, 2, 1],
  bins: [1, 0, 0, 0, 0, 1, 1, 4, 0, 0, 0, 0],
  hourOverlapNonZero: { 10: 1800, 68: 3600, 69: 3600, 70: 3600, 95: 1800, 96: 1800, 162: 1200 },
  hourStartNonZero: { 10: 1800, 68: 5400, 69: 5400, 95: 3600, 162: 1200 },
  calendarCells: 1096,
  years: [2019, 2020, 2021],
};
