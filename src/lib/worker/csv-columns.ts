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

/** Read one cell through a resolved column key, or undefined when absent. */
export function cell(row: CsvRow, key: string | null): string | undefined {
  return key === null ? undefined : row[key];
}
