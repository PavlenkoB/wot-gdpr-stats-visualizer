import { maskStateFor } from '../features/logins/login-state.ts';

// =============================================================================
// The ONE reveal, read through a stamped cell (11-06, D-04, D-07)
// =============================================================================
//
// ## What this module is
//
// One pure function over one stamped cell: the flag that says whether the IP
// addresses in THIS dataset are shown in full. It has no runes, no DOM, no
// storage, no URL and no history — and that is a RULE, not an accident: the
// reset is a pure READ, because setting state from a `$derived` throws
// `state_unsafe_mutation`. `resolveGameFilter` and `resolveSelection` are pure
// reads for the same reason, and the cell beside them in `Dashboard.svelte` is
// the shape.
//
// ## Why the reveal was LIFTED out of Login history
//
// It was a `$state` inside `LoginHistory.svelte`, which meant the choice died
// with the pane (11-RESEARCH Pattern 9). The HEAT pane of plan 11-09 shows
// addresses too, and D-04 asks for ONE global reveal rather than one per pane:
// two booleans are two states that can disagree, and the reader would have to
// press the toggle twice to learn the same fact twice. So the cell lives in the
// shell and both panes read it as a prop.
//
// The stamp is what makes lifting safe. Before the lift the block reset the
// flag from its own `importedAt`; after it, the reset is a comparison the shell
// makes from the same `result.importedAt` that drives everything else, so a
// first import, a replace and a clear all re-mask BY CONSTRUCTION — there is no
// path that forgets to (T-11-18).
//
// ## Why it delegates rather than re-decides
//
// `maskStateFor` is Phase 6's D-07 rule and it is still the rule; this module
// only changes WHO holds the value, never what it means. Calling it rather than
// re-implementing the comparison is what makes it impossible for the shell's
// lifecycle and the block's tests to drift apart.
//
// ## Why nothing here is persisted
//
// Masked on every load is a privacy decision (D-07, T-06-29): a revealed mask
// that survived a reload would disclose addresses of a dataset the reader
// chose to look at, once, in one pane. The cell is component state and nothing
// else, and `tests/unit/shell/reveal-state.test.ts` scans this file and the whole
// shell directory to keep it that way.
// =============================================================================

/** The user's reveal choice, stamped with the dataset it was made under. */
export interface RevealChoice {
  /** True when the reader asked to see full addresses. */
  revealed: boolean;
  /** `ClassifyResult.importedAt` of the dataset on screen when it was set. */
  stamp: string | null;
}

/**
 * Whether the dataset on screen has its addresses revealed, or is masked.
 *
 * D-04 with D-07 underneath it, and the two rules are the same one comparison:
 * a choice whose stamp is not the current dataset's is DISCARDED. A first
 * import, a replace and a Clear each change `result.importedAt`, so the mask
 * returns for all three; the SAME dataset keeps the reader's own choice across a
 * re-query, a re-render and a PANE SWITCH, which is the half of D-04 that
 * Login history's local rune could not offer.
 *
 * `importedAt === null` is masked for the same reason `resolveGameFilter`
 * answers All there: with nothing on screen there is no dataset whose addresses
 * could be revealed.
 */
export function resolveReveal(choice: RevealChoice, importedAt: string | null): boolean {
  return maskStateFor({ importedAt: choice.stamp, revealed: choice.revealed }, importedAt);
}
