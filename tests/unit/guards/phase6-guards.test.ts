import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listComponentFiles } from '../../helpers/components.ts';

// =============================================================================
// Phase 6 standing guards (plan 06-14).
// =============================================================================
//
// TWO PROPERTIES THAT ARE TRUE TODAY AND THAT NOTHING ELSE KEEPS TRUE
//
//   1. NO REAL ADDRESS IS COMMITTED (D-17, T-06-55). Fixtures, tests and sources
//      become public the moment they are pushed, and this phase is the first one
//      whose subject is IP addresses. Every fixture draws from the three RFC 5737
//      documentation blocks (and RFC 3849 for IPv6), by construction; this scan is
//      what makes a future edit that pastes a real address fail in Node, in the
//      same change, rather than in review.
//
//   2. THE LOGINS FEATURE HAS NO MOTION AND NO INLINE STYLE (UI-SPEC section 8,
//      the reduced-motion row). A transition or animation anywhere in it would need
//      a `prefers-reduced-motion` answer the spec says it does not have, and an
//      inline `style` attribute is what the CSP's `style-src` and the Phase 5
//      layout guards are written to keep out of components.
//
// BOTH ARE SELF-TESTED. A scan that quietly stopped matching would be a green
// suite that proves nothing, so each scan runs against content written to a
// temporary directory that contains exactly the thing it exists to catch.
// =============================================================================

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../../..');

// -----------------------------------------------------------------------------
// 1. The address-literal scan
// -----------------------------------------------------------------------------

/** The folders scanned, relative to the repository root. */
const SCANNED_DIRS = ['src', 'scripts', 'tests'] as const;

/** Text files only: the four languages the repository writes and its data files. */
const SCANNED_EXTENSIONS = new Set(['.ts', '.svelte', '.csv', '.json', '.mjs']);

/**
 * This file, which holds the allowlist's literals and so cannot be held to the
 * allowlist it carries. It is excluded from the scan and held to a stricter
 * rule by its own test below: every literal it contains must be permitted or
 * allowlisted, and its negative examples are built from parts so that no public
 * address appears in it at all.
 */
const SELF = 'tests/unit/guards/phase6-guards.test.ts';

/** Folders never entered: dependencies, and the gitignored home of a real export. */
const SKIPPED_DIRS = new Set(['node_modules', 'private']);

/** One dotted quad: not part of a longer number, a word or a dotted run. */
const DOTTED_QUAD = /(?<![\w.])(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?![\w])(?!\.\d)/g;

/** A literal found in a file, and why a reader should care. */
interface Finding {
  /** Repository-relative, with forward slashes. */
  file: string;
  /** The text of the address. */
  literal: string;
}

/**
 * A literal that is not an address anyone owns, written down with the reason.
 *
 * EVERY ENTRY NEEDS A REASON, and the reason has to be one of three kinds: an
 * arithmetic boundary value chosen for a comparison, a well-known public
 * resolver used to assert the shipped table's behaviour, or the first address of
 * the table's own first range. None of them is a person's address. The list is
 * keyed on file AND literal, so allowing `8.8.8.8` in one test does not allow it
 * anywhere else, and an entry whose literal has left its file fails the
 * "stale allowlist" test below rather than lingering.
 */
const ALLOWLIST: readonly { file: string; literal: string; reason: string }[] = [
  // The sort-order cases: a numeric sort must put 9.x before 10.x, which a text
  // sort does not. `9.0.0.0` is chosen only because it is the neighbour of `10`.
  {
    file: 'src/lib/features/logins/login-aggregate.ts',
    literal: '9.0.0.0',
    reason: 'comment: the numeric-versus-text sort example, a neighbour of 10.0.0.0',
  },
  {
    file: 'src/lib/geo/ip.ts',
    literal: '9.0.0.0',
    reason: 'comment: the numeric-versus-text sort example, a neighbour of 10.0.0.0',
  },
  {
    file: 'tests/unit/geo/ip.test.ts',
    literal: '9.0.0.0',
    reason: 'the numeric-versus-text sort case, a neighbour of 10.0.0.0',
  },
  // The parser's boundary cases: groups of 255, 249 and 199 exercise the
  // three-digit branches of the octet reader.
  {
    file: 'tests/unit/geo/ip.test.ts',
    literal: '1.2.3.255',
    reason: 'the 255 boundary of the octet reader',
  },
  {
    file: 'tests/unit/geo/ip.test.ts',
    literal: '249.249.249.249',
    reason: 'the 249 boundary of the octet reader',
  },
  {
    file: 'tests/unit/geo/ip.test.ts',
    literal: '199.199.199.199',
    reason: 'the 199 boundary of the octet reader',
  },
  // The range table's boundary cases: the neighbours of the 192.0.2.0/24 block
  // and the ends of the 32-bit space.
  {
    file: 'tests/unit/geo/range-table.test.ts',
    literal: '191.255.255.255',
    reason: 'the address just below the 192.0.2.0 block, in a synthetic range table',
  },
  {
    file: 'tests/unit/geo/range-table.test.ts',
    literal: '198.51.101.0',
    reason: 'the address just above the 198.51.100.0/24 documentation block',
  },
  {
    file: 'tests/unit/geo/range-table.test.ts',
    literal: '192.0.3.0',
    reason: 'the address just above the 192.0.2.0/24 documentation block',
  },
  // The CSV reader's cases: the first range of the DB-IP file, written as the
  // text a line of that file would carry. It is a range boundary, not a host.
  {
    file: 'tests/unit/geo/range-table.test.ts',
    literal: '1.0.0.0',
    reason: 'the start of the first DB-IP range, as the text a CSV line carries',
  },
  {
    file: 'tests/unit/geo/range-table.test.ts',
    literal: '1.0.0.255',
    reason: 'the end of a /24 range, as the text a CSV line carries',
  },
  // The shipped table's own assertions: the production table must answer `ZZ`
  // for reserved space and for the ends of the address space, and a lookup of a
  // well-known public resolver must not throw.
  {
    file: 'tests/unit/geo/country-table-shipped.test.ts',
    literal: '1.0.0.0',
    reason: 'the first real range of the shipped table',
  },
  {
    file: 'tests/unit/geo/country-table-shipped.test.ts',
    literal: '8.8.8.8',
    reason: 'a well-known public resolver, looked up in the shipped table, not a person',
  },
  {
    file: 'tests/unit/geo/country-table-shipped.test.ts',
    literal: '224.0.0.0',
    reason: 'the start of multicast space, the last range start of the shipped table',
  },
  {
    file: 'tests/unit/geo/country-lookup.test.ts',
    literal: '9.9.9.9',
    reason: 'a well-known public resolver that a fixture table must NOT resolve',
  },
];

/** True for an address in a documentation, loopback, private or reserved block. */
function isPermitted(octets: readonly number[]): boolean {
  const [a, b, c, d] = octets as [number, number, number, number];
  if (a === 192 && b === 0 && c === 2) return true; // RFC 5737 TEST-NET-1
  if (a === 198 && b === 51 && c === 100) return true; // RFC 5737 TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true; // RFC 5737 TEST-NET-3
  if (a === 127) return true; // loopback
  if (a === 10) return true; // private
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 169 && b === 254) return true; // link-local
  if (a === 0 && b === 0 && c === 0 && d === 0) return true; // unspecified
  if (a === 255 && b === 255 && c === 255 && d === 255) return true; // broadcast
  return false;
}

/** Every file under one root that the scan reads, as absolute paths. */
function scannedFiles(root: string): string[] {
  const out: string[] = [];
  const visit = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRS.has(entry.name)) visit(path.join(dir, entry.name));
      } else if (SCANNED_EXTENSIONS.has(path.extname(entry.name))) {
        out.push(path.join(dir, entry.name));
      }
    }
  };
  for (const top of SCANNED_DIRS) {
    try {
      visit(path.join(root, top));
    } catch (error) {
      // A root with no `scripts` folder (the self-test's) simply has nothing there.
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  return out;
}

/** Every dotted quad that is not a permitted address, in a tree rooted at `root`. */
function addressFindings(root: string): Finding[] {
  const findings: Finding[] = [];
  for (const file of scannedFiles(root)) {
    const relative = path.relative(root, file).split(path.sep).join('/');
    if (relative === SELF) continue;
    const text = readFileSync(file, 'utf8');
    const seen = new Set<string>();
    for (const match of text.matchAll(DOTTED_QUAD)) {
      const octets = [match[1], match[2], match[3], match[4]].map(Number);
      // Not an address at all: `192.0.2.256` is the parser's own refusal case.
      if (octets.some((n) => n > 255)) continue;
      if (isPermitted(octets) || seen.has(match[0])) continue;
      seen.add(match[0]);
      findings.push({ file: relative, literal: match[0] });
    }
  }
  return findings;
}

/** A finding the allowlist excuses. */
function isAllowed(finding: Finding): boolean {
  return ALLOWLIST.some((e) => e.file === finding.file && e.literal === finding.literal);
}

// -----------------------------------------------------------------------------
// 2. The motion and inline-style scan
// -----------------------------------------------------------------------------

/** Strip HTML, block and line comments from Svelte/CSS source. */
function stripComments(source: string): string {
  return source
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*/gm, '');
}

/**
 * What the logins feature may not declare, as a pattern over comment-free text.
 *
 * The patterns match SYNTAX, not words: `transition:` (and every `transition-*`
 * longhand), `animation:` (and the longhands), `@keyframes`, a `style="..."`
 * attribute and a `style:prop` directive. Prose about motion lives in comments,
 * which are stripped first, so a component can say why it has none.
 */
const FORBIDDEN: readonly { label: string; pattern: RegExp }[] = [
  { label: 'a transition declaration', pattern: /(?:^|[\s;{])transition(?:-[a-z-]+)?\s*:/ },
  { label: 'an animation declaration', pattern: /(?:^|[\s;{])animation(?:-[a-z-]+)?\s*:/ },
  { label: 'a @keyframes rule', pattern: /@keyframes\b/ },
  { label: 'an inline style attribute', pattern: /\sstyle\s*=/ },
  { label: 'a style: directive', pattern: /\sstyle:[\w-]+/ },
];

/** The reasons a source is not allowed in the logins feature; empty when clean. */
function motionFindings(source: string): string[] {
  const text = stripComments(source);
  return FORBIDDEN.filter(({ pattern }) => pattern.test(text)).map(({ label }) => label);
}

/** The logins feature's own components, as absolute paths. */
function loginComponentPaths(): string[] {
  const dir = path.join(REPO_ROOT, 'src/lib/features/logins');
  return readdirSync(dir)
    .filter((name) => name.endsWith('.svelte'))
    .sort()
    .map((name) => path.join(dir, name));
}

// -----------------------------------------------------------------------------
// The tests
// -----------------------------------------------------------------------------

const temporaryRoots: string[] = [];

/**
 * An address built from its parts, so a NEGATIVE example is never written as a
 * dotted quad in this file. The scan skips this file by name, and the test that
 * reads this file's own literals would otherwise have to excuse every example.
 */
function quad(a: number, b: number, c: number, d: number): string {
  return [a, b, c, d].join('.');
}

/** A scratch repository containing exactly the given files. */
function scratchRoot(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), 'phase6-guards-'));
  temporaryRoots.push(root);
  for (const [name, content] of Object.entries(files)) {
    const target = path.join(root, name);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
  return root;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('phase 6 guards (06-14): no real address is committed (D-17, T-06-55)', () => {
  it('finds no address outside the documentation, loopback, private and reserved blocks, bar the explicit allowlist', () => {
    const unexplained = addressFindings(REPO_ROOT).filter((finding) => !isAllowed(finding));

    expect(
      unexplained,
      `an address literal that is not in a documentation, loopback, private, link-local or ` +
        `unspecified range is committed. If it is a real address, remove it (D-17). If it is ` +
        `an arithmetic boundary or a public resolver, add it to ALLOWLIST with a reason:\n` +
        unexplained.map((f) => `  ${f.file}: ${f.literal}`).join('\n'),
    ).toEqual([]);
  });

  it('keeps the allowlist honest: every entry has a reason and still names a literal that is in its file', () => {
    const present = new Set(addressFindings(REPO_ROOT).map((f) => `${f.file}\u0000${f.literal}`));
    for (const entry of ALLOWLIST) {
      expect(
        entry.reason.trim().length,
        `${entry.file} ${entry.literal} has no reason`,
      ).toBeGreaterThan(10);
      expect(
        present.has(`${entry.file}\u0000${entry.literal}`),
        `${entry.file} no longer contains ${entry.literal}: remove the stale allowlist entry`,
      ).toBe(true);
    }
  });

  it('flags a public address in a temporary file, in each scanned folder and file type', () => {
    const [a, b, c, d, e] = [
      quad(93, 184, 216, 34),
      quad(151, 101, 1, 69),
      quad(8, 8, 4, 4),
      quad(1, 1, 1, 1),
      quad(104, 18, 2, 3),
    ] as [string, string, string, string, string];
    const root = scratchRoot({
      'src/a.ts': `const host = '${a}';\n`,
      'scripts/b.mjs': `export const x = '${b}';\n`,
      'tests/c.csv': `start,end,CC\n${c},${c},US\n`,
      'tests/d.json': `{"ip":"${d}"}\n`,
      'src/e.svelte': `<p>${e}</p>\n`,
    });

    const found = addressFindings(root).map((f) => `${f.file} ${f.literal}`);

    expect(found.sort()).toEqual(
      [
        `scripts/b.mjs ${b}`,
        `src/a.ts ${a}`,
        `src/e.svelte ${e}`,
        `tests/c.csv ${c}`,
        `tests/d.json ${d}`,
      ].sort(),
    );
    // None of them is excused by the allowlist, which is keyed on file AND literal.
    expect(addressFindings(root).every((f) => !isAllowed(f))).toBe(true);
  });

  it('passes the permitted ranges, refuses nothing that is not an address, and ignores binary and lock files', () => {
    const root = scratchRoot({
      'src/ok.ts': [
        "'192.0.2.1' '198.51.100.255' '203.0.113.0'",
        "'127.0.0.1' '10.1.2.3' '172.16.0.1' '172.31.255.255' '192.168.1.1'",
        "'169.254.0.1' '0.0.0.0' '255.255.255.255'",
        // Not addresses: an octet over 255, a version of four parts after a word,
        // a longer dotted run and an arbitrary number with a fifth group.
        "'192.0.2.256' 'v1.2.3.4' '1.2.3.4.5' '1.2.3.4a'",
        '',
      ].join('\n'),
      // Wrong extension and a lock file: skipped by construction.
      'tests/pic.png': quad(93, 184, 216, 34),
      'tests/pnpm-lock.yaml': quad(93, 184, 216, 34),
    });

    expect(addressFindings(root)).toEqual([]);
  });

  it('flags the first address outside each permitted block, so the blocks are not wider than stated', () => {
    const outside = [
      quad(192, 0, 3, 1), // next to TEST-NET-1
      quad(198, 51, 101, 1), // next to TEST-NET-2
      quad(203, 0, 114, 1), // next to TEST-NET-3
      quad(172, 15, 0, 1), // just below 172.16/12
      quad(172, 32, 0, 1), // just above 172.16/12
      quad(192, 169, 0, 1), // next to 192.168/16
      quad(169, 253, 0, 1), // next to link-local
      quad(0, 0, 0, 1), // only the exact unspecified address is permitted
      quad(255, 255, 255, 254), // only the exact broadcast address is permitted
    ];
    const root = scratchRoot({ 'src/x.ts': outside.map((a) => `'${a}'`).join('\n') });

    expect(
      addressFindings(root)
        .map((f) => f.literal)
        .sort(),
    ).toEqual([...outside].sort());
  });

  it('holds this file to a stricter rule than the scan: every dotted quad in it is permitted or allowlisted', () => {
    const own = readFileSync(__filename, 'utf8');
    const stray: string[] = [];
    for (const match of own.matchAll(DOTTED_QUAD)) {
      const octets = [match[1], match[2], match[3], match[4]].map(Number);
      if (octets.some((n) => n > 255) || isPermitted(octets)) continue;
      if (!ALLOWLIST.some((entry) => entry.literal === match[0])) stray.push(match[0]);
    }

    expect(
      stray,
      `this guard file contains an address that is not permitted: ${stray.join(', ')}`,
    ).toEqual([]);
  });
});

describe('phase 6 guards (06-14): the logins feature has no motion and no inline style (UI-SPEC 8)', () => {
  it('declares no transition, animation, keyframes, style attribute or style directive in any logins component', () => {
    const components = loginComponentPaths();
    expect(components.length, 'the logins feature has components').toBeGreaterThanOrEqual(7);

    for (const file of components) {
      const reasons = motionFindings(readFileSync(file, 'utf8'));
      expect(reasons, `${path.relative(REPO_ROOT, file)} declares ${reasons.join(', ')}`).toEqual(
        [],
      );
    }
  });

  it('flags each forbidden construct in temporary content, and passes prose about motion in a comment', () => {
    const offenders: [description: string, source: string, label: string][] = [
      [
        'a transition declaration',
        '<style>\n  .a { transition: opacity 0.2s; }\n</style>\n',
        'a transition declaration',
      ],
      [
        'a transition longhand',
        '<style>\n  .a { transition-duration: 1s; }\n</style>\n',
        'a transition declaration',
      ],
      [
        'an animation declaration',
        '<style>\n  .a { animation: spin 1s infinite; }\n</style>\n',
        'an animation declaration',
      ],
      [
        'an animation longhand',
        '<style>\n  .a { animation-name: spin; }\n</style>\n',
        'an animation declaration',
      ],
      [
        'a @keyframes rule',
        '<style>\n  @keyframes spin { to { opacity: 0; } }\n</style>\n',
        'a @keyframes rule',
      ],
      [
        'an inline style attribute',
        '<div style="width: 10px">x</div>\n',
        'an inline style attribute',
      ],
      ['a style: directive', '<div style:width={px}>x</div>\n', 'a style: directive'],
    ];
    for (const [description, source, label] of offenders) {
      expect(motionFindings(source), description).toContain(label);
    }

    const clean = [
      '<!-- No animation or transition is declared: style="x" is not used. -->',
      '<style>',
      '  /* transition: none; and animation: none; are what a comment may say */',
      '  .a { color: red; }',
      '</style>',
      '',
    ].join('\n');
    expect(motionFindings(clean)).toEqual([]);
  });

  it('is measured by the same layout guards as every other component: the font floor now covers the logins components', () => {
    const listed = new Set(listComponentFiles());

    for (const name of [
      'CityList.svelte',
      'CityOptIn.svelte',
      'CountryList.svelte',
      'LoginHistory.svelte',
      'LoginMapSection.svelte',
      'LoginSummary.svelte',
      'LoginTable.svelte',
      'WorldMap.svelte',
    ]) {
      expect(
        listed.has(name),
        `${name} is not in listComponentFiles(), so the 14px floor skips it`,
      ).toBe(true);
    }
  });
});
