import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildLogins, viewFromLogins } from '../../../src/lib/features/logins/login-aggregate.ts';
import {
  buildLoginRows,
  capFigures,
  excludedCount,
  listedFigures,
  loginTiles,
} from '../../../src/lib/features/logins/login-model.ts';
import type { LoginsView } from '../../../src/lib/features/logins/login-shared.ts';
import { lookupCountry } from '../../../src/lib/geo/country-lookup.ts';
import { countryName } from '../../../src/lib/geo/country-names.ts';
import { parseCsvFile } from '../../../src/lib/worker/csv-parse.ts';
import {
  LOGIN_ACCOUNT_NOTE,
  LOGIN_EXCLUDED_EXPLANATION,
  LOGIN_TABLE_FIND_HINT,
  VEHICLE_SCROLL_HINT,
  formatLoginCapLine,
  formatLoginCountLine,
  formatLoginExcludedPill,
} from '../../../src/lib/ui-copy.ts';
import { buildLoginsOverCapSpec, buildLoginsScaleSpec } from '../../fixtures/logins-fixtures.ts';
import type { LoginSource } from '../../../src/lib/features/logins/login-aggregate.ts';
import type { LoginsScaleSpec } from '../../fixtures/logins-fixtures.ts';

// =============================================================================
// The IP table's decisions, without a DOM (06-10, Task 2)
//
// Vitest renders no component, so this file renders nothing. It pins the PURE
// decisions the two components call — which numbers the count line reads,
// whether the cap line and the excluded pill exist — and reads the component
// SOURCE for the prohibitions that cannot be asserted any other way: no inline
// style, no motion, no raw HTML. The same two rules `login-model.test.ts` states
// for its own source contracts hold here: assert the file EXISTS first (an empty
// string contains no forbidden token), and strip comments before any
// prohibition (a comment that explains an absence names the thing absent).
// =============================================================================

function sourcesOf(spec: LoginsScaleSpec): LoginSource[] {
  return spec.files.map((file) => ({
    kind: file.game === null ? ('logins' as const) : ('sessions' as const),
    game: file.game,
    rows: parseCsvFile(file.text, 'Activity_history', file.path.split('/').pop()!).rows.map(
      (r) => r.data,
    ),
  }));
}

function readyViewOf(spec: LoginsScaleSpec): Extract<LoginsView, { status: 'ready' }> {
  const view = viewFromLogins(buildLogins(sourcesOf(spec), lookupCountry));
  if (view.status !== 'ready') throw new Error('the fixture must produce a ready view');
  return view;
}

describe('the count line reads the listed rows and their logins (06-10)', () => {
  const capped = readyViewOf(buildLoginsOverCapSpec(20_500));

  it('is over the cap, so the identities below are not vacuous', () => {
    expect(capped.other.addresses).toBeGreaterThan(0);
    expect(capped.addresses.length).toBe(20_000);
  });

  it('counts the listed addresses and the logins of those listed addresses', () => {
    const rows = buildLoginRows(capped.addresses, countryName);
    const listed = listedFigures(rows);
    expect(listed.addresses).toBe(capped.addresses.length);
    expect(listed.logins).toBe(capped.addresses.reduce((sum, a) => sum + a.logins, 0));
  });

  it('adds up with the cap line to the tile totals', () => {
    const rows = buildLoginRows(capped.addresses, countryName);
    const listed = listedFigures(rows);
    const tiles = loginTiles(capped, countryName);
    expect(listed.addresses + capped.other.addresses).toBe(tiles.ips);
    expect(listed.logins + capped.other.logins).toBe(capped.totalLogins);
  });

  it('is the sentence the copy inventory formats', () => {
    expect(formatLoginCountLine(1, 1, 'en-US')).toBe('1 IP address · 1 login');
  });
});

describe('the cap line and the excluded pill exist only above zero (06-10, D-06)', () => {
  const small = readyViewOf(buildLoginsScaleSpec());

  it('has no cap figures below the cap', () => {
    expect(small.other.addresses).toBe(0);
    expect(capFigures(small)).toBeNull();
  });

  it('has cap figures above it, and they are the folded addresses and their logins', () => {
    const capped = readyViewOf(buildLoginsOverCapSpec(20_500));
    expect(capFigures(capped)).toEqual({
      addresses: capped.other.addresses,
      logins: capped.other.logins,
    });
    expect(formatLoginCapLine(1, 1, 'en-US')).toContain('1 more IP address');
  });

  it('counts the unreadable rows of a ready view, and of a no-usable one', () => {
    expect(excludedCount(small)).toBe(small.unreadableRows);
    expect(small.unreadableRows).toBeGreaterThan(0);
    expect(excludedCount({ status: 'no-usable', unreadable: 4 })).toBe(4);
  });

  it('counts nothing for a view that has no source, or for no view', () => {
    expect(excludedCount({ status: 'no-source' })).toBe(0);
    expect(excludedCount(null)).toBe(0);
  });

  it('formats an empty pill at zero, so ExcludedNotice renders nothing', () => {
    expect(formatLoginExcludedPill(0)).toBe('');
    expect(formatLoginExcludedPill(1)).toBe('1 login row without a readable IP address');
    expect(LOGIN_EXCLUDED_EXPLANATION.length).toBeGreaterThan(0);
  });
});

// -----------------------------------------------------------------------------
// Source contracts
// -----------------------------------------------------------------------------

const FEATURE_DIR = join(process.cwd(), 'src/lib/features/logins');

/** The file's text with every comment removed, asserting it exists first. */
function codeOfRequired(name: string): string {
  const path = join(FEATURE_DIR, name);
  expect(existsSync(path), `${path} does not exist`).toBe(true);
  return readFileSync(path, 'utf8')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

const COMPONENTS = readdirSync(FEATURE_DIR).filter((name) => name.endsWith('.svelte'));

describe('no component under src/lib/features/logins styles inline, animates or injects HTML (06-10)', () => {
  it('has components to scan, including the table', () => {
    expect(COMPONENTS).toContain('LoginTable.svelte');
    expect(COMPONENTS).toContain('LoginHistory.svelte');
  });

  for (const name of COMPONENTS) {
    it(`${name} has no style attribute, style directive, transition, animation or raw HTML`, () => {
      const code = codeOfRequired(name);
      expect(code).not.toMatch(/\sstyle\s*=/);
      expect(code).not.toMatch(/\sstyle:/);
      expect(code).not.toMatch(/transition/i);
      expect(code).not.toMatch(/\banimation(-[a-z-]+)?\s*:|@keyframes|\banimate:/i);
      expect(code).not.toContain('{@html');
    });
  }
});

describe('the table component keeps an address out of every attribute (06-10, T-06-37)', () => {
  const table = codeOfRequired('LoginTable.svelte');

  it('keys the drawn rows by index and hooks them with counts only', () => {
    expect(table).toContain('(index)');
    expect(table).toContain('data-logins={row.logins}');
    expect(table).not.toMatch(/data-ip|data-address|\(row\.ip\)/);
  });

  it('draws a cell title only from the cell, never from the row or an address', () => {
    expect(table).not.toMatch(/title=\{[^}]*\.ip\b/);
    expect(table).not.toMatch(/aria-label=\{[^}]*\.ip\b/);
  });

  it('is windowed always, with no threshold branch', () => {
    expect(table).toContain('windowRange(');
    expect(table).not.toMatch(/length\s*[<>]=?\s*\d{2,}/);
  });

  it('declares the sort buttons, aria-sort and the pinned Account record group', () => {
    expect(table).toContain('login-sort-');
    expect(table).toContain('aria-sort');
    expect(table).toContain('login-account-row-group');
    expect(table).toContain('login-account-row');
    expect(table).toContain('scope="col"');
  });
});

describe('the block puts the notes, the pill and the cap line under the table (06-10)', () => {
  const block = codeOfRequired('LoginHistory.svelte');

  it('shows the keyboard hint, the find hint and the account note from the copy inventory', () => {
    expect(block).toContain('VEHICLE_SCROLL_HINT');
    expect(block).toContain('LOGIN_TABLE_FIND_HINT');
    expect(block).toContain('LOGIN_ACCOUNT_NOTE');
    // The sentences themselves are asserted by the copy tests; here only that
    // they exist and are not inlined.
    expect(VEHICLE_SCROLL_HINT.length).toBeGreaterThan(0);
    expect(LOGIN_TABLE_FIND_HINT.length).toBeGreaterThan(0);
    expect(LOGIN_ACCOUNT_NOTE.length).toBeGreaterThan(0);
  });

  it('routes the excluded pill through ExcludedNotice with its own test id', () => {
    expect(block).toContain('ExcludedNotice');
    expect(block).toContain('testId="login-excluded"');
    expect(block).toContain('formatLoginExcludedPill');
  });

  it('shows the cap line only from the model figures', () => {
    expect(block).toContain('formatLoginCapLine');
    expect(block).toContain('capFigures');
  });

  it('shows the account note only when the account row exists', () => {
    expect(block).toContain('hasAccountRow');
  });
});
