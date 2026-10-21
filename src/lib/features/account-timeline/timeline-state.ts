/**
 * The pure decisions the Account timeline pane makes (plan 12-12).
 *
 * ## Why this module exists
 *
 * `AccountTimelinePane.svelte` and its two children are wiring and markup. The
 * choices they make - which kind chips exist, whether the chip row shows at all,
 * what a stale filter choice resolves to, which files get a state line, whether
 * the whole pane is empty, whether there is anything for the reveal to govern -
 * live here so they can be unit-tested under Node, where Vitest has no DOM. There
 * is no Svelte, no copy and no DOM in this file; its only imports are the shared
 * timeline constants and a type (the `new-data-state` module's rule).
 *
 * ## The rules recorded here
 *
 *   - **The chip row appears only with two kinds.** One kind means All entries is
 *     the only view, and a chip exists only for a kind that has an entry, so a
 *     filtered view is never empty (D-06, UI-SPEC Surface 2).
 *   - **The choice is component state, reset by a pure READ of the dataset
 *     stamp.** Setting state from a `$derived` throws `state_unsafe_mutation`, so
 *     `resolveKindFilter` answers "All entries" for a choice made under another
 *     dataset instead of clearing it (the `reveal-state.ts` rule). Nothing here
 *     touches a route, storage or a URL.
 *   - **A pane with nothing to mask has no toggle** (UI-SPEC Surface 4): a button
 *     that governs nothing is a control that lies.
 */

import {
  TIMELINE_FILE_IDS,
  TIMELINE_KINDS,
  type TimelineEntryView,
  type TimelineFileId,
  type TimelineFileState,
  type TimelineKind,
} from './timeline-shared.ts';

/**
 * The kinds that have at least one entry, in the fixed chip order (Name,
 * Service, Language, Country, Ban, Third party) whatever order the entries are
 * in. An empty list gives `[]`.
 */
export function kindsPresent(entries: readonly TimelineEntryView[]): TimelineKind[] {
  const seen = new Set<TimelineKind>();
  for (const entry of entries) seen.add(entry.kind);
  return TIMELINE_KINDS.filter((kind) => seen.has(kind));
}

/** The chip row renders only for two or more kinds: with one, All is the only view. */
export function showKindFilter(kinds: readonly TimelineKind[]): boolean {
  return kinds.length >= 2;
}

/**
 * The entries to show for a chosen kind. `null` (All entries) returns the SAME
 * array, so an unfiltered pane re-derives nothing; a kind keeps only that kind's
 * entries in their original (chronological) order.
 */
export function filterEntries(
  entries: readonly TimelineEntryView[],
  kind: TimelineKind | null,
): readonly TimelineEntryView[] {
  if (kind === null) return entries;
  return entries.filter((entry) => entry.kind === kind);
}

/** The reader's kind choice, stamped with the dataset it was made under. */
export interface KindChoice {
  /** The chosen kind, or `null` for All entries. */
  kind: TimelineKind | null;
  /** `ClassifyResult.importedAt` of the dataset on screen when it was set. */
  stamp: string | null;
}

/**
 * The kind filter that applies to the dataset on screen.
 *
 * The chosen kind survives only when its stamp is the current dataset's AND the
 * kind still has an entry; otherwise the answer is All entries (`null`). The
 * second test is what keeps a filtered view from ever being empty after a
 * re-query changes the model under a live choice. A pure read: it never writes,
 * and a hostile kind string (the field is a plain value at runtime) simply is
 * not in `present`, so it resolves to All entries without throwing.
 */
export function resolveKindFilter(
  choice: KindChoice,
  importedAt: string | null,
  present: readonly TimelineKind[],
): TimelineKind | null {
  if (importedAt === null || choice.stamp !== importedAt) return null;
  if (choice.kind === null) return null;
  return present.includes(choice.kind) ? choice.kind : null;
}

/** One per-file state line: the file and why it cannot contribute. */
export interface FileStateLine {
  file: TimelineFileId;
  status: 'skipped' | 'no-rows';
}

/**
 * The per-file info lines, in {@link TIMELINE_FILE_IDS} order: one for each file
 * that is skipped or header-only, and nothing for a ready file or one the export
 * does not hold (a missing optional file is not an event; D-03).
 */
export function fileStateLines(
  files: Readonly<Record<TimelineFileId, TimelineFileState>>,
): FileStateLine[] {
  const lines: FileStateLine[] = [];
  for (const file of TIMELINE_FILE_IDS) {
    const status = files[file];
    if (status === 'skipped' || status === 'no-rows') lines.push({ file, status });
  }
  return lines;
}

/**
 * Whether every file the export holds is skipped or header-only, so the pane has
 * no entry to list. False when any file is ready, and false when no file is
 * present at all (that pane has no list row to arrive from).
 */
export function isWholePaneEmpty(
  files: Readonly<Record<TimelineFileId, TimelineFileState>>,
): boolean {
  let present = false;
  for (const file of TIMELINE_FILE_IDS) {
    const status = files[file];
    if (status === 'ready') return false;
    if (status !== 'not-in-export') present = true;
  }
  return present;
}

/**
 * Whether any entry holds an address part with a value, which is the only thing
 * the single global reveal governs in this pane. A null address part, or a code
 * or text part, does not count: there is nothing there to mask or reveal.
 */
export function hasMaskableEntries(entries: readonly TimelineEntryView[]): boolean {
  return entries.some((entry) =>
    entry.parts.some((part) => part.kind === 'address' && part.cell !== null && part.cell !== ''),
  );
}
