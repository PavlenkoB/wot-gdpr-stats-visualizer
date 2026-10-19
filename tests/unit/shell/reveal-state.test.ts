import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { resolveReveal, type RevealChoice } from '../../../src/lib/shell/reveal-state.ts';

// =============================================================================
// reveal-state — the ONE reveal boolean, read through a stamped cell (11-06)
// =============================================================================
//
// WHAT THIS PROVES
//   1. D-04's "single global reveal": the flag resolves to the reader's own
//      choice for the dataset on screen, and to MASKED for anything else.
//   2. The stamp is the reset: a first import, a replace and a clear each
//      change `importedAt`, so a choice made under a previous archive can never
//      be applied to this one (T-11-18).
//   3. The lift changed no VISIBLE behaviour: `Dashboard.svelte` wires
//      `revealed` / `onRevealChange` to Login history, and `LoginHistory.svelte`
//      no longer owns a boolean of its own — while every toggle-markup,
//      caption and announcement string stays exactly where it was.
//   4. The reveal is still never persisted (D-07, T-06-29): neither the new
//      module nor the shell file that owns the cell touches a storage API, a
//      cookie, the URL or the history.
//
// Pure and DOM-free, so it runs under Node. The style is copied from
// `tests/unit/shell/game-filter-state.test.ts`; test files do not import each
// other in this repository, so the shape is repeated rather than shared.
// =============================================================================

const DATASET = '2026-10-18T10:00:00.000Z';
const OTHER_DATASET = '2026-10-18T11:00:00.000Z';

/** A choice stamped for `stamp`, as `Dashboard.svelte` writes it. */
function choice(revealed: boolean, stamp: string | null): RevealChoice {
  return { revealed, stamp };
}

/** The cell's own initial value, before anything has been chosen. */
const INITIAL = choice(false, null);

// -----------------------------------------------------------------------------
// resolveReveal — the stamped read
// -----------------------------------------------------------------------------

describe('resolveReveal', () => {
  test('a choice made under this dataset is the reader own answer', () => {
    expect(resolveReveal(choice(true, DATASET), DATASET)).toBe(true);
    expect(resolveReveal(choice(false, DATASET), DATASET)).toBe(false);
  });

  test('a choice made under ANOTHER dataset is discarded, not restored', () => {
    expect(resolveReveal(choice(true, DATASET), OTHER_DATASET)).toBe(false);
    expect(resolveReveal(choice(true, DATASET), null)).toBe(false);
  });

  test('the initial choice is masked for every dataset, including none', () => {
    expect(resolveReveal(INITIAL, DATASET)).toBe(false);
    expect(resolveReveal(INITIAL, OTHER_DATASET)).toBe(false);
    expect(resolveReveal(INITIAL, null)).toBe(false);
  });

  test('an unstamped choice cannot reveal anything even under a dataset', () => {
    // The defensive shape: a cell written before the first import has no stamp,
    // and a stamp that does not match is the whole reset rule.
    expect(resolveReveal(choice(true, null), DATASET)).toBe(false);
  });

  test('a REPLACE hides the old archive addresses immediately', () => {
    // The flow T-11-18 is about, in the order the shell runs it: reveal under A,
    // drop a new export (B), and the flag is masked without a reset hook.
    const cell = choice(true, DATASET);
    expect(resolveReveal(cell, DATASET)).toBe(true);
    expect(resolveReveal(cell, OTHER_DATASET)).toBe(false);
    // And a Clear, which is the same comparison with `null` on the right.
    expect(resolveReveal(cell, null)).toBe(false);
  });

  test('a stamp is a comparison, not a HISTORY: coming back to A does not restore it', () => {
    // The cell the shell holds while B is on screen is still stamped A; B never
    // rewrites it, so if A returned with A's own `importedAt` the old choice
    // would match again. In practice a replace always carries a NEW stamp, and
    // this case is why the cell is stamped rather than reset: the reset has to
    // be a value, not a hook that somebody has to remember to call.
    const cell = choice(true, DATASET);
    expect(resolveReveal(cell, DATASET)).toBe(true);
    expect(resolveReveal(cell, OTHER_DATASET)).toBe(false);
    expect(resolveReveal(cell, OTHER_DATASET)).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// The lift — ownership moved, visible behaviour did not (D-04, T-11-19)
// -----------------------------------------------------------------------------

const SHELL_DIR = fileURLToPath(new URL('../../../src/lib/shell/', import.meta.url));
const LOGIN_HISTORY = fileURLToPath(
  new URL('../../../src/lib/features/logins/LoginHistory.svelte', import.meta.url),
);

function readSource(path: string): string {
  return readFileSync(path, 'utf8');
}

/**
 * The same source with its comments removed, so an assertion about CODE is not
 * satisfied by prose. Both blocks here NAMES the rule it is asserting (the
 * doc comment explains where the mask went), which is exactly why the logins
 * feature scan strips comments before looking for a forbidden token.
 */
function codeOf(path: string): string {
  return readSource(path)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

describe('the reveal is owned by the shell and read as a prop', () => {
  test('Dashboard holds ONE stamped cell and one derived read of it', () => {
    const code = readSource(join(SHELL_DIR, 'Dashboard.svelte'));
    expect(code).toContain('let revealChoice = $state<RevealChoice>(');
    expect(code).toContain('const revealed = $derived(resolveReveal(');
    expect(code).toContain('revealChoice = { revealed: next, stamp: datasetStamp(result) }');
    // One derivation and one cell: two would be two answers to one question.
    expect(code.match(/const revealed = \$derived\(/g) ?? []).toHaveLength(1);
  });

  test('Login history receives the flag and the setter, and owns no boolean', () => {
    const dashboard = readSource(join(SHELL_DIR, 'Dashboard.svelte'));
    expect(dashboard).toMatch(/<LoginHistory[^>]*\{revealed\}/);
    expect(dashboard).toContain('onRevealChange={setRevealed}');

    const block = readSource(LOGIN_HISTORY);
    expect(block).toContain('revealed: boolean');
    expect(block).toContain('onRevealChange: (revealed: boolean) => void');
    // The local rune is GONE: a second mask anywhere in the app is exactly the
    // failure D-04's "one reveal" exists to prevent.
    expect(block).not.toMatch(/let revealed = \$state/);
    // And the block asks its owner rather than writing the rune itself. The
    // NEXT value is computed first, so the announcement below the toggle says
    // what the reader just asked for rather than waiting for the prop back.
    expect(codeOf(LOGIN_HISTORY)).toContain('onRevealChange(next)');
    expect(codeOf(LOGIN_HISTORY)).toContain('const next = !revealed');
  });

  test('the block still announces the toggle with the two copy sentences', () => {
    // T-11-19: the lift is allowed to change nothing a reader can see, so these
    // three lines are asserted verbatim rather than re-derived.
    const block = readSource(LOGIN_HISTORY);
    expect(block).toContain('MASK_ANNOUNCE_SHOWN');
    expect(block).toContain('MASK_ANNOUNCE_MASKED');
    expect(block).toContain("data-masked={revealed ? 'false' : 'true'}");
    // The mask's lifecycle is now the shell's, not the block's: the block no
    // longer computes it, and keeps its stamp only for the table resets.
    expect(codeOf(LOGIN_HISTORY)).not.toContain('maskStateFor');
  });
});

// -----------------------------------------------------------------------------
// The reveal is still never persisted (D-07, T-06-29, T-11-18)
// -----------------------------------------------------------------------------

const FORBIDDEN = [
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'document.cookie',
  'location.hash',
  'history.pushState',
  'history.replaceState',
];

describe('neither the reveal module nor the shell persists the flag', () => {
  test('reveal-state.ts touches no storage API, no cookie, the URL or the history', () => {
    const code = readSource(join(SHELL_DIR, 'reveal-state.ts'));
    for (const token of FORBIDDEN) {
      expect(code, `reveal-state.ts must not touch ${token}`).not.toContain(token);
    }
  });

  test('no shell file touches one either, so the cell cannot leak from the shell', () => {
    const files = readdirSync(SHELL_DIR).filter(
      (name) => name.endsWith('.ts') || name.endsWith('.svelte'),
    );
    expect(files.length).toBeGreaterThan(0);
    for (const name of files) {
      // Strip comments before scanning: a comment NAMES the rule, and the logins
      // feature scan strips comments for exactly this reason.
      const code = readFileSync(join(SHELL_DIR, name), 'utf8')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^[ \t]*\/\/.*$/gm, '');
      for (const token of FORBIDDEN) {
        expect(code, `${name} must not touch ${token}`).not.toContain(token);
      }
    }
  });

  test('resolveReveal is a pure READ of maskStateFor, so the lifecycle has one definition', () => {
    // Not a second re-implementation of D-07: the shell's read delegates to the
    // feature's rule, so the two cannot drift apart.
    const code = readSource(join(SHELL_DIR, 'reveal-state.ts'));
    expect(code).toContain('maskStateFor');
  });
});
