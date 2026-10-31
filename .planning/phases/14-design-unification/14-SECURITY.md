---
phase: "14"
slug: "design-unification"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-27"
---

# Phase 14 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

Method: ASVS level 1, grep depth. The register was authored at plan time (a `<threat_model>` block in every one of the 21 plans), no `## Threat Flags` entry in any summary names a new threat, and every threat was classified against evidence observed in the final tree (HEAD `783c267`). Per the secure-phase short-circuit rule (`threats_open: 0`, register authored at plan time, ASVS level 1) the auditor subagent was not spawned.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| stylesheet to network | A CSS file is the one place a remote fetch can hide outside the TypeScript scan | URLs (`url()`, `@import`) |
| markup to CSP | The shipped CSP has no `style-src`, so an inline style attribute is blocked rather than allowed | Style strings |
| imported text to style | Imported export text (vehicle names, nicknames, tank names) reaches the DOM beside styled elements | Untrusted strings |
| token declaration to every consumer | A wrong value or lost declaration applies to the whole app at once | Colours, sizes |
| scratch harness to real data | The harness drops an export into a browser; a real export is PII | Export files |
| evidence file to repository | The committed pixel record must not carry export content | Widths, sizes, hashes |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-14-01 | Information disclosure | remote `url()` or `@import` in the new global CSS | high | mitigate | `grep -E "url\(\|@import"` over every `.css` and `.svelte` in `src` returns nothing; the design-tokens network rule runs on every file; the zero-network e2e specs pass (273 of 273) | closed |
| T-14-02 | Tampering | inline `style` attribute added during migration | medium | mitigate | no `style=` attribute and no `style:` directive in any `.svelte` file under `src`; the style-attribute rule of the design-tokens guard runs on every file | closed |
| T-14-03 | Information disclosure | scratch harness loading a real export | medium | mitigate | the harness took its export only from `tests/fixtures` builders and refused any other path (14-01 SUMMARY); the committed evidence file holds only widths, pixel sizes, counts, hashes and commit ids (0 matches for an email address or an IP in it). The harness itself was wiped by a machine restart, so the control can no longer be re-inspected; the committed artefact is clean | closed |
| T-14-SC | Tampering | npm/pip/cargo installs | high | mitigate | `git diff 901a9e1 --stat -- package.json pnpm-lock.yaml` is empty: no package was added in any plan | closed |
| T-14-04 | Tampering | token value altered or lost in the relocation | medium | mitigate | 34 legacy tokens moved verbatim, checked against `901a9e1` (14-02 SUMMARY); `contrast.test.ts` passes (79 tests) and pins the heat stops, derived strings and ratios | closed |
| T-14-05 | Tampering | guards that pass vacuously, or an allowlist that rots | high | mitigate | `tests/helpers/migration.ts` and every consumer of `PENDING_FILES` are deleted (14-21); the sweeps in `design-tokens-guards.test.ts` carry non-vacuity assertions (19 matching assertions) and each rule has a synthetic pass and fail | closed |
| T-14-17 | Tampering | nesting sweep whose detector never fires | medium | mitigate | the sweep compiles with the Svelte compiler and a fixture test proves `css_unused_selector` is reported in the sweep's own compile mode (14-04) | closed |
| T-14-06 | Tampering | removing the title font-size from the phone hide rule drops the clip declarations | low | mitigate | `clip: rect(0 0 0 0)` remains in the hide rule (`src/app.css:285`); the heading stays in the accessibility tree | closed |
| T-14-24 | Tampering | D-16 compensation missing or drifting | medium | mitigate | `Overview.svelte:135` carries `margin: 0 0 calc((var(--fs-display) - var(--fs-title)) * var(--lh-heading))`; `overview-title.test.ts` passes; Overview byte-equal at four widths | closed |
| T-14-18 | Tampering | nesting or reordering a phone-block target | medium | mitigate | the phase-8 guards that read the phone block pass; the pane pixel compare was 56 of 56 pairs byte-equal after the plans that touched it (14-06 to 14-08) | closed |
| T-14-07 | Tampering | status token value drifting from the literal it replaces | low | mitigate | status tokens are declared once in `tokens.css`; the colour guard and contrast tests pass; the shell pixel compare was byte-equal after 14-07 | closed |
| T-14-19 | Information disclosure | deleting a local `.visually-hidden` exposes hidden text | low | mitigate | the shared `.visually-hidden` is defined in `src/styles/utilities.css`; no local `.visually-hidden {` rule remains under `src/lib` | closed |
| T-14-08 | Tampering | mark colour built from imported data | medium | mitigate | no style attribute or style directive anywhere in `src`; heat marks read `--heat-N` tokens through classes | closed |
| T-14-09 | Tampering | removing `overflow-wrap` from the tile numerals | low | mitigate | `overflow-wrap` is present in `PlaytimeSummary.svelte` (5 occurrences) and in `type.css` | closed |
| T-14-20 | Tampering | scroller losing `isolation: isolate` or its focus ring | low | mitigate | `src/styles/utilities.css` declares `isolation: isolate` (line 72) and `&:focus-visible` (line 74) once for every scroller | closed |
| T-14-10 | Information disclosure | restyle of `CityOptIn` altering when or whether the city file is fetched | high | mitigate | the `<script>` block of `CityOptIn.svelte` is byte-identical to `901a9e1` (8155 characters, equal), and its markup differs only in `class` values | closed |
| T-14-21 | Tampering | vehicle table losing `isolation: isolate` or its sticky header stack | low | mitigate | `VehicleTable.svelte` uses the shared `.scroller` (line 329), which carries `isolation: isolate` | closed |
| T-14-11 | Tampering | deleted `overflow-wrap` or `min-width` lets a long vehicle id widen the page | low | mitigate | `overflow-wrap` is present in `PlayerStats.svelte` (4 occurrences); the e2e long-text case passes | closed |
| T-14-22 | Tampering | tooltip white mapped to `--page` instead of `--white` | low | mitigate | `ChartTooltip.svelte` reads `var(--white)` for its text (lines 362, 387, 398) | closed |
| T-14-12 | Tampering | role on the headline dropping `overflow-wrap` | low | mitigate | `overflow-wrap` is present in `SpendSummary.svelte` (5 occurrences) and in `type.css` | closed |
| T-14-13 | Tampering | a literal-CSS test rewritten so loosely that a regression passes | medium | mitigate | the rewritten readers go through the nested-aware helper with non-empty-match requirements (14-04, 14-15); mutation checks were run by hand in 14-02 and 14-04. At grep depth the absence of every loosened assertion cannot be proved; the full suite (4884 passed) and the pixel record are the backstop | closed |
| T-14-14 | Information disclosure | restyle revealing a masked value in the timeline | medium | mitigate | the `<script>` block of all three account-timeline files is identical to `901a9e1` and their markup differs only in class values, so the masking logic is untouched | closed |
| T-14-15 | Tampering | a colour or size string built from imported text reaching a style value | medium | mitigate | no style attribute or style directive anywhere in `src`; the style-attribute rule runs on every file | closed |
| T-14-23 | Repudiation | BYTE-EQUAL verdict recorded from a dirty tree, a stale build or a widened mask | medium | mitigate | the Result and the Final re-run both record `Working tree (src/): clean`, equal PNG sizes at all four widths and a mask limited to the title box; the executors compared the served asset names with `dist/index.html`. The Final re-run used a replacement script because the original harness was lost; it reproduced all four Baseline PNG sizes, and the section says so | closed |
| T-14-16 | Information disclosure | a future stylesheet adding a remote `url()`/`@import`, or an inline style | high | mitigate | the whole-tree guards no longer have an exemption list, so a new violation fails a named test; the greps above are clean; the zero-network specs pass | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|

No accepted risks.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-27 | 25 | 25 | 0 | orchestrator, ASVS L1 grep depth (auditor not spawned: short-circuit rule) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-27
