import type { AccountRowGroup, CsvRow } from '../../src/lib/worker/csv-columns.ts';

/**
 * Build `AccountRowGroup`s for tests (09-07).
 *
 * Every builder that reads stored rows now takes ONE account's rows of one file
 * at a time, so a test that stands for a single-account export has to say so
 * once. This is that saying: the one helper every such test uses, so "this file
 * belongs to one account" is a named fact rather than a shape spelled out at
 * forty call sites.
 */

/**
 * ONE account's rows — the shape a single-account export's reader produces.
 *
 * An empty input yields NO groups rather than one empty group, so "the file held
 * no rows" and "the file held rows this app cannot read" stay different answers.
 */
export function oneAccount<T extends CsvRow>(
  rows: readonly T[],
  account = 'test-account',
): AccountRowGroup<T>[] {
  return rows.length === 0 ? [] : [{ account, rows }];
}

/**
 * One group per entry, in order — a multi-account file whose accounts are named.
 *
 * The empty-entry case yields NO group for that account, which is what a file
 * that contributed no row to this account actually means.
 */
export function oneAccountEach<T extends CsvRow>(
  perAccount: readonly (readonly T[])[],
  accounts: readonly string[],
): AccountRowGroup<T>[] {
  const groups: AccountRowGroup<T>[] = [];
  perAccount.forEach((rows, index) => {
    if (rows.length === 0) return;
    groups.push({ account: accounts[index] ?? `account-${index}`, rows });
  });
  return groups;
}
