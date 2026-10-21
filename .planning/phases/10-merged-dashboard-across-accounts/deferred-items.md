# Deferred items — Phase 10

Out-of-scope discoveries made while executing a phase plan. None of these were
fixed by the plan that found them; each carries the evidence that it is not that
plan's defect.

## 10-02 — `chart-fill.spec.ts` fails under parallel workers (pre-existing)

- **Found during:** 10-02's plan-level verification (`pnpm exec playwright test
  tests/e2e/shell tests/e2e/playtime tests/e2e/vehicles`).
- **What happens:** `tests/e2e/shell/chart-fill.spec.ts:122` "finance charts fill
  the detail pane" fails at the 375px sample with
  `finance-tooltip right 367.2 > edge 359.0`. It passes when the file is run on
  its own and fails when it runs inside the directory group (Playwright uses the
  CPU count as workers outside CI).
- **Evidence it is not 10-02's:** the pre-plan source for every file this plan
  touched was restored with `git checkout dac615d -- src/...` and the same group
  was re-run: the same chart-fill failure. 10-02 changes nothing in Finance, and
  the failing measurement is a Finance tooltip's right edge against the pane's
  content edge.
- **Also recorded in:** `.planning/WINDOWS.md` (entry 15, kind `lint-warning`,
  status `open`), so it is visible to the ship gate rather than only here.
- status: resolved
- **Resolution:** chart-fill now polls until layout settles (see 3ebfd46); WINDOWS entry 15 closed.
