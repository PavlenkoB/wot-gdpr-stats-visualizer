---
phase: 13-overview-personal-insights
plan: 03
subsystem: testing
tags: [vitest, fixtures, oracle, synthetic-data, canary, worker-round-trip, phase-13]

requires:
  - phase: 13-overview-personal-insights
    provides: "plan 13-01's overview view contract and plan 13-02's key-free vehicle lookup"
  - phase: 05-player-statistics
    provides: "renderStatsCsv, STATS_NAME_CANARY and the WOT_MAIN_HEADER quoting rule"
  - phase: 05-finance
    provides: "CURRENCY_OPS_HEADER, ORDERS_HEADER_12, renderQuoteAllCsv and FINANCE_CANARIES"
provides:
  - "buildOverviewInsightExport() — one synthetic two-account export whose every Overview figure is hand-derivable"
  - "The absence matrix: seven omit options, each removing exactly one source"
  - "OV_SYNTHETIC_TABLE and the `tanks: 'known'` option — the synthetic and the real-looking tank worlds"
  - "OV_CANARIES — the shared contract of every string that must never reach a reply or a page"
  - "OV_EXPECTED — the hand-derived answer key, in a module that imports nothing at all"
  - "The fixture test: shape per option, a real-worker import per option, the oracle's self-consistency and the canaries at rest"
affects: [13-07, 13-08, 13-11, 13-12, 13-14, overview, validation, privacy]

actuals:
  tokens: 17752
  tasks: 2
  commits: 2
plan_head_before: b721abe6cf9e1a00c7be336299a6754990f5ffae
plan_head_after: f2d06d6d099d0e2c5d5856bd9c420511f1b5197a

tech-stack:
  added: []
  patterns:
    - "One archive, one answer key: the fixture builds every source and the oracle states every figure, and neither can reach the other's code"
    - "An absence is reached by REMOVING one source from the default archive, never by a second hand-written archive that could drift"
    - "A canary set that distinguishes at-rest absence from at-rest presence: a known-deferred category stores nothing, a stored category stores raw, and the two need different downstream assertions"

key-files:
  created:
    - tests/fixtures/overview-fixtures.ts
    - tests/helpers/overview-oracle.ts
    - tests/unit/overview/overview-fixtures.test.ts
  modified:
    - tests/fixtures/README.md

key-decisions:
  - "The absent-state matrix lives inside OV_EXPECTED.absent rather than in a second export, so the answer key is ONE object a later plan imports."
  - "The 'need' strings are named here for the first time: 'session-history', 'wot-session-history', 'account-statistics', 'vehicle-statistics', 'currency' and 'orders' — the source a tile reads — plus the four column names for the record-columns option."
  - "One e-mail canary serves BOTH account roots. The plan names a single OV_EMAIL_CANARY, and a second literal would need a second exported constant that the artifact list does not have."
  - "The account-statistics and vehicle-statistics files are rendered with renderStatsCsv (quote-all cells, bare CR) and the currency and Orders files with renderQuoteAllCsv, so the fixture reuses the existing renderers rather than writing a second pair."
  - "Root A's session files are CRLF and root B's is a bare CR, because the real archive mixes the two and a fixture that normalised them would stop proving the importer reads both."

patterns-established:
  - "An answer key that imports NOTHING is the only kind that can catch a wrong fixture: the fixture may know about the oracle, never the reverse."
  - "A hand-counted day number is cross-checked against Date.UTC by the test, so the two routes to the same fact must agree before any aggregator is written."
  - "The canary contract is stated as AT REST (absent or present, with the rule that decides it) and DOWNSTREAM (absent from a reply, a view and the DOM), so a later plan knows which assertion belongs where."

requirements-completed: [INSIGHT-02, INSIGHT-07]

coverage:
  - id: D1
    description: "The synthetic two-account archive exists, every value in it is invented, and each of the seven omit options removes exactly the one source it names."
    requirement: INSIGHT-02
    verification:
      - kind: unit
        ref: tests/unit/overview/overview-fixtures.test.ts#the Overview fixture archive
        status: pass
    human_judgment: false
  - id: D2
    description: "The archive imports through the real ingest worker and finishes done — for the default build, for every omit option and for the known tags."
    requirement: INSIGHT-02
    verification:
      - kind: integration
        ref: tests/unit/overview/overview-fixtures.test.ts#the Overview fixture through the real worker
        status: pass
    human_judgment: false
  - id: D3
    description: "OV_EXPECTED states every Overview figure of the default archive with the arithmetic beside it, in a module that imports nothing, and agrees with itself and with Date.UTC."
    requirement: INSIGHT-02
    verification:
      - kind: unit
        ref: tests/unit/overview/overview-fixtures.test.ts#the Overview answer key
        status: pass
    human_judgment: false
  - id: D4
    description: "The chat line, the clan name and the e-mail are absent from every stored row, while the order amount, the finance canaries and the nickname are present at rest because those categories are stored raw."
    requirement: INSIGHT-07
    verification:
      - kind: integration
        ref: tests/unit/overview/overview-fixtures.test.ts#the Overview fixture at rest
        status: pass
    human_judgment: false
  - id: D5
    description: "No real account id, name, path or value is committed, and the shared sample export is untouched."
    requirement: INSIGHT-07
    verification:
      - kind: unit
        ref: tests/unit/guards/no-real-data.test.ts
        status: pass
      - kind: unit
        ref: tests/unit/guards/sample-export-shape.test.ts
        status: pass
    human_judgment: false

# Metrics
duration: 16min
completed: 2026-10-23
status: complete
---

# Phase 13 Plan 03: The synthetic Overview archive and its hand-derived answer key

**One invented two-account export whose every tile is derivable by arithmetic, seven one-source omissions that reach every absent state, and a zero-import answer key that a wrong aggregator and a wrong fixture cannot agree on.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-10-23T06:29:00Z
- **Completed:** 2026-10-23T06:45:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- `buildOverviewInsightExport()` builds one synthetic two-account export in which every Overview figure is hand-derivable: the WoT union is **51,900 s**, the all-games union **53,700 s**, the longest streak **3 days**, the busiest day **21,600 s**, the longest session **15,000 s**, the signature hour **21:00**, the battles **1,500** with **780** wins, the credits in flow **12,000,000** and **3** orders.
- The archive carries the real shapes rather than convenient ones: sessions in both real timestamp formats (`DD.MM.YYYY HH:MM` and `YYYY-MM-DD HH:MM:SS.000`) and both real line terminators (CRLF and a bare CR), the account statistics quoted the way the export quotes them, and the `\N` marker in the place the export writes it.
- The damage record (**6,100**) is held by the SECOND account and the kills record names vehicle id `0`, so a "sum" rule and a "maximum" rule cannot both be right, and the "vehicle not recorded" path is exercised by the default archive rather than only by an option.
- Seven omit options — `sessions`, `wot-sessions`, `account-statistics`, `vehicle-statistics`, `currency`, `orders`, `record-columns` — each remove exactly ONE source, so every absent state the Overview has to render is reachable from the same builder. `record-columns` is the interesting one: the file STAYS and its header shrinks, which is a different absence from a missing file.
- `tanks: 'known'` swaps the three invented tank tags for the real-looking ones the existing vehicle fixture already uses and leaves every other figure alone, so a later plan can prove table resolution against the committed table without changing anything else.
- `OV_CANARIES` is the shared contract of the six planted sensitive values, and the fixture test proves which of them are absent at rest (the chat line, the clan name, the e-mail) and which are PRESENT at rest (the order amount, the finance canaries, the nickname) — because those categories are stored raw. A later plan therefore knows to assert their absence DOWNSTREAM, not at rest.
- `tests/helpers/overview-oracle.ts` imports nothing at all and states every figure with the arithmetic beside it; the three hand-counted day numbers are cross-checked against `Date.UTC`, a completely different route to the same facts.

## Task Commits

Each task was committed atomically:

1. **Task 1: The synthetic two-account archive with options and planted sensitive values** - `9ca8835` (feat)
2. **Task 2: The hand-derived oracle and the fixture proofs** - `f2d06d6` (test)

## Files Created/Modified

- `tests/fixtures/overview-fixtures.ts` - The archive builder. `OV_ROOT_A`/`OV_ROOT_B`, `OV_TAGS`, `OV_KNOWN_TAGS`, `OV_IDS`, `OV_SYNTHETIC_TABLE`, the four `OV_*` canaries, `OV_CANARIES`, `OverviewOmit`, `OverviewFixtureOptions` and `buildOverviewInsightExport()`. Imports the shared pinned `zipSync` and the two existing renderers, and nothing from `src/`.
- `tests/helpers/overview-oracle.ts` - `OV_EXPECTED`, the answer key, with `OvExpected` and its sub-shapes as explicit interfaces. Imports nothing.
- `tests/unit/overview/overview-fixtures.test.ts` - The five proof groups: shape per option, a real-worker import per option, the oracle's self-consistency, the canaries at rest, and the independence of the fixture and the key.
- `tests/fixtures/README.md` - A new section describing the archive, its options, the invented values, the canary table and the answer key.

## Decisions Made

- **The absent-state matrix lives inside `OV_EXPECTED.absent`.** The plan asks for "the tiles that become absent and their needs/columns" to be exported per omit option; putting them in the one answer key means a later plan imports ONE object rather than two, and the absent state cannot drift away from the figures it is absent for.
- **The `need` strings are named here for the first time.** The plan gives `session-history` for the session option and leaves the rest to the executor, so this plan names them: `session-history`, `wot-session-history`, `account-statistics`, `vehicle-statistics`, `currency` and `orders` — each the source a tile reads — plus the four column names (`DAMAGE_MAX`, `XP_MAX`, `FRAGS_MAX`, `SNIPER_SERIES_MAX`) for the option that drops columns rather than a file. The `droppedColumns` list carries the full eight the fixture actually drops.
- **One e-mail canary serves both roots.** The plan names a single `OV_EMAIL_CANARY` and its artifact list has one e-mail constant; a second literal would need a second export, and the point of a canary is to be greppable. The canary is proven absent at rest for BOTH roots by the same assertion.
- **`IN_GARAGE` is 1 on the garage row only.** The plan fixes that row's `IN_GARAGE` and says nothing about the others, so exactly one row carries it and "in the garage with no battles" has one shape in the archive and can be counted.
- **The fixture reuses the existing renderers.** `renderStatsCsv` writes the two Player_statistics files (quote-all cells, bare CR) and `renderQuoteAllCsv` writes the currency and Orders files, so no second pair of renderers exists and the physical format matches what the other fixtures already teach the parser.

## Deviations from Plan

**1. [Rule 1 - Bug] The two phase-level requirements are NOT marked complete in `REQUIREMENTS.md`**
- **Found during:** the state-update step at the end of the plan
- **Issue:** The plan's frontmatter names `requirements: [INSIGHT-02, INSIGHT-07]`, and the mechanical instruction is to mark them complete. Both are PHASE-level requirements that this plan does not satisfy: INSIGHT-02 is the insight MODEL (plans 13-07 and 13-08 build it) and INSIGHT-07 is the absence of sensitive values ON THE PAGE plus the zero-network assertion (plans 13-12 and 13-14 write it). This plan supplies the fixture and the answer key those requirements will be TESTED against, and nothing else. Running `requirements mark-complete` ticked both boxes and flipped the traceability table to `Complete`, which tells any auditor that the model exists and the privacy assertion runs.
- **Fix:** `REQUIREMENTS.md` is left untouched — both requirements stay `Pending`, as they were before this plan. The SUMMARY frontmatter still mirrors the plan's own `requirements` field, which is what plans 13-01 and 13-02 did, so the phase's own convention is unchanged. The requirement becomes checkable when the plan that IMPLEMENTS it runs.
- **Files modified:** none (`REQUIREMENTS.md` was reverted)
- **Verification:** `git diff .planning/REQUIREMENTS.md` is empty; both rows still read `Pending`.
- **Committed in:** the plan metadata commit

Two points where the plan left a choice open are recorded above as decisions rather than as deviations: the shape of `OV_EXPECTED` (the plan fixes the figures, not the object layout) and the `need` strings for the five omit options whose need it does not name.

**One calibration note, not a deviation:** the plan's estimate was 60,000 tokens at low confidence; the realised diff is 71,007 characters, or about **17,750 tokens** on the plan's own scale (chars/4). The plan over-budgeted this deliverable by roughly three times.

---
**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The single deviation corrects the state-update step rather than the plan's code: the deliverable is untouched, and the requirement tracker now says what is true — the insight model and the page-level privacy assertion are still to be built.

## Issues Encountered

None. The archive built as specified on the first run and every acceptance criterion passed on the first execution.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 13-07, 13-08 and 13-11 have their answer key: `OV_EXPECTED` states every figure of the default archive, and `OV_EXPECTED.absent` states the tile set that disappears under each omit option. The tile ids in use are `logged`, `hour`, `streak`, `sess`, `busy`, `dmg`, `xp`, `kills`, `snip`, `bat`, `tank`, `cls`, `fleet`, `nat`, `cred` and `ord` — a later plan that needs a different id renames it HERE, once.
- The `tanks: 'known'` build is ready for the plan that drives the archive through the committed table. Until 13-15 fills that table, the known tags resolve to nothing, which is the D-09 fallback path — and the synthetic build is the one that resolves.
- The canary contract is settled: the chat line, the clan name and the e-mail are absent at rest, so only the order amount, the finance canaries and the nickname need a downstream assertion (a worker reply, a view, the DOM).

## Self-Check: PASSED

- All three created files exist on disk, and both task commits (`9ca8835`, `f2d06d6`) are ancestors of HEAD.
- Every acceptance criterion re-run: `pnpm exec vitest run tests/unit/overview/overview-fixtures.test.ts` (23 passed), `pnpm exec vitest run tests/unit/guards/no-real-data.test.ts tests/unit/guards/sample-export-shape.test.ts` (18 passed), `pnpm exec vitest run tests/unit/overview tests/unit/guards/no-real-data.test.ts tests/unit/guards/sample-export-shape.test.ts` (116 passed), `pnpm run check` (0 errors, 0 warnings), `pnpm run lint` (0 problems) and the full `pnpm run test:unit` (141 files, 4274 passed, 9 expected fail).
- `git diff --stat b721abe..HEAD` touches four files, all under `tests/`, and deletes nothing.
- `actuals.commits: 2` is MEASURED from the plan ledger (`b721abe..f2d06d6`), not narrated: two task commits, plus this plan's own metadata commit.

---
*Phase: 13-overview-personal-insights*
*Completed: 2026-10-23*
