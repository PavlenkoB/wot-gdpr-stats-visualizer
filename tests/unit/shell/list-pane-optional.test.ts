// =============================================================================
// list-pane-optional.test.ts — the list walks what is RENDERED (11-05)
// =============================================================================
//
// WHAT THIS IS. A source-shape guard, not a render test, for the same reason
// `game-filter-scope.test.ts` is one: `vitest.config.ts` runs in Node with no
// Svelte plugin, so a component cannot be rendered in a unit test at all in
// this repository. The guarantee is a WIRING decision — which ids the keyboard
// steps over and which ids a row click resolves to — and a wiring decision
// belongs in the file that makes it.
//
// WHY IT MATTERS. `PANE_IDS` is still the nine always-present panes (11-05
// widened the vocabulary rather than the tuple), and two of those nine are
// OPTIONAL: a row exists only when the worker reported that pane. A `j`/`k` step
// computed over `PANE_IDS` would land the selection on a row that is not on
// screen, and `paneOf` resolving ids out of `PANE_IDS` would read a row button
// as "not a pane" for exactly the two ids that are new. Both are the same
// mistake — reading the vocabulary instead of the rendered list.
// =============================================================================

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { OPTIONAL_PANE_IDS, PANE_ORDER } from '../../../src/lib/shell/selection-state.ts';

const LIST_PANE_PATH = fileURLToPath(
  new URL('../../../src/lib/shell/ListPane.svelte', import.meta.url),
);

const source = readFileSync(LIST_PANE_PATH, 'utf8');

/** `stepSelection(` call sites, with their argument lists. */
function stepSelectionCalls(): string[] {
  const calls: string[] = [];
  const pattern = /stepSelection\(([\s\S]*?)\)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) calls.push(match[1]!);
  return calls;
}

describe('ListPane: the keyboard steps over the rows that are rendered', () => {
  test('stepSelection is called with the rendered order as a third argument', () => {
    const calls = stepSelectionCalls();
    expect(calls.length).toBeGreaterThan(0);
    for (const args of calls) {
      // Three arguments, and the third is the id list the component derived
      // from its own `entries` — the rows it is actually showing.
      expect(args.split(',').length, `stepSelection(${args})`).toBe(3);
      expect(args, 'the order comes from the rendered entries').toContain('entries');
    }
  });

  test('a row click resolves its pane over PANE_ORDER, not the nine-pane tuple', () => {
    const paneOf = source.slice(source.indexOf('function paneOf'));
    expect(paneOf).toContain('PANE_ORDER');
    expect(paneOf).not.toContain('PANE_IDS');
  });

  test('the list does not hard-code a row id list of its own', () => {
    // The rows are an `{#each}` over the model's entries, so a new pane needs no
    // markup edit; a hard-coded id array here would be the second vocabulary.
    for (const id of [...PANE_ORDER]) {
      const hardCoded = source.match(new RegExp(`list-row-['"]?${id}['"]?`));
      expect(hardCoded, `${id} is not named in the markup`).toBeNull();
    }
  });

  test('both optional ids are renderable: they exist in the model vocabulary', () => {
    // The guard is about the component, so this is the fixture side of it: an
    // id that is not in the pane model could never be a row button.
    expect([...OPTIONAL_PANE_IDS]).toEqual(['heat', 'warships-storage']);
    for (const id of OPTIONAL_PANE_IDS) expect(PANE_ORDER).toContain(id);
  });
});
