import type { LoginsView } from './login-shared.ts';
import type { DataOutcome } from '../../core/query-client.ts';

// =============================================================================
// The Login history block's decisions, as pure functions (06-08).
//
// ## Why this module exists at all
//
// The same three failures Phase 4 and Phase 5 taught are reachable here, and
// every one of them is a claim about the USER'S OWN DATA rather than a visual
// glitch:
//
//   - a previous export's addresses under a new export's heading (T-06-30),
//   - a worker's internal detail printed under a heading that promises the
//     reader their data is fine (T-06-31, D-21),
//   - a revealed mask that survives a dataset replace (D-07).
//
// So the five states are decided by `deriveLoginState`, every answer is
// admitted or dropped by `acceptLoginsOutcome`, and the mask reset is
// `maskStateFor` — three ordinary functions over ordinary data, which is the
// only reason they can be unit-tested at all (Vitest runs with no Svelte
// plugin and `environment: 'node'`; see vitest.config.ts).
//
// ## No Svelte, no copy
//
// Nothing here imports a component or a string. A state test is not where
// wording is verified: `06-02` owns the sentences, and the component reads
// them. This is the same split `finance-state.ts` states for itself.
//
// ## The one key
//
// `importedAt` is the dataset identity, a primitive string. A replace changes
// it, a clear removes it, and an answer carrying a different one belongs to a
// dashboard that is no longer on screen. `shown` therefore holds the
// `importedAt` it answers for TOGETHER WITH the view, and a mismatch is "no
// answer" rather than a value to display — which is what returns the block to
// `loading` on a replace BY CONSTRUCTION rather than through a reset hook
// somebody has to remember to call.
// =============================================================================

/**
 * The five states of the 06-UI-SPEC section 2 matrix for the login block.
 *
 * `no-source` and `no-usable` are NOT collapsed into one empty state, and D-10
 * (Phase 3) is the reason: "there is no file that could carry an address" and
 * "the file was there and no row could be read" are different facts about the
 * user's own zip, and only the second is fixed by a different file.
 */
export type LoginState = 'loading' | 'ready' | 'no-source' | 'no-usable' | 'error';

/**
 * The statuses a view may carry, which are the states a block is in once it has
 * an answer for the dataset on screen.
 *
 * `error` is not among them because a failure is not something a view reports;
 * it is something the transport reports, and `ShownLogins`'s `failed` variant
 * is how that reaches here. `loading` is not among them for the mirror reason.
 */
export type LoginViewStatus = Exclude<LoginState, 'loading' | 'error'>;

/**
 * One applied answer, stamped with the ask that produced it.
 *
 * Two variants and no third, exactly `finance-state.ts`'s shape: a view that
 * can be rendered, or a failure that cannot. The `failed` variant carries NO
 * detail, which is what makes T-06-31 structural rather than a rule to remember
 * — there is nowhere for a worker string to be read from.
 */
export type ShownLogins =
  { kind: 'view'; importedAt: string; view: LoginsView } | { kind: 'failed'; importedAt: string };

/** Everything the state derivation reads, and nothing it has to compute. */
export interface LoginStateInput {
  /** The dataset on screen now, or null when none is. */
  importedAt: string | null;
  /** The last applied answer, or null when there is none. */
  shown: ShownLogins | null;
}

/**
 * The one state the block renders (06-UI-SPEC section 2).
 *
 * The order of the tests is the order of the disqualifications, cheapest and
 * most disqualifying first:
 *
 *   1. Is there a dataset, and is what we are showing an answer for THAT
 *      dataset? A replace that lands mid-query therefore returns the block to
 *      `loading` by construction, and a `failed` answer for a replaced dataset
 *      never becomes an error about the export now on screen.
 *   2. Did the answer fail? `error`.
 *   3. Otherwise the view's own status, which is a claim about the export.
 */
export function deriveLoginState({ importedAt, shown }: LoginStateInput): LoginState {
  if (importedAt === null) return 'loading';
  if (shown === null || shown.importedAt !== importedAt) return 'loading';
  if (shown.kind === 'failed') return 'error';
  return shown.view.status;
}

/**
 * Admit one outcome, or drop it.
 *
 * Every rejection is a `null`, never an exception: a block awaiting a query has
 * to keep rendering, and an answer it must not show is not an error condition
 * (D-21's rule that nothing on this path ever rejects).
 *
 * The dataset check runs against the dataset CURRENTLY on screen as well as
 * against the ask, because the two can differ: a replace can land while the
 * worker is reading, and then the answer is for a dashboard nobody is looking
 * at any more. The surviving record is stamped with the ASK rather than with
 * the reply, so `shown` can only ever describe a question this block actually
 * put.
 *
 * The order of the checks is the order of the disqualifications. `superseded`
 * is first because it is not an answer at all. The two dataset gates come next
 * because a wrong-dataset answer is wrong however it is stamped. The error
 * outcome becomes a `failed` block HERE, with the detail dropped, so the one
 * place a worker string could enter a block is the one place that does not
 * take it. A null result is dropped rather than rendered — it means the worker
 * holds no stored aggregate for this channel, which is a fact about its
 * storage and not one of the export's empty states, and dropping it leaves the
 * block loading rather than painting an error about data the app may still
 * hold.
 */
export function acceptLoginsOutcome(
  outcome: DataOutcome<'logins'>,
  askImportedAt: string,
  currentImportedAt: string | null,
): ShownLogins | null {
  if (outcome.kind === 'superseded') return null;
  if (currentImportedAt === null || currentImportedAt !== askImportedAt) return null;

  if (outcome.kind === 'error') {
    // T-06-31, D-21: the worker's `detail` is deliberately NOT carried. It can
    // name an internal path, and `LOGIN_HISTORY_ERROR` is the one sentence that
    // is true whether the worker has no aggregate or the query failed.
    return { kind: 'failed', importedAt: askImportedAt };
  }

  if (outcome.importedAt === null || outcome.importedAt !== askImportedAt) return null;
  if (outcome.result === null) return null;
  // A reply for another channel cannot be applied: handing a `premium` view to
  // the login block would paint one section's numbers under another's heading.
  // `QueryClient.handle` settles this as an error before it arrives, so this is
  // the SECOND gate rather than the first — and the one that does not depend on
  // that client keeping its check.
  if (outcome.result.channel !== 'logins') return null;

  return { kind: 'view', importedAt: askImportedAt, view: outcome.result.view };
}

/**
 * The revealed flag the block should be showing, given the one it was showing.
 *
 * ## The rule (D-07)
 *
 * Masked on every load, reset to masked on a dataset replace and on a Clear,
 * and never persisted anywhere. That is three facts and one comparison, so the
 * comparison is what this function is:
 *
 *   - a DIFFERENT `importedAt` means a different dataset is on screen, and the
 *     answer to "should the addresses of THAT dataset be revealed?" is no, for
 *     the same reason the previous dataset's answer was no;
 *   - the SAME `importedAt` means the same dataset, so the user's own choice
 *     survives a re-query, a re-render and a sort.
 *
 * ## Why the stamp is a parameter and not read from a rune
 *
 * A block that read its own `$state` here would have to remember to clear it,
 * and a mask that is not cleared on one path is a mask that leaks. Passing the
 * previous stamp IN makes the reset a value the caller computes from the same
 * `importedAt` that already drives the query effect, so there is nothing to
 * forget: the dataset effect and the mask reset are the same three lines.
 *
 * `null` on both sides (a clear with nothing loaded) is `false`, because a
 * cleared page has no dataset whose addresses could be revealed.
 */
export function maskStateFor(
  previous: { importedAt: string | null; revealed: boolean },
  importedAt: string | null,
): boolean {
  if (importedAt === null) return false;
  return previous.importedAt === importedAt ? previous.revealed : false;
}
