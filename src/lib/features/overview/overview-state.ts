import { acceptDataOutcome, type ShownBlock } from '../finance/finance-state.ts';
import type { OverviewView } from './overview-shared.ts';

// =============================================================================
// overview-state.ts — what the Overview renders, decided in one pure place
// =============================================================================
//
// ## Why this module exists
//
// The Overview asks ONE channel and has THREE renderable states. The state is
// a function of two things — the dataset on screen and the last applied
// answer — and both of them can change independently: a replace lands while
// the answer is in flight, or the worker fails after the dataset was already
// on screen. Deciding the state in one pure function means the page cannot
// disagree with itself about which of the three it is showing.
//
// ## The order of the tests IS the order of the questions
//
//   1. Is there a dataset, and is what we are showing an answer for THAT
//      dataset? A replace that lands mid-query therefore returns the page to
//      `loading` BY CONSTRUCTION rather than through a hand-written reset.
//   2. Did the answer fail? `error`.
//   3. Otherwise `ready`.
//
// ## Why the state has no 'no sessions' case
//
// An export with no session history is not a failure and not a loading state:
// the answer arrives, and the Logged in tile inside it is ABSENT. The page
// draws the skeleton tiles and the absent row from that answer, which is a
// statement about the export rather than about the app.
export { acceptDataOutcome };

/** The applied answer and the dataset it answers for, in ONE cell. */
export type OverviewShown = ShownBlock<OverviewView>;

/** The three states the Overview renders. */
export type OverviewScreen = 'loading' | 'error' | 'ready';

/** Everything the state derivation reads, and nothing it has to compute. */
export interface OverviewScreenInput {
  /** The dataset on screen now, or null when none is. */
  importedAt: string | null;
  /** The last applied answer, or null when there is none. */
  shown: OverviewShown | null;
}

/**
 * The one state the Overview renders.
 *
 * A pure function with no runes and no DOM, so the three states can be tested
 * in Node (Vitest runs with no Svelte plugin) and the page has no second
 * place to derive them.
 */
export function deriveOverviewScreen({ importedAt, shown }: OverviewScreenInput): OverviewScreen {
  if (importedAt === null) return 'loading';
  if (shown === null || shown.importedAt !== importedAt) return 'loading';
  if (shown.kind === 'failed') return 'error';
  return 'ready';
}
