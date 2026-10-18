/**
 * The two column helpers every CSV aggregator in the worker shares.
 *
 * Kept to exactly these two on purpose: each aggregator resolves its own
 * columns from the FIRST row's keys in one enumeration (so a later row cannot
 * change which column is which, and no value is read by a guessed name), and
 * that walk stays beside the aliases it resolves. Only the normalisation and
 * the read are common.
 */

/** A parsed CSV row: every cell a string, or absent for a ragged row. */
export type CsvRow = Readonly<Record<string, string | undefined>>;

/** The header cell as a comparable key: trimmed and upper-cased. */
export function headerKey(name: string): string {
  return name.trim().toUpperCase();
}

/**
 * ONE account's rows of ONE file — the unit every CSV consumer resolves within.
 *
 * ## Why a group and not a flat row list
 *
 * Every aggregator resolves its columns from the FIRST row's keys and then reads
 * every row through those keys. That rule is correct for one file and wrong for
 * one file contributed by two accounts: the accounts' CSVs carry their own
 * headers, and a real archive shows the difference (a `VEHICLE_NAME` written as
 * `VEHICLE_ID`, an `AMOUNT` written as `AMOUNT_VALUE`). Resolving off one
 * account's first row makes the OTHER account's cells read as absent — a false
 * statement about the user's own data while its file is plainly in the archive
 * (CR-01, DATA-04).
 *
 * So the account is the OUTERMEST level of the grouping, exactly as it already
 * is in `readSessionRowData` and `readLoginRowData` (09-03): each group resolves
 * its columns from its OWN first row, and a key is never taken across a group
 * boundary.
 *
 * ## Why this module owns the type
 *
 * It is already the one worker-side module every aggregator imports for
 * `headerKey`/`cell`, and it has no dependencies. A builder must not reach into
 * `src/lib/worker/db.ts` — the persistence layer — for a type describing rows.
 */
export interface AccountRowGroup<T extends CsvRow = CsvRow> {
  /** The account root that owns these rows — `row.account` of each of them. */
  readonly account: string;
  /** This account's rows of this file, in stored order. */
  readonly rows: readonly T[];
}

/** Read one cell through a resolved column key, or undefined when absent. */
export function cell(row: CsvRow, key: string | null): string | undefined {
  return key === null ? undefined : row[key];
}
