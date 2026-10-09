---
phase: 261009-qbo-fix-top-3-phase-08-ui-pass-3-review-issu
plan: 261009-qbo
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/ui-copy.ts
  - src/lib/features/logins/LoginHistory.svelte
  - src/App.svelte
  - src/lib/shell/ImportBar.svelte
  - src/lib/shell/ConfirmPanel.svelte
  - src/lib/shell/Dropzone.svelte
  - src/lib/shell/UnsupportedBlock.svelte
  - src/lib/features/playtime/CalendarHeatmap.svelte
  - src/lib/features/playtime/Playtime.svelte
  - src/lib/features/playtime/PlaytimeSummary.svelte
  - src/lib/features/vehicles/BattleTypeSummary.svelte
  - src/lib/features/vehicles/PlayerStats.svelte
  - src/lib/features/vehicles/VehicleTable.svelte
  - src/lib/features/finance/CurrencyBlock.svelte
  - src/lib/features/finance/PremiumBlock.svelte
  - src/lib/features/finance/SpendSummary.svelte
  - src/lib/features/logins/CityList.svelte
  - src/lib/features/logins/CityOptIn.svelte
  - src/lib/features/logins/CountryList.svelte
  - src/lib/features/logins/LoginMapSection.svelte
  - src/lib/features/logins/LoginTable.svelte
  - src/lib/features/logins/WorldMap.svelte
  - src/lib/charts/MonthlyBarChart.svelte
  - src/lib/charts/MonthlyDataTable.svelte
  - tests/unit/shell/ui-copy.test.ts
  - tests/unit/charts/about-disclosure.test.ts
  - tests/unit/charts/contrast.test.ts
  - tests/unit/guards/phase8-ui-review-guards.test.ts
  - tests/unit/guards/phase8-shell-guards.test.ts
  - tests/e2e/logins/login-table.spec.ts
  - tests/e2e/logins/login-city.spec.ts
  - tests/e2e/shell/dashboard.spec.ts
  - tests/e2e/shell/master-detail-nav.spec.ts
  - tests/e2e/finance/finance.spec.ts
  - tests/e2e/_support/helpers.ts
  - .planning/phases/08-master-detail-ui-redesign/08-UI-SPEC.md
  - .planning/phases/08-master-detail-ui-redesign/08-REVIEW-DISPOSITION.md
autonomous: true
requirements: []

estimate:
  tokens: 150000
  raw_tokens: 150000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "Login history: the two table hints (the keyboard-scroll hint and the 139-character find hint) render inside a closed-by-default 'About this table' disclosure with a 44px summary, directly under the table; their text is unchanged; the Account record note stays directly above the table (Amendment A-3)"
    - "The city opt-in intro stays visible in the idle state, outside every disclosure, with its size and its two consent sentences (nothing is downloaded until the press; nothing from the export is sent); moving it would break Phase 6 D-14 and D-16 and 06-UI-SPEC section 5, so the paragraph stays and the reasoning is recorded as Amendment A-4"
    - "WR-01: one persistent polite live region (the notice announcer) is mounted once in App.svelte outside the subtree that moves between the detail pane and the list pane; its element survives a confirmed clear, a first import and a replace; the visible notice slot carries no live attributes"
    - "WR-04: the confirm panel, the duplicate notice and the failure banner are fully inside the viewport and inside the list pane at 900px and wider on a short window (1280x600), pinned in an existing e2e test; at planning time this was already true because of the Amendment A-2 sticky footer, and the plan fixes the code only if the executor's own re-measurement says otherwise"
    - "WR-05: Escape on the confirm panel cancels and returns focus to the opener (or the dropzone for a drop), Tab and Shift+Tab wrap between the two buttons, the safe button is still focused first, and a confirmed replace leaves focus on the dropzone instead of the body"
    - "No colour literal (hex, rgb, rgba, hsl) exists anywhere under src except app.css token declarations and an explicit allow-list where every entry has a reason and a file list; the guard scans all of src and fails on a stale allow-list entry"
    - "The off-token neutrals (the three greys, the two tints, the near-black, the drag-over blue tint and the white fills) read the declared tokens; control and panel borders keep at least 3:1 by reading the faint token; every changed expectation is recorded"
    - "08-REVIEW-DISPOSITION.md marks WR-01, WR-04, WR-05 and IN-02 fixed with pointers; no dependency is added, no frozen copy text changes, no e2e test() is added or removed (254 tests in 26 files), and the product still makes zero network requests after load"
  artifacts:
    - path: "src/lib/features/logins/LoginHistory.svelte"
      provides: "the table hints inside an AboutDisclosure with test id about-login-table"
      contains: "about-login-table"
    - path: "src/lib/ui-copy.ts"
      provides: "ABOUT_NAME_LOGIN_TABLE, an added constant; no existing text changed"
      contains: "ABOUT_NAME_LOGIN_TABLE"
    - path: "src/App.svelte"
      provides: "the persistent notice announcer and the focus return after a confirmed replace"
      contains: "notice-announcer"
    - path: "src/lib/shell/ConfirmPanel.svelte"
      provides: "Escape cancel and the two-button Tab wrap"
      contains: "Escape"
    - path: "tests/unit/guards/phase8-ui-review-guards.test.ts"
      provides: "the all-of-src colour literal guard with an explicit allow-list"
      contains: "phase 8 colour guard"
    - path: ".planning/phases/08-master-detail-ui-redesign/08-UI-SPEC.md"
      provides: "Amendment A-4 recording the disclosure, the city consent decision, the advisories and the colour mapping"
      contains: "Amendment A-4"
  key_links:
    - from: "tests/e2e/logins/login-table.spec.ts (tracer test)"
      to: "src/lib/features/logins/LoginHistory.svelte AboutDisclosure"
      via: "about-login-table is closed, hints hidden until the summary is pressed, summary at least 44px high"
      pattern: "about-login-table"
    - from: "tests/e2e/shell/dashboard.spec.ts (cleared test)"
      to: "src/App.svelte notice announcer"
      via: "an element handle taken before the clear is still connected after it and holds the cleared message"
      pattern: "notice-announcer"
    - from: "tests/e2e/shell/dashboard.spec.ts (start-over test)"
      to: "src/lib/shell/ConfirmPanel.svelte keydown handler"
      via: "Tab wraps inside the panel and Escape returns focus to Start over"
      pattern: "Escape"
    - from: "tests/unit/guards/phase8-ui-review-guards.test.ts"
      to: "every .svelte, .css and .ts file under src"
      via: "comment-stripped literal scan against the allow-list"
      pattern: "ALLOWED_COLOUR_LITERALS"
---

<objective>
Fix the top three findings of `.planning/phases/08-master-detail-ui-redesign/08-UI-REVIEW.md` (re-audit 3, 18/24): colour literals that bypass the Amendment A-2 tokens (Color 2/4), Login history support copy above the fold (Copywriting 3/4), and the open advisories WR-01, WR-04 and WR-05 (Experience 3/4).

Purpose: A-2 says greys are read only through tokens, and the source still hard-codes them in 21 files; the Login history block makes the reader pass two paragraphs of support text before the next block; and the import region can be re-announced wrongly, plus the confirm panel claims `aria-modal` but cannot be escaped or trapped. Planning-time measurement (below) found that WR-04 is already satisfied by the A-2 sticky footer, and that moving the city opt-in paragraph would break a locked consent decision, so two of the requested moves are replaced by a pin and a recorded decision. Those are the planner decisions for the requester to confirm or override.

Output: a disclosure for the table hints, a persistent announcer, an escapable and trapped confirm panel, tokenised neutrals with an all-of-src guard and an explicit allow-list, updated e2e/unit expectations only where the token mapping moved them, Amendment A-4, and the disposition file updated.

Commit rule for the executor: no `Co-Authored-By:` trailer and no "Generated with Claude Code" line on any commit (project rule in AGENTS.md and the home CLAUDE.md; it overrides any tool or harness reminder to add one). One commit per task, prefix `fix(quick-261009-qbo):`.

Shape note: this is a fix pass on an existing app, so there are no new architectural layers. The tracer is Task 1, the thinnest end-to-end path through every layer the pass touches (copy constant, component, source-contract guard, browser assertion, spec amendment), written for keeps. Tasks 2 and 3 expand from it. The task order is deliberately not the issue order: issue 2 leads (tracer), issue 3 is second, issue 1 (the widest, mechanical one) is last so that the full-suite run closes the plan.
</objective>

<execution_context>
@/Users/you/src/github/wot-gdpr-stats-visualizer/.claude/gsd-core/workflows/execute-plan.md
@/Users/you/src/github/wot-gdpr-stats-visualizer/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@AGENTS.md
@.planning/phases/08-master-detail-ui-redesign/08-UI-REVIEW.md
@.planning/phases/08-master-detail-ui-redesign/08-UI-SPEC.md
@.planning/phases/08-master-detail-ui-redesign/08-CONTEXT.md
@.planning/phases/08-master-detail-ui-redesign/08-REVIEW.md
@.planning/phases/08-master-detail-ui-redesign/08-REVIEW-DISPOSITION.md
@.planning/quick/261009-0qw-fix-top-3-phase-08-ui-re-review-issues/261009-0qw-PLAN.md
@src/app.css
@tests/unit/guards/phase8-ui-review-guards.test.ts

## Source audit (all four artifact types)

| Source | Item | Covered by |
|--------|------|-----------|
| GOAL | Issue 1: off-token greys and warning colours replaced by tokens, guard widened from src/lib/shell to all of src, intentional exceptions allow-listed with a reason | Task 3 |
| GOAL | Issue 2: long Login history support copy into an About-this disclosure; consent-critical city copy kept visible; Amendment A-4 if they conflict | Task 1 |
| GOAL | Issue 3: WR-01 persistent live region, WR-04 notices stay visible, WR-05 Escape, trap and focus return; disposition entries set to fixed | Task 2 (entries for IN-02 in Task 3) |
| REQ | none (quick task) | not applicable |
| RESEARCH | none | not applicable |
| CONTEXT | Phase 8 D-05 (keys are heard only by the element that owns them, no page-wide handler): the Escape handler lives on the confirm panel only | Task 2 |
| CONTEXT | Phase 8 D-03 (first import and replace land on Overview): the post-replace focus target must not fight the selection reset | Task 2 |
| CONTEXT | Phase 8 D-06 (list rows are button rows with aria-current, no listbox): unchanged | not touched |
| CONTEXT | Phase 8 D-07 and D-08 (e2e budget at its ceiling): assertions are appended to existing tests, 254 tests in 26 files stays | Tasks 1 to 3 verify |
| CONTEXT | Phase 6 D-14 (size warning at the control) and D-16 (same-origin sanctioned request, 06-UI-SPEC section 5 idle state shows the intro) | Task 1 (honoured: the intro stays visible) |
| CONTEXT | Phase 6 D-02 (Account record separate from tiles) and Amendment A-3 (note above the table) | Task 1 (unchanged, pinned) |
| SPEC | Amendment A-2 (greys read only through tokens, one scale) | Task 3 |
| SPEC | UI-SPEC copy row "Disclosure summary" (About this [name] wraps existing explanatory copy) | Task 1 |

## Planning-time findings (measured on the running dev server, 2026-10-09; the executor re-measures in Task 2 Step A)

| Advisory | Measurement | Verdict |
|----------|-------------|---------|
| WR-01 | A handle on `notice-slot` taken before Start over then Delete cached data is disconnected afterwards, and the cleared acknowledgement sits in a different slot that was created together with its text | reproduced |
| WR-04 | At 1280x600, 900x500 and 1024x420 the confirm panel, the duplicate notice and the failure banner were all inside the viewport AND inside the list pane rect (inViewport true, inPane true in all nine cases) | NOT reproduced: the A-2 sticky `.pane-list .import-region` footer already holds them in view |
| WR-05 | Initial focus is the Cancel button (kept). Escape leaves the panel open. Tab from Cancel goes Commit, then into the Overview card links in the detail pane. After a confirmed replace `document.activeElement` is BODY | reproduced (all three) |

## Planner decisions (record them in the SUMMARY; the requester can override)

1. **Status colours are allow-listed, not tokenised.** The seven warning and destructive literals (`#c5221f`, `#fce8e6`, `#8a1c17`, `#f5d4d1`, `#f9ab00`, `#fef7e0`, `#8a5a00`) stay in FailureBanner, ExcludedNotice, ImportSummary, ConfirmPanel and the block error and notice rules. The task rule is "add tokens only if the UI-SPEC declares them": the 08-UI-SPEC Color table lists the warning and destructive ROLES as unchanged from Phases 4 and 6 but declares no custom property, and four of the seven values are not in it at all. Tokenising three of seven would leave a border literal beside a token fill. They are therefore listed in the guard with the reason, a file list and a stale check. The requester can instead ask for an amendment that declares `--warn-*` and `--danger-*` tokens; that is a separate, mechanical follow-up.
2. **`#80868b` control and panel borders read `--faint`, not `--border`.** The review suggested `--border`, but that drops a select, input, picker or button boundary from about 3.7:1 to about 1.4:1 on white, which is the "noticeable change, prefer contrast" case in the task rule. `--faint` is the declared 3.36:1 token (measured on the page) and the spec already uses it for the dashed unavailable-panel border. Hover state on a `--hover` fill is 2.85:1 for the boundary; the resting state, where the boundary matters, clears 3:1. Shell buttons that already read `--border` per the spec are not touched.
3. **State surfaces keep their light-to-dark order.** Resting header fill `--list`, sorted header `--hover`, header sort-button hover `--sel` (this keeps the old order, `#f7f7fa` then `#f1f3f4` then `#dadce0`, so a hover on a sorted header never reads lighter than its resting look). Selected table row `--sel`. Chips and tags `--chip`. Static panels `--list`. Hover fills `--hover`. Progress track `--track`. Row separators `--hover` (the nearest declared token that keeps the line visible). The drag-over fill is `color-mix(in srgb, var(--focus) 10%, var(--page))`, which computes to the old tint without a new token or a new hex.
4. **White.** White fills (`background`) read `--page`, the way `.btn` already does. White SVG strokes (the separator under the focus ring on the data ramp) and the tooltip's white text stay literal and are allow-listed with a reason: they are chosen for contrast against the ramp and the dark tooltip surface, not as a page surface.
5. **Both table hints go into one disclosure.** The review names only the find hint, but the keyboard-scroll hint beside it is the same kind of supplementary usage guidance (the Phase 8 disclosure already wraps keyboard hints), and wrapping only one would leave a lone caption on each side of a disclosure. The name is a new constant `ABOUT_NAME_LOGIN_TABLE = 'table'`, an addition that changes no existing text.
6. **The city intro stays visible (the conflict case).** Reasons, to be written into A-4: Phase 6 D-14 requires the size warning where the user decides; 06-UI-SPEC section 5 and the `idle` state table list the intro Caption with the size as part of the idle render; the e2e comment calls the size "stated twice, in the intro and on the button (D-16)"; and the intro is the only on-screen statement that nothing is fetched until the press and that nothing from the export goes with the request, which is the single sanctioned exception to the product's core value. Hiding that behind a closed disclosure at the moment of a network consent is not safe. Nothing else in the opt-in is moved.
7. **WR-01 is fixed with a persistent announcer, not by moving a DOM node.** The visible notices still render inside `notice-slot` in whichever ImportBar instance is mounted (many tests pin that containment), but `notice-slot` stops being the live region. One visually hidden `role="status"` paragraph is mounted once in `App.svelte` outside the `checking-cache` branch, so it never moves or re-mounts, and it carries the processing line, the duplicate message and the cleared message. The error is not spoken by it because `FailureBanner` is `role="alert"`. This follows the existing `chart-status` pattern. It changes two existing assertions that pinned the old live region (listed in Task 2).
8. **WR-04 is closed as already fixed by A-2, with a pin.** The executor re-measures first; the pin is added regardless; code changes only if the re-measurement disagrees (fallback in Task 2).
9. **WR-05 keeps `aria-modal` and adds a keyboard trap.** Escape and the trap are handled on the panel, not on the window (D-05). Making the rest of the page inert would need a change in four ancestors for a two-button panel; the wrap is the standard dialog pattern and is what the requester asked for.

## Facts the executor must not re-discover

- The dev server is usually running on http://localhost:5173 (curl it; start `pnpm run dev` in the background if not). It serves the working tree. Throwaway scripts live in the session scratchpad, never in the repo.
- Playwright is not hoisted: a scratchpad `.mjs` imports it from `node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.mjs` under the repo root. Node is 26, so a scratchpad script can import `buildSampleExport`, `buildRenamedRootExport` and `buildTruncatedExport` straight from `tests/fixtures/export-fixtures.ts`. Import with `page.getByTestId('file-input').setInputFiles({ name, mimeType: 'application/zip', buffer })` and wait for `[data-testid=identity-header]:not([data-variant=skeleton])`. The empty state already has a list pane and rows, so never wait on those.
- A second import always goes through the confirm panel first, even identical bytes. A duplicate is produced by offering the SAME byte array again and pressing the commit button; two `buildSampleExport()` calls can differ, so keep one array.
- `playwright test` builds and previews the app itself (GEO_FIXTURE build) and its desktop viewport is 1280x720. `playwright test --list` counts both projects: it reports 254 tests in 26 files and must still report exactly that at the end. Never add or remove a `test()` entry; append assertions to existing tests.
- `.planning/` is ignored by prettier and eslint. After `.svelte` or `.ts` edits run `pnpm exec prettier --write <files>`, then `pnpm run lint`. Use the Edit and Write tools for edits; never `Bash(cat << EOF)`.
- `src/lib/ui-copy.ts` may only gain the one constant in Task 1; no existing string changes (`git diff` on it must show added lines only).
- Shared e2e helpers in `tests/e2e/_support/helpers.ts`: `openSection(page, id)`, `expectSelected`, `importAndOpen`, `replaceExport` and the `*Block(page)` locators. File-local helpers: `importSampleAndWait` and `dropAndConfirm` in `tests/e2e/shell/dashboard.spec.ts`, `offerThroughConfirm` in `tests/e2e/shell/master-detail-nav.spec.ts`. Reuse them; do not add new shared helpers.
- The full Playwright suite takes several minutes with `--workers=2`; if one foreground call would exceed the 10 minute tool limit, run it in the background and wait on its exit.

## Colour mapping table (Task 3 applies it; the guard in Task 3 enforces it)

| Literal | Where it is used | Becomes |
|---------|------------------|---------|
| `#dadce0` | any `border`, `border-top`, `border-bottom`, `border-right` and any SVG `stroke` (hairlines, table rules, the `h3` rule, scrollers, frames, `.tag`, `fieldset`, the map country outline) | `var(--border)` |
| `#dadce0` | `background` of `button:hover` in VehicleTable and LoginTable (sort header buttons) | `var(--sel)` |
| `#dadce0` | `background` of `progress` and `progress::-webkit-progress-bar` in CityOptIn | `var(--track)` |
| `#80868b` | every `border` (button, select, input, picker summary, `.banner`, `.info`) | `var(--faint)` |
| `#f1f3f4` | `background` inside any `:hover` rule (confirm cancel, select, input, summary, button) | `var(--hover)` |
| `#f1f3f4` | `th.sorted` background | `var(--hover)` |
| `#f1f3f4` | `tr.selected td` background (PlaytimeSummary) | `var(--sel)` |
| `#f1f3f4` | `.nation` (VehicleTable) and `.tag` (LoginTable) background | `var(--chip)` |
| `#f1f3f4` | `.banner` (UnsupportedBlock) and `.info` (CityOptIn) background | `var(--list)` |
| `#f1f3f4` | `td` `border-bottom` row separators (BattleTypeSummary, CityList, CountryList) | `var(--hover)` |
| `#f7f7fa` | `background` of `th`, `tr.account td`, `.info` (PlayerStats) and the `li` tile (SpendSummary) | `var(--list)` |
| `#202124` | ConfirmPanel text colour | `var(--ink)` |
| `#e8f0fe` | Dropzone `.highlighted` background | `color-mix(in srgb, var(--focus) 10%, var(--page))` |
| `#ffffff`, `#fff` | `background` | `var(--page)` |
| `#ffffff` | SVG `stroke` (CalendarHeatmap, HourGrid, DurationList, WorldMap, MonthlyBarChart) and ChartTooltip text `color` | allow-listed, reason recorded |
| `#c5221f`, `#fce8e6`, `#8a1c17`, `#f5d4d1`, `#f9ab00`, `#fef7e0`, `#8a5a00` | warning and destructive status chrome | allow-listed, reason recorded (decision 1) |
| `rgba(26, 115, 232, ...)` | spinner track and reduced-motion arc in App.svelte and ImportBar.svelte | allow-listed, reason recorded (A-2: the spinner is one of the places blue survives) |
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Tracer - Login history table hints into an About this table disclosure; the city consent text stays visible</name>
  <files>src/lib/ui-copy.ts, src/lib/features/logins/LoginHistory.svelte, tests/unit/shell/ui-copy.test.ts, tests/unit/charts/about-disclosure.test.ts, tests/e2e/logins/login-table.spec.ts, tests/e2e/logins/login-city.spec.ts, .planning/phases/08-master-detail-ui-redesign/08-UI-SPEC.md</files>
  <read_first>
    - src/lib/features/logins/LoginHistory.svelte (the table-section block near lines 400-445: the count line, the Account record note, LoginTable, the two hint captions, ExcludedNotice, the cap line, then the map section and the city section)
    - src/lib/charts/AboutDisclosure.svelte and src/lib/features/logins/LoginMapSection.svelte lines 90-105 (the established usage: name from an ABOUT_NAME constant, a test id, a paragraph child)
    - src/lib/features/logins/CityOptIn.svelte (the markup block near line 255: the idle branch renders the intro caption with test id city-intro and the load button)
    - src/lib/ui-copy.ts lines 3066-3095 (the ABOUT_NAME constants) and formatCityIntro near line 2905 (read only; its text is frozen)
    - tests/unit/charts/about-disclosure.test.ts (stripComments, REGION, regions, outsideRegions, read) and tests/unit/shell/ui-copy.test.ts around line 2043 (the table of ABOUT_NAME rows)
    - tests/e2e/logins/login-table.spec.ts (the tracer test titled "tracer: windowed, ranked, and no full address or hostile cell anywhere while masked", the comment "The three hints under the table", and the Account record test near line 560)
    - tests/e2e/logins/login-city.spec.ts (the tracer test near line 214 that asserts the idle state) and tests/e2e/shell/master-detail-nav.spec.ts near line 465 (the existing assertion style for a closed disclosure: summary text, hidden body, open after a press)
    - .planning/phases/06-login-ip-history-offline-geolocation/06-UI-SPEC.md sections "Notes under the table" and "City-level detail" (the idle intro), and 06-CONTEXT.md D-14 to D-16
  </read_first>
  <behavior>
    - Source-contract test (unit, new describe in about-disclosure.test.ts): LoginHistory.svelte has an AboutDisclosure region with test id about-login-table and the ABOUT_NAME_LOGIN_TABLE name that contains both {VEHICLE_SCROLL_HINT} and {LOGIN_TABLE_FIND_HINT}; outside every region the file still renders the Account record note (login-account-note) and the CityOptIn element; no AboutDisclosure region mentions the city section; CityOptIn.svelte contains no AboutDisclosure at all and still renders the element with test id city-intro. Use the existing regions and outsideRegions helpers.
    - Copy test (unit): ABOUT_NAME_LOGIN_TABLE equals 'table' (a new row in the existing each-table of ui-copy.test.ts), so the summary reads "About this table".
    - Browser assertion 1 (appended to the existing login-table tracer test, no new test() entry): about-login-table exists once, is closed by default, its summary text equals formatAboutThis(ABOUT_NAME_LOGIN_TABLE) and is at least 44px high; while closed neither hint is visible but the block still contains both texts (the existing toContainText assertions keep passing unchanged); pressing the summary makes both visible; the disclosure sits below the table (its top is at or below the table scroller's bottom).
    - Browser assertion 2 (appended to the existing Account record test): the login-account-note is not inside any details element and its bottom is at or above the table scroller's top (A-3 stays true).
    - Browser assertion 3 (appended to the existing city tracer test, at the idle check): city-intro is visible, matches the about-N-MB pattern, and is not inside any details element (the consent text is always on screen next to the button).
    - RED evidence, in two steps: (1) with nothing but the tests written, the unit run fails on the copy row (the constant does not exist) and on the disclosure source-contract tests; (2) after only the constant is added (Step B, first bullet), the browser run fails on the disclosure assertions because the component has no disclosure yet, while the city-intro assertion and the Account note assertion pass already (the intro is already visible, the note is already above the table). Any other red is invalid.
  </behavior>
  <action>
    Step A (RED, unit). Add the unit tests and the browser assertions described under behavior, importing ABOUT_NAME_LOGIN_TABLE and formatAboutThis in the two e2e specs that need them. Keep each added assertion block short and commented with why (the consent decision is Phase 6 D-14 and D-16; the note placement is Amendment A-3). Run `pnpm exec vitest run tests/unit/charts/about-disclosure.test.ts tests/unit/shell/ui-copy.test.ts` and confirm the stated RED for the unit tests.

    Step B (constant, RED in the browser, then GREEN).
    - In src/lib/ui-copy.ts add `ABOUT_NAME_LOGIN_TABLE = 'table'` directly after ABOUT_NAME_MAP, with a one-line doc comment in the same style ("What the Login history table's disclosure calls it: About this table"). Nothing else in the file changes. Now run `pnpm exec playwright test tests/e2e/logins/login-table.spec.ts tests/e2e/logins/login-city.spec.ts --workers=2` and confirm the second RED.
    - In src/lib/features/logins/LoginHistory.svelte import AboutDisclosure from the charts directory and the new constant. Replace the two caption paragraphs that render VEHICLE_SCROLL_HINT and LOGIN_TABLE_FIND_HINT with one AboutDisclosure using the new name and test id about-login-table, holding the same two caption paragraphs in the same order with the same constants. Place it directly after the LoginTable element and before the ExcludedNotice. The Account record note above the table, the count line, the excluded notice, the cap line and the whole city section stay exactly where they are. Update the comment above the table section so it says why: the two hints are supplementary usage guidance (Phase 8 disclosure pattern), the Account record note stays above the table (Amendment A-3), and the city intro is deliberately NOT in a disclosure (Phase 6 D-14, D-16).
    - Do not edit CityOptIn.svelte, formatCityIntro, LOGIN_TABLE_FIND_HINT, VEHICLE_SCROLL_HINT or LOGIN_ACCOUNT_NOTE.

    Step C (spec). Append "Amendment A-4 (quick 261009-qbo): login table hints in a disclosure, city consent text stays visible, advisories closed, colour tokens" to .planning/phases/08-master-detail-ui-redesign/08-UI-SPEC.md in the style of A-2 and A-3, with a Cause line and one short paragraph per subject. Write only the first two paragraphs now (later tasks append the rest under the same heading): (1) Login history: the keyboard-scroll hint and the find hint sit in an "About this table" disclosure directly under the table, closed by default, 44px summary, text unchanged, which is the spec's "Disclosure summary" pattern; the Account record note stays above the table (A-3). (2) City opt-in: the review asked for the 205-character intro to move into a disclosure; it stays visible because Phase 6 D-14 puts the size warning at the control, D-16 and 06-UI-SPEC section 5 list the intro as part of the idle render, and the intro is the only on-screen statement that nothing is downloaded until the press and nothing from the export is sent with the request, the one sanctioned exception to the zero-network guarantee. A unit guard and an e2e assertion pin it. State that the amendment adds no breakpoint and no token.

    Step D (verify and commit). Prettier on the touched files, then the verify command. Commit as `fix(quick-261009-qbo): put the Login history table hints in an About this table disclosure and keep the city consent text visible`.
  </action>
  <verify>
    <automated>pnpm exec prettier --check src tests && pnpm run test:unit && pnpm run check && pnpm run lint && pnpm exec playwright test tests/e2e/logins tests/e2e/shell/mobile-sweep.spec.ts --workers=2</automated>
  </verify>
  <done>The unit guard, the copy row and the disclosure assertions were observed red for the stated reason and are green; the two hints render only inside a closed About this table disclosure under the table with unchanged text; the Account record note is still above the table and outside any disclosure; city-intro is visible and outside every disclosure; ui-copy.ts shows added lines only; Amendment A-4 exists with its first two paragraphs; unit, check, lint, the logins specs and mobile-sweep are green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: WR-01 persistent notice announcer, WR-05 confirm panel Escape, trap and focus return, WR-04 pinned</name>
  <files>src/App.svelte, src/lib/shell/ImportBar.svelte, src/lib/shell/ConfirmPanel.svelte, tests/e2e/shell/dashboard.spec.ts, tests/e2e/shell/master-detail-nav.spec.ts, tests/e2e/_support/helpers.ts, tests/unit/guards/phase8-shell-guards.test.ts, .planning/phases/08-master-detail-ui-redesign/08-REVIEW-DISPOSITION.md, .planning/phases/08-master-detail-ui-redesign/08-UI-SPEC.md</files>
  <read_first>
    - .planning/phases/08-master-detail-ui-redesign/08-REVIEW.md (WR-01, WR-04, WR-05 exactly as written) and 08-REVIEW-DISPOSITION.md
    - src/App.svelte (the whole script: confirmTrigger, onCancelConfirm, the justCleared effect, notice and statusTextFor, the importRegion snippet and the template)
    - src/lib/shell/ImportBar.svelte (the notice slot and its comment, lines 64-107) and src/lib/shell/ConfirmPanel.svelte (the script and markup; leave the style block alone, Task 3 owns its colours)
    - src/lib/shell/Dashboard.svelte lines 238-345 (importRegion rendered in the empty state and in ListPane; the chart-status page-level region and its clip-pattern style, the pattern to copy)
    - src/lib/shell/Dropzone.svelte (focus() and the tabindex 0 root: focusable even while aria-disabled)
    - tests/e2e/shell/dashboard.spec.ts: the (full-variant), (busy) and (single-live-region) tests and the Overview live-region count near lines 1005-1100, the confirm-panel describe near line 1130 ((start-over), (clear-data), (replace-on-drop), (confirmed-clear)) and the (cleared) test near line 1507
    - tests/e2e/shell/master-detail-nav.spec.ts near lines 150-215 (duplicate and failed replace keep the selection) and 630-730 (the replace test: confirm panel fully on screen, cancel returns to the dropzone, commit, then a failed replace)
    - tests/e2e/_support/helpers.ts near line 444 (the rule R5 comment about live regions)
    - tests/unit/guards/phase8-shell-guards.test.ts (shellSource, stripComments and the existing describe)
    - .planning/phases/08-master-detail-ui-redesign/08-CONTEXT.md D-03 and D-05
  </read_first>
  <behavior>
    - Source-contract tests (unit, appended to phase8-shell-guards.test.ts, comment-stripped sources, index the test id and not an imported symbol): ImportBar.svelte has no `aria-live` and no `role="status"`; App.svelte contains exactly one element with test id notice-announcer, it carries role status, aria-live polite and aria-atomic true, and its position in the source is BEFORE the `checking-cache` branch so it is outside every conditional; ConfirmPanel.svelte handles `Escape` and `Tab` and calls the oncancel prop from the Escape branch.
    - Browser assertions, all appended to existing tests (no new test() entry):
      1. (single-live-region) in dashboard.spec.ts is rewritten in place: the notice announcer, not the notice slot, has role status, aria-live polite and aria-atomic true; it is the only `[aria-live]` element on a first visit; the notice slot still exists, has no role and no aria-live attribute, and its own height is still zero when empty. Rename the title to say "the notice announcer" instead of "the notice slot".
      2. The import-bar live-region count line near line 1015 becomes zero (the bar no longer owns a live region); the page-wide counts of 1, 2 and 3 stay as they are; the comments that say "the notice slot is the live region" are updated.
      3. (cleared) test: take an element handle on the announcer before pressing Start over; after the confirmed clear the handle is still connected, the announcer text equals CLEARED_ACK_MESSAGE, the visible cleared acknowledgement is not inside any live region, and after the next import the announcer text is empty again.
      4. (start-over) test: after the existing "Cancel is focused" check, Tab moves focus to the commit button, Tab again returns to Cancel, Shift+Tab goes to commit, Shift+Tab returns to Cancel, and focus never leaves the panel; then Escape closes the panel, focus is on the Start over button and nothing was cleared (slim variant intact); then press Start over again so the original click-Cancel assertions that follow still run.
      5. master-detail-nav replace test: right after the replace is committed, the dropzone is focused (and still focused once the import has landed); the new dataset still lands on Overview (D-03).
      6. WR-04 pin: in the replace test and in the duplicate-keeps-selection test of master-detail-nav.spec.ts set the viewport to 1280x600 at the start, and assert that the confirm panel, the duplicate notice and the failure banner each lie fully inside both the viewport and the list-pane box, using one small local helper.
    - RED evidence (run BEFORE any source edit): assertions 1 to 5 and the unit tests fail for the stated reasons (no announcer, bar still owns a live region, Escape does nothing, Tab leaves the panel, focus is on the body after the replace). Assertion 6 is EXPECTED GREEN at the current commit because Amendment A-2 already made the footer sticky; if it is red, WR-04 is real and the fallback in Step E applies.
  </behavior>
  <action>
    Step A (reproduce on the dev server, no edits). Write a throwaway script in the session scratchpad, never in the repo, that records: (WR-01) a handle on notice-slot before a confirmed clear and whether it is still connected after, plus whether the cleared acknowledgement sits in the old or a new slot; (WR-04) at 1280x600, 900x500 and 1024x420, with a loaded sample export, the bounding box of the confirm panel, of the duplicate notice (offer the same bytes, press commit) and of the failure banner (offer the truncated export, press commit) against the viewport height and the list-pane box; (WR-05) the active element after opening Start over, after Escape, after Tab presses, and after a confirmed replace of the renamed-root export. The planning-time baselines are in the context section above; write the executor's own numbers into the SUMMARY. If WR-04 does reproduce in any of the nine cases, record which and use the fallback in Step E.

    Step B (RED). Add the unit tests and the browser assertions listed under behavior. Run `pnpm exec vitest run tests/unit/guards/phase8-shell-guards.test.ts` and `pnpm exec playwright test tests/e2e/shell/dashboard.spec.ts tests/e2e/shell/master-detail-nav.spec.ts --workers=2` and confirm the stated RED and the one expected green.

    Step C (WR-01, GREEN). In src/App.svelte derive the announcement text from the existing notice and statusTextFor values: the stage or progress line while processing, DUPLICATE_BANNER_MESSAGE for a duplicate, CLEARED_ACK_MESSAGE when cleared, and the empty string for an error (the failure banner is `role="alert"` and speaks for itself) and for no notice. Import the two message constants from ui-copy alongside the existing imports. Render one paragraph with class notice-announcer, test id notice-announcer, role status, aria-live polite and aria-atomic true inside `main`, BEFORE the checking-cache conditional, so it is mounted once for the page's lifetime and is never inside a branch; interpolate the derived text as plain text only. Give it the same clip-pattern style the Dashboard chart-status region uses (absolute, 1px, clipped, not display none) and declare no font-size, because the 14px floor guard scans every stylesheet. In src/lib/shell/ImportBar.svelte remove role, aria-live and aria-atomic from the notice slot, keep its test id, its zero margin and padding and everything inside it, and rewrite the comment above it: the slot is the visible container only, the announcer in App.svelte is the one live region, and why (this ImportBar is torn down and rebuilt when the dataset appears or disappears, so a region owned by it was created together with its own text, which is not announced; RESEARCH Pitfall 10). Update every stale comment that calls the notice slot a live region in tests/e2e/_support/helpers.ts (near line 444) and in dashboard.spec.ts (the (full-variant), (busy) and Overview-count comments), changing comments only apart from the two assertions named under behavior.

    Step D (WR-05, GREEN). In src/lib/shell/ConfirmPanel.svelte keep the markup, the props, the test ids, the copy and the initial focus on the Cancel button exactly as they are, and add a keydown handler on the panel root only (Phase 8 D-05: no window or document listener, so no key is taken from a chart or a field). Escape without modifiers calls preventDefault and the oncancel prop. Tab without modifiers wraps: on the last button a forward Tab moves focus to the first, and on the first button Shift+Tab moves focus to the last, each with preventDefault; any other Tab press is left to the browser. Bind both buttons so the handler can move focus between them. Keep aria-modal; if the Svelte a11y rule objects to a handler on a role element, suppress that one rule with a comment that says why (the panel root owns the dialog's keys). Rewrite the script comment to describe Escape and the wrap. In src/App.svelte, change the confirm callback so that when the pending action is a replace, it records that fact before confirming, confirms, clears the stored trigger, waits one tick and then calls focusDropzone on the import bar; a clear or start-over confirm keeps using the existing justCleared effect. Cancel and Escape both already reach onCancelConfirm, which returns focus to the opener (Start over or Clear my cached data) or to the dropzone for a drop; do not duplicate that logic.

    Step E (WR-04). With Step A showing the notices and the panel inside the viewport and the list pane at 900px and wider on short windows, make NO source change: the A-2 sticky import footer is the fix. The pin in assertion 6 stays. FALLBACK, only if Step A or assertion 6 is red: in ImportBar.svelte add an effect keyed on the notice value that, after a tick, calls scrollIntoView with block nearest on the visible notice element when one exists (no smooth behaviour), then re-run assertion 6 and record the failing case and the fix in the SUMMARY.

    Step F (records). In 08-REVIEW-DISPOSITION.md set WR-01, WR-04 and WR-05 to `fixed` and extend each title with a pointer in the style of the existing CR-01 title: WR-01 "fixed by the persistent notice announcer in App.svelte, pinned in the dashboard.spec (cleared) and (single-live-region) tests", WR-04 "already satisfied by the A-2 sticky import footer (quick 261008-x40), pinned at 1280x600 in master-detail-nav.spec", WR-05 "fixed in ConfirmPanel.svelte (Escape, Tab wrap) and App.svelte (focus after a confirmed replace), pinned in dashboard.spec (start-over) and master-detail-nav.spec". Update the closing sentence of the file so it no longer says every other finding is open. Append to Amendment A-4 in 08-UI-SPEC.md the advisories paragraph: the one persistent polite announcer and why; Escape, the two-button wrap and the post-replace focus on the dropzone; WR-04 closed as A-2 behaviour with the viewports checked.

    Step G (verify and commit). Prettier on touched files, then the verify command, then `pnpm exec playwright test --list | tail -1` must report 254 tests in 26 files (Phase 8 D-07 and D-08: the e2e budget is at its ceiling, so assertions are appended to existing tests only). Commit as `fix(quick-261009-qbo): one persistent notice announcer, an escapable and trapped confirm panel, and focus after a confirmed replace`.
  </action>
  <verify>
    <automated>pnpm exec prettier --check src tests && pnpm run test:unit && pnpm run check && pnpm run lint && pnpm exec playwright test tests/e2e/shell tests/e2e/import --workers=2 && pnpm exec playwright test --list | tail -1</automated>
  </verify>
  <done>WR-01, WR-05 and the unit contracts were observed red and are green; the announcer element survives a confirmed clear and carries the cleared message; the bar owns no live region and the page-wide live-region counts are unchanged; Escape cancels and returns focus, Tab and Shift+Tab stay inside the panel, the safe button is still focused first, and a confirmed replace leaves the dropzone focused; WR-04 is re-measured and pinned at 1280x600 with no source change (or with the recorded fallback); the disposition file and Amendment A-4 are updated; the shell and import specs are green and the list still reports 254 tests in 26 files.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Colour tokens in 21 files, an all-of-src colour guard with an explicit allow-list, then the full verification</name>
  <files>src/lib/shell/ConfirmPanel.svelte, src/lib/shell/Dropzone.svelte, src/lib/shell/UnsupportedBlock.svelte, src/lib/features/playtime/CalendarHeatmap.svelte, src/lib/features/playtime/Playtime.svelte, src/lib/features/playtime/PlaytimeSummary.svelte, src/lib/features/vehicles/BattleTypeSummary.svelte, src/lib/features/vehicles/PlayerStats.svelte, src/lib/features/vehicles/VehicleTable.svelte, src/lib/features/finance/CurrencyBlock.svelte, src/lib/features/finance/PremiumBlock.svelte, src/lib/features/finance/SpendSummary.svelte, src/lib/features/logins/CityList.svelte, src/lib/features/logins/CityOptIn.svelte, src/lib/features/logins/CountryList.svelte, src/lib/features/logins/LoginHistory.svelte, src/lib/features/logins/LoginMapSection.svelte, src/lib/features/logins/LoginTable.svelte, src/lib/features/logins/WorldMap.svelte, src/lib/charts/MonthlyBarChart.svelte, src/lib/charts/MonthlyDataTable.svelte, tests/unit/guards/phase8-ui-review-guards.test.ts, tests/unit/guards/phase8-shell-guards.test.ts, tests/unit/charts/contrast.test.ts, tests/e2e/finance/finance.spec.ts, .planning/phases/08-master-detail-ui-redesign/08-UI-SPEC.md, .planning/phases/08-master-detail-ui-redesign/08-REVIEW-DISPOSITION.md</files>
  <read_first>
    - The "Colour mapping table" and planner decisions 1 to 4 in the context section of this plan (the mapping is already decided; this task applies and enforces it)
    - src/app.css lines 1-40 (the :root tokens, which are NOT edited: no token is added) and tests/unit/guards/phase8-ui-review-guards.test.ts (stripComments, walk, SOURCES, the existing legacy-grey, blue and font-size tests)
    - tests/unit/guards/phase8-shell-guards.test.ts lines 60-130 and the two colour tests ("no shell file carries the legacy dark-text or grey-text hex" and "blue survives only in the focus ring token, the spinner and the drag highlight")
    - tests/unit/charts/contrast.test.ts: the chart frame strokes describe near line 487 (chartStroke, chartStrokeValue, appCssToken, specFrame), the "hairlines are the palette grey" test, and the Day 10 neutrals describe near line 949 with its recorded ratios
    - tests/e2e/finance/finance.spec.ts near line 1004 (the frame test: ZERO_LINE and HAIRLINE as literals)
    - .planning/phases/08-master-detail-ui-redesign/08-UI-SPEC.md Color section and Amendment A-2 (greys are read only through tokens; the blue hex exists only as the --focus declaration)
  </read_first>
  <behavior>
    - Colour guard (unit, new describe "phase 8 colour guard (quick 261009-qbo)" in phase8-ui-review-guards.test.ts, reusing its walker and comment stripper): scan every .svelte, .css and .ts file under src, comments stripped, for hex literals of 3, 4, 6 or 8 digits and for rgb, rgba, hsl and hsla function openings; in src/app.css first remove the custom-property declarations of the form `--name: #hex;` (the :root tokens and the data palette are the token declarations themselves, exempt by pattern with that reason stated in the test). Every remaining literal must be covered by an entry of a typed ALLOWED_COLOUR_LITERALS list whose entries each carry the literal (case-insensitive), the repo-relative files it may appear in, and a non-empty reason; a literal in a file not listed for it fails with `file: literal` and a hint to read a token. A second test fails when any allow-list entry matches nothing in its files (a stale entry), and a third fails when a reason is empty. A fourth asserts the walk visited more than 80 files and saw app.css, so it cannot pass vacuously. The allow-list contents are exactly: the seven status literals (reason: warning and destructive status chrome carried unchanged from Phase 4 and Phase 6 by the 08-UI-SPEC Color table, which declares the roles and no custom property), the white SVG strokes and the tooltip white text (reason: chosen for contrast on the data ramp and the dark tooltip surface, not a page surface), and the spinner rgba (reason: A-2 keeps blue for the spinner). The file lists are taken from the guard's own RED output, not guessed.
    - Widened shell guards (phase8-shell-guards.test.ts): the legacy dark-text and grey-text hex test and the blue-literal test now scan every file under src, not only src/lib/shell, using a small local recursive walker (test files do not import each other); the blue test's allowed files shrink to App.svelte and ImportBar.svelte (Dropzone no longer carries a blue literal); the tests are renamed to say "under src".
    - Contrast and expectation changes that exist only because of the intended mapping: contrast.test.ts frame-stroke tests now expect the hairline to read var(--border) and resolve to the --border token, within 3 of 255 per channel of the 05 spec's value (mirroring how the zero line already supersedes the 05 hex); finance.spec.ts HAIRLINE becomes the --border computed colour. New recorded pairs in the Day 10 neutrals describe: --text on --list, --hover, --sel and --chip each at least 4.5:1, --ink on --sel and --hover each at least 7:1, and --faint on --list at least 3:1 (a control boundary keeps its contrast).
    - The scan ignores HTML numeric character references (a hex-looking run preceded by an ampersand is not a colour); if the first run reports any other false positive in a .ts or .svelte file, refine the pattern rather than allow-listing prose.
    - RED evidence: write the guards BEFORE touching any component. The colour guard must fail and name exactly the 21 files the mapping table edits (the allow-listed literals are already covered by the list, so they do not appear). The widened shell guards are expected GREEN today and stay green: no legacy dark-text or grey-text hex exists anywhere under src, so they pin the new scope rather than a new violation. Any other red is invalid.
  </behavior>
  <action>
    Step A (inventory and RED guard). Re-run a count of colour literals per file under src (comments excluded) and note it in the SUMMARY as the before figure. Write the colour guard, the stale and reason tests, the widened shell guard changes and the new contrast pairs exactly as described under behavior, with the allow-list files filled from the guard output. Run `pnpm exec vitest run tests/unit/guards tests/unit/charts/contrast.test.ts` and confirm the colour guard is red for the 21 mapped files and nothing else.

    Step B (apply the mapping). Apply the Colour mapping table in the context section to the 21 files, CSS and comments only. A scripted pass in the session scratchpad is fine for the unambiguous rows (the border rows, the `:hover` backgrounds, `#f7f7fa`, `#202124`, `#ffffff`/`#fff` backgrounds, `#e8f0fe`); then hand-edit the rows that depend on the selector (`th.sorted`, `tr.selected td`, `.nation`, `.tag`, the panel backgrounds, the row separators, the progress track, the sort-button hover). Review `git diff` file by file before staging. Do not touch src/app.css, add no token, add no `var(--x, #hex)` fallback, change no rule's selector, spacing, font or layout, and leave every allow-listed literal in place. Update every comment that names a replaced hex (the ConfirmPanel comments about the neutral dismiss button and the destructive commit button, the PlayerStats and CountryList comments about the control chrome border, the Calendar comment about the white separator stays because it names an allow-listed literal) so the file does not describe a colour it no longer uses; comments naming the allow-listed status colours stay.

    Step C (expectations that moved because of the mapping, and only those). Make the contrast.test.ts and finance.spec.ts edits described under behavior. Run the whole unit suite and the full Playwright suite; any other failing assertion that pins a replaced colour is handled the same way only if the cause is purely the mapping (record file, line, old value, new value in the SUMMARY); any other failure is a regression in the edit and the CSS is fixed instead. If a mapping changed a rendered colour noticeably on a control, prefer the token that keeps its contrast, and record it.

    Step D (records). Append the colour paragraph to Amendment A-4 in 08-UI-SPEC.md: the rule (every neutral reads a declared token; the table of mappings in compact form; the white-fill and stroke split), the decisions that deviate from the review's suggestion (control and panel borders read `--faint` to keep a 3:1 boundary where `--border` would give 1.4:1, with the 2.85:1 hover-state note; sorted, selected and hover surfaces keep their light-to-dark order), the status-colour allow-list and why no token was added (the Color table declares the roles, not custom properties; declaring `--warn-*` and `--danger-*` is a possible follow-up amendment), the drag-over fill derived from `--focus`, and the guard that now covers all of src. State the viewports checked if any visual check was done. In 08-REVIEW-DISPOSITION.md set IN-02 to `fixed` with the pointer "all neutrals read tokens; guarded over all of src with an explicit allow-list (quick 261009-qbo)" and leave IN-03 open (its other two items are not in scope).

    Step E (visual spot check, then final verification). On http://localhost:5173 with the sample export at 1280x800, look at one screenshot each of Vehicles (table header, sorted header, a select), Login history (table, Account record tag, the city opt-in buttons and info line) and the list pane with a confirm panel open, and note any control whose boundary looks lost. Then run the full verification: prettier, the unit suite, check, lint, the full Playwright suite with two workers, and the list count. If `graphify update .` is on PATH run it and commit its output separately as `chore(quick-261009-qbo): refresh graphify code graph` only if graphify-out is tracked. Finally write the quick-task SUMMARY recording the nine planner decisions, the Task 2 reproduction table, the before and after literal counts, and every changed expectation. Commit the task as `fix(quick-261009-qbo): read the declared tokens for every off-token neutral and guard colour literals across src`.
  </action>
  <verify>
    <automated>pnpm exec prettier --check src tests && pnpm run test:unit && pnpm run check && pnpm run lint && pnpm exec playwright test --workers=2 && pnpm exec playwright test --list | tail -1</automated>
  </verify>
  <done>The colour guard was observed red for the 21 mapped files and is green; no colour literal remains under src outside the app.css token declarations and the allow-list, each allow-list entry carrying a reason and a live file list; the widened shell guards scan all of src; the only edited expectations are the frame-stroke contrast tests and the finance hairline pin, both recorded; new contrast pairs pass; Amendment A-4 is complete; IN-02 is fixed in the disposition file; the full unit suite, check, lint and the full Playwright suite with two workers are green and the list still reports 254 tests in 26 files.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| export zip to UI text | Untrusted strings (nickname, folder names, stage and category names) already reach the DOM as text. The announcer adds a second text node carrying a stage or progress line and two fixed messages. |
| user keyboard to confirm panel | The panel is the gate for destructive actions (replace, start over, clear). Escape and Tab handling changes how a keyboard user reaches or leaves that gate. |
| city opt-in consent text | The intro paragraph is what the user reads before the one sanctioned network request. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-qbo-01 | Information Disclosure | City opt-in intro moved behind a closed disclosure | high | mitigate | The intro stays visible and outside every AboutDisclosure; a unit guard asserts CityOptIn.svelte has no disclosure and still renders city-intro, and an appended e2e assertion asserts it is visible and not inside a details element (Task 1). |
| T-qbo-02 | Information Disclosure | Notice announcer text | low | mitigate | The announcer interpolates text only (no raw HTML), carries stage or progress lines and two fixed messages, never an address or an export value beyond what processing-status already shows; the existing privacy e2e scans of body text stay green (Task 2). |
| T-qbo-03 | Denial of Service | Confirm panel keyboard trap | medium | mitigate | The trap wraps only between the panel's two buttons and Escape always leaves it, restoring focus to the opener or the dropzone; the handler is on the panel root, not on the window, so no other component's keys are taken (Phase 8 D-05); asserted in the (start-over) test (Task 2). |
| T-qbo-04 | Tampering | Wrong destructive default | medium | mitigate | The safe Cancel button is still focused first and Enter on it still cancels; the commit button keeps its destructive chrome (status literals untouched); the existing UAT assertions that Cancel is focused stay green (Task 2). |
| T-qbo-05 | Information Disclosure | Zero-network guarantee across the CSS and test edits | low | mitigate | No `url(`, `@import`, font file or script is added (color-mix is a pure function); the full Playwright run includes the zero-network specs and lint keeps the ESLint network ban in force (Task 3). |
| T-qbo-06 | Repudiation | Silent loss of a control boundary after the border mapping | low | mitigate | Control and panel borders read `--faint` (3.36:1) rather than `--border`; a contrast pair test pins it and the visual spot check in Task 3 looks for any lost boundary. |
| T-qbo-SC | Tampering | npm/pip/cargo installs | high | accept | This plan installs no package and changes no manifest or lockfile, so the package-legitimacy gate has nothing to audit; no dependency is added. |
</threat_model>

<verification>
Run in order at the repository root after Task 3:
1. `pnpm exec prettier --check src tests` (clean).
2. `pnpm run test:unit` (all green, including the colour guard, the stale-entry guard, the widened shell guards, the disclosure guard and the new contrast pairs).
3. `pnpm run check` and `pnpm run lint` (clean).
4. `pnpm exec playwright test --workers=2` (full suite, no skip or only marker), then `pnpm exec playwright test --list | tail -1` reports exactly `Total: 254 tests in 26 files`.
5. `git diff --stat <commit before Task 1> HEAD -- package.json pnpm-lock.yaml` prints nothing, and `git diff -U0 <commit before Task 1> HEAD -- src/lib/ui-copy.ts` shows only added lines (no dependency change, no frozen copy changed). Use the commit that was HEAD when execution started, not a relative HEAD~N, since a graphify or SUMMARY commit would shift the range.
6. Visual, on http://localhost:5173 with the sample export: Login history shows the table with the "About this table" disclosure closed below it and the city intro plus its button visible; Start over opens the panel with Cancel focused, Tab stays inside it and Escape closes it back onto Start over; a confirmed replace leaves the dropzone focused and lands on Overview; at 1280x600 a duplicate drop shows its notice on screen.
7. Optional repository hygiene from the home CLAUDE.md: `graphify update .`; commit its output only if graphify-out is already tracked.
</verification>

<success_criteria>
- Issue 1 resolved: no off-token colour literal under src outside app.css token declarations and an explicit, reasoned, stale-checked allow-list; a guard covers all of src; the only edited expectations are the two moved purely by the mapping.
- Issue 2 resolved without breaking consent: the table hints are in an About this table disclosure, the Account note stays above the table, the city intro stays visible, and the reasoning is in Amendment A-4.
- Issue 3 resolved: one persistent live region survives a clear; Escape, a two-button wrap and focus return work; WR-04 is re-measured and pinned; the disposition file marks WR-01, WR-04, WR-05 and IN-02 fixed with pointers.
- No dependency, no new e2e test (254 tests in 26 files), no network request added, no existing copy text changed; three commits with the `fix(quick-261009-qbo):` prefix and no co-author trailer.
- The nine planner decisions, the reproduction table, the before and after literal counts and every changed expectation are in the SUMMARY so the requester can override any of them.
</success_criteria>

<output>
Create `.planning/quick/261009-qbo-fix-top-3-phase-08-ui-pass-3-review-issu/261009-qbo-SUMMARY.md` when done
</output>

<!-- planner-discipline-allow: aria-live -->
<!-- planner-discipline-allow: role="status" -->
<!-- planner-discipline-allow: notice-slot -->
