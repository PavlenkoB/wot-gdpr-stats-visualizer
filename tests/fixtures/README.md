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

## Device_info data module

Since quick task 261012-bog the sample's `Device_info` folder is written by
`tests/fixtures/device-info-fixtures.ts`, and `export-fixtures.ts` imports it in
place of the old invented `Devices.csv` (which survives only in the 10x scale
export's templates, so that export and its answer key are unchanged).

- **Three real-named files**: `WOT_Device_Info.csv` (PC hardware, ten columns),
  `WOTB_Device_Info.csv` (Blitz devices, eight) and
  `WOT_Assistant_Device_Info.csv` (one `POST` column of JSON-like blobs). They
  are written with `renderQuoteAllCsv`, so they have the export's own physical
  shape: bare header, quote-all cells, bare-CR terminator.
- **Two renderings of the Assistant file**: LF inside the quoted cells with a
  bare-CR record terminator (the parser's mixed-terminator path, and the one the
  sample carries) and every inner LF replaced by CR (the uniform bare-CR path).
- **Every value is fabricated**: `Synth`-prefixed strings and unmistakable
  synthetic numbers, never a value from a real export.
- **Eight blobs, four readable**: each blob carries its derivation in a comment,
  and the expected fields are stated beside it (a pretty multi-line blob, a
  single-line one, a trailing comma that makes `JSON.parse` fail, a numeric
  `Version`; then an object with none of the four keys, plain text, an all-`N/D`
  blob and a `__proto__` blob).
- **Two canaries**: `DEVICE_SPA_CANARY` stands for the account id the blob
  carries and `DEVICE_FLAGS_CANARY` for the opaque flags value. Both are
  confined to the Assistant file (a guard test pins that), so a leak into a
  stored row, a posted view or the DOM is assertable by value.
- **Counts are derived**: `DEVICE_INFO_COUNTS` is computed from the row arrays,
  and `SAMPLE_FILE_COUNTS.Device_info` and `SAMPLE_ROW_COUNTS.Device_info` read
  it, so a fixture edit cannot leave a stale count behind.

## The Overview insight fixture (phase 13, plan 13-03)

`tests/fixtures/overview-fixtures.ts` owns ONE synthetic two-account export that
the Overview's tests assert against, and `tests/helpers/overview-oracle.ts` owns
the answer key for it.

### Every value is invented

Nothing in this archive came from a real export, and nothing in it was
anonymised either — nothing real was ever read. The two account roots are
made-up ids (`1234567` and `2345678`); the tank tags are `Synth`-prefixed
inventions; the e-mail is on an RFC 2606 reserved domain
(`ov.player@example.invalid`); the order id is the all-zero uuid the finance
fixture already uses. The no-real-data guard re-runs against this archive like
against every other fixture in this directory.

### The archive

Two account roots, each with an identity file, a session file, an
account-statistics file, a vehicle-statistics file, a currency-operations file
and an Orders file. Root A additionally carries one Blitz session file and the
two known-deferred folders (a chat file and a clan file), so the archive holds
both the WoT-only and the all-games worlds.

The figures are hand-designed so that EVERY tile is derivable by arithmetic:

- the two accounts' WoT sessions merge to **51,900 s**, and one root B session
  overlaps a root A session by thirty minutes, so the union is not the sum;
- adding the Blitz session brings the all-games union to **53,700 s**;
- the two accounts report **1,500** battles, **780** wins, **1,123,200 s** in
  battle and **12,000,000** credits in flow;
- the damage record (**6,100**) is held by the SECOND account, so a "sum" rule
  and a "maximum" rule cannot both be right;
- one tank's record id is `0` and another record's is a tank no table carries,
  so the "vehicle not recorded" path is exercised by the default archive.

The archive deliberately mixes the two real timestamp shapes (`DD.MM.YYYY HH:MM`
and `YYYY-MM-DD HH:MM:SS.fff`) and the two real line terminators (CRLF and a
bare CR).

### The options are the absence matrix

`buildOverviewInsightExport({ omit: [...] })` removes EXACTLY ONE source per
option — `sessions`, `wot-sessions`, `account-statistics`,
`vehicle-statistics`, `currency`, `orders`, `record-columns` — so every absent
state the Overview has to render is reachable from the same builder instead of
from a second hand-written archive that could drift. `record-columns` is the
odd one: the file STAYS and its header shrinks, which is a different absence
from a missing file.

`buildOverviewInsightExport({ tanks: 'known' })` swaps the invented tank tags
for the real-looking ones the existing vehicle fixture already uses and leaves
every other figure alone, so a later plan can prove table resolution against
the committed table without changing anything else.

### The canaries it plants

`OV_CANARIES` is the single list of every string in this archive that must
never reach a worker reply or a page:

| Canary | Where it lives | At rest? |
| --- | --- | --- |
| `OV_CHAT_CANARY` | `Chat_history/Messages.csv` | **no** — known-deferred, counted and never stored |
| `OV_CLAN_CANARY` | `Clans/Clan_membership.csv` | **no** — known-deferred, counted and never stored |
| `OV_EMAIL_CANARY` | the `LOGIN` cell of both `Account_Info.csv` files | **no** — stripped before the row is written |
| `OV_NAME_CANARY` | the `NAME` cell of both account-statistics files | **yes** — that category is stored raw |
| `OV_FINANCE_CANARIES` | the coupon, aggregator, package and order-id cells of every order row | **yes** — stored raw |
| `OV_ORDER_AMOUNT_CANARY` | the amount cell of every order row | **yes** — stored raw |

That asymmetry is the point. The three that are absent at rest are absent
because a rule removes them (a known-deferred category stores nothing; `LOGIN`
is on the deny-list), and the three that ARE at rest are there because those
categories are stored raw. A later plan therefore asserts the latter's absence
DOWNSTREAM — in a worker reply, in a view, in the DOM — and not at rest.

### The answer key

`tests/helpers/overview-oracle.ts` imports NOTHING: not `src/`, not the fixture
module, not a date library. Every figure is stated with the arithmetic that
produces it in the comment beside it, and the three day numbers are HAND-COUNTED
from the epoch and then cross-checked against `Date.UTC`, which is a different
route to the same three facts. The direction of the independence is one-way on
purpose: the oracle imports nothing, and the fixture does not have to know it
exists.

