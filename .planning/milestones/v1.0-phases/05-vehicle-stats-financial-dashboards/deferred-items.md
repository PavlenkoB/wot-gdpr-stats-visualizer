- `tests/unit/ui-copy.test.ts:207` fails on this machine because the box's locale
  is `uk_UA.UTF-8` and `formatImportSummary` groups the row count with
  `toLocaleString()` rather than a pinned locale.
  status: acknowledged
  **Found during:** 05-04 Task 3, running the plan's whole-suite gate.
  **Closed by:** 05-08. `formatNumber` now takes an optional locale and defaults
  to the viewer's; `formatRowCount` and `formatSkippedRowCount` group through it
  instead of reaching for the ambient locale, and `tests/unit/setup.ts` pins
  `en-US` for the unit suite — the determinism moved to the test side, which is
  what RESEARCH Pitfall 7 prescribes. `tests/e2e/pin-locale.ts` does the same for
  the Node side of a Playwright assertion.
  **Verified:** `LC_ALL=de_DE.UTF-8 LANG=de_DE.UTF-8 pnpm exec vitest run
  tests/unit/ui-copy.test.ts` reports 175 passed (175); the same command under
  `uk_UA.UTF-8` and `fr_FR.UTF-8` also reports 175 passed. The assertion
  `uses the existing thousands separator for the row count` passes under
  `de_DE`; before the fix the same run reported `expected '3 files, 1.204 rows'
  to be '3 files, 1,204 rows'`. The production default was verified unpinned by
  importing the module with the seam uncalled: `de-DE` gives `1.204` and `uk-UA`
  gives `1 204`, so a real viewer still gets their own grouping.
  **Not weakened:** the assertion is unchanged; only the locale it runs under is
  now declared by the test setup rather than inherited from the machine.
