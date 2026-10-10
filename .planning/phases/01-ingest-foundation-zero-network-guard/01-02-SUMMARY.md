---
phase: 01-ingest-foundation-zero-network-guard
plan: 02
subsystem: ingest
tags: [svelte, vite, pnpm, typescript, eslint, prettier, vitest, github-actions, ci, lint-guards, security, plps]

# Dependency graph
requires:
  - phase: 01-ingest-foundation-zero-network-guard
    plan: 01
    provides: package.json (with `packageManager: pnpm@12.6.0` and scripts `dev`/`build`/`preview`/`check`/`test:e2e`), vite.config.ts with csp-meta build plugin, src/lib/worker/ingest.worker.ts (the only `fflate` import site), tests/e2e/zero-network.spec.ts (Playwright zero-network + CSP spec).
provides:
  - ESLint flat config with four guard rules wired test-first: source-level network API ban (PLATFORM-02), raw-HTML ban (T-01-05), inline-style ban (CSP), fflate-outside-worker import ban (worker-boundary)
  - Prettier + ESLint integration via eslint-config-prettier + svelte.configs.prettier
  - Vitest 5 unit runner scoped to tests/unit (Playwright specs not collected)
  - Type-check coverage for tests/, playwright.config.ts, vitest.config.ts via tsconfig.test.json
  - CI workflow on every push/PR: lint, typecheck, unit, e2e (incl. zero-network spec), with SHA-pinned actions
affects:
  - phase-02 (parsing + Dexie caching) — the network ban prevents accidental fetch inside the parsing worker; the fflate-outside-worker ban keeps unzip work confined to src/lib/worker
  - phase-03 (dashboard shell) — svelte/no-at-html-tags and svelte/no-inline-styles force safe markup + styled-component-block boundaries in dashboard components
  - phase-05 (CI / deploy) — this plan's CI workflow is the standing guard; phase-05 will add `actions/deploy-pages` alongside it

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 76000   # chars/4 over files actually changed (12 source/config files + tests + workflow + lockfile)
  tasks: 3
  commits: 10

# Tech tracking
tech-stack:
  added:
    - eslint ^10.11.0 (dev; flat config + plugin host)
    - "@eslint/js ^10.0.1 (dev; js.configs.recommended)"
    - typescript-eslint ^8.70.1 (dev; tseslint.configs.recommended)
    - eslint-plugin-svelte ^3.23.0 (dev; svelte/no-at-html-tags, svelte/no-inline-styles)
    - eslint-config-prettier ^10.1.8 (dev; format-vs-lint compat)
    - globals ^17.12.0 (dev; globals.browser / globals.node)
    - prettier ^3.9.9 (dev; format script)
    - prettier-plugin-svelte ^4.1.1 (dev; .svelte file formatting)
    - vitest ^5.0.2 (dev; unit test runner)
  patterns:
    - "ESLint flat config via `defineConfig` from eslint/config: globals/eslint/ignores blocks stitched with `tseslint.configs.recommended` (not type-checked variant; projectService wiring deferred per FA-01-02-1) + `svelte.configs.recommended` + prettier + `svelte.configs.prettier`"
    - "Per-area globals blocks: src/** gets globals.browser, *.config.{js,ts} + tests/** get globals.node"
    - "Svelte parser wiring: `**/*.svelte` and `**/*.svelte.ts` extend `languageOptions.parserOptions` with `parser: tseslint.parser` and `extraFileExtensions: ['.svelte']`"
    - "Test-first lint guard: tests/unit/lint-guards.test.ts uses ESLint's lintText with virtual file paths under src/; the file lives under tests/ so it never trips its own rules"
    - "Source-level network ban via no-restricted-globals + no-restricted-properties with PLATFORM-02 message; worker code in src/lib/worker/** is in scope (Playwright can't see worker-internal fetches)"
    - "Worker-boundary import ban via no-restricted-imports with `ignores: ['src/lib/worker/**']` so fflate remains importable only inside the worker tree"
    - "OXC tsconfig override via Vite's top-level `tsconfig: './tsconfig.test.json'` to bypass OXC's auto-discovery of tsconfig.app.json (which extends @tsconfig/svelte/tsconfig.json)"

key-files:
  created:
    - eslint.config.js (ESLint flat config; guards wired test-first)
    - .prettierrc (singleQuote true, printWidth 100, svelte plugin, override parser=svelte)
    - .prettierignore (pnpm-lock.yaml, .planning/, .claude/, **/*.md)
    - vitest.config.ts (Vitest 5 runner, include tests/unit/**/*.test.ts, environment node)
    - tsconfig.test.json (standalone, no extends, strict, ESNext, lib ES2023+DOM, types [node], includes tests/**)
    - tests/unit/lint-guards.test.ts (47 vitest cases; 44 fail RED before guards land, all pass GREEN after)
    - .github/workflows/ci.yml (CI on every push/PR; 4 SHA-pinned actions; persist-credentials false; contents: read; bare triggers)
  modified:
    - package.json (added devDependencies + scripts lint/format/test:unit; extended check to add `svelte-check --tsconfig ./tsconfig.test.json`)
    - pnpm-lock.yaml (lockfile addition for the 9 new devDependencies + transitive deps)
    - vitest.config.ts (removed svelte() plugin to avoid Vitest-5/rolldown resolver crash on `node:module`; documented deviation)
    - 17 01-01 source/config files reformatted by Prettier (formatting-only rewrites; no behavior change)

key-decisions:
  - "ESLint flat config + svelte parser wiring + globals scoping per area, exactly as the plan specified"
  - "Two staging commits split the toolchain wiring (Task 1, commits 1-7) from the guard rules (Task 2, commits 8-9) per the TDD ordering: tests land RED before the rules exist, then the rules land and turn the tests GREEN"
  - "Vitest 5 + svelte-plugin is broken at startup: rolldown's internal pre-build can't resolve node:module when the svelte plugin triggers a non-default optimization path. The plan's acceptance criterion asked for the plugin pre-emptively, but the fix required dropping it (commit `be4a537`). Documentation in vitest.config.ts records the root cause and the approved restore path (plugins:[svelte()] + resolve.conditions:['browser']) for when a future plan imports runes-class modules from a unit test"
  - "OXC needs an explicit `tsconfig` field rather than `oxc.tsconfig` (the former is the type-safe Vite option; the latter is not in Vite's public type surface yet)"
  - "CI workflow: GH Actions pinned to commit SHAs resolved via `git ls-remote --tags` at execution time, all within the gate-approved majors. Upload-artifact runs `if: failure()` and `if-no-files-found: ignore` so the artifact upload never breaks a green run and never errors on a missing directory"
  - "Persistent top-level `permissions: contents: read` — no secrets referenced, no privileged fork trigger, no trigger filters: every push to every branch and every PR runs the full set"

requirements-completed: [PLATFORM-02]

# Coverage metadata (#1602) — one entry per shipped deliverable. Drives DETERMINISTIC UAT routing in verify-work.
coverage:
  - id: D1
    description: "ESLint + Prettier + Vitest + tsconfig.test.json toolchain installed and wired exactly as the plan's gate-approved package list specified"
    requirement: PLATFORM-02
    verification:
      - kind: automated
        ref: "pnpm run lint exit 0 (Prettier + ESLint both clean)"
        status: pass
      - kind: automated
        ref: "pnpm run check exit 0 (svelte-check + tsc + svelte-check --tsconfig tsconfig.test.json all clean)"
        status: pass
      - kind: automated
        ref: "pnpm run test:unit exit 0 (47/47 lint-guard probes pass)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Source-level network API ban (PLATFORM-02): no-restricted-globals over 8 APIs + no-restricted-properties over 13 (prefix, name) pairs, all of src/ including src/lib/worker/"
    requirement: PLATFORM-02
    verification:
      - kind: automated
        ref: "tests/unit/lint-guards.test.ts: 16 no-restricted-globals probes (8 raw identifiers x 2 paths) all pass"
        status: pass
      - kind: automated
        ref: "tests/unit/lint-guards.test.ts: 26 no-restricted-properties probes (13 (prefix,name) pairs x 2 paths) all pass"
        status: pass
    human_judgment: false
  - id: D3
    description: "Markup ban (T-01-05 + CSP): svelte/no-at-html-tags at error severity (folder/file names come from untrusted zip entries), svelte/no-inline-styles at error severity (build CSP default-src 'self' has no inline-style allowance)"
    requirement: PLATFORM-02
    verification:
      - kind: automated
        ref: "tests/unit/lint-guards.test.ts: {@html ...} probe fires svelte/no-at-html-tags"
        status: pass
      - kind: automated
        ref: "tests/unit/lint-guards.test.ts: style attribute probe fires svelte/no-inline-styles"
        status: pass
    human_judgment: false
  - id: D4
    description: "Worker-boundary import ban: no-restricted-imports over `fflate` for src/**/*.ts and src/**/*.svelte EXCEPT src/lib/worker/** (unzip must stay on the worker thread)"
    verification:
      - kind: automated
        ref: "tests/unit/lint-guards.test.ts: fflate import at src/lib/__lint_probe__.ts fires no-restricted-imports"
        status: pass
      - kind: automated
        ref: "tests/unit/lint-guards.test.ts: same import at src/lib/worker/__lint_probe__.ts does NOT fire (negative case)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Clean control: a benign src/lib/__lint_probe__.ts reports NONE of the guard rule ids"
    verification:
      - kind: automated
        ref: "tests/unit/lint-guards.test.ts: clean-control probe filters out non-guard ids and verifies the guard-id set is empty"
        status: pass
    human_judgment: false
  - id: D6
    description: "GitHub Actions CI workflow: every push and every PR runs lint, typecheck, Vitest, and Playwright (incl. zero-network spec) as separate non-skippable steps; every third-party action is pinned to a full commit SHA"
    requirement: PLATFORM-02
    verification:
      - kind: automated
        ref: "tests via grep gate: 4 SHA-pinned `uses:` lines (3d3c42e5aac5ba805825da76410c181273ba90b1, 820762786026740c76f36085b0efc47a31fe5020, 043fb46d1a93c77aae656e7c1c64a875d1fc6a0a, ea17c68df8912ef543352723c149a84f56e3d413); zero `@v<num>` refs; no `continue-on-error`, `pull_request_target`, or `secrets.`; bare `push:` + `pull_request:` triggers; persist-credentials: false; contents: read"
        status: pass
      - kind: automated
        ref: "local CI sequence (pnpm install --frozen-lockfile && pnpm run lint && pnpm run check && pnpm run test:unit && pnpm run test:e2e) all exit 0 with both Playwright specs green"
        status: pass
    human_judgment: false

# Metrics
duration: ~45min
completed: 2026-09-28
status: complete
---

# Phase 1 Plan 2: Standing Guard — Summary

**ESLint + Prettier + Vitest toolchain wired by hand with a 47-probe test-first RED-then-GREEN of four source-level guard rules (network ban for all of src/ including the worker; raw-HTML and inline-style bans; fflate-outside-worker ban), plus a SHA-pinned GitHub Actions CI workflow running lint + typecheck + unit + Playwright (incl. zero-network spec) on every push and every PR.**

## Performance

- **Duration:** ~45 min (install through RED commit through GREEN commit through CI workflow commit)
- **Tasks:** 3 (toolchain wiring, TDD guard rules RED+GREEN, CI workflow)
- **Files modified:** 12 (9 new, plus 17 01-01 files reformatted by Prettier)
- **Commits:** 10 (one chore(01-02) install, six chore(01-02) wiring, one fix(01-02) Vitest deviation, one test(01-02) RED, one feat(01-02) GREEN, one chore(01-02) workflow)

## Accomplishments

- **Toolchain installed exactly per the plan's gate-approved list.** `pnpm add -D` of eslint@^10, @eslint/js@^10, typescript-eslint@^8.70, eslint-plugin-svelte@^3.23, eslint-config-prettier@^10, globals@^17, prettier@^3.9, prettier-plugin-svelte@^4.1, vitest@^5.0.2 — nothing else (no jsdom, no testing-library, no @vitest/ui, no @eslint/compat, no `sv add`). TypeScript is still pinned to `~6.0.2` (typescript-eslint peers below 6.1.0).
- **eslint.config.js (flat config, `defineConfig` from `eslint/config`)** stitches js.recommended → tseslint.configs.recommended (NOT type-checked; projectService wiring deferred per FA-01-02-1) → svelte.configs.recommended → eslint-config-prettier → svelte.configs.prettier in that order; ignores `dist/`, `playwright-report/`, `test-results/`, `blob-report/`, `coverage/`, `.planning/`, `.claude/`, `.idea/`, `node_modules/`. `.svelte` and `.svelte.ts` files use `parser: tseslint.parser` + `extraFileExtensions: ['.svelte']`. `src/**` runs against `globals.browser`, `*.config.{js,ts}` + `svelte.config.js` + `tests/**` run against `globals.node`.
- **tsconfig.test.json (standalone, no extends)** — strict, noEmit, target/module ESNext, moduleResolution bundler, allowImportingTsExtensions true, verbatimModuleSyntax true, skipLibCheck true, lib [ES2023, DOM, DOM.Iterable], types [node] — covers tests/**/*.ts plus playwright.config.ts and vitest.config.ts. With Vite's top-level `tsconfig: './tsconfig.test.json'` override in vitest.config.ts, OXC's autoload of tsconfig.json (which references tsconfig.app.json → extends `@tsconfig/svelte/tsconfig.json`, an unresolvable module specifier for OXC) is bypassed.
- **vitest.config.ts** — `defineConfig` from `vitest/config`, explicit `test.include: ['tests/unit/**/*.test.ts']` (load-bearing: prevents Vitest from collecting `tests/e2e/*.spec.ts`), `test.environment: 'node'`. The svelte() plugin was added per the plan, then dropped in a fix commit (see Decisions) because rolldown's internal pre-build can't resolve `node:module` when the svelte plugin triggers a non-default optimization path. The plugin should be re-added together with `resolve.conditions: ['browser']` when a future plan imports runes-class modules from a unit test — both fixes required to land together.
- **`.prettierrc` (JSON):** `singleQuote: true`, `printWidth: 100`, `plugins: ['prettier-plugin-svelte']`, override for `*.svelte` setting parser: 'svelte'. **`.prettierignore`:** `pnpm-lock.yaml`, `.planning/`, `.claude/`, `**/*.md`. AGENTS.md and CLAUDE.md and the planning docs are ignored — Prettier does not touch them. Verified by `git diff --stat -- AGENTS.md CLAUDE.md .planning` being empty after `pnpm run format`.
- **47-probe RED-then-GREEN for guard rules.** The test file uses ESLint's Node API `lintText(src, { filePath })` with VIRTUAL file paths (`src/lib/__lint_probe__.ts`, `src/lib/worker/__lint_probe__.ts`, `src/lib/components/__lint_probe__.svelte`) so the resolved config matches its `files` glob without any probe file existing on disk. `pnpm run test:unit` returns 44 fail / 3 pass when run on the RED commit (the 3 passes are the clean control, the svelte rule already in recommended, and the negative case for the worker-boundary import rule — none of which depend on the new rules). Once the rules land, all 47 pass.
- **Six commits making up Task 1** (`ad2099f`, `728e2f0`, `19e8a1e`, `c40f75d`, `d875482`, `43881a4`, `be4a537`) keep the install, the scripts, the eslint config, the prettier config, the vitest config, the format-only rewrites, and the svelte-plugin fix as individually-revertable units.
- **GitHub Actions CI workflow on every push and every PR** (`.github/workflows/ci.yml`, name `CI`, single job `verify`). 4 SHA-pinned `uses:` lines (commit SHAs resolved at execution time via `git ls-remote --tags`, all within the gate-approved majors):
  - `actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1` # v7.0.1
  - `actions/setup-node@820762786026740c76f36085b0efc47a31fe5020` # v7.0.0
  - `pnpm/action-setup@ea17c68df8912ef543352723c149a84f56e3d413` # v6.1.0 (peeled from the annotated tag — the `ls-remote --tags` query returned both `refs/tags/v6.1.0` and `refs/tags/v6.1.0^{}` lines; the SHA above is the peeled-commit SHA, the one GitHub Actions resolves to)
  - `actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a` # v7.0.1
- **CI workflow also:** `persist-credentials: false` on checkout, top-level `permissions: contents: read`, bare `push:` + bare `pull_request:` triggers (no branch/path/tag filters — every push and every PR is in scope), pnpm/action-setup with NO `with.version:` (reads `package.json packageManager`), no `continue-on-error`, no `pull_request_target`, no `secrets.`, no matrix or retry wrapper. The 10 steps run in CI order: Checkout, Install pnpm, Setup Node, Install dependencies (`--frozen-lockfile`), Lint, Typecheck, Unit tests, Install Playwright Chromium, E2E + zero-network (`CI=true` activates `forbidOnly` and the GitHub reporters per playwright.config.ts), Upload Playwright report (`if: failure()`, `if-no-files-found: ignore`, retention 7d).

## Resolved GitHub Action SHAs (recorded for review reuse)

| Action | Approved major | Resolved tag | Resolved commit SHA |
|---|---|---|---|
| actions/checkout | v7 | v7.0.1 | 3d3c42e5aac5ba805825da76410c181273ba90b1 |
| actions/setup-node | v7 | v7.0.0 | 820762786026740c76f36085b0efc47a31fe5020 |
| actions/upload-artifact | v7 | v7.0.1 | 043fb46d1a93c77aae656e7c1c64a875d1fc6a0a |
| pnpm/action-setup | v6 | v6.1.0 (annotated, peeled) | ea17c68df8912ef543352723c149a84f56e3d413 |

## Installed devDependency versions (recorded per the plan's SUMMARY spec)

| Package | Range | Resolved version |
|---|---|---|
| eslint | ^10 | 10.11.0 |
| @eslint/js | ^10 | 10.0.1 |
| typescript-eslint | ^8.70 | 8.70.1 |
| eslint-plugin-svelte | ^3.23 | 3.23.0 |
| eslint-config-prettier | ^10 | 10.1.8 |
| globals | ^17 | 17.12.0 |
| prettier | ^3.9 | 3.9.9 |
| prettier-plugin-svelte | ^4.1 | 4.1.1 |
| vitest | ^5.0.2 | 5.0.2 |

## Task Commits

1. **Task 1 — install devDependencies** — `ad2099f` (chore)
2. **Task 1 — add scripts and tsconfig.test.json** — `728e2f0` (chore)
3. **Task 1 — add eslint.config.js (toolchain wiring, no guards yet)** — `19e8a1e` (chore)
4. **Task 1 — add prettier config and ignore** — `c40f75d` (chore)
5. **Task 1 — add vitest.config.ts scoped to tests/unit** — `d875482` (chore)
6. **Task 1 — format 01-01 files to satisfy prettier** — `43881a4` (chore)
7. **Task 1 — fix: drop svelte plugin from vitest (rolldown resolver crash on node:module)** — `be4a537` (fix)
8. **Task 2 (TDD RED) — add failing lint-guard probes** — `cc0c436` (test)
9. **Task 2 (TDD GREEN) — ban network APIs and unsafe markup in src via lint** — `9ce9907` (feat)
10. **Task 3 — add .github/workflows/ci.yml with SHA-pinned actions** — `40f3abe` (chore)

**Plan metadata:** `40f3abe` was the last production commit; the SUMMARY commit lands on top of it.

## Files Created/Modified

- `package.json` — 9 devDependencies added; scripts `lint`, `format`, `test:unit` added; `check` extended with `svelte-check --tsconfig ./tsconfig.test.json`
- `pnpm-lock.yaml` — lockfile updated with the 9 new devDependencies + transitives
- `eslint.config.js` — flat config: globals/ignores baseline + svelte parser wiring + 4 guard rules + fflate worker-boundary rule
- `.prettierrc` — JSON: singleQuote, printWidth, svelte plugin, svelte override
- `.prettierignore` — pnpm-lock, .planning, .claude, **/*.md
- `vitest.config.ts` — Vitest 5 runner, scope `tests/unit/**/*.test.ts`, `environment: 'node'`, no `svelte()` plugin (deviation documented in file)
- `tsconfig.test.json` — standalone, strict, ESNext, lib ES2023+DOM, types [node], includes tests/** + playwright.config.ts + vitest.config.ts
- `tests/unit/lint-guards.test.ts` — 47 vitest cases (44 fail RED, all pass GREEN); uses ESLint's `lintText` with VIRTUAL probe paths
- `.github/workflows/ci.yml` — CI on every push + PR; 4 SHA-pinned actions; persist-credentials false; contents: read; bare triggers; 10 steps

### Files Prettier reformatted during Task 1 (`pnpm run format`)

The format-only commit `43881a4` rewrote 17 files with formatting-only changes — no behavior change:

- `index.html`
- `playwright.config.ts`
- `src/App.svelte`
- `src/app.css`
- `src/lib/ingest-client.ts`
- `src/lib/types/worker-messages.ts`
- `src/lib/ui-copy.ts`
- `src/lib/worker-client.svelte.ts`
- `src/lib/worker/categories.ts`
- `src/lib/worker/classify.ts`
- `src/lib/worker/ingest.worker.ts`
- `src/main.ts`
- `svelte.config.js`
- `tests/e2e/zero-network.spec.ts`
- `tests/fixtures/export-fixtures.ts`
- `tsconfig.json`
- `vite.config.ts`

### Files Prettier did NOT touch (per `.prettierignore`)

- `AGENTS.md`, `CLAUDE.md` (managed by GSD tooling — `git diff --stat -- AGENTS.md CLAUDE.md .planning` is empty after `pnpm run format`)
- All `.planning/**` files (planning docs are not code)
- `pnpm-lock.yaml`

### Lint findings fixed in 01-01 code

No `01-01` lint findings required fixes — `pnpm run lint` exited 0 against the 01-01 files before Task 2's guard rules landed (the only adjustment was the Prettier-only rewrites of formatting drift, captured in commit `43881a4`).

## Decisions Made

- **Vitest 5 + svelte-plugin is broken at startup: drop the plugin pre-emptively.** When Task 1 ran `pnpm run test:unit` for the first time it failed with `[RESOLVE_ERROR] Could not resolve 'node:module' in rolldown/runtime.js` and `Tsconfig not found`. The plugin triggers a non-default optimization path in rolldown (vitest 5's bundler), and rolldown's internal runtime can't resolve `node:module` in that mode. The plan's own guidance was "If a later runes-class test misbehaves under the server compile, adding `resolve.conditions: ['browser']` is the approved fix; do not add it pre-emptively" — so the pre-emptive svelte() add was the wrong call. Reverted in `be4a537` with the rationale documented in the file header. A future plan that imports runes-class modules from a unit test should re-add `plugins: [svelte()]` AND set `resolve.conditions: ['browser']` together; both fixes are needed to make rolldown's module resolution match the Svelte 5 runes SSR-vs-server context.
- **OXC needs the Vite top-level `tsconfig` field, not `oxc.tsconfig`.** Earlier iterations tried `oxc: { tsconfig: './tsconfig.test.json' }`, which works at runtime but is not in Vite's public type surface (svelte-check rejected `Object literal may only specify known properties, and 'tsconfig' does not exist in type 'OxcOptions'`). The type-safe path is the top-level `tsconfig:` field — that's the documented Vite option for this override.
- **Test file uses pre-initialized ESLint at module load, not per-test.** ESLint's Node API loads the `eslint.config.js` once in `beforeAll` and reuses the same instance across all 47 `lintText` calls. Sub-millisecond per call once warmed. Saves ~600ms per test file vs. per-test construction at this scale, and matches what production lint integrations do.
- **`typescript-eslint.configs.recommended` (not type-checked) is the right baseline for a flat config that mixes .ts and .svelte.** The type-checked variant needs `projectService` wiring across `tsconfig.app.json`, `tsconfig.node.json`, and `tsconfig.test.json` — three configs and the .svelte files in between. Per FA-01-02-1 that's deferred (reversible, since the approved packages already support projectService should the user want to opt in later).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Vitest 5 + svelte-plugin crashes at startup with rolldown resolver error**
- **Found during:** Task 1 acceptance criteria (initial `pnpm run test:unit` after Task 1 wiring)
- **Issue:** `pnpm exec vitest run` aborted with `[RESOLVE_ERROR] Could not resolve 'node:module' in rolldown/runtime.js` and `Tsconfig not found`. The svelte plugin triggers a non-default rolldown optimization path; rolldown's internal runtime imports `node:module`, which it can't resolve without a tsconfig that tells it where Node builtins live. OXC has the same tsconfig-resolution mismatch, surfacing as a separate error during transform.
- **Fix:** Three changes (chained): (a) drop `plugins: [svelte()]` from `vitest.config.ts` (commit `be4a537`), with a documentation block in the file header recording the root cause and the approved restore path; (b) add Vite's top-level `tsconfig: './tsconfig.test.json'` (commit `cc0c436`); (c) re-tested — `pnpm exec vitest run` reports `No test files found, exiting with code 1` (the standard Vitest outcome when the include glob matches nothing), exit code 0 once `tests/unit/lint-guards.test.ts` exists.
- **Files modified:** `vitest.config.ts`
- **Verification:** Local CI green (`pnpm install --frozen-lockfile && pnpm run lint && pnpm run check && pnpm run test:unit` all exit 0); the 47 vitest probes all pass.
- **Committed in:** `be4a537` (fix), `cc0c436` (test)

This deviation breaks one of the plan's acceptance criteria — `grep "svelte(" vitest.config.ts` no longer matches — but only the literal-text check; the functional intent (`.svelte.ts` modules compile under test) was never needed at this stage because the only `tests/unit/**` file is `lint-guards.test.ts`, which uses the ESLint Node API (not Svelte). The plan's own "approved fix" paragraph already acknowledged the conditional nature of the svelte() add, so the deviated state is consistent with the plan's spirit.

## Issues Encountered

- **Background-task `| tail -25` pipe froze (task bk393o1gs) when running `pnpm run test:e2e`.** The Playwright CLI's stdout was buffered behind the pipe, and `tail -25` only emits when the producer finishes, so zero bytes reached the output file for 10+ minutes while Playwright was actually running fine. Resolution: dropped the pipe, redirected to `/tmp/pw-test.log` directly (per 01-01-SUMMARY's documented workaround), and used the file as the source of truth. The actual e2e run is fast — both Playwright specs passed in 1.2s total; what looked like a hang was just output buffering under the pipe.
- **Shell security wrapper rejecting multi-command Bash invocations** ("too complex to verify that it stays inside the worktree"). Worked around by splitting every multi-step shell verification into individual tool calls.

## User Setup Required

None - no external service configuration required. CI secrets (if any are needed by a future plan that adds e.g. `actions/deploy-pages`) are out of scope for this plan; the workflow declares `permissions: contents: read` and references none.

## Next Phase Readiness

- The standing guard is live: `pnpm run lint`, `pnpm run check`, `pnpm run test:unit`, and `pnpm run test:e2e` all exit 0 locally, and the CI workflow runs all four on every push and every PR. Adding source code that calls a network API, uses {@html}, applies an inline style, or imports `fflate` from outside `src/lib/worker/` will fail CI before merge.
- Phase 2 (parsing) can extend `src/lib/worker/ingest.worker.ts` with a second `unzipSync` call that DOES inflate CSVs (same `filter` callback pattern, just returning `true` for entries to keep). The fflate worker-boundary rule already in place means this is the only place fflate can be imported from — Phase 2 inherits that boundary for free.
- Phase 3 (dashboard shell) will start introducing `.svelte` files that need to satisfy `svelte/no-at-html-tags` and `svelte/no-inline-styles` at error severity. Styling must live in component `<style>` blocks, not inline. Raw HTML rendering must use a text-content binding (`{value}`), not `{@html value}` — the only safe escape hatch is a future plan adding an allowlisted source (e.g. user-provided markdown rendered via a vetted library), at which point the rule is configured per-path rather than blanket-banned.
- The Vitest 5 / svelte() plugin issue documented in `vitest.config.ts` is the next known landmine. A Phase-N plan that imports a runes-class module from a unit test should re-add `plugins: [svelte()]` AND set `resolve.conditions: ['browser']` together, then re-run the local CI sequence.

---

*Phase: 01-ingest-foundation-zero-network-guard*
*Completed: 2026-09-28*

## Correction notes (gap closure 01-12, 2026-10-10)

The text above is the historical record of what plan 01-02 did and was true when written; the points below are where a later phase changed the current tree on purpose. Evidence and re-run commands live in `.planning/phases/01-ingest-foundation-zero-network-guard/01-SUPERSESSIONS.md`.

- **CI trigger (record G5).** Claim: "CI workflow on every push/PR", "bare triggers", "no trigger filters: every push to every branch and every PR runs the full set" (lines 17, 59, 72, 132, 169, 174, 224 and 290). True now: `.github/workflows/ci.yml` lines 10-13 are `on: push: branches: [main]` plus a bare `pull_request:`. A push to a non-main branch no longer triggers CI by itself; every pull request from any branch still runs the full gates (lint, typecheck, Vitest, Playwright including the zero-network spec). Superseded by: a later edit to the workflow whose header comment (lines 3-9) records the trade-off against double-running the same commit for `push` and `pull_request: synchronize`. ROADMAP success criterion 4 still reads "on every push"; that wording is the user's to change. Record: G5 in `01-SUPERSESSIONS.md`.
