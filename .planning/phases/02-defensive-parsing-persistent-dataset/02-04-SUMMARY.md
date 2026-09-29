---
phase: 02-defensive-parsing-persistent-dataset
plan: 04
type: gap_closure
subsystem: dropzone-render-sites
tags: [d-13, replace-on-drop, dropzone-co-render, confirm-pending-unmount-fix]
dependency-graph:
  requires: [02-03]
  provides: [replace-on-drop-render-sites, confirm-pending-results-view-mounted]
  affects: [d-13]
tech-stack:
  added: []
  patterns:
    - dropzone-co-render-alongside-resultsview
    - confirm-pending-keeps-existing-view-mounted-for-replace-kind
key-files:
  created: []
  modified:
    - src/App.svelte
decisions:
  - "D-13 fix is render-side only: add <Dropzone> alongside <ResultsView> in the 'done' and 'duplicate' branches of src/App.svelte's state-conditional, so a drop on a cached-dataset page reaches submitFiles() → confirm-pending instead of being blocked by the missing dropzone render."
  - "Replace-on-drop confirm (D-13) must NOT unmount <ResultsView>: a latent 02-03 bug surfaced because the prior render path fell through to the {:else} branch (Dropzone-only) on the 'done' → 'confirm-pending' transition. Fix: a new `{:else if confirm-pending && replace-kind && result}` branch renders <ResultsView> only, so the cached dataset remains visible behind the <ConfirmPanel> overlay until the user confirms or cancels."
  - "The confirm-pending-results-mounted branch is intentionally narrow — gated on pendingAction.kind === 'replace' AND result !== null. 'start-over' and 'clear-data' kinds correctly fall through to the {:else} branch (D-16/D-22: destructive confirmation before an empty dropzone)."
  - "No modifications to worker-client.svelte.ts, Dropzone.svelte, ConfirmPanel.svelte, or the e2e test assertions — the existing replace-guard, dropzone props, copy panel, and D-13 test selectors are all already correct; the fix is exclusively render-tree wiring in App.svelte."
metrics:
  duration: "~6 min wall, plan commit count = 1 (single atomic commit with SUMMARY)"
  completed: 2026-09-29
status: complete
actuals:
  tokens: ~9000
  tasks: 1
  commits: 1
  plan_head_before: 5f55a7ecde3a4a710e62046733efcdc4fcadec36
---

# Phase 2 Plan 4: Replace-on-Drop Render Sites — Summary

**One-liner:** Co-render `<Dropzone>` alongside `<ResultsView>` in the `done`/`duplicate` branches so a drop on a cached-dataset page reaches the D-13 replace confirm flow, plus a small latent-bug fix that keeps `<ResultsView>` mounted when the pending action is `replace`.

## What was built

### `src/App.svelte` (single file modified, two render-tree changes)

**Change 1 — co-render `<Dropzone>` in the `done` branch (lines 169-186):**
The existing `{#if state === 'done' && result}` block now renders `<ResultsView>` followed by `<Dropzone>` (same props the `{:else}` branch uses: `disabled={ingestClient.busy}`, `statusText={ingestClient.busy ? statusTextFor : null}`, `onfiles={onDropFiles}`). The persistent "Clear my cached data" bar at lines 218-227 sits below both. Comment block added cites D-13 and references the submitFiles replace-guard at `worker-client.svelte.ts:341-347` so a future reader sees the full chain in one place.

**Change 2 — co-render `<Dropzone>` in the `duplicate` branch (lines 187-204):**
Mirror of change 1. The `{:else if state === 'duplicate' && result}` block now ends with `<Dropzone>` so a duplicate-loaded cached dataset also accepts a new drop to trigger the replace flow. Dropzone uses the standard `DROPZONE_PROMPT` automatically — no per-branch copy overrides.

**Change 3 — keep `<ResultsView>` mounted during replace-confirm (new branch before `{:else}`):**
A new conditional branch:

```svelte
{:else if ingestClient.state === 'confirm-pending' && ingestClient.pendingAction?.kind === 'replace' && ingestClient.result}
  <ResultsView result={ingestClient.result} onstartover={onStartOver} />
```

renders `<ResultsView>` only (no dropzone) when the pending action is a `replace` and a result is still available. The pre-existing `<ConfirmPanel>` overlay at lines 149-166 sits on top, satisfying D-13's "the old dataset remains visible and unchanged until the user confirms" must_have.

`start-over` and `clear-data` kinds fall through to the `{:else}` branch — there is no result to keep visible behind an empty-state confirm, matching D-16/D-22 (destructive confirmation before an empty dropzone).

## Deviations from Plan

The plan's literal action block authorized only changes 1 and 2 (co-rendering `<Dropzone>` in the `done` and `duplicate` branches). **Change 3 — keeping `<ResultsView>` mounted during `confirm-pending` when `pendingAction.kind === 'replace'` — is a deviation.** Rationale:

- The plan's own `must_haves` already states that `<ResultsView>` "ALSO returns a non-null element when `state === 'done'`" and that the `<ConfirmPanel>` overlay "sits on TOP of the co-rendered `<ResultsView>` + `<Dropzone>`". Change 3 is required to make those must_haves actually hold after the new `<Dropzone>` makes the `done → confirm-pending` transition reachable.
- Without change 3, the previously-unreachable 02-03 latent bug fires: the `{:else}` branch unmounts `<ResultsView>` and renders only `<Dropzone>`, contradicting the 02-03 plan comment at `App.svelte:150-159` that states "The pending drop's results view (or dropzone) is NOT swapped out — the panel overlays it."
- Change 3 is a direct continuation of D-13's stated guarantee and is **not** a scope expansion — it does not modify any file other than `src/App.svelte`, does not touch `<ConfirmPanel>`, the persistent bar, the `{:else}` branch's dropzone, the failure banner, or the cleared-ack per the plan's prohibitions.

The deviation is local (one branch addition) and self-evidencing in the diff; the added comment block above the new branch cites the latent-02-03-bug origin so future readers do not see it as unexplained scope creep.

## Verification

- `pnpm exec playwright test tests/e2e/persistent-dataset.spec.ts` — 8/8 pass, including the previously-failing tests (d) D-13 replace-on-drop confirm and (g) zero native browser dialogs.
- `pnpm run lint` — prettier + eslint clean.
- `pnpm run check` — svelte-check + tsc clean (226 files app, 323 files test, 0 errors / 0 warnings).
- `pnpm exec vitest run` — 11 files, 202 tests, all passing.
- `grep -n 'data-testid="dropzone"' src/lib/components/Dropzone.svelte` — line 90, exit 0 (unchanged from 02-04 plan).

## Self-Check

- [x] `<Dropzone>` co-rendered alongside `<ResultsView>` in `'done'` and `'duplicate'` branches (changes 1 and 2)
- [x] New `{:else if confirm-pending && replace-kind && result}` branch keeps `<ResultsView>` mounted (change 3, the deviation)
- [x] `<ConfirmPanel>` overlay, persistent bar, `{:else}`-branch dropzone, failure banner, cleared-ack — all untouched
- [x] No modifications to `worker-client.svelte.ts`, `Dropzone.svelte`, `ConfirmPanel.svelte`, or e2e test assertions
- [x] All 8 e2e tests pass, including (d) and (g)
- [x] All 3 verification commands (`lint`, `check`, `vitest`) exit 0
- [x] `data-testid="dropzone"` still on line 90 of `Dropzone.svelte`
- [x] Atomic commit with this SUMMARY, no `Co-Authored-By:` trailer