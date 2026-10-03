import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import { parseSessionTimestamp } from '../../../src/lib/features/playtime/playtime-aggregate';
import { oracleSlice, type OracleSession } from '../../helpers/session-oracle';
import {
  SCALE_5K_SPEC,
  SCALE_60K_SPEC,
  SESSIONS_HEADER,
  SESSION_FIXTURE_IP,
  buildSessionsCsv,
  buildSessionsExport,
  type SessionsFixtureSpec,
} from '../../fixtures/sessions-fixtures';

const sum = (values: readonly number[]): number =>
  values.reduce((total, value) => total + value, 0);

/**
 * A small, single-year, three-server spec with one of every unreadable row
 * kind. One year keeps the whole set inside the oracle's per-second bitmap
 * limit, which a twelve-year spread could not be.
 */
const SMALL_SPEC: SessionsFixtureSpec = {
  seed: 4242,
  sessions: 150,
  startYear: 2019,
  years: 1,
  servers: ['eu', 'ru', 'na'],
  platforms: ['win32'],
  containedRate: 0.2,
  zeroLengthRate: 0.05,
  longSessionRate: 0.02,
  bad: { emptyEnd: 1, endBeforeStart: 1, garbage: 1, impossibleDate: 1, missingStart: 1 },
  strayEarlyYear: false,
};

/** Split a Sessions.csv into header and rows. Bare CR only — never LF. */
function parseCsv(csv: string): string[][] {
  expect(csv.includes('\n')).toBe(false);
  return csv
    .split('\r')
    .filter((line) => line.length > 0)
    .map((line) => line.split(';'));
}

/** The usable sessions of a parsed CSV: every row whose timestamps parse. */
function usableRows(csv: string): { sessions: OracleSession[]; excluded: number } {
  const [, ...rows] = parseCsv(csv);
  const sessions: OracleSession[] = [];
  let excluded = 0;
  for (const row of rows) {
    const start = parseSessionTimestamp(row[0]);
    const end = parseSessionTimestamp(row[1]);
    if (start === null || end === null || end < start) {
      excluded += 1;
      continue;
    }
    sessions.push({ start, end });
  }
  return { sessions, excluded };
}

describe('sessions fixture generator', () => {
  it('produces byte-identical CSV from the same seed and different CSV from another', () => {
    const first = buildSessionsCsv(SCALE_5K_SPEC);
    const second = buildSessionsCsv(SCALE_5K_SPEC);
    expect(first).toBe(second);

    const other = buildSessionsCsv({ ...SCALE_5K_SPEC, seed: SCALE_5K_SPEC.seed + 1 });
    expect(other).not.toBe(first);
  });

  it('writes the header and nothing but bare-CR separators', () => {
    const csv = buildSessionsCsv(SMALL_SPEC);
    const lines = parseCsv(csv);

    expect(lines[0]!.join(';')).toBe(SESSIONS_HEADER);
    expect(csv.endsWith('\r')).toBe(true);
    expect(csv.includes('\n')).toBe(false);
  });

  it('emits exactly the accounted rows, all ending in the one fixture IP', () => {
    const { csv, expected } = buildSessionsExport(SMALL_SPEC);
    const rows = parseCsv(csv).slice(1);

    expect(rows).toHaveLength(expected.sessions + expected.excluded);
    // T-04-01: the IP column is never read, so the fixture can put a real
    // TEST-NET-1 value in it and prove nothing reaches Dexie through it.
    for (const row of rows) expect(row[5]).toBe(SESSION_FIXTURE_IP);
    expect(SESSION_FIXTURE_IP.startsWith('192.0.2.')).toBe(true);
  });

  it('keeps every derived sum internally consistent', () => {
    const { expected } = buildSessionsExport(SCALE_5K_SPEC);

    expect(sum(expected.hourOverlap)).toBe(expected.seconds);
    expect(sum(expected.hourStart)).toBe(expected.seconds);
    expect(sum(expected.daySeconds)).toBe(expected.seconds);
    expect(sum(expected.bins)).toBe(expected.sessions);
    expect(expected.dayIndex).toEqual([...expected.dayIndex].sort((a, b) => a - b));
    expect(expected.years).toEqual([...expected.years].sort((a, b) => a - b));
    expect(expected.activeDays.length).toBeGreaterThan(0);
  });

  it('matches the independent per-second oracle field for field', () => {
    const { csv, expected } = buildSessionsExport(SMALL_SPEC);
    const { sessions, excluded } = usableRows(csv);
    const oracle = oracleSlice(sessions);

    expect(excluded).toBe(expected.excluded);
    expect(sessions.length).toBe(expected.sessions);
    expect(expected.seconds).toBe(oracle.seconds);
    expect(expected.dayIndex).toEqual(oracle.dayIndex);
    expect(expected.daySeconds).toEqual(oracle.daySeconds);
    expect(expected.daySessions).toEqual(oracle.daySessions);
    expect(expected.hourOverlap).toEqual(oracle.hourOverlap);
    expect(expected.hourStart).toEqual(oracle.hourStart);
    expect(expected.bins).toEqual(oracle.bins);
  });

  it('covers containment, midnight crossing and zero-length sessions in the small spec', () => {
    const { expected, csv } = buildSessionsExport(SMALL_SPEC);
    const { sessions } = usableRows(csv);

    // Containment is what makes the merge sweep do any work at all here:
    // without an overlapping row a naive "sum the durations" implementation
    // would agree with this fixture too.
    const contained = sessions.filter((session) =>
      sessions.some(
        (other) =>
          other !== session &&
          other.start <= session.start &&
          session.end <= other.end &&
          (other.start < session.start || other.end > session.end),
      ),
    );
    expect(contained.length).toBeGreaterThan(0);

    // Zero-length sessions are valid rows that claim no seconds.
    expect(sessions.filter((session) => session.start === session.end).length).toBeGreaterThan(0);
    // A cross-midnight session is what makes the per-day and per-hour
    // attributions disagree, which is why both are asserted separately.
    expect(
      sessions.some(
        (session) => Math.floor(session.start / 86400) !== Math.floor((session.end - 1) / 86400),
      ),
    ).toBe(true);
    expect(expected.bins.filter((count) => count > 0).length).toBeGreaterThan(1);
  });

  it('reports the same calendar surface at both scales', () => {
    const small = buildSessionsExport(SCALE_5K_SPEC).expected;
    const large = buildSessionsExport(SCALE_60K_SPEC).expected;

    expect(large.years).toEqual(small.years);
    expect(large.calendarCells).toBe(small.calendarCells);
    expect(large.years[0]).toBe(1970);
    expect(small.calendarCells).toBeGreaterThan(12 * 365);
  });

  it('zips to the canonical Activity_history/Sessions.csv path', () => {
    const { bytes, csv } = buildSessionsExport(SMALL_SPEC);
    const files = unzipSync(bytes);
    const key = Object.keys(files).find((path) => path.endsWith('Activity_history/Sessions.csv'));

    expect(key).toBeDefined();
    expect(new TextDecoder().decode(files[key!])).toBe(csv);
  });
});
