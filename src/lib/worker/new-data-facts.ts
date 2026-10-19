// =============================================================================
// new-data-facts.ts — the new-game pane facts, derived in ONE place (D-09)
// =============================================================================
//
// What this module answers: "for each new-game pane, how many of its files were
// in the export, and how many rows did they store?"
//
// ## Why it is ONE function and not two call sites
//
// `done`, `duplicate` and `cache-status` all carry a `ClassifyResult`, and the
// list, the Overview card and every pane header read their counts off it rather
// than issuing a worker query of their own (11-UI-SPEC assumption A3). Three
// call sites computing it separately is the same drift `resultFromMeta` and
// `accountSummariesOf` exist to prevent: a header that says "4 files" after an
// import and "5" after a reload is a false statement about the user's data that
// no test of the import alone would catch. So the derivation is here, and the
// two publish sites call it — edit them together.
//
// ## Why it is pure
//
// No Dexie, no DOM, no copy, no clock. It takes the flattened presence list and
// returns two integers per pane, so it is testable by hand and neither a
// worker-boundary violation nor something a page-side module could re-derive
// differently.
//
// ## What a published pane may carry (T-11-14)
//
// Two integers and nothing else. Not a file name, not a category, not an account
// root, not a cell — the pane table is keyed by the pane id, which is a constant
// this app chose. The category test below is what keeps it that way: a fact whose
// category does not match its file's spec contributes to no pane at all, so a
// copy of a pane file filed anywhere else cannot conjure one.
// =============================================================================

import type { DatasetFile } from './db.ts';
import { specFor } from './new-data-allowlist.ts';
import {
  NEW_DATA_PANE_FILES,
  NEW_DATA_PANE_IDS,
  type NewDataPaneFacts,
  type NewDataPaneId,
} from '../features/new-data/new-data-shared.ts';

/**
 * The pane facts of a stored or freshly built presence list.
 *
 * `files` is the flattened list `meta.files` holds — the accounts' own facts
 * concatenated — because a pane counts FILES OF THE EXPORT, and the flattened
 * list is the one that holds every account's contribution. A nullish list is
 * not an error: a cache written before presence facts existed has none, and the
 * honest answer for it is "no pane", never a throw (Pitfall 6).
 */
export function newDataPaneFacts(
  files: readonly DatasetFile[] | null | undefined,
): Partial<Record<NewDataPaneId, NewDataPaneFacts>> {
  const panes: Partial<Record<NewDataPaneId, NewDataPaneFacts>> = {};
  for (const fact of files ?? []) {
    const sourceFile = fact.sourceFile.toLowerCase();
    for (const id of NEW_DATA_PANE_IDS) {
      if (!NEW_DATA_PANE_FILES[id].includes(sourceFile)) continue;
      // The category is half the decision, and it is the half the FILE NAME
      // cannot supply: a spec is filed under one category, so a fact whose own
      // category does not match it is a copy this build stores nothing from and
      // it counts toward no pane (T-11-14). A null here is every fail-closed
      // case `specFor` documents, including a pane file that has no spec at all.
      if (specFor(fact.category, sourceFile) === null) continue;
      const pane = panes[id] ?? { fileCount: 0, rowCount: 0 };
      pane.fileCount += 1;
      // The STORED count, never `parsedRowCount`: a pane header that said "10
      // rows" beside a table holding four would be a false claim, and the
      // parsed number is already on the fact for anyone who needs it.
      pane.rowCount += fact.rowCount;
      panes[id] = pane;
    }
  }
  return panes;
}
