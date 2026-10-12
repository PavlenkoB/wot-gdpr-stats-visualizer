---
phase: 01-ingest-foundation-zero-network-guard
plan: 09
subsystem: infra
tags: [vite, csp, typescript, tsconfig, project-references, svelte, ci, typecheck]

requires:
  - phase: 01-06
    provides: src/ layout incl. worker-client.svelte.ts (a Svelte 5 rune module) that `tsc -b` now compiles
provides:
  - "vite.config.ts: one self-contained cspMeta plugin — CSP injection and literal-quote emission in a single transformIndexHtml hook, no registration-order dependency"
  - "package.json: `check` is a single `tsc -b` over the app/node/test project-reference graph"
  - "tsconfig.app.json: explicit verbatimModuleSyntax, no-op checkJs removed, allowJs preserved"
  - "svelte.config.js: annotated so the empty `{}` reads as intentional"
affects: [01-10, ci, typecheck, build, vite-plugin-ordering]

actuals:
  tokens: 2166
  tasks: 3
  commits: 3
plan_head_before: 3ecf0dcee50827dd1d79a23debaf6cd99063ebed

tech-stack:
  added: []
  patterns:
    - "CSP meta emitted by string surgery inside one transformIndexHtml hook instead of a tag descriptor + unescape hook pair"
    - "Typecheck as a single `tsc -b` driven by a solution-style tsconfig.json with three project references"

key-files:
  created: []
  modified:
    - vite.config.ts
    - svelte.config.js
    - tsconfig.json
    - package.json
    - tsconfig.test.json
    - tsconfig.app.json

key-decisions:
  - "Serialize the CSP meta tag inside cspMeta rather than returning an HtmlTagDescriptor: Vite injects returned tags AFTER the hook returns, so a same-hook unescape can never see the serializer output. Emitting the tag ourselves keeps the literal quotes and deletes the escape problem at the root."
  - "Keep svelte.config.js and annotate it (plan's stated preference) instead of deleting it; @sveltejs/vite-plugin-svelte reads the file during build and the build was re-verified after the edit."
  - "Add `\"svelte\"` to tsconfig.test.json `types` to make the mandated `tsc -b` command viable; this mirrors what tsconfig.app.json already did and is the minimal enabling change."

patterns-established:
  - "When a Vite transformIndexHtml hook must emit literal characters (quotes, entities), serialize the tag itself — a returned `tags` descriptor always goes through escapeHtml."
  - "Every project config in the references graph must load the type libraries its transitive source files need; a test project compiles src/ files through test imports, so its `types` must cover the app's globals (Svelte runes)."

requirements-completed: []

coverage:
  - id: D1
    description: "WR-02: vite.config.ts ships the CSP meta from a single plugin with no registration-order dependency; built dist/index.html unchanged"
    requirement: WR-02
    verification:
      - kind: other
        ref: "pnpm run build && grep -c \"default-src 'self'\" dist/index.html && grep -c \"connect-src 'none'\" dist/index.html && ! grep -q '&#39;' dist/index.html"
        status: pass
      - kind: other
        ref: "diff -u /tmp/01-09-baseline-index.html dist/index.html (byte-identical, sha b079539d, 797 bytes)"
        status: pass
    human_judgment: false
  - id: D2
    description: "WR-04: pnpm run check is a single `tsc -b` over the app/node/test project references, exiting 0 with no output"
    requirement: WR-04
    verification:
      - kind: other
        ref: "pnpm run check (exit 0, output is only the `$ tsc -b` script echo); also run from a fully cleaned node_modules/.tmp"
        status: pass
    human_judgment: false
  - id: D3
    description: "IN-01/IN-02: tsconfig.app.json declares verbatimModuleSyntax: true, drops the no-op checkJs, keeps allowJs"
    requirement: IN-01
    verification:
      - kind: other
        ref: "ts.parseConfigFileTextToJson over tsconfig.app.json -> verbatimModuleSyntax true, allowJs true, checkJs absent"
        status: pass
    human_judgment: false
  - id: D4
    description: "IN-05: svelte.config.js annotated with a comment explaining the empty config is intentional"
    requirement: IN-05
    verification:
      - kind: other
        ref: "cat svelte.config.js (12 lines) + pnpm run build (exit 0) with the file in place"
        status: pass
    human_judgment: false
  - id: D5
    description: "Playwright zero-network spec asserting the served HTML carries the CSP meta tag"
    requirement: WR-02
    verification:
      - kind: e2e
        ref: "tests/e2e/zero-network.spec.ts#served HTML carries the CSP meta tag with default-src and connect-src none"
        status: unknown
    human_judgment: true
    rationale: "pnpm run test:e2e was not run in this session: the environment override forbids it (port 4173 with reuseExistingServer:false can collide with a developer's preview server). The spec's subject — the served HTML's CSP meta content — was instead asserted directly against the real build output (exactly one `default-src 'self'`, exactly one `connect-src 'none'`, zero `&#39;`, byte-identical to the pre-change build), but the spec itself has not been executed against a served page."

duration: 11min
completed: 2026-09-30
status: complete
---

# Phase 01 Plan 09: Build/CI Configuration Hardening Summary

**CSP meta emission collapsed into one order-independent Vite plugin, and CI typecheck collapsed from three commands to a single `tsc -b` over a three-project reference graph.**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-09-30T16:37Z
- **Completed:** 2026-09-30T16:48Z
- **Tasks:** 3
- **Files modified:** 6 (plus `.planning/WINDOWS.md`, created by the optional ledger step)

## Accomplishments

- **WR-02 closed.** `vite.config.ts` registers one CSP plugin. The `unescapeQuotes` plugin is gone; the tag is serialized inside `cspMeta`'s single `transformIndexHtml` hook, so a future maintainer reordering the `plugins:` array can no longer ship `&#39;` escapes.
- **The built artifact is provably unchanged.** `dist/index.html` is byte-identical to the pre-change build — same 797 bytes, same sha `b079539d3a61`, exactly one `default-src 'self'`, exactly one `connect-src 'none'`, zero `&#39;`.
- **WR-04 closed.** `pnpm run check` is now `tsc -b`; `tsconfig.json` gained the missing `tsconfig.test.json` reference so the test project is actually part of the graph (all three use `incremental` + `tsBuildInfoFile`, so the CI `Cache TypeScript build info` step is unaffected).
- **IN-01/IN-02 closed.** `tsconfig.app.json` states `verbatimModuleSyntax: true` and no longer carries the no-op `checkJs: true`; `allowJs: true` is preserved as the plan requires.
- **IN-05 closed.** `svelte.config.js` now explains that the empty `{}` is intentional for the minimal (non-SvelteKit) template, and the build was re-verified with the file in place.

## Task Commits

Each task was committed atomically:

1. **Task 1: Fold `unescapeQuotes` into `cspMeta` (WR-02); annotate `svelte.config.js` (IN-05)** — `6961890` (build)
2. **Task 2: Add `tsconfig.test.json` reference + switch `check` to `tsc -b` (WR-04)** — `0185747` (build)
3. **Task 3: `tsconfig.app.json` — verbatimModuleSyntax, drop checkJs (IN-01, IN-02)** — `4153bfd` (chore)

## Files Created/Modified

- `vite.config.ts` — `cspMeta` is now a factory returning one plugin; tag serialized and injected by string surgery; standalone `unescapeQuotes` deleted.
- `svelte.config.js` — comment block explaining the intentional empty config.
- `tsconfig.json` — added `{ "path": "./tsconfig.test.json" }`; `files: []` and the two existing references untouched; no `extends`, no `compilerOptions`.
- `package.json` — `"check": "tsc -b"` (was two `svelte-check` passes + one `tsc -p`).
- `tsconfig.test.json` — `types: ["node", "svelte"]` (enabling change, see deviation 2).
- `tsconfig.app.json` — `verbatimModuleSyntax: true` added, `checkJs: true` removed, `allowJs: true` kept, stale comment trimmed.
- `.planning/WINDOWS.md` — created by `gsd-tools windows append` to record the one unrun `<verify>`.

## Decisions Made

- **Serialize the tag rather than unescape it.** The plan's Task 1 assumed the unescape could be folded into the same hook and applied to the post-injection HTML. Vite's `applyHtmlTransforms` injects a returned `tags` array *after* the hook returns, and its `escapeHtml` (which matches `["'&<>]`) turns each `'` into `&#39;` at that point. A same-hook unescape is therefore structurally impossible. Emitting the tag string ourselves makes the escaping step disappear instead of chasing it — same intent (no order dependency), and the output is byte-identical.
- **Annotation over deletion for `svelte.config.js`**, per the plan's own preference; deletion was not attempted because the plugin reads the file during build.
- **Kept the CI workflow untouched.** The `Typecheck` step just runs `pnpm run check`; with all three configs keeping `incremental` + `tsBuildInfoFile` under `node_modules/.tmp`, the cache step and the typecheck step both keep working with no `.github/` change.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Implemented the WR-02 fold as tag serialization, not as a same-hook unescape**
- **Found during:** Task 1
- **Issue:** The plan's action step assumed `cspMeta`'s hook could unescape the HTML *after* its own tag injection. Vite applies returned `tags` after the hook returns, so the serializer's `&#39;` output never passes back through the hook. Folding the unescape in as written would have left `dist/index.html` with `&#39;self&#39;` and broken the e2e CSP assertion.
- **Fix:** `cspMeta` builds the `<meta …>` string itself and inserts it right after `<head…>` (Vite's own head-prepend regex, mirrored), reproducing Vite's indent behavior byte-for-byte.
- **Files modified:** `vite.config.ts`
- **Verification:** `diff -u` against the saved pre-change `dist/index.html` → identical; counts 1 / 1 / 0.
- **Committed in:** `6961890`

**2. [Rule 3 - Blocking] `tsconfig.test.json` needed the `svelte` type library for `tsc -b` to pass**
- **Found during:** Task 2
- **Issue:** The mandated `tsc -b` failed with 8× `TS2304: Cannot find name '$state'` in `src/lib/worker-client.svelte.ts`. Bisected by building each project alone: app and node pass; the **test** project fails. The test project transitively compiles that rune module through test imports, and its `types: ["node"]` did not load Svelte's ambient rune declarations. The old script hid this by running `svelte-check` over this config, which injects runes itself.
- **Fix:** Added `"svelte"` to `types` in `tsconfig.test.json`, mirroring `tsconfig.app.json`'s `["svelte", "vite/client"]`.
- **Files modified:** `tsconfig.test.json` (not in the plan's `files_modified` list — enabling change, one entry)
- **Verification:** `pnpm run check` exits 0, both incrementally and after deleting all three `.tsbuildinfo` files.
- **Committed in:** `0185747`

**3. [Rule 1 - Correction] IN-01's flag was already inherited, so the edit is declarative**
- **Found during:** Task 3
- **Issue:** The plan describes `verbatimModuleSyntax: true` as missing from `tsconfig.app.json` "while node/test already have it". `@tsconfig/svelte/tsconfig.json` (which `tsconfig.app.json` extends) already sets it, so the app project was already enforcing it — the gap was textual, not behavioral.
- **Fix:** Stated the flag explicitly with a comment noting it is inherited, so the three project configs read the same. No new diagnostics appeared, as expected. A grep of `src/` for type-only re-exports (`^export {`, `^export * from`) returned nothing.
- **Files modified:** `tsconfig.app.json`
- **Verification:** `pnpm run check` exits 0.
- **Committed in:** `4153bfd`

---

**Total deviations:** 3 auto-fixed (1 bug, 1 blocking, 1 correction)
**Impact on plan:** All three were required to make the plan's own acceptance criteria pass. No new features, no scope beyond build/CI configuration. One file outside the plan's declared list (`tsconfig.test.json`) was touched — see deviation 2.

## Issues Encountered

- **Diagnosing the `$state` failure took a bisect.** The first hypothesis (tsc cannot resolve Svelte runes at all) was wrong — a standalone probe with `--types svelte` compiled `$state` fine. The actual cause was the *test* project compiling app source without the type library. Per-project builds isolated it immediately.
- **`pnpm run test:e2e` was not run.** The environment override forbids it (binds port 4173 with `reuseExistingServer:false`). The plan's Task 1/2/3 verify chains each include it. Substituted the strongest available substitute — the built `dist/index.html` asserted directly, which is the artifact the spec inspects. Recorded in `.planning/WINDOWS.md` as `unrun-verify` (open_count 1); `workflow.windows_enforce` is not set in `config.json`, so it is not blocking.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Build, typecheck, lint, and unit gates are all green; the phase can proceed.
- **Flag for the orchestrator (coverage reduction, not a failure):** `tsc` does not put `.svelte` files in its program — `tsc -p tsconfig.app.json --noEmit --listFiles | grep -c '\.svelte$'` returns **0 of the 11** `.svelte` files. So WR-04's efficiency win also means `pnpm run check` no longer type-checks Svelte components the way `svelte-check` did. Both dropped svelte-check passes are clean today (0 errors, 0 warnings), but future `.svelte` type errors will not be caught in CI unless `svelte-check` is re-added as its own CI step. I did not add one: the plan and the plan's success criteria both mandate a single `tsc -b`, and reintroducing svelte-check is a CI-architecture decision, not a config-tightening one.
- `.planning/WINDOWS.md` has one open entry (the unrun e2e verify); waive or close it if the dist-level CSP assertion is considered sufficient.

## Verification Evidence

All commands run from the repo root after the final commit:

| Check | Result |
|-------|--------|
| `pnpm run build` | exit 0 |
| `grep -c "default-src 'self'" dist/index.html` | `1` |
| `grep -c "connect-src 'none'" dist/index.html` | `1` |
| `grep -q '&#39;' dist/index.html` | absent (0 occurrences) |
| `diff -u` pre/post `dist/index.html` | identical, 797 bytes, sha `b079539d3a61` |
| `pnpm run check` | exit 0, no output beyond the script echo (also from a fully cleaned `node_modules/.tmp`) |
| `grep '"check"' package.json` | `"check": "tsc -b",` |
| `tsconfig.json` references | `./tsconfig.app.json`, `./tsconfig.node.json`, `./tsconfig.test.json`; `files: []` intact |
| `tsconfig.app.json` (via `ts.parseConfigFileTextToJson`) | `verbatimModuleSyntax: true`, `allowJs: true`, `checkJs` absent |
| `svelte.config.js` | 12 lines, comment + `export default {}` |
| `pnpm run lint` | exit 0 (`prettier --check` + `eslint`) |
| `pnpm run test:unit` | exit 0 — 15 files, **336 passed** |
| `pnpm run test:e2e` | **not run** (environment override; see Issues Encountered) |

## Self-Check: PASSED

- All 6 modified files exist on disk (checked with `[ -f ]`).
- All 3 task commits exist in history (`6961890`, `0185747`, `4153bfd`).
- `commits: 3` is measured from the persisted plan ledger (`plan_head_before: 3ecf0dc`, `git rev-list --count 3ecf0dc..HEAD` → 3), not narrated.
- No unexpected file deletions in any task commit (`git diff --diff-filter=D` empty for all three).
- No modifications to `.planning/STATE.md` or `.planning/ROADMAP.md` by this plan.

---
*Phase: 01-ingest-foundation-zero-network-guard*
*Completed: 2026-09-30*

## Correction notes (gap closure 01-12, 2026-10-10)

The text above is the historical record of what plan 01-09 did and was true when written; the points below are where a later phase changed the current tree on purpose. Evidence and re-run commands live in `.planning/phases/01-ingest-foundation-zero-network-guard/01-SUPERSESSIONS.md`.

- **The `check` script (record G6).** Claim: "`check` is a single `tsc -b`", "WR-04: pnpm run check is a single `tsc -b`", "`pnpm run check` is now `tsc -b`", `"check": "tsc -b"` in the file-change list, and the verification row `"check": "tsc -b",` (lines 12, 63-67, 117, 134 and 205). True now: `package.json` line 11 is `"check": "tsc -b && svelte-check --tsconfig ./tsconfig.app.json --threshold warning"`. Superseded by: Phase 6 commit `50f9f5c`, which added the svelte-check pass because `tsc -b` does not type-check `.svelte` files (the coverage reduction this summary itself flagged at line 190). `pnpm run check` still exits 0. Record: G6 in `01-SUPERSESSIONS.md`.
- **CSP figures (record G2).** Claim: the built `dist/index.html` is byte-identical to the pre-change build with exactly one `connect-src 'none'`, and the e2e reference `tests/e2e/zero-network.spec.ts#served HTML carries the CSP meta tag with default-src and connect-src none` (lines 56, 59, 91, 116 and 201). These are historical measurements of the build as it stood on 2026-09-30. True now: the directive is `connect-src 'self'` (`vite.config.ts` line 40) since plan 06-11, and the spec lives at `tests/e2e/guards/zero-network.spec.ts` with the title "served HTML carries the CSP meta tag with connect-src exactly 'self' and every other directive unchanged" (line 95). `default-src 'self'` and the absence of `&#39;` are unchanged. Record: G2 in `01-SUPERSESSIONS.md`.
