# Pitfalls Research

**Domain:** Browser-only, zero-backend viewer for a personal GDPR data export (Wargaming account data: activity/session history, per-vehicle stats, financial/currency history, login-IP history)
**Researched:** 2026-09-27
**Confidence:** MEDIUM (web-search triangulated on general patterns; project-specific reasoning applied on top — see per-pitfall notes for LOW-confidence items)

**Scope note:** This file intentionally excludes pitfalls already documented in `.planning/PROJECT.md` — bare-CR/CRLF CSV line-ending handling, double-UTF8 mojibake, JSZip-vs-fflate main-thread blocking, GitHub Pages refresh-404, MaxMind GeoLite2 licensing traps, Dexie/Safari IndexedDB quirks, schema-drift-tolerant parsing, and the "detected but unsupported category" UI treatment. Everything below is net-new, focused on: (a) displaying sensitive personal fields (email, precise login IPs) respectfully even in a 100%-local tool, (b) multi-currency financial summaries (USD/RUB/UAH in one account's real history), (c) client-side big-CSV-parse-then-IndexedDB-cache tooling mistakes, and (d) hand-rolled SVG stat/heatmap dashboards.

**Scope-timing note:** Per the milestone context, the email field and "precise" login IPs live in `User_Info`, and multi-currency real-money data lives in `Payment_history` — both currently listed in PROJECT.md's "Out of Scope" for v1 (only `Activity_history`'s country-level IP table and `Financial_data`'s virtual-currency/premium-time timelines are in v1). The pitfalls below are written to apply directly to what's *already* in v1 scope (IP-history table, virtual-currency timelines) and to transfer cleanly if/when `User_Info` and `Payment_history` are pulled into scope in a later milestone — flagged inline where the distinction matters.

---

## Critical Pitfalls

### Pitfall 1: Plaintext-by-default PII creates a false sense of total safety

**What goes wrong:**
The product's entire pitch is "your data never leaves your machine," which is true at the network layer — but the team ships the login-IP table (and, if `User_Info` is later added, the account email) rendered as plain, always-visible text on screen. Users then screenshot the dashboard to share a cool heatmap, screen-share it during a stream/call, or leave it open on a shared/work machine, leaking IP addresses (and later, email) through a channel the "zero network requests" guarantee never covered.

**Why it happens:**
The team's threat model is scoped entirely to "does this app phone home," so anything that stays client-side gets treated as automatically safe. Screen-based leakage (screenshots, screen recording, shoulder-surfing, shared devices) isn't a network-layer concern, so it's easy to never even ask the question.

**How to avoid:**
Mask sensitive fields (IP octets, email local-part) by default with a reveal-on-click/hover affordance, the same pattern used for card numbers or API keys elsewhere on the web. Reserve full plaintext for the moment the user actively chooses to look, not the default render.

**Warning signs:**
Any component that renders an IP address or email as a bare `{value}` interpolation with no masking state; no design discussion of "what if this is screenshotted."

**Phase to address:**
The Activity_history / login-IP table phase (and any future User_Info phase). Verify with a UI review checklist item, not just a functional test.

**Confidence:** MEDIUM — general PII-masking UX pattern is well established; the screenshot/screen-share framing is project-specific reasoning, not directly sourced.

---

### Pitfall 2: IndexedDB-cached PII has no lifecycle story on shared/multi-user machines

**What goes wrong:**
The app caches the fully parsed export (including IP history, and later financial/email data) in IndexedDB so re-upload isn't needed. IndexedDB has no built-in encryption — everything sits in plaintext on disk, readable by any XSS payload, any browser extension with broad site-data permissions, or anyone else who later uses the same OS user account and browser profile (a shared family computer, a work laptop, a library kiosk). There's no shipped affordance to wipe it, so "I'm done looking, let me leave this borrowed computer clean" isn't actually possible.

**Why it happens:**
`bulkPut` + `navigator.storage.persist()` were chosen for *durability* (don't lose the parsed data, resist eviction) without a paired *deletability* story. The team's decision log treats persistence as unambiguously good, but for this specific dataset (login IPs, eventually email/payment history), persistence cuts both ways.

**How to avoid:**
Ship an explicit, obvious "Clear my data" control that deletes the IndexedDB database (and confirms it did) as a first-class piece of UI, not a dev-console workaround. Document in-app that the data persists on this device/browser profile until cleared — set the expectation rather than let users assume "closing the tab" is equivalent to deleting.

**Warning signs:**
No UI element anywhere that calls `indexedDB.deleteDatabase` or equivalent Dexie method; the only way to clear data today is browser devtools or clearing all site data (which most users don't know how to scope to just one site).

**Phase to address:**
The IndexedDB-caching phase — pair the "cache for convenience" feature with a "delete for privacy" feature in the same phase, not as an afterthought.

**Confidence:** MEDIUM — "IndexedDB is unencrypted plaintext, shared-computer risk is real" is well-corroborated; the specific recommendation to ship a delete-my-data control is project-specific reasoning.

---

### Pitfall 3: Silently blending multi-currency amounts into one "total"

**What goes wrong:**
A real account's financial history can span USD, RUB, and UAH (confirmed in the milestone context for `Payment_history`, and structurally possible for `Financial_data`'s virtual-currency/premium-time entries too if the account changed billing region). A dashboard that sums "total spent" or "total flow" across rows without grouping by currency produces a number that is not merely imprecise — it's meaningless (1500 + 1500 where one row is USD and the other is RUB is not "3000" of anything). Worse, if a single currency symbol gets slapped on that blended total, it actively misinforms the user about their own spending.

**Why it happens:**
Early iterations naturally start with "sum this column" without noticing the currency column varies per row, especially since a synthetic/dev test account with a single currency won't surface the bug at all. This is exactly the kind of thing that looks correct against a small sample and breaks on the real multi-currency account.

**How to avoid:**
Never produce a cross-currency sum. Group every financial aggregate by currency code and render one subtotal per currency (or a small per-currency breakdown list) instead of a single blended number. If a single "primary" number is wanted for a hero stat, pick "most active currency by row count" and label it explicitly (e.g. "totals shown in the currencies you were billed in") rather than converting.

**Warning signs:**
Any `.reduce()` / `sum()` over a financial timeline that doesn't first `.groupBy(currency)`; any UI string like "Total spent: $X" with a hardcoded currency symbol next to a computed sum.

**Phase to address:**
The Financial_data dashboard phase (and the future Payment_history phase, if added). Verify by testing specifically against a synthetic fixture with 2+ currency codes, not just the real sample's dominant currency.

**Confidence:** MEDIUM — directly corroborated by web research on multi-currency personal-finance dashboards ("dashboards that combine or mislabel amounts across currencies represent a critical error"); the WoT-specific USD/RUB/UAH detail comes from the milestone context, not web research.

---

### Pitfall 4: Treating a build-time-hardcoded FX rate as authoritative, or re-pricing history on every load

**What goes wrong:**
Because the "zero network requests after load" constraint rules out a live FX-rate API, a team under pressure to show "one number" might bake a single exchange rate into the bundle at build time and use it to convert historical RUB/UAH rows into USD-equivalents. This produces two failure modes: (1) false precision — the converted number looks authoritative but reflects one arbitrary rate, possibly years stale relative to when the money was actually spent; (2) if the rate is ever updated in a later deploy, previously-shown historical totals silently change between visits, which reads as a bug even though "the code changed" is the real cause.

**Why it happens:**
This is the exact anti-pattern documented across personal-finance apps generally: converting at "today's" rate makes every past number drift as time passes and rates update, so "you can't trust any number older than right now." The project's own no-network constraint actually protects against the live-rate version of this trap — but doesn't protect against a hardcoded-constant version of the same mistake.

**How to avoid:**
Don't convert currencies at all for v1. Show amounts in their original currency, grouped (per Pitfall 3). If a future milestone wants a single blended view, it must be clearly labeled as an approximation with the rate and its as-of date visible next to the number, and that rate must never silently change retroactively for already-computed historical figures.

**Warning signs:**
Any constant like `const RUB_TO_USD = 0.011` committed to the codebase and multiplied into a financial row.

**Phase to address:**
Financial_data dashboard phase — decide "no conversion, ever, for v1" explicitly during planning so no one reaches for this shortcut under time pressure.

**Confidence:** MEDIUM — well-corroborated pattern from personal-finance-app research; application to this project's no-network constraint is project-specific reasoning.

---

### Pitfall 5: SVG-per-data-point rendering doesn't survive a large/veteran account

**What goes wrong:**
The calendar heatmap (year-by-year) and day-of-week × hour-of-day heatmap are hand-rolled SVG, which is fine for the ~3,870-session sample inspected — but PROJECT.md itself flags that "how big can this get" for a veteran multi-year account is an unverified assumption. If the heatmap renders one `<rect>` per session (or even one per active day across many years for a long-tenured account), a sufficiently large account can push into the hundreds-of-thousands-of-DOM-nodes range that's documented to freeze or crash a browser tab. This is a different failure mode than the already-documented "unzip/parse blocks main thread" pitfall — this one happens *after* parsing succeeds, purely at render time.

**Why it happens:**
Calendar heatmaps are naturally modeled "one shape per day," which feels bounded (365/year × N years is small) — but a session-duration histogram or an hour-of-day breakdown rendered at per-session granularity, or a heatmap that also draws per-session tooltips/hit-targets rather than per-day ones, multiplies node count by session count instead of day count.

**How to avoid:**
Aggregate before rendering: pre-compute per-day (or per-bucket) rollups once, and render exactly one shape per calendar cell / histogram bucket regardless of how many raw sessions fall into it — node count should scale with *time range*, not with *row count*. Reuse a single `<rect>` definition via SVG `<use>` where the same shape repeats with only position/color varying. Set an explicit node-count ceiling in a test using a synthetic large fixture (e.g. 10-15 years × daily activity), not just the real 2021 sample.

**Warning signs:**
Any heatmap/histogram component whose render loop is `sessions.map(session => <rect ... />)` rather than `days.map(day => <rect ... />)`.

**Phase to address:**
The Activity_history heatmap phase. Verify explicitly against a synthetic large-account fixture, since the only real sample available is small.

**Confidence:** MEDIUM — directly corroborated ("painting one half million SVG nodes will probably crash your browser"; common industry guidance switches to Canvas above roughly 10k points); the specific WoT scale-risk framing is project-specific, building on PROJECT.md's own noted assumption gap.

---

### Pitfall 6: Raw, ungrouped login-IP + country data feels invasive even to the account's own owner

**What goes wrong:**
A flat table of "timestamp, raw IP, country flag" for potentially thousands of login rows, combined with a world map plotting every one of them, can produce an uncomfortable experience distinct from a bug: seeing your own multi-year movement/travel/work-vs-home pattern laid out chronologically and geographically is a qualitatively different experience than abstractly knowing "yes, Wargaming logs my login IPs." This is a UX pitfall specific to this domain (self-surveillance dashboards over one's own PII), not a security bug, but it's a real way to make the "did I actually want to see this" question land badly on first use.

**Why it happens:**
The feature is scoped as "IP history table + world map" as a factual reporting task, without a design pass on *how* that confrontation with one's own data is introduced (e.g. cold open on a full unfiltered table vs. a summarized "3 countries, mostly your home IP, 2 anomalies" framing first).

**How to avoid:**
Lead with a summarized view (distinct IPs/countries count, most-common IP, notable changes) and let the full row-level table be an expandable/secondary view rather than the first thing rendered. Group consecutive identical-IP logins into ranges ("same IP, 47 logins, Jan–Mar 2021") instead of one row per login.

**Warning signs:**
The IP table is the default, ungrouped, first-rendered element of the Activity_history section with no summary layer above it.

**Phase to address:**
The login-IP/geo phase. This is a design decision to make during that phase's planning discussion, not a bug to catch later.

**Confidence:** LOW — this is project-specific reasoning about self-surveillance UX; not directly corroborated by a citable source, included because it's a genuinely new consideration the milestone context calls out.

---

### Pitfall 7: Convenience affordances (copy button, tab title, browser history) leak PII outside the masked view

**What goes wrong:**
Even if the on-screen table masks an email or IP by default (Pitfall 1's fix), secondary surfaces can still leak the raw value: a "copy IP" button puts the unmasked value on the system clipboard, where any other running app (including clipboard-manager history tools) can read it; `document.title` set to include an account ID/email for a nice browser-tab label persists in browser history and any open-tabs sync; a future "export view as image/PDF" feature would bypass masking entirely if it captures the underlying DOM value rather than the masked rendering.

**Why it happens:**
These are "nice polish" features added late, independently of the masking work done earlier, so they're not re-checked against the same privacy bar.

**How to avoid:**
Treat masking as a property of the *data*, not the *component* — anywhere a sensitive field can be copied, titled, or exported, route it through the same reveal/mask state rather than reaching for the raw parsed value. Audit `document.title`, any `navigator.clipboard.writeText` calls, and any future export/print/screenshot feature specifically for this before shipping.

**Warning signs:**
A "copy" icon next to a masked field where the click handler references the unmasked source value instead of the currently-displayed masked/revealed value.

**Phase to address:**
Cross-cutting — flag during the UI-polish pass of whichever phase adds copy/export/title-setting behavior, and again at any pre-ship privacy review.

**Confidence:** LOW — project-specific reasoning extending Pitfall 1; not independently sourced.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Pick one "home currency" and force-convert everything for v1 | Simpler summary UI, one number to show | Silently wrong for any account with real multi-currency history (the exact case this project has confirmed exists); users lose trust when they notice a number that doesn't match what they actually paid | Never — show per-currency, not blended (see Pitfall 3/4) |
| Cache the entire parsed dataset in IndexedDB verbatim, with no "sensitive-fields" flag or partial-clear option | Simplest possible storage pipeline | No future path to "clear just the login-IP/email history but keep my stats" without a full wipe; harder to retrofit granular deletion later | Acceptable for v1 given single-user local threat model and single-active-dataset design; revisit if multi-profile storage or granular privacy controls are ever added |
| Skip per-row currency-code validation on financial rows ("it's always been USD/RUB/UAH in the sample, ship it") | Faster to build | A malformed or unexpected currency code silently mislabels a monetary amount — a money-display bug is worse than a crash because it's wrong, not visibly broken | Never acceptable for anything touching a currency symbol or total — validate/enum-check and fail loudly (show "unknown currency" rather than a wrong symbol) |
| Render heatmaps at per-session granularity because it "just worked" on the small sample | Less aggregation code to write up front | Breaks (freezes/crashes tab) on any account meaningfully larger than the one sample inspected — exactly the scale risk PROJECT.md already flags as unverified | Acceptable only behind an explicit TODO with a synthetic-large-fixture test tracking it; not acceptable to ship unverified at scale |

## Performance Traps

Patterns that work at small scale (the one 2.2MB / ~3,870-row sample) but fail as the export grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| One SVG node per raw session/login row instead of per aggregated bucket | Heatmap/table render stutters, then the tab becomes unresponsive or crashes | Pre-aggregate to day/bucket granularity before rendering; cap SVG node count, switch to Canvas or reuse `<use>` shapes above a threshold | Documented failure zone starts in the tens-of-thousands of nodes; likely for any multi-year veteran account |
| `postMessage`-ing the entire parsed dataset from Worker to main thread as one giant structured-clone payload | Noticeable pause/jank right after "parsing complete," worse than the unzip/parse time itself | Stream results in chunks, or transfer only what's needed for the current view and page/query IndexedDB for the rest | Grows with total row count across all categories combined, not just one file |
| One massive IndexedDB transaction for the full `bulkPut` insert with no chunking/yielding | Long single UI-thread stall even though the write is nominally "async"; risk of hitting the transaction-goes-stale-across-await pitfall if code awaits unrelated work mid-transaction | Chunk `bulkPut` calls (e.g. a few thousand rows per transaction) and yield between chunks | Becomes noticeable well before hitting storage quota — parsing/serialization overhead bites first |
| Un-virtualized IP/session table re-rendering fully on every filter keystroke | Typing in a filter box visibly lags | Virtualize the table body (per PROJECT.md's stated intent) and make sure it's actually wired to *this* table, not just planned generically | Becomes visible in the thousands-of-rows range, well within plausible veteran-account territory |

## Security Mistakes

Domain-specific issues beyond general web security, specific to caching a personal-data export client-side.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Treating IndexedDB as a safe-by-default store for IP/email/financial data because "nothing leaves the device" | Data persists in plaintext on disk; readable by XSS, by browser extensions with broad site-data permissions, or by a subsequent user of a shared/borrowed machine | Store only what the dashboard needs; ship an explicit, discoverable "clear my data" control (Pitfall 2); don't conflate "no network calls" with "no exposure" |
| Letting "copy" / future "export" / tab-title features bypass on-screen masking | A field masked in the main view still leaks in full via clipboard, browser tab history, or an exported file | Route every sensitive-field surface (copy, title, export) through the same mask/reveal state as the on-screen render (Pitfall 7) |
| No validation that a financial row's currency code is one of the expected set before rendering a currency symbol | A parsing bug or unexpected export format quietly displays a wrong currency symbol next to a real number, misinforming the user about their own spending | Validate/enum-check currency codes; render "unknown currency" rather than guessing |

## UX Pitfalls

Common user-experience mistakes specific to this domain (self-surveillance dashboards over one's own sensitive export).

| Pitfall | User Impact | Better Approach |
|---------|--------------|-------------------|
| Email/IP shown in plaintext by default | User misjudges the tool's actual privacy posture and gets burned by screenshotting/screen-sharing/leaving it open on a shared device | Mask by default, reveal-on-demand (Pitfall 1) |
| A single blended "total" across USD/RUB/UAH | User treats a meaningless number as their real total spend | Per-currency subtotals, never a cross-currency sum (Pitfall 3) |
| Flattened stat aggregates across WoT / Blitz / Warships / Warplanes (e.g. one "overall win rate") | Misleading number that mixes fundamentally different game modes and stat baselines | Always segment by game; never auto-sum "battles" or "win rate" across games |
| Raw, ungrouped IP/login table as the first thing shown | Feels invasive even to the account's own owner; can sour first impressions of an otherwise-trustworthy tool | Lead with a summary (distinct IPs/countries, most-common IP), make the full row-level table secondary and grouped (Pitfall 6) |
| Heatmap color scale dominated by a handful of outlier days/sessions | Almost every other day/session reads as visually identical "cold," hiding real patterns | Use a percentile- or log-scaled color mapping instead of linear min-max |
| No timezone disclosure on the day-of-week × hour-of-day activity heatmap | User draws wrong conclusions about "when I actually play" if the underlying timestamps are server-time/UTC but displayed as if browser-local (or vice versa) | Explicitly label which timezone basis the heatmap uses, and pick one deliberately rather than defaulting silently |

## "Looks Done But Isn't" Checklist

- [ ] **PII masking:** Often masked only in the primary table view — verify it's also masked in tooltips, any copy-to-clipboard action, `document.title`, and that no `console.log` of raw parsed rows ships in the production build.
- [ ] **"Clear my data" control:** Often wired to clear the visible table state but not the underlying IndexedDB database (or any in-memory Worker copy) — verify it actually calls a delete against the database and the app returns to its true empty/first-run state afterward.
- [ ] **Multi-currency totals:** Often labeled with a single currency symbol next to a computed sum — verify every "total"/"sum" figure in the financial dashboard is broken out per currency, and that a synthetic 2+-currency test fixture (not just the real sample) was used to check this.
- [ ] **Heatmap performance at scale:** Often tested only against the one small real sample — verify against a synthetic dataset 10-50x larger (multi-year, high session count) before considering the heatmap "done," since PROJECT.md itself flags large-account scale as unverified.
- [ ] **IP/login table at scale:** Often "virtualized" in name only — verify smooth scrolling/filtering against a synthetic 10k+-row fixture, not just the small real sample's few hundred rows.

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|----------------|-----------------|
| PII shipped plaintext-by-default | LOW | Static site, quick redeploy: add mask-by-default + reveal toggle in a follow-up patch; no data migration needed since nothing was ever sent anywhere |
| Blended-currency totals shipped wrong | MEDIUM | Requires a data-model change (retain per-currency groupings, not a pre-summed scalar) and a redesign of the summary UI — can't just reformat a number, the underlying aggregation has to change |
| Heatmap crashes/freezes on a large real-world account | MEDIUM-HIGH | Requires retrofitting an aggregation/rendering-mode boundary into an already-shipped hand-rolled SVG component — the same class of "expensive to retrofit after the fact" risk PROJECT.md already flags for worker/virtualization boundaries generally, landing specifically on the heatmap component |
| IndexedDB left with no clear-data path after users start relying on the cache | LOW | Purely additive: ship a delete-database control in a follow-up release; no backward-compat concern since it's a destructive action users opt into |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| Plaintext PII by default (Pitfall 1) | Activity_history / login-IP table phase (and future User_Info phase) | UI review: every sensitive field renders masked-by-default with an explicit reveal action |
| No IndexedDB data-lifecycle/deletion story (Pitfall 2) | IndexedDB-caching phase | A "clear my data" control exists, is discoverable, and demonstrably deletes the database (checked in a test, not just eyeballed) |
| Cross-currency blended totals (Pitfall 3) | Financial_data dashboard phase (and future Payment_history phase) | Test against a synthetic 2+-currency fixture; every total is per-currency-labeled |
| Hardcoded/re-pricing FX conversion (Pitfall 4) | Financial_data dashboard phase | Explicit "no conversion in v1" decision recorded; code review checks for any FX constant |
| SVG-per-data-point heatmap scale failure (Pitfall 5) | Activity_history heatmap phase | Render test against a synthetic large/veteran-account fixture (not just the real small sample) |
| Invasive raw IP/login presentation (Pitfall 6) | Login-IP/geo phase | Design review confirms a summary-first, grouped-table-second layout exists before full build-out |
| PII leaking via copy/title/export (Pitfall 7) | Cross-cutting, checked at each phase adding copy/export/title behavior | Audit clipboard writes, `document.title` usage, and any export feature against the mask/reveal state |

## Sources

- [Privacy UX: Common Concerns And Privacy In Web Forms — Smashing Magazine](https://www.smashingmagazine.com/2019/04/privacy-concerns-ux-web-forms/)
- [Email Masking Explained — Mailtrap Blog](https://mailtrap.io/blog/email-masking/)
- [Your budgeting app is lying to you about last month — DEV Community](https://dev.to/sssselfmade/your-budgeting-app-is-lying-to-you-about-last-month-3kn8)
- [Multi-Currency Net Worth Trackers: Compare Apps for 2025 — Know Your Dosh](https://www.knowyourdosh.com/blog/multi-currency-personal-finance-apps)
- [How to process 1.5GB+ JSON/CSV files in the browser without crashing the RAM — DEV Community](https://dev.to/valenleyes/how-to-process-15gb-jsoncsv-files-in-the-browser-without-crashing-the-ram-pa9)
- [Web Workers for Heavy Client Compute — Michael Samuel Naeem](https://blog.michaelsam94.com/web-performance-web-workers-heavy-compute/)
- [Browser Storage Limits: Practical Caps for Large CSV Workflows — Elysiate](https://www.elysiate.com/blog/browser-storage-limits-practical-caps-for-large-csv-workflows)
- [How to Visualize Millions of Data Points Efficiently — DEV Community](https://dev.to/andyb1979/how-to-visualize-millions-of-data-points-efficiently-54ib)
- [Rendering Mode in React HeatMap Chart — Syncfusion](https://help.syncfusion.com/chart-sdk/react/heatmap-chart/rendering-mode)
- [IndexedDB — Security Glossary, cside](https://cside.com/glossary/indexeddb)
- [Encrypted storage · Issue #191 · w3c/IndexedDB](https://github.com/w3c/IndexedDB/issues/191)

---
*Pitfalls research for: browser-only Wargaming GDPR export viewer (sensitive-PII display + multi-currency financial display, net-new scope beyond prior custom research)*
*Researched: 2026-09-27*
