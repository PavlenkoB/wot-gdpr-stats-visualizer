// Synthetic Sessions.csv for the headless demo driver (phase 04, plan 04-12).
//
// WHY THIS IS A SEPARATE MODULE
// The driver's demo export carried a two-column Sessions.csv
// (`SESSION_ID;START_AT`) that had been fine while the pipeline counted
// nothing. Since the Phase 4 pipeline was added, that shape is classified as
// `no-usable-sessions`: `resolveSessionColumns` looks for `SESSION_START` and
// `SESSION_END`, finds neither, and every row is excluded. The demo therefore
// showed an empty Playtime block and the screenshots proved nothing about the
// charts the phase exists to build.
//
// So the demo data now carries the REAL six-column shape the aggregator reads:
//   SESSION_START;SESSION_END;CLIENT_BUILD;CLIENT_PLATFORM;SERVER_NAME;IP
// and this module owns it, with a `--check` mode that verifies the data
// without a browser. The driver imports `buildDemoSessionsCsv` and never
// inlines a row.
//
// SYNTHETIC ONLY, AND PII-FREE
// Per `tests/fixtures/README.md` (fixture=synthetic): the only address written
// is `192.0.2.99` from TEST-NET-1 (RFC 5737), the server names are not real
// hostnames, and no real Wargaming data is ever read or written here. A real
// export is never dropped into the repository; the human check in
// 04-12-PLAN Task 3 runs one from outside it.
//
// WHY THE NUMBERS ARE HAND-DERIVABLE
// `--check` asserts a closed form over this layout rather than a snapshot, so
// a change to the generator that breaks the demo's expected tiles fails with a
// NAMED assertion rather than a number nobody can check by hand:
//   30 usable sessions over 21 distinct days, 3 servers with 10 each,
//   1,870 minutes (31.2 hours) in total, 1 excluded row with an empty end,
//   and exactly 1 session crossing midnight.
//
// Usage:
//   node .claude/skills/run-data-export-viewer/sessions-csv.mjs --check

import { pathToFileURL } from 'node:url';

/**
 * The Sessions.csv header, matching the column names the aggregator resolves.
 * The order is the export's own; `CLIENT_BUILD` is never read.
 */
export const SESSIONS_HEADER = 'SESSION_START;SESSION_END;CLIENT_BUILD;CLIENT_PLATFORM;SERVER_NAME;IP';

/** The one address written in every row. RFC 5737 TEST-NET-1, never a real host. */
const DEMO_IP = '192.0.2.99';

/** The CLIENT_BUILD written on every row; the aggregator ignores it. */
const DEMO_CLIENT_BUILD = '12931';

/** The CLIENT_PLATFORM written on every row. */
const DEMO_PLATFORM = 'win32';

/** The three server names, chosen by `i % 3` so each gets exactly ten rows. */
const DEMO_SERVERS = ['EU1', 'EU2', 'NA1'];

/**
 * The row that crosses midnight, as an index into the 30-session loop.
 *
 * 23:30 for 90 minutes ends at 01:00 the next day, so the session's merged
 * seconds are attributed to its START day (D-02) while its tail lands in the
 * next day's hour grid. It is the one row in the demo that exercises the
 * midnight-crossing path at all.
 */
const MIDNIGHT_CROSSER = 5;

/** Day zero of the demo: 1 January 2024, a leap year. */
const DEMO_START_YEAR = 2024;
const DEMO_START_MONTH = 0;
const DEMO_START_DAY = 1;

/** Days the 30 sessions are spread over, so the calendar shows three weeks. */
const DEMO_DAY_SPAN = 21;

/**
 * `YYYY-MM-DD` for a day offset from the demo start.
 *
 * @param {number} offset
 * @returns {string}
 */
function dayOffset(offset) {
  const at = new Date(Date.UTC(DEMO_START_YEAR, DEMO_START_MONTH, DEMO_START_DAY + offset));
  return at.toISOString().slice(0, 10);
}

/**
 * A wall-clock instant on `date`.
 *
 * @param {string} date `YYYY-MM-DD`
 * @param {string} time `HH:MM:SS`
 * @returns {string}
 */
function at(date, time) {
  return `${date} ${time}`;
}

/**
 * A demo cell as Unix seconds. `Date.parse` with an explicit `Z` and no
 * conversion afterwards, so the demo's wall clock and the instant the
 * aggregator computes from it are the same thing.
 *
 * @param {string} value
 * @returns {number}
 */
function instantOf(value) {
  return Date.parse(`${value.replace(' ', 'T')}Z`) / 1000;
}

/**
 * The demo Sessions.csv: a header line, 30 usable data lines and one excluded
 * line, joined with a BARE CARRIAGE RETURN and ending with one.
 *
 * The CR-only ending matches the real export and the repo's own fixtures
 * (`buildSessionsCsvFromRows`). PapaParse splits on both CR and LF, so an
 * LF-normalised file would parse identically — which is precisely why the
 * quirk has to be reproduced deliberately rather than by accident.
 */
export function buildDemoSessionsCsv() {
  const lines = [SESSIONS_HEADER];

  for (let i = 0; i < 30; i += 1) {
    const date = dayOffset(i % DEMO_DAY_SPAN);
    let start;
    let minutes;
    if (i === MIDNIGHT_CROSSER) {
      start = at(date, '23:30:00');
      minutes = 90;
    } else {
      // The first three weeks start in the evening; the last nine days start
      // in the morning, so the hour grid is not a single stripe.
      start = at(date, i < DEMO_DAY_SPAN ? '18:00:00' : '10:00:00');
      minutes = 20 + 15 * (i % 7);
    }
    const end = new Date((instantOf(start) + minutes * 60) * 1000)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ');
    lines.push(
      [start, end, DEMO_CLIENT_BUILD, DEMO_PLATFORM, DEMO_SERVERS[i % 3], DEMO_IP].join(';'),
    );
  }

  // The one excluded row: a start with no end. D-02 counts it and it is never
  // a session, which is what makes the excluded pill in screenshot 03b say
  // "1 session row excluded" instead of nothing.
  lines.push(
    [at(dayOffset(DEMO_DAY_SPAN + 1), '12:00:00'), '', DEMO_CLIENT_BUILD, DEMO_PLATFORM, 'EU1', DEMO_IP].join(';'),
  );

  return lines.join('\r') + '\r';
}

/**
 * Run the checks and print one summary line.
 *
 * The parse here is INDEPENDENT of the aggregator on purpose — split on the
 * carriage return, then on the semicolon — so this verifies the data this
 * module generates rather than agreeing with the code that consumes it.
 */
function check() {
  const text = buildDemoSessionsCsv();
  const failures = [];
  /** @param {string} label @param {unknown} actual @param {unknown} want */
  const expect = (label, actual, want) => {
    const got = JSON.stringify(actual);
    const expected = JSON.stringify(want);
    if (got !== expected) failures.push(`${label}: got ${got}, want ${expected}`);
  };

  if (text.includes('\n')) failures.push('the file must contain no line feed character');
  expect('header', text.slice(0, SESSIONS_HEADER.length), SESSIONS_HEADER);

  const lines = text.split('\r').filter((line) => line !== '');
  const rows = lines.slice(1).map((line) => line.split(';'));

  const usable = [];
  let emptyEnd = 0;
  for (const row of rows) {
    expect('field count', row.length, 6);
    expect('last field is the documentation address', row[5], DEMO_IP);
    if (row[1] === '') {
      emptyEnd += 1;
      continue;
    }
    // The same exclusion rule the aggregator applies, written out so the two
    // do not share code: both instants present and the end not before the start.
    const start = instantOf(row[0] ?? '');
    const end = instantOf(row[1] ?? '');
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
      failures.push(`row ${row.join(';')} is not a usable session`);
      continue;
    }
    usable.push(row);
  }

  expect('usable rows', usable.length, 30);
  expect('rows with an empty end', emptyEnd, 1);

  const serverCounts = new Map();
  let totalMinutes = 0;
  let crossingMidnight = 0;
  const startDates = new Set();
  for (const row of usable) {
    const server = row[4] ?? '';
    serverCounts.set(server, (serverCounts.get(server) ?? 0) + 1);
    const start = instantOf(row[0] ?? '');
    const end = instantOf(row[1] ?? '');
    totalMinutes += (end - start) / 60;
    // `instantOf` returns SECONDS, so the comparison has to scale back up —
    // a `new Date(seconds)` would read both instants as 1970 and the two
    // dates would always look equal.
    if (new Date(start * 1000).toISOString().slice(0, 10) !== new Date(end * 1000).toISOString().slice(0, 10)) {
      crossingMidnight += 1;
    }
    startDates.add((row[0] ?? '').slice(0, 10));
  }

  expect('distinct server names', serverCounts.size, 3);
  for (const [server, count] of serverCounts) {
    expect(`usable rows for ${server}`, count, 10);
  }
  expect('distinct start dates', startDates.size, DEMO_DAY_SPAN);
  expect('total usable minutes', totalMinutes, 1870);
  expect('sessions crossing midnight', crossingMidnight, 1);

  if (failures.length > 0) {
    for (const failure of failures) console.error(`FAIL ${failure}`);
    return 1;
  }

  console.log(
    `sessions-csv OK: ${usable.length} usable rows, ${emptyEnd} excluded row, ` +
      `${startDates.size} days, ${totalMinutes} minutes (${(totalMinutes / 60).toFixed(1)} hours), ` +
      `${serverCounts.size} servers (${[...serverCounts.keys()].sort().join(', ')}), ` +
      `${crossingMidnight} session crossing midnight`,
  );
  return 0;
}

// Direct execution only. `import.meta.url` equals the resolved `argv[1]` when
// this file is the entry point and never when the driver imports it, so this
// comparison is what keeps the module importable without side effects.
if (process.argv[1] !== undefined) {
  if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    if (process.argv.includes('--check')) {
      process.exit(check());
    }
    console.error('usage: node sessions-csv.mjs --check');
    process.exit(1);
  }
}
