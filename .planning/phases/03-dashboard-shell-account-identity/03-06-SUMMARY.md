---
phase: 03-dashboard-shell-account-identity
plan: 06
status: complete
wave: 3
requirements: [IDENTITY-01, DATA-04]
files_modified:
  - src/lib/components/ImportBar.svelte
  - src/lib/components/Dropzone.svelte
  - src/lib/components/ConfirmPanel.svelte
  - src/lib/components/FailureBanner.svelte
  - src/App.svelte
  - tests/e2e/dashboard.spec.ts
---

# Plan 03-06 — the Import bar: one element, two variants, one notice slot

## What was built

**`ImportBar.svelte`** is new and is the whole import region. It is ONE
`<section aria-label="Import" data-testid="import-bar" data-variant>` in both
modes (D-24, D-25): the element is never re-created, `data-variant` flips from
`full` to `slim` when a cached dataset appears, and the dropzone inside it is
the same instance either way. Its children are, in order: the notice slot, the
slim-only meta row, the single dropzone, and the confirm snippet.

**The notice slot is one always-present live region** (D-26). It is rendered
unconditionally and only its CHILD is conditional, because a live region
created together with its content is not announced. It holds at most one of
processing, error, duplicate or cleared, and no child of it carries a `role` —
the slot is `role="status" aria-live="polite" aria-atomic="true"`, and a nested
one would announce every update twice (RESEARCH Pitfall 10). `FailureBanner`
keeps its `role="alert"`: an error is meant to interrupt.

**The section has no flex `gap`.** An empty slot must add no space, and a gap
would double the 12px a notice already carries, so the slot, the notices and
the meta row each own a 12px bottom margin. When the slot is empty it measures
exactly zero pixels, which the first-visit test asserts.

**`Dropzone.svelte` no longer swaps its prompt for a spinner.** It lost
`statusText`, gained `compact` and an exported `focus()`. The prompt is always
visible and the element is `aria-disabled` / `aria-busy` while busy — and
`aria-busy` follows `disabled` rather than a processing flag, because the
processing flag can no longer exist: the spinner moved into the slot. Had it
kept its old condition the attribute would be permanently `undefined` and the
import-flow busy assertion would fail (RESEARCH Pitfall 9, exactly as
predicted). The compact rule is declared BEFORE `.highlighted` and `.disabled`
so the drag highlight and the busy treatment still win over it.

**The confirm panel renders inside the bar, last**, and it takes focus. It
binds its dismiss button and focuses it in `onMount` — in code, not with the
element's own mount-time focus attribute, which the svelte a11y lint flags.
`App.svelte` records the click's `currentTarget` when Start over or Clear my
cached data opens the panel, drops that reference when the dataset is replaced
by a file drop instead, and on cancel returns focus to the recorded trigger if
it is still connected, falling through to the dropzone when it is not. After a
CONFIRMED clear the trigger is gone with the dataset, so an `$effect` on
`justCleared` lands focus on the full-size dropzone (UI-SPEC focus
management).

**`App.svelte` is now composition only.** It keeps the window-level drag and
drop guard verbatim, `statusTextFor`, `confirmCopy` and the cache-check block
(with its spinner styles), and derives `hasResult`, `notice` and `importedOn`.
The `notice` derivation is RESEARCH Pattern 4, so exactly one transient
message can exist and the bar and the dashboard can never disagree about
whether an export is loaded. The old inline notice branches, the bottom
`.persistent-bar` and its styles are gone.

## Files changed

| File | Change |
|------|--------|
| `src/lib/components/ImportBar.svelte` | new — the import region: notice slot, meta row, the single dropzone, the confirm host, the spinner, `focusDropzone()` |
| `src/lib/components/Dropzone.svelte` | `compact` prop and exported `focus()`; `statusText` and the spinner removed; `aria-busy` follows `disabled`; prompt always shown |
| `src/lib/components/ConfirmPanel.svelte` | dismiss button focused in `onMount`; margin moved from 16px-below to 12px-above now that it is the bar's last child |
| `src/lib/components/FailureBanner.svelte` | bottom margin 16px → 12px to match the other notices in the slot; markup, role and copy unchanged |
| `src/App.svelte` | renders `ImportBar` + `Dashboard`; derives `notice` / `hasResult` / `importedOn`; confirm snippet, trigger recording and focus return |
| `tests/e2e/dashboard.spec.ts` | +19 tests: import region (4), confirm panel and focus (5), app-state matrix (10) |

`package.json` and `pnpm-lock.yaml` untouched (T-03-SC). `--nav-offset` was
already in `src/app.css` from 03-04 and was not re-added. `DashboardNav.svelte`
was not moved or wrapped, and the scroll-spy's first-section rule and its
in-flow `font-size: 0` suffix are untouched.

## Tests

**Task 1 — the import region (4).** Full on a first visit and slim after an
import on the same element; exactly one dropzone in both; an empty slot
measuring zero height; processing text and spinner inside the slot and no
spinner in the dropzone; the dropzone keeping its full prompt and its disabled
input while busy; one `aria-live` element on the page and no `role="status"`
anywhere inside the slot.

The busy snapshot is ONE `page.evaluate` that waits for `aria-busy` with a
frame loop inside the page and then reads the whole region in a single pass.
Separate Playwright round trips race the transition: the sample settles inside
the client's 400 ms floor, and the plan calls that out explicitly.

**Task 2 — the confirm panel and focus (5).** The panel is a descendant of the
import bar and its top edge is below the meta row's bottom edge; its dismiss
button is focused on open; dismissal returns focus to `start-over`, to
`clear-data-control` and to the dropzone respectively; a confirmed clear lands
focus on the full-size dropzone with the bar back to `full`; and both
clear-data triggers produce byte-identical panel text and labels (Phase 2
D-22).

**Task 3 — the state matrix (10).** One test per row of the UI-SPEC matrix:
duplicate, replace in flight, failed replace, first import error, cleared,
return visit, drop during confirm; plus the cache-check window, a stray drop
outside the dropzone, and the slim bar at 375px.

Three of them carry guarantees the matrix only implies. `failed-replace`
asserts the old nickname, account ID, imported-on text and every section
summary are unchanged **after a reload**, because screen and storage agreeing
for a moment is not the guarantee. `cache-check-window` holds the worker
script's response back for 800 ms and asserts the import bar, identity header,
nav and all five sections have count 0 while the spinner block is up. The
`stray-drop` test reads `defaultPrevented` at the window bubble phase for both
`dragover` and `drop`, which is the only place the guard that stops the
browser navigating to the dropped file is observable.

`replace-in-flight` and the Task 1 busy snapshot read from inside the page
rather than polling from the test side, for the same 400 ms reason.

### RED → GREEN evidence

| Commit | State |
|--------|-------|
| `fadb885` | RED — 4 discovered, 4 failed: `import-bar` and `notice-slot` resolved to 0 elements. The busy snapshot also reported the dropzone with no `aria-busy` and the spinner where it used to be |
| `2cced89` | GREEN — 4 passed; dashboard + identity-privacy + zero-network 30 passed, 0 failed; lint, check, 325 unit clean |
| `83b2dd0` | RED — 5 discovered, 3 failed, all on focus: `confirm-cancel` stayed `inactive` for Start over, Clear my cached data and replace-on-drop. The panel mounted without ever taking focus |
| `14c3f57` | GREEN — 9 passed (Tasks 1 + 2); dashboard + zero-network 30 passed, 0 failed; lint, check, 325 unit clean |
| `a076fd3` | Task 3 — 10 passed on first run, no source change needed; full gate green |

The Task 2 RED commit also contains two tests that were already passing: the
confirmed-clear focus landing (`App.svelte` moved focus on `justCleared` from
Task 1) and the shared copy pair (Phase 2 D-22). They are kept as the
regression guards they are, and the commit message says so rather than
implying a fifth failure.

## Verification

| Command | Result |
|---------|--------|
| `pnpm run lint` | exit 0 — prettier clean, eslint clean |
| `pnpm run check` | exit 0 — svelte-check 0 errors / 0 warnings on both tsconfigs |
| `pnpm run test:unit` | 325 passed across 14 files |
| `pnpm exec playwright test dashboard identity-privacy scroll-nav zero-network` | 58 passed, 0 failed |
| `pnpm exec playwright test` (full) | 63 passed, 20 failed — see below |
| `grep -c "prefers-reduced-motion" src/lib/components/ImportBar.svelte` | `2` (the spinner's reduced-motion rule and the block it guards) |
| `grep -c "autofocus" src/lib/components/ConfirmPanel.svelte` | `0`, and the word appears in no comment in that file |
| `git diff --quiet 9558a26 -- package.json pnpm-lock.yaml` | exit 0 |

The full gate was run after each task, not the per-task subset.

The **full** Playwright suite is `63 passed, 20 failed`. The baseline coming
into this plan was 44/20 and the 19 tests added here account for the difference
exactly. All 20 failures remain in the three legacy specs — `import-failure`
(6), `import-flow` (7), `persistent-dataset` (7) — each asserting retired
markup (`results`, `account-heading`, `summary-line`, `category-badge`,
level-2 heading counts) or the retired no-confirmation Start Over flow. Plan
03-07 owns that migration. No new failure appeared, and nothing in those specs
was touched or weakened here.

## Deviations

- **The `(duplicate)` test passes one byte array to both imports, and the
  helper says why.** fflate stamps each archive with a second-resolution
  mtime, so `buildSampleExport()` called twice a second apart returns different
  bytes with a different SHA-256, and the worker correctly treats the second
  drop as a replacement rather than a duplicate. The first version of this test
  passed in isolation and failed when it ran first in the file, which is
  precisely the shape of flake that gets mistaken for a product bug. The
  fixture, not the app, was at fault; no product guarantee was relaxed. The
  reasoning is in the JSDoc on `importSampleAndWait` so the next reader does
  not "tidy" the shared array away.

- **Playwright DOES intercept the module-worker script request**, so the
  `page.route` hold-back worked as the plan's primary suggestion and the
  `Worker`-constructor `addInitScript` fallback was not needed. The route only
  delays the response; the test asserts the hold actually happened (`held >
  0`), so it cannot pass vacuously if a future build stops routing the worker
  through the page's network stack.

- **The `cache-check-window` test navigates a second time.** The file-level
  `beforeEach` has already loaded the app and waited for worker-ready, so the
  route is registered and `page.goto('/')` re-issued inside the test; the fresh
  document fetches the worker script again and this time it is held. The cost
  is one redundant load for that single test, which is cheaper than splitting
  the file's setup for one row of the matrix.

- **The focus ring rule is unchanged (` :focus-within` only).** Adding
  `:focus-visible` alongside it was considered while reworking the dropzone and
  dropped: `focus-within` already covers both the Tab case and the programmatic
  `focus()` after a clear, and widening it would have been an unrequested
  visual change.

- **Task 3 produced no source change.** The plan anticipated that a failing
  row might expose a real defect; none did. Every row passed as written, so the
  `files_modified` list is the same five files Tasks 1 and 2 touched plus the
  spec.

## Notes for the next plans

- New test ids live on `import-bar`: `notice-slot`, `duplicate-notice`, plus
  `data-variant` on the bar itself. 03-07 meets all of these when it re-points
  the three legacy specs.
- `processing-status` and `spinner` still exist but now live INSIDE
  `notice-slot` rather than inside the dropzone. A legacy selector like
  `page.getByTestId('dropzone').getByTestId('processing-status')` will now
  resolve to 0, and that is correct, not a regression.
- `persistent-bar` still exists and is still the wrapper holding
  `imported-at`, `start-over` and `clear-data-control`, but it now lives inside
  `import-bar` in the slim variant and is absent on a first visit. The
  persistent-dataset spec's count-0-on-first-visit assertion still holds.
- `cleared-ack` no longer has a `role="status"` of its own (the slot is the
  region). A spec that selects it by ROLE rather than test id will need
  re-pointing.
- The duplicate notice is reachable only AFTER the user confirms a replace
  with identical bytes, because the replace confirmation precedes the worker's
  hash check. A spec that drops the same file and expects the notice without a
  confirm will hang; 03-07 should confirm first.
- `imported-at` text is asserted with a `/^Imported on /` prefix match in these
  tests because the date varies; the exact-string cases live elsewhere.
- `Dropzone.svelte` now exports `focus()`. If a future refactor re-creates the
  dropzone element rather than re-styling it, the confirmed-clear focus
  landing is the test that catches it.

## Plan file

`03-06-PLAN.md` — 3 tasks, all complete.
