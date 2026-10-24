import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { MAX_TIER as LOOKUP_MAX_TIER } from '../../../src/lib/features/overview/overview-lookup.ts';
import { defaultVehicleLookup } from '../../../src/lib/features/overview/vehicle-table.ts';
import {
  VEHICLE_TABLE,
  VEHICLE_TABLE_META,
} from '../../../src/lib/features/overview/vehicle-table.generated.ts';
import {
  MAX_ROWS,
  MAX_TIER,
  VEHICLE_TYPES,
  readApplicationId,
  renderModule,
  rowsHash,
  validatePages,
  validateRows,
  type VehicleTableRow,
} from '../../../scripts/vehicles/lib/vehicle-table-build.ts';

// =============================================================================
// The tank-table GENERATOR (13-02 Task 1, D-07, D-08, T-13-06, T-13-07)
//
// Three claims are defended here, and none of them needs a network or a key:
//
//   1. THE VALIDATION FAILS CLOSED. The API payload is untrusted input that
//      becomes committed source, so every field that could carry a control
//      character, an angle bracket, a duplicate key or a nonsense tier is
//      rejected rather than sanitised. Each case below plants a MARKER in the
//      offending field and asserts the thrown message does not carry it: the
//      message may name the rule and the numeric id, and nothing else.
//
//   2. THE KEY NEVER ESCAPES. The key is read from the environment or from
//      one line of the gitignored env file, and it reaches the request and
//      nothing else. No message, no output file and no log line may carry it.
//
//   3. THE COMMITTED TABLE IS THE MAINTAINER'S, AND IT IS VALID. Plan 13-15
//      passed the Terms-of-Use gate and committed the generated rows; the last
//      block of this file re-applies the generator's per-row rules to them
//      (D-07, D-09).
//
// The generator cases are SYNTHETIC: invented tags, invented ids above 900,000
// and invented names. The only real rows are the ones the last block READS
// from the committed module; this file writes none.
// =============================================================================

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const BUILD_SCRIPT = path.join(REPO_ROOT, 'scripts/vehicles/build-vehicle-table.ts');
const BUILD_LIB = path.join(REPO_ROOT, 'scripts/vehicles/lib/vehicle-table-build.ts');
const COMMITTED_TABLE = path.join(
  REPO_ROOT,
  'src/lib/features/overview/vehicle-table.generated.ts',
);

/** A marker planted in an offending field, to prove the message does not echo it. */
const MARKER = 'PLANTED-MARKER-XYZ';

/** Run the generator the way a contributor does: the same Node, no flags. */
function runScript(
  args: readonly string[],
  env?: NodeJS.ProcessEnv,
): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [BUILD_SCRIPT, ...args], {
    encoding: 'utf8',
    cwd: REPO_ROOT,
    env: env ?? process.env,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

let tempDir = '';

beforeAll(() => {
  tempDir = mkdtempSync(path.join(tmpdir(), 'vehicle-table-'));
});

afterAll(() => {
  if (tempDir !== '') rmSync(tempDir, { recursive: true, force: true });
});

/** One synthetic API entry. */
function entry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    tank_id: 900001,
    tag: 'SynthAlpha',
    name: 'Synth Alpha Long Name',
    short_name: 'SynthAlpha',
    type: 'mediumTank',
    tier: 5,
    nation: 'synth',
    ...overrides,
  };
}

/** One synthetic API page. */
function page(entries: Record<string, unknown>[], status = 'ok'): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const item of entries) data[String(item['tank_id'])] = item;
  return { status, meta: { count: entries.length, page_total: 1, total: entries.length }, data };
}

/** The payload the tests round-trip: two pages, three rows, invented ids. */
function syntheticPages(): Record<string, unknown>[] {
  return [
    page([
      entry({ tank_id: 900003, tag: 'SynthCharlie', short_name: 'SynthCharlie' }),
      entry({ tank_id: 900001, tag: 'SynthAlpha', short_name: 'SynthAlpha' }),
    ]),
    page([entry({ tank_id: 900002, tag: 'SynthBravo', short_name: '', name: 'Synth Bravo' })]),
  ];
}

describe('validatePages: the payload becomes rows, and only good rows', () => {
  it('accepts a two-page payload and returns the rows sorted by tank id', () => {
    const rows = validatePages(syntheticPages());
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row[0])).toEqual([900001, 900002, 900003]);
    expect(rows[0]).toEqual([900001, 'synth:SynthAlpha', 'SynthAlpha', 'mediumTank', 5]);
  });

  it('falls back to the long name when the short name is empty', () => {
    const rows = validatePages(syntheticPages());
    expect(rows[1]?.[2]).toBe('Synth Bravo');
  });

  it('rejects a page that did not answer with status "ok"', () => {
    expect(() => validatePages([page([entry()], 'error')])).toThrow(/status/i);
  });

  it('rejects a page with no data object', () => {
    expect(() => validatePages([{ status: 'ok' }])).toThrow(/data/i);
    expect(() => validatePages([{ status: 'ok', data: [] }])).toThrow(/data/i);
  });

  it('rejects an entry that is not an object', () => {
    expect(() => validatePages([{ status: 'ok', data: { '1': null } }])).toThrow(/entry/i);
    expect(() => validatePages([{ status: 'ok', data: { '1': 'nope' } }])).toThrow(/entry/i);
  });

  it.each([
    ['zero', 0],
    ['negative', -5],
    ['fractional', 1.5],
    ['a string', '900001'],
    ['above the 32-bit range', 2147483648],
  ])('rejects a tank id that is %s', (_label, tankId) => {
    expect(() => validatePages([page([entry({ tank_id: tankId })])])).toThrow(/tank_id/i);
  });

  it('rejects a malformed tag', () => {
    expect(() => validatePages([page([entry({ tag: `${MARKER}!` })])])).toThrow(/tag/i);
    expect(() => validatePages([page([entry({ tag: '' })])])).toThrow(/tag/i);
  });

  it('accepts a hyphen in a tag, as the real T-34 and IS-3 tags carry one', () => {
    const rows = validatePages([page([entry({ tag: 'R04_T-34' })])]);
    expect(rows[0]?.[1]).toMatch(/:R04_T-34$/);
  });

  it('names the character that broke the tag rule, never the tag itself', () => {
    let message = '';
    try {
      validatePages([page([entry({ tag: `${MARKER}.x` })])]);
    } catch (error) {
      message = error instanceof Error ? error.message : '';
    }
    expect(message).toMatch(/U\+002E/);
    expect(message).not.toContain(MARKER);
  });

  it('rejects a malformed nation', () => {
    expect(() => validatePages([page([entry({ nation: `${MARKER}!` })])])).toThrow(/nation/i);
    expect(() => validatePages([page([entry({ nation: 'S' })])])).toThrow(/nation/i);
  });

  it('rejects a name that is not a string of 1 to 60 characters', () => {
    expect(() => validatePages([page([entry({ short_name: '', name: '' })])])).toThrow(/name/i);
    expect(() => validatePages([page([entry({ short_name: '', name: 42 })])])).toThrow(/name/i);
    expect(() => validatePages([page([entry({ short_name: 'x'.repeat(61) })])])).toThrow(/name/i);
  });

  it('rejects a name with a control character', () => {
    const name = `Synth${String.fromCharCode(7)}Alpha`;
    expect(() => validatePages([page([entry({ short_name: name })])])).toThrow(
      /control character/i,
    );
  });

  it('rejects a name with a C1 control, a zero-width, a bidi or a byte-order character (IN-07)', () => {
    const hidden = [
      0x85, 0x9f, 0x200b, 0x200f, 0x2028, 0x2029, 0x202a, 0x202e, 0x2066, 0x2069, 0xfeff,
    ];
    for (const code of hidden) {
      const name = `Synth${String.fromCharCode(code)}Alpha`;
      expect(
        () => validatePages([page([entry({ short_name: name })])]),
        `U+${code.toString(16)} must be refused`,
      ).toThrow(/control character/i);
    }
  });

  it('still accepts ordinary and accented names (IN-07)', () => {
    const rows = validatePages([
      page([entry({ short_name: 'Synth Alpha-1 \u00c9clair \u2013 II' })]),
    ]);
    expect(rows).toHaveLength(1);
  });

  it('refuses the same characters in a row the validator re-reads (IN-07)', () => {
    const bad = [[1, 'ussr:R01_Synth', `Synth${String.fromCharCode(0x202e)}Alpha`, 'heavyTank', 5]];
    expect(() => validateRows(bad)).toThrow(/control character/i);
    const good = [[1, 'ussr:R01_Synth', 'Synth Alpha', 'heavyTank', 5]];
    expect(() => validateRows(good)).not.toThrow();
  });

  it('rejects a name with an angle bracket', () => {
    expect(() => validatePages([page([entry({ short_name: `<${MARKER}>` })])])).toThrow(
      /angle bracket/i,
    );
  });

  it('rejects a type outside the known set', () => {
    expect(() => validatePages([page([entry({ type: 'battlecruiser' })])])).toThrow(/type/i);
    expect(() => validatePages([page([entry({ type: `${MARKER}` })])])).toThrow(/type/i);
  });

  it('accepts tier XI, the first of which is tank 6017', () => {
    const rows = validatePages([page([entry({ tier: 11 })])]);
    expect(rows[0]?.[4]).toBe(11);
  });

  it('keeps the generator and the lookup on the same tier ceiling', () => {
    expect(MAX_TIER).toBe(LOOKUP_MAX_TIER);
  });

  it('rejects a tier outside 1 to 11', () => {
    expect(() => validatePages([page([entry({ tier: 0 })])])).toThrow(/tier/i);
    expect(() => validatePages([page([entry({ tier: 12 })])])).toThrow(/tier/i);
    expect(() => validatePages([page([entry({ tier: 5.5 })])])).toThrow(/tier/i);
  });

  it('rejects a duplicate tank id', () => {
    const pages = [
      page([entry({ tank_id: 900001, tag: 'SynthAlpha' })]),
      page([entry({ tank_id: 900001, tag: 'SynthBravo' })]),
    ];
    expect(() => validatePages(pages)).toThrow(/more than once/i);
  });

  it('rejects a duplicate nation:tag key', () => {
    const pages = [
      page([entry({ tank_id: 900001, tag: 'SynthAlpha' })]),
      page([entry({ tank_id: 900002, tag: 'SynthAlpha' })]),
    ];
    expect(() => validatePages(pages)).toThrow(/more than once/i);
  });

  it('rejects a payload with no rows at all', () => {
    expect(() => validatePages([page([])])).toThrow(/no vehicle rows/i);
  });

  it('rejects a payload larger than the row cap', () => {
    const many: Record<string, unknown>[] = [];
    for (let i = 0; i < MAX_ROWS + 1; i += 1) {
      many.push(entry({ tank_id: 900000 + i, tag: `Synth${i}` }));
    }
    expect(() => validatePages([page(many)])).toThrow(/more than/i);
  });

  it('never lets a payload string into the thrown message', () => {
    const cases: unknown[][] = [
      [page([entry({ tag: `${MARKER}!` })])],
      [page([entry({ nation: `${MARKER}!` })])],
      [page([entry({ short_name: `<${MARKER}>` })])],
      [page([entry({ type: MARKER })])],
      [page([entry({ short_name: `${MARKER}${'x'.repeat(60)}` })])],
      [page([entry({ tank_id: MARKER })])],
      [{ status: 'error', error: { code: 401, message: MARKER } }],
    ];
    for (const pages of cases) {
      let message = '';
      try {
        validatePages(pages);
      } catch (error) {
        message = error instanceof Error ? error.message : String(error);
      }
      expect(message, 'the case must have thrown').not.toBe('');
      expect(message, `the message must not carry the marker: ${message}`).not.toContain(MARKER);
    }
  });

  it('accepts exactly the five known types', () => {
    expect([...VEHICLE_TYPES]).toEqual(['mediumTank', 'AT-SPG', 'heavyTank', 'lightTank', 'SPG']);
  });
});

describe('renderModule: the generated file carries data and nothing else', () => {
  const rows: VehicleTableRow[] = validatePages(syntheticPages());
  const text = renderModule(rows, '2026-10-23');

  it('imports nothing', () => {
    expect(text).not.toMatch(/\bimport\b/);
    expect(text).not.toContain('import(');
  });

  it('names no URL and no host', () => {
    expect(text).not.toContain('http');
    expect(text).not.toContain('://');
  });

  it('writes one row per line, with the metadata beside them', () => {
    expect(text).toContain('export const VEHICLE_TABLE: readonly VehicleTableRow[] = [');
    expect(text).toContain('count: 3');
    expect(text).toContain(rowsHash(rows));
    expect(text).toContain('generatedAt: "2026-10-23"');
  });

  it('writes a quote in a name safely', () => {
    const quoted = renderModule(
      [[900001, 'synth:SynthAlpha', 'The "Big" One', 'mediumTank', 5]],
      '2026-10-23',
    );
    expect(quoted).toContain('"The \\"Big\\" One"');
  });

  it('renders an empty table as an empty array', () => {
    const empty = renderModule([], '2026-10-23');
    expect(empty).toContain('export const VEHICLE_TABLE: readonly VehicleTableRow[] = [];');
    expect(empty).toContain('count: 0');
  });
});

describe('readApplicationId: the key, and only the key', () => {
  it('prefers the environment over the file', () => {
    const key = readApplicationId(
      { WG_APPLICATION_ID: 'SYNTHETIC-ENV-KEY-0001' },
      'WG_APPLICATION_ID=SYNTHETIC-FILE-KEY-0002\n',
    );
    expect(key).toBe('SYNTHETIC-ENV-KEY-0001');
  });

  it('falls back to the file text', () => {
    const key = readApplicationId({}, 'WG_APPLICATION_ID=SYNTHETIC-FILE-KEY-0003\n');
    expect(key).toBe('SYNTHETIC-FILE-KEY-0003');
  });

  it('trims the quotes around a quoted value', () => {
    expect(readApplicationId({}, 'WG_APPLICATION_ID="SYNTHETIC-QUOTED-0004"\n')).toBe(
      'SYNTHETIC-QUOTED-0004',
    );
    expect(readApplicationId({}, "WG_APPLICATION_ID='SYNTHETIC-QUOTED-0005'\n")).toBe(
      'SYNTHETIC-QUOTED-0005',
    );
  });

  it('ignores a commented line', () => {
    expect(readApplicationId({}, '# WG_APPLICATION_ID=SYNTHETIC-COMMENT-0006\n')).toBeNull();
  });

  it('drops an inline comment, quoted or not (IN-06)', () => {
    expect(readApplicationId({}, 'WG_APPLICATION_ID=SYNTHETIC-INLINE-0007 # a note\n')).toBe(
      'SYNTHETIC-INLINE-0007',
    );
    expect(readApplicationId({}, 'WG_APPLICATION_ID="SYNTHETIC-INLINE-0008" # a note\n')).toBe(
      'SYNTHETIC-INLINE-0008',
    );
    expect(readApplicationId({}, 'WG_APPLICATION_ID=# nothing here\n')).toBeNull();
  });

  it('takes the LAST assignment, as dotenv does (IN-06)', () => {
    const text = [
      'WG_APPLICATION_ID=SYNTHETIC-OLD-0009',
      '# WG_APPLICATION_ID=SYNTHETIC-COMMENT-0010',
      'export WG_APPLICATION_ID=SYNTHETIC-NEW-0011',
      '',
    ].join('\n');
    expect(readApplicationId({}, text)).toBe('SYNTHETIC-NEW-0011');
  });

  it('returns null when there is neither an environment value nor a file value', () => {
    expect(readApplicationId({}, null)).toBeNull();
    expect(readApplicationId({}, 'OTHER=1\n')).toBeNull();
    expect(readApplicationId({}, 'WG_APPLICATION_ID=\n')).toBeNull();
  });
});

describe('the generator as a child process', () => {
  it('writes the empty table, and the check accepts it', () => {
    const out = path.join(tempDir, 'empty.ts');
    const written = runScript(['--empty', '--out', out]);
    expect(written.status).toBe(0);
    expect(readFileSync(out, 'utf8')).toContain('count: 0');

    const checked = runScript(['--check', '--against', out]);
    expect(checked.status).toBe(0);
    expect(checked.stdout).toContain('count=0');
  });

  it('writes the rows of a saved payload, and the check accepts them', () => {
    const payload = path.join(tempDir, 'payload.json');
    writeFileSync(payload, JSON.stringify(syntheticPages()));
    const out = path.join(tempDir, 'rows.ts');

    const written = runScript(['--from', payload, '--out', out]);
    expect(written.status).toBe(0);
    expect(readFileSync(out, 'utf8')).toContain('count: 3');

    const checked = runScript(['--check', '--against', out]);
    expect(checked.status).toBe(0);
    expect(checked.stdout).toContain('count=3');
  });

  it('fails the check when one character of a row changed', () => {
    const payload = path.join(tempDir, 'payload2.json');
    writeFileSync(payload, JSON.stringify(syntheticPages()));
    const out = path.join(tempDir, 'rows2.ts');
    expect(runScript(['--from', payload, '--out', out]).status).toBe(0);

    const edited = readFileSync(out, 'utf8').replace('SynthAlpha', 'SynthAlphi');
    expect(edited).not.toBe(readFileSync(out, 'utf8'));
    writeFileSync(out, edited);

    const checked = runScript(['--check', '--against', out]);
    expect(checked.status).not.toBe(0);
    expect(checked.stderr).toMatch(/stale|invalid/i);
  });

  it('rejects an unknown flag', () => {
    const result = runScript(['--nonsense']);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/unknown flag/i);
  });

  it('fails closed when there is no key and no env file, and writes nothing', () => {
    const out = path.join(tempDir, 'never-written.ts');
    const env = { ...process.env };
    delete env['WG_APPLICATION_ID'];

    const result = runScript(
      ['--out', out, '--key-file', path.join(tempDir, 'no-such-env-file.local')],
      env,
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('WG_APPLICATION_ID is not set (environment or .env.local)');
    expect(() => readFileSync(out, 'utf8')).toThrow();
  });

  it('accepts the committed module, whatever its row count', () => {
    const checked = runScript(['--check']);
    expect(checked.status).toBe(0);
    expect(checked.stdout).toContain(`count=${VEHICLE_TABLE_META.count}`);
  });

  it('uses only erasable syntax, which is what makes stripping portable', () => {
    // Node's type stripping REPLACES types; it does not transform them. An
    // enum, a namespace or a parameter property needs a transform, so it is
    // the construct where two Node majors are most likely to disagree.
    for (const file of [BUILD_SCRIPT, BUILD_LIB]) {
      const source = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      const code = source
        .split('\n')
        .filter((line) => !line.trimStart().startsWith('//'))
        .join('\n');
      expect(code, `${file} must not declare an enum`).not.toMatch(/^\s*(export\s+)?enum\s/m);
      expect(code, `${file} must not declare a namespace`).not.toMatch(
        /^\s*(export\s+)?namespace\s/m,
      );
      expect(code, `${file} must not use a constructor parameter property`).not.toMatch(
        /constructor\s*\([^)]*\b(private|public|protected|readonly)\s/m,
      );
    }
  });

  it('imports with explicit .ts specifiers, which is what Node resolves', () => {
    const source = readFileSync(BUILD_SCRIPT, 'utf8');
    for (const match of source.matchAll(/from '([^']+)'/g)) {
      const specifier = match[1]!;
      if (specifier.startsWith('node:')) continue;
      expect(specifier, `${specifier} must carry its .ts extension`).toMatch(/\.ts$/);
    }
  });
});

describe('the committed module', () => {
  const source = readFileSync(COMMITTED_TABLE, 'utf8');

  it('holds at least 500 vehicles, and its metadata counts exactly its rows', () => {
    expect(VEHICLE_TABLE.length).toBeGreaterThanOrEqual(500);
    expect(VEHICLE_TABLE_META.count).toBe(VEHICLE_TABLE.length);
    expect(VEHICLE_TABLE.length).toBeLessThanOrEqual(MAX_ROWS);
  });

  it('carries the hash of its own rows', () => {
    expect(VEHICLE_TABLE_META.sha256).toBe(rowsHash([...VEHICLE_TABLE]));
  });

  it('passes the same per-row rules the generator applies', () => {
    expect(() => validateRows(VEHICLE_TABLE)).not.toThrow();
  });

  it('states the row rules explicitly: id, key, class, tier, name', () => {
    for (const [id, key, name, type, tier] of VEHICLE_TABLE) {
      expect(Number.isInteger(id) && id > 0, `id ${id}`).toBe(true);
      expect(key, `key of ${id}`).toMatch(/^[a-z_]{2,20}:[A-Za-z0-9_-]{1,64}$/);
      expect(VEHICLE_TYPES as readonly string[], `type of ${id}`).toContain(type);
      expect(Number.isInteger(tier) && tier >= 1 && tier <= MAX_TIER, `tier of ${id}`).toBe(true);
      expect(name.length >= 1 && name.length <= 60, `name of ${id}`).toBe(true);
      const bad = [...name].some((ch) => {
        const code = ch.charCodeAt(0);
        return ch === '<' || ch === '>' || code < 0x20 || code === 0x7f;
      });
      expect(bad, `name of ${id}`).toBe(false);
    }
  });

  it('has unique tank ids and unique keys', () => {
    expect(new Set(VEHICLE_TABLE.map((row) => row[0])).size).toBe(VEHICLE_TABLE.length);
    expect(new Set(VEHICLE_TABLE.map((row) => row[1])).size).toBe(VEHICLE_TABLE.length);
  });

  it('feeds a lookup of the same size, and both keys agree on the first and last row', () => {
    expect(defaultVehicleLookup.size).toBe(VEHICLE_TABLE_META.count);
    for (const row of [VEHICLE_TABLE[0]!, VEHICLE_TABLE[VEHICLE_TABLE.length - 1]!]) {
      const byTag = defaultVehicleLookup.byTag(row[1]);
      const byId = defaultVehicleLookup.byId(String(row[0]));
      expect(byTag).not.toBeNull();
      expect(byTag).toEqual(byId);
      expect(byTag?.name).toBe(row[2]);
      expect(byTag?.classKey).toBe(row[3]);
      expect(byTag?.tier).toBe(row[4]);
    }
  });

  it('is plain data: no import, no URL, no key', () => {
    expect(source).not.toMatch(/\bimport\b/);
    expect(source).not.toContain('http');
    expect(source).not.toContain('://');
    expect(source).not.toMatch(/application_id|WG_APPLICATION_ID/i);
  });

  it('stays under 120 KB, a regression guard on the worker chunk', () => {
    expect(statSync(COMMITTED_TABLE).size).toBeLessThan(120 * 1024);
  });
});
