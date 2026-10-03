# Test fixtures

fixture=synthetic

All committed test zips used by the e2e suite are generated **in memory** by
`tests/fixtures/export-fixtures.ts` via `fflate.zipSync`. The synthetic zips
mirror the real Wargaming export's folder and column structure (verified against
the real 2021 sample described in `.planning/PROJECT.md`), but every value is
fabricated:

- Account ID: `123456789`
- Email / `LOGIN` field: `*.example.invalid` (RFC 6761 reserved TLD)
- IP addresses: `192.0.2.0/24` (TEST-NET-1, RFC 5737)

Real Wargaming exports must never be committed. If you need to test against a
real sample, place it under `tests/fixtures/private/` (gitignored) or anywhere
outside this repository.

## Policy

1. No real export binary may be committed.
2. The committed fixture set must always be regeneratable from
   `tests/fixtures/export-fixtures.ts` (it is the source of truth).
3. `tests/fixtures/private/` is reserved for local-only real samples and is
   gitignored at the repository root.
4. A root-level `*.zip` is also gitignored: a real export dropped at the repo
   root must never be staged.

## Phase 5 data modules

Since 05-06 the shared sample's three Phase 5 folders are not assembled from
literals in `export-fixtures.ts`. They are written by the modules that own the
data, and `export-fixtures.ts` imports them:

- `tests/fixtures/finance-fixtures.ts` — the three real 2021 header lists
  (premium operations 4 columns, virtual-currency operations 6, Orders 12) and
  the three hand fixtures with hand-derived answer keys. The sample takes
  `PREMIUM_HAND_CSV`, `CURRENCY_HAND_CSV` and `ORDERS_HAND_CSV`. Since 05-18 the
  premium rows carry the real export's column semantics: `CURR_PREMIUM` holds
  the premium operation's datetime and `CREATED` and `UPDATED` both hold one
  shared bulk-migration stamp, `PREMIUM_BULK_STAMP` (invented; month 24,197,
  outside every grant month). Every premium row is built through `premiumRow`,
  so "no row is dated by its own `CREATED`" holds by construction, and
  `PREMIUM_REAL_SHAPE_ROWS` / `_CSV` / `_EXPECTED` add a seven-row real-shaped
  set. As everywhere in this directory, every date, duration and amount is
  fabricated: no value from a real export is committed.
- `tests/fixtures/player-stats-fixtures.ts` — the nineteen real-named,
  real-column `Player_statistics` files for four titles, `STATS_NAME_CANARY`
  and the hand-derived answer key. The sample takes
  `PLAYER_STATS_SAMPLE_FILES`.
- `tests/helpers/finance-oracle.ts` and `tests/helpers/vehicle-oracle.ts` —
  the independent oracles from 05-01 and 05-02. They import nothing at all,
  which is what makes them oracles rather than a second copy of the code
  under test. The sample does not use them; the answer keys do.

### The leaf-module rule

**A data module never imports the shared sample builder.** That is what lets
`export-fixtures.ts` import the data modules safely.

The rule exists because the alternative fails at RUNTIME, not at compile
time. `finance-fixtures.ts` and `player-stats-fixtures.ts` each import
`mulberry32` from `sessions-fixtures.ts`, which needs the account-root folder
name — and that name now lives in the leaf `tests/fixtures/sample-account.ts`
precisely so `sessions-fixtures.ts` does not have to reach back into
`export-fixtures.ts` for it. Without the leaf, importing `export-fixtures.ts`
from a data module closes a cycle, and when a test file imports the data
module first, the builder's module BODY reads exports that are not initialised
yet:

```
export-fixtures → finance-fixtures → sessions-fixtures → export-fixtures
```

`05-03` hit exactly this and worked around it by transcribing the two finance
headers by hand, with a lockstep test to hold the copy honest. `05-06`
imports the real constants instead and deletes the transcription.

### Physical format, and why the sample mixes terminators

The three Phase 5 folders use the export's payments-era format exactly:
an **unquoted header line**, **quote-all data cells**, and a **bare CR**
terminator with no line feed anywhere in the file. Every other sample file
keeps its **CRLF** style. That mix is deliberate and matches the real archive
— Phase 2's parser has to handle both, and a sample that normalised them
would stop testing that.

Nothing else catches a regression here: PapaParse accepts CR, LF and CRLF
alike, so re-wrapping these files in CRLF leaves every count, every ingest
assertion and every e2e spec green while the sample quietly stops being the
real format. `tests/unit/guards/sample-export-shape.test.ts` pins the bytes and is
the only thing standing between that edit and a passing suite.

### The NAME canary

Every `*_Account_Statistics.csv` in the sample carries `STATS_NAME_CANARY`
(`CANARY-ACCOUNT-NAME-9f3`) in its `NAME` column, and no other file does. It
is a distinctive literal rather than anything resembling a real nickname, so
a leak is assertable by value: a later test can assert the string never
reaches a worker message, a DOM attribute, a tooltip or the page text outside
the identity header.

### Order ids and canary cells in Orders.csv

Every order row carries the literal **all-zero** UUID
(`00000000-0000-0000-0000-000000000000`) and the `FINANCE_CANARIES` literals
in its coupon, aggregator and package cells. A real coupon name, aggregator
description, package list or order id is a personal identifier, and the
all-zero pattern is what makes "this is fabricated" checkable rather than
merely asserted.

### Custom Phase 5 exports

There is no bespoke builder for a Phase 5 shape. `buildCustomExport` already
omits folders and overlays individual files by root-relative path, which
covers every case a new builder would:

```ts
buildCustomExport({ omitFolders: ['Financial_data'] });
buildCustomExport({ overrides: { 'Payment_history/Orders.csv': headerOnlyCsv } });
```

Adding a `buildRealShapeFinanceExport()` would duplicate the sample's
other twenty-eight files and put a second copy of the layout to keep in sync.
