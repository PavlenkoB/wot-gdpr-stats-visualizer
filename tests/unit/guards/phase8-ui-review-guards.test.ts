import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { contrastRatio } from '../../helpers/contrast.ts';
import { OVERVIEW_SCALE_PX, SCALE_PX } from '../../helpers/components.ts';

// =============================================================================
// Phase 8 UI-review guards (quick 261008-x40): the top three findings of
// 08-UI-REVIEW.md, pinned on SOURCE so they cannot regress.
// =============================================================================
//
// WHAT THESE PIN
//   - no file under src carries the three pre-Phase-8 greys: text, fills, strokes
//     and the tooltip surface read var(--text), var(--muted) and var(--ink);
//   - the blue literal survives only as the `--focus` declaration in app.css;
//   - every font-size under src is on the 14 / 18 / 26 / 30px scale (the :root
//     rule included), and native controls get one explicit element-level 14px;
//     the ONE exception is the Overview folder, which declares 12 / 14 / 32 /
//     56px (13-UI-SPEC Typography) and is pinned by self-tests below;
//   - the list-pane footer is sticky at the bottom of the scrolling pane at 900px
//     and above.
//
// WHY THE HELPERS ARE COPIED RATHER THAN IMPORTED
// Test files do not import from each other in this repository (the header of
// phase5-layout-guards.test.ts gives the reason), so `stripComments` is copied.
// =============================================================================

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SRC = path.join(REPO_ROOT, 'src');
const APP_CSS = path.join(SRC, 'app.css');

/** Strip HTML, block and line comments from Svelte/CSS/TS source. */
function stripComments(source: string): string {
  return source
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*/gm, '');
}

/** Every .svelte, .css and .ts file under `dir`, sorted. */
function walk(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...walk(full));
    } else if (/\.(svelte|css|ts)$/.test(entry.name)) {
      found.push(full);
    }
  }
  return found;
}

const FILES = walk(SRC);

/** The repo-relative name and comment-stripped source of every file under src. */
const SOURCES = FILES.map((file) => ({
  name: path.relative(REPO_ROOT, file),
  source: stripComments(readFileSync(file, 'utf8')),
}));

const APP_CSS_STRIPPED = stripComments(readFileSync(APP_CSS, 'utf8'));

const LEGACY_GREYS = /#3c4043|#5f6368|#08060d/i;
const BLUE = /#1a73e8/i;
const KEYWORDS = new Set(['inherit', 'initial', 'unset']);

/**
 * The Overview folder and its own type scale (13-UI-SPEC Typography).
 *
 * The Overview page declares FOUR text sizes — 12, 14, 32 and 56px — because
 * it is the one page with a hero numeral, a display value, a label and a
 * caption role. The project's scale (14 / 18 / 26 / 30) has no place for a
 * 12px caption or a 56px hero, so the Overview needed a scale of its own.
 *
 * The exemption is chosen BY FILE PATH, and it is deliberately narrow:
 *
 *   - it applies to `src/lib/features/overview/` and to nothing else;
 *   - it is an EXACT set, not a superset of the old scale, so 18px — legal
 *     everywhere else — is illegal in the Overview, and a stray 26px there is
 *     illegal too. A superset would let the Overview drift back towards the
 *     old scale without anybody noticing;
 *   - it is covered by self-tests below, so a change that widens the
 *     exemption fails a test rather than quietly weakening the guard for
 *     every other pane.
 */
const OVERVIEW_DIR = 'src/lib/features/overview/';

/** A repo-relative name with forward slashes, whatever the platform separator is. */
const posix = (name: string): string => name.split(path.sep).join('/');

/**
 * Every font-size in the given sources that is off ITS file's scale.
 *
 * The scale is chosen per FILE: a file under the Overview folder is held to
 * the Overview's four sizes, every other file to the project's four. The
 * function is pure and takes its input as an argument so the exemption can be
 * exercised directly by the self-tests below, with synthetic entries — a
 * guard whose own scope is untested is a guard whose scope can be widened by
 * accident.
 */
function fontSizeOffenders(entries: readonly { name: string; source: string }[]): string[] {
  const offenders: string[] = [];
  for (const { name, source } of entries) {
    const scale = posix(name).startsWith(OVERVIEW_DIR) ? OVERVIEW_SCALE_PX : SCALE_PX;
    for (const match of source.matchAll(/font-size\s*:\s*([^;}\n]+)/g)) {
      const value = (match[1] ?? '').trim().replace(/\s*!important$/, '');
      if (value === '0' || KEYWORDS.has(value)) continue;
      const px = /^(\d+(?:\.\d+)?)px$/.exec(value);
      if (px !== null && scale.has(Number(px[1]))) continue;
      offenders.push(`${name}: font-size: ${value}`);
    }
  }
  return offenders;
}

describe('phase 8 UI-review guards (quick 261008-x40)', () => {
  it('walks a real source tree', () => {
    const names = SOURCES.map(({ name }) => name);
    expect(names.length).toBeGreaterThan(80);
    expect(names).toContain(path.join('src', 'app.css'));
    expect(names).toContain(path.join('src', 'lib', 'ui-copy.ts'));
  });

  it('no file under src carries a legacy grey', () => {
    const offenders = SOURCES.filter(({ source }) => LEGACY_GREYS.test(source)).map(
      ({ name }) => name,
    );
    expect(offenders, 'read var(--text), var(--muted) or var(--ink)').toEqual([]);
  });

  it('the blue literal exists only as the --focus declaration', () => {
    const offenders = SOURCES.map(({ name, source }) => ({
      name,
      source:
        name === path.join('src', 'app.css') ? source.replace(/--focus:\s*#1a73e8;/i, '') : source,
    }))
      .filter(({ source }) => BLUE.test(source))
      .map(({ name }) => name);
    expect(offenders, 'read var(--focus)').toEqual([]);

    // The declaration itself is still there to be read.
    expect(APP_CSS_STRIPPED).toMatch(/--focus:\s*#1a73e8;/i);
  });

  it('white text on the tooltip surface (the --text token) clears 7:1', () => {
    const text = /--text:\s*(#[0-9a-f]{6});/i.exec(APP_CSS_STRIPPED)?.[1];
    expect(text, 'app.css declares --text').toBeDefined();
    expect(contrastRatio('#ffffff', text!)).toBeGreaterThanOrEqual(7);
  });

  it('every font-size under src is on its scale (14 / 18 / 26 / 30px, or 12 / 14 / 32 / 56px under features/overview)', () => {
    const offenders = fontSizeOffenders(SOURCES);
    expect(
      offenders,
      'use px, and one of 14, 18, 26 or 30 (or 12, 14, 32 or 56 under features/overview)',
    ).toEqual([]);
  });

  it('native controls get one explicit element-level 14px outside the phone block', () => {
    const rule = /(?:^|[};])\s*button\s*,\s*input\s*,\s*select\s*,\s*textarea\s*\{([^}]*)\}/m.exec(
      APP_CSS_STRIPPED,
    );
    expect(rule, 'app.css has a `button, input, select, textarea` rule').not.toBeNull();
    expect(rule![1]).toMatch(/font-size:\s*14px/);
    expect(rule![1]).toMatch(/font-family:\s*inherit/);

    const firstMedia = APP_CSS_STRIPPED.indexOf('@media');
    expect(firstMedia).toBeGreaterThan(-1);
    expect(rule!.index, 'the rule precedes the first @media').toBeLessThan(firstMedia);
  });

  it('the list-pane footer is sticky inside the min-width 900px block', () => {
    const start = APP_CSS_STRIPPED.search(/@media\s*\(min-width:\s*900px\)\s*\{/);
    expect(start).toBeGreaterThan(-1);
    const open = APP_CSS_STRIPPED.indexOf('{', start);
    let depth = 0;
    let end = open;
    for (let i = open; i < APP_CSS_STRIPPED.length; i += 1) {
      const ch = APP_CSS_STRIPPED[i];
      if (ch === '{') depth += 1;
      if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    const block = APP_CSS_STRIPPED.slice(open + 1, end);
    const rule = /\.pane-list\s+\.import-region\s*\{([^}]*)\}/.exec(block);
    expect(rule, 'a `.pane-list .import-region` rule inside the 900px block').not.toBeNull();
    expect(rule![1]).toMatch(/position:\s*sticky/);
    expect(rule![1]).toMatch(/bottom:\s*0/);
    expect(rule![1]).toMatch(/background:/);
  });
});

// =============================================================================
// The Overview type-scale exemption, and the self-tests that keep it scoped
// (13-04 Task 2, 13-UI-SPEC Typography, T-13-12)
// =============================================================================
//
// A guard that is loosened is only safe if the loosening is itself pinned.
// The Overview needs 12px captions and a 56px hero numeral, and the project's
// scale has neither; so the scale is chosen per file path, and the exemption
// applies to `src/lib/features/overview/` alone.
//
// The four assertions below are the shape of that scope, stated as tests: the
// shell keeps the old scale, the Overview gets the new one, and the Overview
// scale is an EXACT set rather than a superset — so a file that drifts back
// towards 18px or 26px inside the Overview fails here too.
// =============================================================================
describe('the Overview font-size exemption (13-UI-SPEC Typography)', () => {
  /** A synthetic stylesheet entry declaring one font size. */
  const entry = (name: string, size: string): { name: string; source: string } => ({
    name,
    source: `.x { font-size: ${size}; }`,
  });

  it('a 12px caption is legal under features/overview and illegal in the shell', () => {
    expect(fontSizeOffenders([entry('src/lib/features/overview/Tile.svelte', '12px')])).toEqual([]);
    expect(fontSizeOffenders([entry('src/lib/shell/Shell.svelte', '12px')])).toHaveLength(1);
  });

  it('a 56px hero numeral is legal under features/overview and illegal in the shell', () => {
    expect(fontSizeOffenders([entry('src/lib/features/overview/Tile.svelte', '56px')])).toEqual([]);
    expect(fontSizeOffenders([entry('src/lib/shell/Shell.svelte', '56px')])).toHaveLength(1);
  });

  it('the Overview scale is an exact set, not a superset of the project scale', () => {
    // 18px and 26px are legal everywhere else and illegal in the Overview:
    // the exemption grants the Overview its OWN four sizes, it does not grant
    // it the old ones as well.
    expect(
      fontSizeOffenders([entry('src/lib/features/overview/Tile.svelte', '18px')]),
    ).toHaveLength(1);
    expect(
      fontSizeOffenders([entry('src/lib/features/overview/Tile.svelte', '26px')]),
    ).toHaveLength(1);
    expect(fontSizeOffenders([entry('src/lib/shell/Shell.svelte', '18px')])).toEqual([]);
  });

  it('a folder that merely starts with the same letters is not the Overview', () => {
    // The prefix is matched against a repo-relative path with a trailing
    // slash, so a sibling folder cannot inherit the exemption by name.
    expect(
      fontSizeOffenders([entry('src/lib/features/overview-extra/Tile.svelte', '12px')]),
    ).toHaveLength(1);
  });
});

// =============================================================================
// Phase 8 UI re-review guards (quick 261009-0qw): the single phone block.
// =============================================================================
//
// The 08-UI-SPEC says the phone width is declared once. The re-audit found it
// declared in nine places across eight components. Every phone rule now lives in
// the one block in src/app.css, each selector namespaced under `.shell` and the
// component's own unique hook so it is strictly more specific than the scoped
// rule it replaced and never depends on the order two stylesheets land in.

/** A phone-width query, whitespace tolerant: `max-width: 480px` in any spacing. */
const PHONE_QUERY = /max-width\s*:\s*480px/g;

describe('phase 8 UI re-review guards (quick 261009-0qw)', () => {
  it('declares exactly one phone-width query under src, and it is in app.css', () => {
    expect(SOURCES.length, 'the walk visited the source tree').toBeGreaterThan(50);

    const counts = SOURCES.map(({ name, source }) => ({
      name,
      count: (source.match(PHONE_QUERY) ?? []).length,
    })).filter(({ count }) => count > 0);

    const outside = counts.filter(({ name }) => name !== path.join('src', 'app.css'));
    expect(
      outside.map(({ name, count }) => `${name} (${count})`),
      'move these rules into the app.css phone block with a namespaced selector',
    ).toEqual([]);

    const inApp = counts.find(({ name }) => name === path.join('src', 'app.css'));
    expect(inApp?.count, 'app.css holds exactly one phone-width query').toBe(1);
  });

  it('no comment still says a component repeats the phone query because a scoped rule outranks the global one', () => {
    const stale = FILES.map((file) => ({
      name: path.relative(REPO_ROOT, file),
      raw: readFileSync(file, 'utf8'),
    })).filter(({ raw }) => /scoped\s+rule\s+outranks\s+(?:the|a)\s+global/i.test(raw));
    expect(stale.map(({ name }) => name)).toEqual([]);
  });
});

// =============================================================================
// Colour literals (quick 261009-qbo): every neutral reads a declared token
// =============================================================================
//
// Amendment A-2 says greys are read only through the tokens declared in
// `:root` in `src/app.css`, and the third re-audit found them still hard-coded in
// 21 files. This guard scans EVERY .svelte, .css and .ts file under src (comments
// stripped) for colour literals: hex of 3, 4, 6 or 8 digits and the openings of
// rgb, rgba, hsl and hsla. The token declarations themselves (`--name: #hex;` in
// `src/app.css`, the `:root` tokens and the data palette) are the one place a
// literal is the point, so they are exempt by that pattern and nothing else in
// app.css is.
//
// Anything else must be in ALLOWED_COLOUR_LITERALS with a reason and the exact
// files it may appear in. A literal in a file not listed for it fails with a hint
// to read a token; an entry that matches nothing in its files fails as stale; an
// empty reason fails. The status colours are allow-listed rather than tokenised
// because the 08-UI-SPEC Color table declares the warning and destructive ROLES
// and no custom property for them (declaring `--warn-*` and `--danger-*` is a
// possible follow-up amendment).

interface AllowedColourLiteral {
  /** The literal as written, compared case-insensitively. */
  literal: string;
  /** Repo-relative files (forward slashes) where it may appear. */
  files: readonly string[];
  /** Why it is not a token. */
  reason: string;
}

const STATUS_REASON =
  'warning and destructive status chrome carried unchanged from Phase 4 and Phase 6 by the 08-UI-SPEC Color table, which declares the roles and no custom property';
const WHITE_REASON =
  'chosen for contrast on the data ramp (a white separator under the focus ring) or on the dark tooltip surface, not a page surface';

const ALLOWED_COLOUR_LITERALS: readonly AllowedColourLiteral[] = [
  {
    literal: '#c5221f',
    reason: STATUS_REASON,
    files: [
      'src/lib/features/account-timeline/AccountTimelinePane.svelte',
      'src/lib/features/device-info/DeviceInfo.svelte',
      'src/lib/features/finance/CurrencyBlock.svelte',
      'src/lib/features/finance/PremiumBlock.svelte',
      'src/lib/features/finance/SpendSummary.svelte',
      'src/lib/features/logins/CityOptIn.svelte',
      'src/lib/features/logins/LoginHistory.svelte',
      'src/lib/features/new-data/HeatPane.svelte',
      'src/lib/features/new-data/PerksPane.svelte',
      'src/lib/features/new-data/WarshipsStoragePane.svelte',
      'src/lib/features/playtime/Playtime.svelte',
      'src/lib/features/vehicles/PlayerStats.svelte',
      'src/lib/shell/ConfirmPanel.svelte',
      'src/lib/shell/FailureBanner.svelte',
    ],
  },
  {
    literal: '#fce8e6',
    reason: STATUS_REASON,
    files: [
      'src/lib/features/account-timeline/AccountTimelinePane.svelte',
      'src/lib/features/device-info/DeviceInfo.svelte',
      'src/lib/features/finance/CurrencyBlock.svelte',
      'src/lib/features/finance/PremiumBlock.svelte',
      'src/lib/features/finance/SpendSummary.svelte',
      'src/lib/features/logins/CityOptIn.svelte',
      'src/lib/features/logins/LoginHistory.svelte',
      'src/lib/features/new-data/HeatPane.svelte',
      'src/lib/features/new-data/PerksPane.svelte',
      'src/lib/features/new-data/WarshipsStoragePane.svelte',
      'src/lib/features/playtime/Playtime.svelte',
      'src/lib/features/vehicles/PlayerStats.svelte',
      'src/lib/shell/ConfirmPanel.svelte',
      'src/lib/shell/FailureBanner.svelte',
    ],
  },
  {
    literal: '#8a1c17',
    reason: STATUS_REASON,
    files: [
      'src/lib/features/account-timeline/AccountTimelinePane.svelte',
      'src/lib/features/device-info/DeviceInfo.svelte',
      'src/lib/features/finance/CurrencyBlock.svelte',
      'src/lib/features/finance/PremiumBlock.svelte',
      'src/lib/features/finance/SpendSummary.svelte',
      'src/lib/features/logins/CityOptIn.svelte',
      'src/lib/features/logins/LoginHistory.svelte',
      'src/lib/features/new-data/HeatPane.svelte',
      'src/lib/features/new-data/PerksPane.svelte',
      'src/lib/features/new-data/WarshipsStoragePane.svelte',
      'src/lib/features/playtime/Playtime.svelte',
      'src/lib/features/vehicles/PlayerStats.svelte',
      'src/lib/shell/ConfirmPanel.svelte',
      'src/lib/shell/FailureBanner.svelte',
    ],
  },
  {
    literal: '#f5d4d1',
    reason: STATUS_REASON,
    files: ['src/lib/shell/ConfirmPanel.svelte'],
  },
  {
    literal: '#f9ab00',
    reason: STATUS_REASON,
    files: [
      'src/lib/features/playtime/Playtime.svelte',
      'src/lib/shell/ConfirmPanel.svelte',
      'src/lib/shell/ExcludedNotice.svelte',
      'src/lib/shell/ImportSummary.svelte',
    ],
  },
  {
    literal: '#fef7e0',
    reason: STATUS_REASON,
    files: [
      'src/lib/features/playtime/Playtime.svelte',
      'src/lib/shell/ConfirmPanel.svelte',
      'src/lib/shell/ExcludedNotice.svelte',
      'src/lib/shell/ImportSummary.svelte',
    ],
  },
  {
    literal: '#8a5a00',
    reason: STATUS_REASON,
    files: [
      'src/lib/features/playtime/Playtime.svelte',
      'src/lib/shell/ExcludedNotice.svelte',
      'src/lib/shell/ImportSummary.svelte',
    ],
  },
  {
    literal: '#ffffff',
    reason: WHITE_REASON,
    files: [
      'src/lib/charts/ChartTooltip.svelte',
      'src/lib/charts/MonthlyBarChart.svelte',
      'src/lib/features/logins/WorldMap.svelte',
      'src/lib/features/playtime/CalendarHeatmap.svelte',
      'src/lib/features/playtime/DurationList.svelte',
      'src/lib/features/playtime/HourGrid.svelte',
    ],
  },
  {
    literal: 'rgba(',
    reason:
      'the spinner track and its reduced-motion arc: Amendment A-2 keeps blue for the spinner, and a translucent blue has no token. The Overview tile adds its three elevation shadows (13-UI-SPEC Color, Elevation): translucent ink at 5, 8 and 10 percent alpha, which has no token either',
    files: [
      'src/App.svelte',
      'src/lib/features/overview/OverviewTile.svelte',
      'src/lib/shell/ImportBar.svelte',
    ],
  },
];

// `&#x2014;` and `&#8212;` are character references, not colours, so a hex-looking
// run preceded by an ampersand or a word character is skipped.
const COLOUR_HEX = /(?<![&\w])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g;
const COLOUR_FN = /\b(?:rgba?|hsla?)\(/gi;
/** A custom-property declaration with a hex value: the token itself. */
const TOKEN_DECLARATION = /--[\w-]+\s*:\s*#[0-9a-fA-F]{3,8}\s*;/g;

/** Every colour literal in a comment-stripped source, lower-cased. */
function colourLiterals(name: string, source: string): string[] {
  const scanned =
    name === path.join('src', 'app.css') ? source.replace(TOKEN_DECLARATION, '') : source;
  return [
    ...(scanned.match(COLOUR_HEX) ?? []),
    ...(scanned.match(COLOUR_FN) ?? []).map((fn) => fn.toLowerCase()),
  ].map((literal) => literal.toLowerCase());
}

describe('phase 8 colour guard (quick 261009-qbo)', () => {
  it('walks the whole source tree, so the checks below are not vacuous', () => {
    const names = SOURCES.map(({ name }) => posix(name));
    expect(names.length).toBeGreaterThan(80);
    expect(names).toContain('src/app.css');
    expect(names).toContain('src/lib/shell/ConfirmPanel.svelte');
    expect(names).toContain('src/lib/features/logins/LoginTable.svelte');
  });

  it('no colour literal exists under src outside the app.css tokens and the allow-list', () => {
    const offenders: string[] = [];
    for (const { name, source } of SOURCES) {
      for (const literal of new Set(colourLiterals(name, source))) {
        const allowed = ALLOWED_COLOUR_LITERALS.find(
          (entry) => entry.literal === literal && entry.files.includes(posix(name)),
        );
        if (allowed === undefined) offenders.push(`${posix(name)}: ${literal}`);
      }
    }
    expect(
      offenders,
      'read a declared token from src/app.css (var(--page), --border, ...)',
    ).toEqual([]);
  });

  it('every allow-list entry matches something in each of its files (no stale entry)', () => {
    const byName = new Map(SOURCES.map(({ name, source }) => [posix(name), source]));
    const stale: string[] = [];
    for (const entry of ALLOWED_COLOUR_LITERALS) {
      expect(entry.files.length, `${entry.literal} lists files`).toBeGreaterThan(0);
      for (const file of entry.files) {
        const source = byName.get(file);
        if (source === undefined) {
          stale.push(`${file}: no such file (${entry.literal})`);
        } else if (!colourLiterals(path.normalize(file), source).includes(entry.literal)) {
          stale.push(`${file}: ${entry.literal} no longer appears`);
        }
      }
    }
    expect(stale, 'remove the stale allow-list entry or file').toEqual([]);
  });

  it('every allow-list entry carries a reason', () => {
    for (const entry of ALLOWED_COLOUR_LITERALS) {
      expect(entry.reason.trim().length, `${entry.literal} has a reason`).toBeGreaterThan(20);
    }
  });
});
