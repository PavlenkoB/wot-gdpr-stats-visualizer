/**
 * The read-time cross-account merge (D-10, D-11, D-12).
 *
 * ## What this is
 *
 * Two accounts in one export can hold a byte-identical row — the same
 * subscription, the same external service, the same language/country entry.
 * Shown once, with a tag per account, that row stops being noise and starts
 * being a fact about the account SET; shown twice it is a statement about one
 * account that is true of the other and nobody checked.
 *
 * ## Why the merge happens HERE and not at write time
 *
 * Storage stays PER ACCOUNT (D-12). Merging on the way into Dexie would destroy
 * a fact — that account A *did* hold that subscription is a real thing about the
 * user, and a re-import, a cache purge or a second pane asking a narrower
 * question would all lose it. So the rows are stored as they arrive and the
 * grouping happens when a pane model is built, out of `AccountRowGroup[]`
 * (one group per account), which is the unit every other builder already
 * resolves within.
 *
 * ## Why only rows identical ACROSS accounts merge
 *
 * A repeated row inside ONE account is a real repeated event: the export says
 * the account was granted that subscription twice, and collapsing the second
 * into the first would state something the user's own data does not say. So the
 * key carries the OCCURRENCE INDEX of the signature inside its own account, and
 * only the k-th occurrences of two accounts' rows ever meet. Dropping the
 * occurrence index is a one-line change if the user wants every identical row
 * collapsed, which is why RESEARCH records it as `[ASSUMED]`.
 *
 * ## Why the signature is the whole allowlisted column list (D-11)
 *
 * The caller passes ALL of a spec's column ids, never a subset it found
 * convenient, so a difference in ANY stored column keeps the rows apart. The
 * signature is the JSON text of those values in order, which makes a collision
 * between two different tuples impossible (a plain join with a separator cannot:
 * `["a", "b c"]` and `["a b", "c"]` join alike). An absent or `undefined` value
 * is written as `null`, so an EMPTY STRING is a value and is not the same thing
 * as a missing cell — the export omitting a column and reporting it empty are
 * two different facts about the user's data.
 *
 * ## Why a Map and never an object (T-09-27, T-12-13)
 *
 * An account root comes out of an untrusted zip, so it may be the string
 * `__proto__`. Written as an object key that would set the object's prototype
 * instead of storing an entry and the account's rows would vanish; read back it
 * would walk up to `Object.prototype`. A Map has no such key.
 *
 * This module touches no clock, no storage and no DOM, so the merge cannot
 * depend on when or where it ran.
 */

import type { AccountRowGroup, CsvRow } from '../../worker/csv-columns.ts';

/** One displayed row and the accounts whose stored rows it stands for. */
export interface MergedRow {
  /**
   * Every account root that contributed a row, in FIRST-SEEN order.
   *
   * First-seen rather than identity-header order on purpose: this module has no
   * access to the header, and the view layer already orders account chips by
   * letter through `accountChipsOf`. Two orders exist and each is right for its
   * own job.
   */
  readonly accounts: readonly string[];
  /** The FIRST occurrence's stored row, kept whole (no column is dropped). */
  readonly row: CsvRow;
}

/** Merged rows, plus how many STORED rows the merge removed. */
export interface MergeResult {
  readonly rows: readonly MergedRow[];
  /** `storedRows - rows.length`. Zero when nothing merged. */
  readonly mergedAway: number;
}

/**
 * The separator between a signature and its occurrence index.
 *
 * NUL, the same choice `narrowGroupKey` in the worker makes: JSON text never
 * contains a raw control character, so no cell can forge the boundary and make
 * two different signatures read as one.
 */
const KEY_SEPARATOR = '\u0000';

/**
 * The row's signature over the caller's column list: JSON text of the values in
 * column order, with an absent or `undefined` value written as `null`.
 */
function signatureOf(row: CsvRow, columnIds: readonly string[]): string {
  return JSON.stringify(columnIds.map((id) => row[id] ?? null));
}

/**
 * Collapse rows that are identical across accounts, and report how many stored
 * rows that removed.
 *
 * `columnIds` must be the WHOLE of the spec's column list. A looser list would
 * hide a real difference between two accounts' rows, which is the one thing
 * D-11 exists to prevent.
 *
 * Rows come back in first-seen order, so the pane's own chronology decides the
 * final order; this function does not sort.
 */
export function mergeIdenticalAcrossAccounts(
  groups: readonly AccountRowGroup[],
  columnIds: readonly string[],
): MergeResult {
  // The merged rows, keyed by signature + occurrence index. Never an object: an
  // account root may be `__proto__`.
  const merged = new Map<string, MergedRow>();
  /** How many stored rows were read, for `mergedAway`. */
  let stored = 0;

  for (const group of groups) {
    /** Occurrence index of each signature INSIDE this group. */
    const seen = new Map<string, number>();
    for (const row of group.rows) {
      stored += 1;
      const signature = signatureOf(row, columnIds);
      const occurrence = seen.get(signature) ?? 0;
      seen.set(signature, occurrence + 1);
      const key = signature + KEY_SEPARATOR + occurrence;

      const existing = merged.get(key);
      if (existing === undefined) {
        merged.set(key, { accounts: [group.account], row });
        continue;
      }
      // An account already on this row adds nothing: a root may be contributed
      // by more than one group, and a tag repeated is a tag that lies.
      if (!existing.accounts.includes(group.account)) {
        merged.set(key, { accounts: [...existing.accounts, group.account], row: existing.row });
      }
    }
  }

  return { rows: [...merged.values()], mergedAway: stored - merged.size };
}

/**
 * The no-merge path: every stored row once, with its single account, and
 * nothing removed.
 *
 * Returned in the SAME shape as {@link mergeIdenticalAcrossAccounts} so a
 * builder for a file that never merges (coupons, bonus codes, bans, names,
 * surveys) is a substitution rather than a second code path — and so it reports
 * `mergedAway: 0` truthfully, which is what keeps the merge note off the screen
 * for a file that had nothing to merge.
 */
export function flattenGroups(groups: readonly AccountRowGroup[]): MergeResult {
  const rows: MergedRow[] = [];
  for (const group of groups) {
    for (const row of group.rows) rows.push({ accounts: [group.account], row });
  }
  return { rows, mergedAway: 0 };
}
