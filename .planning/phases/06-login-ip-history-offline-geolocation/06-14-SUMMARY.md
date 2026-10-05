---
phase: 06-login-ip-history-offline-geolocation
plan: 14
subsystem: testing
tags: [playwright, vitest, ci-budget, zero-network, csp, scale, guards, readme]

requires:
  - phase: 06-login-ip-history-offline-geolocation
    provides: "the login table and map (06-10, 06-12), the city opt-in (06-13), the one sanctioned fetch and its ESLint exemption (06-11), the 12,000-row fixture builders and the independent oracle (06-03), the committed fixture country table (06-04)"
provides:
  - "tests/e2e/logins/login-scale.spec.ts: the 12,000-row proof, five tests priced as one block, expectations from an independent naive range scan plus the oracle"
  - "a Phase 6 zero-network test through import, reveal, every sort, map pointer and keyboard, the country list, Clear and re-import, with the city opt-in never pressed"
  - "the CI e2e budget reconciled (globalTimeout 27 min, wrapper 29 min, job 37 min) with LOGIN_SCALE_SPEC_* constants in the guard"
  - "tests/unit/guards/phase6-guards.test.ts: no real IPv4 literal committed, no motion or inline style in the logins feature, both self-tested"
  - "the run skill's driver logging the login block and the city opt-in state, plus the README section that states the one sanctioned request and what enforces it"
  - "the Phase 7 hand-offs in the ROADMAP Planning Notes"
affects: [phase-07, ACTIVITY-05, ACTIVITY-06, ACTIVITY-07]

actuals:
  tokens: 15400
  tasks: 3
  commits: 7

# Measured, never narrated (#3968). plan_head_after is the head when the ledger was read.
plan_head_before: 25c6b508d7b1e2aab2589736f443fcc106581b8c
plan_head_after: 407ba34d829ccc835b51eb461d122e8ff2e51eb2
commits: 7
commits_note: "7 measured by `git rev-list --count 25c6b50..HEAD`. Five are this plan's: the three task commits (f9c5f46, 8f1145b, 0458343) landed by the executor that died on an API rate limit, then 1f76079 and 407ba34 from the resume. Two are the orchestrator's AGENTS.md and STACK.md refresh (b579e95, da77bff) that landed on the branch while this resume ran. tokens is chars/4 over the added lines of the plan's files (about 61,500 chars); the estimate of 100,000 was high because the bulk is comments and two long specs."

tech-stack:
  added: []
  patterns:
    - "a scale spec priced as a block: one import in beforeAll, cheap serial reads of the same DOM, subtracted from the per-test count and added back as one allowance"
    - "expectations from an independent oracle: the fixture's source CSV re-read with a BigInt range scan in the test, never through the implementation's range table"
    - "a guard that scans the repository AND is self-tested against temporary offending content, so a weakened scan fails the suite"

key-files:
  created:
    - "tests/e2e/logins/login-scale.spec.ts"
    - "tests/unit/guards/phase6-guards.test.ts"
  modified:
    - "tests/e2e/guards/zero-network.spec.ts"
    - "tests/unit/guards/ci-budget.test.ts"
    - "tests/helpers/components.ts"
    - "playwright.config.ts"
    - ".github/workflows/ci.yml"
    - ".claude/skills/run-data-export-viewer/driver.mjs"
    - ".claude/skills/run-data-export-viewer/SKILL.md"
    - "README.md"
    - ".planning/ROADMAP.md"

key-decisions:
  - "The scale block's allowance is 13 s, an ESTIMATE (4.2 s measured for the file, times the guard's existing ~3x runner factor), deliberately not floored at the finance block's 90 s. The three limits rose by one minute each as the guard required."
  - "D-17's fixture cleanup was attempted and NOT applied: replacing the sample export's Logins.csv with a real-shaped WOT_Game_Sessions.csv breaks seven existing tests whose assertions are not count constants or file names. The invented file is kept."
  - "The README states that the CSP does not limit the one request to the city asset. The enforcement it names is the ESLint network ban with one exempt file and the Playwright request counting."

patterns-established:
  - "A single wording rule for the privacy claim: one sanctioned, opt-in, same-origin, main-thread request; the CSP is defence in depth only; the guarantee is the lint ban plus request assertions."

requirements-completed: [ACTIVITY-05, ACTIVITY-06, ACTIVITY-07]

coverage:
  - id: D1
    description: "A 12,000-row login export keeps the table windowed (at most 30 rows, aria-rowcount equal to listed addresses plus two), the whole page under a fixed element bound, every sort settled within 5 s with the oracle's extreme first and the Account record row pinned first, and the map within shapes plus tiny markers plus three"
    requirement: "ACTIVITY-05"
    verification:
      - kind: e2e
        ref: "tests/e2e/logins/login-scale.spec.ts (5 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Tiles, the country list, the shaded countries and the masked IPv6 text agree with an independent oracle on that fixture"
    requirement: "ACTIVITY-06"
    verification:
      - kind: e2e
        ref: "tests/e2e/logins/login-scale.spec.ts#the six tiles and the multi-file note agree with the oracle"
        status: pass
    human_judgment: false
  - id: D3
    description: "No request after the load baseline, no second worker and no CSP violation through every Phase 6 flow at 12,000 rows, with the city opt-in never pressed"
    requirement: "ACTIVITY-07"
    verification:
      - kind: e2e
        ref: "tests/e2e/guards/zero-network.spec.ts#no network request, no second worker and no CSP violation through every Phase 6 flow at 10,000 rows, with the city opt-in never pressed"
        status: pass
    human_judgment: false
  - id: D4
    description: "The CI e2e limits move together and the guard passes; the repository cannot gain a public IPv4 literal, motion or an inline style in the logins feature without a failing test"
    verification:
      - kind: unit
        ref: "tests/unit/guards/ci-budget.test.ts and tests/unit/guards/phase6-guards.test.ts (121 tests across tests/unit/guards)"
        status: pass
    human_judgment: false
  - id: D5
    description: "A real production build with no fixture seam and no city asset loads the real table in a real browser, reads the Login history as ready and the city opt-in as unavailable, and makes zero requests after the baseline"
    verification:
      - kind: other
        ref: "node .claude/skills/run-data-export-viewer/driver.mjs against pnpm run preview (output recorded below)"
        status: pass
    human_judgment: false
  - id: D6
    description: "How smooth scrolling and sorting feel on the user's device, and the visual impression of the sticky layers, the wrapped IPv6 cell and the map"
    verification: []
    human_judgment: true
    rationale: "A headless browser can bound the DOM, the settle time and the scroll positions but cannot feel smoothness; the plan declares these as backstop truths for the end-of-phase human check."

duration: resume only, not timed (the first executor's time is not recorded)
completed: 2026-10-04
status: complete
---

# Phase 6 Plan 14: Phase 6 closeout Summary

**A 12,000-row login export is proven in a real browser against an independent range-scan oracle (662 addresses over 23 countries, a windowed table, a map of at most 240 nodes), the zero-network contract holds through every Phase 6 flow, and the CI budget, the committed-address guard and the README's one-sanctioned-request wording are in place.**

## Performance

- **Duration:** not timed for this resume (verification, gap analysis, two comment and hand-off corrections, the SUMMARY); the dead executor's time is unknown
- **Completed:** 2026-10-04
- **Tasks:** 3 of 3 (Task 2's D-17 fixture cleanup deliberately not applied, see Deviations)
- **Files modified:** 11 plan files plus this SUMMARY (the plan listed 12; two of its test files are untouched on purpose)

## Resume note

The first executor for this plan died on an API rate limit after three commits. Nothing from it was trusted: each task and each `must_haves` truth was mapped to the diff, every gate was re-run from scratch, and the real-build driver run below was repeated rather than copied. The README edit it died during is complete and coherent (read in full; the new sections sit between the privacy verification section and Test fixtures, the intro and Usage paragraphs are amended to name the exception, and no existing section is damaged).

## What the three landed commits delivered, mapped to the plan

| Plan item | Delivered by | State |
|---|---|---|
| Task 1: `login-scale.spec.ts` (nine assertions) | f9c5f46 | Done. Five tests; every one of the plan's nine assertions is present. |
| Task 1: extended zero-network test | f9c5f46 | Done. Reuses the CSP-violation collector and request and worker counting; opt-in asserted `idle` before and after and `city-progress` absent. |
| Task 2.1: CI budget block, three limits together | 8f1145b | Done, and coherent (see below). |
| Task 2.2: `phase6-guards.test.ts` (scan, motion and style scan, self-tests, `listComponentFiles` lists logins) | 8f1145b | Done. `tests/helpers/components.ts` gained `features/logins`. |
| Task 2.3: D-17 fixture cleanup | nobody | Attempted by this resume, reverted, blocker recorded (below). `export-fixtures.ts` and `sample-export-shape.test.ts` are unchanged on purpose. |
| Task 3.1: driver logging and SKILL.md | 0458343 | Done; text, state and counts only; the reveal control is never pressed. |
| Task 3.2: real-build smoke | repeated here | Done (below). |
| Task 3.3: README | 0458343 | Done and honest (verified below). |
| Task 3.4: ROADMAP hand-offs | 0458343, corrected in 407ba34 | Done; one factual error fixed (below). |
| Task 3.5: whole gate | repeated here | Done (below). |

## Verification, with real numbers

| Gate | Result |
|---|---|
| `pnpm run test:unit` | 76 files, 2,290 tests passed |
| `pnpm exec vitest run tests/unit/guards` | 8 files, 121 tests passed |
| `pnpm run check` | `tsc -b` clean |
| `pnpm run lint` | Prettier clean, ESLint clean |
| `pnpm run build` (no fixture seam, no `public/geo-city-data`) | built; `ingest.worker-*.js` 4,705,166 B, `index-*.js` 336,545 B, `index-*.css` 40,911 B |
| `pnpm exec playwright test` (5 workers) | 234 passed, 80 s wall |
| `pnpm exec playwright test --workers=1` (the CI shape) | 234 passed, 299 s wall |

### Real-build driver run (no fixture seam, no city asset)

`dist/` holds exactly one worker chunk (4.7 MB, over the 2 MB the plan asked to confirm) and one main chunk, one stylesheet and `favicon.svg`; no other chunk and no `geo-city-data/` directory. The driver, against `pnpm run preview`:

```
login history state: "ready"
login tile addresses: "3"          login tile countries: "0"
login tile unknown country: "3"    login tile most-used (masked): "192.0.2.xxx"
login tile top country: "— no known country"
login tile range: "2024-01-01 to 2024-01-23"
login cells: 3 table rows, 0 shaded countries
city opt-in state: "unavailable"
requests after load: 0 (baseline 4)
```

The production country table loaded in a real browser (the block reached `ready` through the worker that inlines it, and every documentation address is reserved space, so all three read as unknown country and the map shows its no-country sentence). The city opt-in reads `unavailable` and no request was made.

## CI budget coherence (checked, not assumed)

- `playwright.config.ts`: `globalTimeout: 27 * 60 * 1000` (1,620 s).
- `.github/workflows/ci.yml`: wrapper `pnpm exec timeout 29m playwright test` (1,740 s = globalTimeout + 120 s, against the guard's 90 s minimum) and `timeout-minutes: 37` (wrapper + 8 min, against the guard's 300 s floor). Ordering holds: 27 < 29 < 37.
- `ci-budget.test.ts`: `LOGIN_SCALE_SPEC_TEST_COUNT = 5` (matches `playwright test --list`: 5 tests in 1 file, 234 in 22 files) and `LOGIN_SCALE_SPEC_SECONDS = 13`. The projection is `330 + 5 * (234 - 86 - 5 - 5 - 5) + 120 + 90 + 13 = 1,218 s`; 1.3 x 1,218 = 1,583.4 s <= 1,620 s. The guard passes.
- Every quoted limit states the true value: ci.yml lines 29 to 31 (wrapper 29 min, 29 + 5 = 34, job 37), lines 147 to 151 (globalTimeout 27 min, `29 min = 1620 + 120 s`, 234 tests project 1,218 s) and the `timeout 29m` line; the playwright.config.ts comment block and the guard's header arithmetic agree. The older "25 min" and "26 min" strings that remain are the dated history of earlier raises (05-16, 06-12), labelled as such.
- **Measured against projected.** The projection is conservative by a wide margin on this machine: the whole 234-test suite takes 299 s with one worker (about 1.28 s per test including a 2 s build) against 1,218 s projected. The login block costs about 2.6 s in its five tests plus the one import (the file measured 4.2 s end to end) and the new zero-network test 4.5 s. The 13 s allowance is an estimate on the self-hosted runner's ~3x factor; the first CI run replaces it. The 27-minute limit is therefore headroom against a slow runner, not a measured need.
- A comment fix landed in 1f76079: the spec and guard comments said the table lists 900 addresses; the fixture lists 662.

## Does the scale spec prove ROADMAP success criterion 4?

Yes, with one stated limit. Computed from the fixture builder and the same naive scan the spec uses: 12,000 rows, 662 listed addresses, **23 distinct countries**, 22 of them with a map shape (one of those is tiny), 18 unknown-country addresses. The spec itself asserts `>= 20` countries and a non-empty explicit unknown bucket, then checks every drawn country's `data-logins` and `data-ips` against the oracle, the ranked country list row by row, and that the list's logins plus the unknown bucket's equal every login counted. The map node bound is `235 + 2 * 1 + 3 = 240` and is asserted independent of rows (`nodes < rowCount / 10` as well); the whole page is under 4,500 elements (measured 3,274), a bound a window-less table (about 4,600 more) would break. The Phase 6 zero-network test additionally requires more than five shaded countries before it hovers.

The limit: the diversity comes from the committed fixture table cutting the three RFC 5737 /24s into /27 blocks of one country each. The real DB-IP table answers `ZZ` for every documentation address (06-CONTEXT D-17 option-a), so a documentation-address fixture can never shade a country against the shipped table. That table's behaviour stays covered structurally by `country-table-shipped.test.ts` and the driver run above, not by a 10,000-row browser run. The IPv6 addresses all fall in one fixture block, so they add rows and masking cases, not country diversity (the spec's own header says so).

## README honesty check

Read against the code: it describes ONE sanctioned request (the opt-in city file, `geo-city-data/<name>.citydb.bin`, same-origin, plain GET, main thread, from `src/lib/geo/city-fetch.ts`, user-initiated, nothing persisted, unavailable and no request on a build without the file); it calls `connect-src 'self'` defence in depth only; it states that a meta CSP does not govern a worker (measured) and cannot restrict a `'self'` source to a path, so it does not limit the request to the city file; and it names the real enforcement (the ESLint network ban over `src/lib/geo/` and `src/lib/worker/` with exactly one exempt file, the Playwright request counting across every flow, and the city specs asserting which asset was fetched). It does not claim the CSP restricts the request to the city asset. `grep -rnE '\bfetch\(' src` returns exactly one call site, `src/lib/geo/city-fetch.ts:144`, and nothing under `src/lib/worker`.

Two README facts are stale and were not touched because the plan says not to alter the existing counts (see Open for the phase owner).

## Deviations from Plan

### 1. [Plan item not applied] D-17 fixture cleanup (Task 2.3)

Attempted: replaced `Activity_history/Logins.csv` in `sampleEntries` and in `SCALE_ROW_TEMPLATES` with a real-shaped `WOT_Game_Sessions.csv` (header `STARTED_AT;FINISHED_AT;IP`, `01.06.2020 12:00;01.06.2020 13:30;192.0.2.30`, CRLF), and updated the one file-name assertion in `sample-export-shape.test.ts`. Result: 7 failures in 3 files, none of them count constants or file-name assertions, so the plan's stated limit says to revert, which was done (`git checkout` of both files; no residue).

The assertions that forbid it:
- `tests/unit/import/ingest-worker.test.ts`: "the All slice is exact: 3 usable, 2 excluded, 10800 merged seconds, two start days"; "the meta record carries the aggregate at PLAYTIME_VERSION and never the IP (T-04-01)"; "resolves query(null) with the All slice over the real worker". They hold hand-derived playtime totals (10,800 s) over the sample; a session file adds a session and changes every derived number, which is an oracle change and not a count change.
- `tests/unit/import/logins-sources.test.ts`: "answers `ready` for an export holding ONLY a Logins.csv", "the IP column is the only User_Info column the aggregator reads", "an unreadable Account address is a fact, not text, and changes no total".
- `tests/unit/import/logins-backfill.test.ts`: "answers the import-time view exactly for a Logins.csv-only export".

The four Logins.csv-named tests fail because they depend on the invented `Logins.csv` being the sample's second Activity_history file (the 06-05 merge decision, D-01, reads exactly that shape), and the three playtime tests because the sample's session content is their hand-derived oracle. I did not dig into each test's exact coupling beyond seeing it fail. Left kept, with this reason, as the plan requires. A future plan could do it by rewriting those seven tests' expectations from their oracles; that is a test rewrite, not a fixture swap.

### 2. [Rule 1 - Bug] The Phase 7 hand-off quoted the research estimate as a measurement

- **Found during:** verification of Task 3.4
- **Issue:** the ROADMAP hand-off (d) said the city file is "42.8 MB raw". 06-09 measured 50,130,477 B raw and 11,877,710 B gzipped; 42.8 MB was the 06-RESEARCH estimate against an interleaved layout.
- **Fix:** scoped `Edit` of that one clause. The 120 MB peak figure is kept and now says it was estimated against the 42.8 MB container.
- **Files modified:** `.planning/ROADMAP.md` (407ba34)

### 3. [Rule 1 - Bug] Stale row count in comments

- **Issue:** the scale spec and the guard said the table lists 900 addresses and an unwindowed table would add some 6,000 elements; the fixture lists 662 (about 4,600).
- **Fix:** comments only; no bound or assertion changed (1f76079).

### 4. Process note

My first full Playwright run overlapped a second one I started by mistake (both use port 4173 and `dist/`), which produced one spurious failure in the Phase 5 zero-network test. I killed both, freed the port and re-ran once cleanly; every number above is from the clean runs. No test was modified in response.

No auth gates, no package installs, no checkpoints were reached. `.planning/WINDOWS.md` was not touched (rows 8-9 are corrupt, so `windows append` would fail); the deviations are recorded here.

## Known Stubs

None. No placeholder text or empty-data wiring in any file this plan touched.

## Threat Flags

None. The plan adds tests, guards, CI limits, documentation and a driver; no new endpoint, auth path or file access surface. T-06-55 (real addresses) is mitigated by the scan and its self-tests, T-06-56 by the extended zero-network test, T-06-57 by the coherent limits and the guard, T-06-58 by the driver logging text and counts only.

## Open for the phase owner

Found and deliberately not fixed (outside this plan's files):

1. **`.planning/REQUIREMENTS.md` ACTIVITY-06 says "bundled by default (small: ~1-2MB)".** Measured: the country table is 3,403,572 B raw (about 725 KB gzipped), and with it inlined the worker chunk is 4.7 MB. The requirement text is stale on size.
2. **AGENTS.md** stale rows named at dispatch (the CSP row still saying `connect-src 'none'`, and `@ip-location-db/dbip-country` as the chosen input in Recommended Stack, Alternatives Considered and What NOT To Use) have already been corrected by the orchestrator's commits b579e95 and da77bff during this resume; I confirmed the CSP row now says `connect-src 'self'` and explains why. Nothing remains open there.
3. **README "Verifying the privacy guarantee" block quotes "337 unit tests" and "86 e2e tests"**; the suite now runs 2,290 and 234. The plan said not to alter the existing counts, so they were left; they should be updated in whichever plan or housekeeping change next touches the README.
4. **City-container cap margin is thinner than planned** (06-09): `MAX_CITY_TABLE_BYTES` (96 MB) is about 1.9x the measured 50.1 MB container, not the 2.2x the estimate implied. Phase 7 should not assume more margin; the hand-off in the ROADMAP now carries the correct measured size.
5. **The CI budget's 13 s scale allowance is an estimate**; the first CI run should replace it with a measurement. The one-worker local run suggests all three limits have wide headroom.
6. **D-17's fixture swap** (Deviation 1) remains open as a deliberate test rewrite if the owner still wants the sample export free of the invented `Logins.csv`.

## Self-Check: PASSED

- `tests/e2e/logins/login-scale.spec.ts`, `tests/unit/guards/phase6-guards.test.ts`, `.planning/phases/06-login-ip-history-offline-geolocation/06-14-SUMMARY.md`: present.
- Commits f9c5f46, 8f1145b, 0458343, 1f76079, 407ba34: present on `gsd/phase-06-login-ip-history-offline-geolocation`.
- `git status --short`: clean before this file was written; the D-17 experiment left no residue.
