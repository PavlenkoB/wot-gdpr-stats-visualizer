# Phase 1: Ingest Foundation & Zero-Network Guard - Pattern Map

**Mapped:** 2026-09-27
**Files analyzed:** 0 existing (repo is fully greenfield)
**Analogs found:** 0 / N/A

## Greenfield Status

Confirmed via `ls` at repo root: only `AGENTS.md`, `CLAUDE.md`, `LICENSE`, `README.md`, and `.planning/` exist. No `package.json`, no `src/`, no scaffolded app, no git-tracked source files of any kind. There is **no existing codebase to extract analog patterns from** — this phase establishes the first patterns for the project.

Per this agent's instructions, when the repo is confirmed greenfield, RESEARCH.md's own "Recommended Project Structure" and "Architecture Patterns" sections serve as the pattern source of truth in place of codebase analogs. The planner should reference `01-RESEARCH.md` directly for all pattern needs in this phase.

## File Classification (files this phase will create — no analogs, first of their kind)

| New File | Role | Data Flow | Pattern Source (RESEARCH.md) |
|----------|------|-----------|-------------------------------|
| `src/lib/worker/ingest.worker.ts` | worker/controller | event-driven (postMessage) | Architecture Patterns → Pattern 3, Pattern 4; Code Examples |
| `src/lib/worker/classify.ts` | utility (pure functions) | transform | Architecture Patterns → Pattern 1 |
| `src/lib/worker/categories.ts` | config (allow-lists) | — | Architecture Patterns → Pattern 2 |
| `src/lib/worker-client.svelte.ts` | provider/store (singleton) | event-driven | Architecture Patterns → Pattern 4 |
| `src/lib/components/Dropzone.svelte` | component | request-response (UI event → worker) | Common Pitfalls → Pitfall 2, Pitfall 3; Recommended Project Structure |
| `src/lib/components/StatusBanner.svelte` | component | — | Decisions D-04–D-09 in CONTEXT.md; Pattern 4 (stage field) |
| `src/lib/components/CategoryBadge.svelte` | component | — | Decisions D-01–D-03 in CONTEXT.md |
| `src/lib/types/worker-messages.ts` | model (discriminated union) | event-driven | Architecture Patterns → Pattern 4 (`WorkerMsg` type) |
| `index.html` (CSP meta tag) | config | — | Code Examples → CSP meta tag |
| `tests/e2e/zero-network.spec.ts` | test | request-response (network capture) | Code Examples → Playwright zero-network assertion |
| `tests/e2e/import-failure.spec.ts` | test | event-driven | Common Pitfalls → Pitfall 2; D-04–D-07 |
| `tests/unit/classify.test.ts` | test | transform | Architecture Patterns → Pattern 1, Pattern 2 |
| `vitest.config.ts`, `playwright.config.ts` | config | — | Validation Architecture → Wave 0 Gaps |

## No Analog Found

All files above — reason: repo is greenfield, this is the first phase of implementation. There is no prior controller, component, service, model, middleware, or config file in the codebase to copy conventions from.

**Directive for planner:** treat `01-RESEARCH.md`'s sections `Recommended Project Structure`, `Architecture Patterns` (Pattern 1–4), `Code Examples`, and `Common Pitfalls` as the authoritative pattern source for this phase's plan actions, in place of the codebase-analog excerpts this document would normally contain. Once this phase's files exist, later phases' PATTERNS.md documents should point back to these files as the project's first established analogs (e.g. Phase 2's worker/service files should analogize to `src/lib/worker/ingest.worker.ts`; Phase 3's badge/banner UI should analogize to `CategoryBadge.svelte`/`StatusBanner.svelte`).

## Metadata

**Analog search scope:** entire repository (`ls` at root; confirmed no `src/` directory exists)
**Files scanned:** 0 (none exist)
**Pattern extraction date:** 2026-09-27
