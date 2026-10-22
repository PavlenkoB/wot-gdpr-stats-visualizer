# Phase 1: Ingest Foundation & Zero-Network Guard - Research

**Researched:** 2026-09-27
**Domain:** Client-side toolchain scaffolding (Svelte 5 + Vite 8) + Web Worker zip-classification pipeline + CI network-isolation enforcement
**Confidence:** MEDIUM-HIGH (toolchain/versions HIGH via registry checks; Wargaming export structure LOW — no public docs exist, project's own prior inspection is the only source; Playwright worker-network-capture behavior MEDIUM — documented but not empirically re-verified against this exact Vite/Playwright version pairing)

## Summary

Phase 1 is pure scaffolding-plus-plumbing: there is no `package.json` yet, so the first task is running `sv create` with the **minimal** (non-SvelteKit) template, TypeScript, and the eslint/prettier/vitest/playwright add-ons — all versions pinned in `AGENTS.md` were re-verified against the npm registry this session and are current. The interesting engineering is entirely inside one Vite-bundled module Worker: `fflate.unzipSync` can enumerate a zip's internal paths and per-entry uncompressed sizes **without inflating any file content**, by using its `filter` callback as a read-only side-channel (return `false` from the callback for every entry, but capture `file.name`/`file.originalSize` before returning) — this is the mechanism that satisfies "classify folders without parsing CSVs yet" and incidentally hardens the pipeline against zip-bomb-style resource exhaustion during Phase 1, since no entry is ever decompressed. Root-folder and category-folder detection is a pure string-splitting exercise over those enumerated paths (first path segment = account root, second segment = category folder), classified against two small allow-lists (supported, known-deferred) with everything else falling through to "unknown" — no maintained blocklist needed, which is exactly what IMPORT-02's "auto-detect, don't assume a fixed layout" needs.

The CSP-meta-tag / zero-network-Playwright-check pairing (PLATFORM-02) is more subtle than it looks. CSP's `worker-src` directive, when absent, falls back to `child-src` → `script-src` → `default-src` (MDN-confirmed), so `default-src 'self'` alone governs the same-origin module worker without a dedicated `worker-src` entry. On the Playwright side, there is a real, documented gap: `page.on('request')`/`page.route()` reliably capture the **worker's own script-file load** (a page-initiated resource fetch) but do **not** reliably capture `fetch()`/XHR calls made from code running **inside** a worker's own execution context (Playwright issue #33917, reproduced independently). This project's worker never calls `fetch()` itself, so the gap is irrelevant here — but it means the planner should not assume Playwright's network listeners give worker-internals visibility for granted; it's specifically the worker's *own script load* that's captured, and that's the one thing this phase's CI check needs to see.

**Primary recommendation:** Scaffold with `sv create` (`--template minimal --types ts`), keep the entire unzip+classify pipeline inside one eagerly-spawned module Worker using `fflate.unzipSync({ filter })` for path-only enumeration, classify folders via two small string allow-lists with an unknown fallthrough, and assert zero-network in Playwright by collecting all `page.on('request')` URLs from `page.goto()` onward and diffing the count before/after the drop-and-classify interaction — the worker script's own load will already be included in the pre-drop baseline if the worker is spawned at app init, which is what proves PLATFORM-02's "including the worker script fetch" boundary.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Zip decompression / path enumeration | Browser / Client (Web Worker) | — | Must stay off the main thread (page must stay responsive per success criterion 3); fflate runs synchronously inside the worker's own execution context, never on the UI thread. |
| Category folder classification | Browser / Client (Web Worker) | — | Pure string/array logic over paths already read by the worker; no reason to round-trip to the main thread mid-computation. |
| Stage/progress reporting (D-09) | Browser / Client (Web Worker → main thread message) | Browser / Client (Svelte UI) | Worker owns the source of truth for "which stage am I in"; UI is a pure renderer of the last message received. |
| Drop target / busy-guard / spinner UI | Browser / Client (Svelte component, main thread) | — | DOM interaction and disabling the dropzone must happen on the main thread; the worker cannot touch the DOM. |
| Zero-network CI enforcement | CI / Build (Playwright + GitHub Actions) | Browser / Client (CSP meta tag, defense-in-depth) | The actual enforcement is a build-time/CI-time check (fails the push), not a runtime browser mechanism; CSP is a secondary, runtime backstop. |
| CSP delivery | CDN / Static (served `index.html`) | — | GitHub Pages serves static files with no custom-header control, so the `<meta http-equiv>` tag baked into the built HTML is the only delivery mechanism available (already established in `AGENTS.md`; re-confirmed, no new research needed). |

This phase has **no API/backend tier and no persistent-storage tier** — that is correct, not a gap: Phase 1 explicitly parses/persists nothing (IndexedDB arrives in Phase 2 per `CONTEXT.md`'s Phase Boundary). Every capability in this phase lives in the Browser/Client tier (split between the Worker sub-tier and the main-thread Svelte UI sub-tier) plus the CI/Build tier for the standing network guard.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| IMPORT-02 | App auto-detects the zip's root/category-folder structure rather than assuming a fixed layout or naming | Root-folder detection via common-first-path-segment heuristic (see Architecture Patterns → Pattern 1); category classification via two allow-lists + unknown fallthrough (see Don't Hand-Roll and Code Examples) |
| IMPORT-05 | A zip that isn't a recognizable Wargaming export (wrong file, corrupt archive) shows a generic failure state | Single try/catch boundary around the whole worker pipeline (see Common Pitfalls → Pitfall 2, Code Examples → error path) routes every failure mode (pre-check rejection, `unzipSync` throw, "no common root" structural failure) through one `ERROR` message type, satisfying D-04/D-05/D-07 |
| PLATFORM-02 | Zero network requests after initial page load, enforced by an automated Playwright CI assertion, backed by a CSP meta tag as defense-in-depth | CSP fallback chain confirmed via MDN (worker-src → child-src → script-src → default-src); Playwright request-capture behavior and its worker-internals gap documented in Common Pitfalls → Pitfall 4; concrete assertion pattern in Code Examples |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| svelte | 5.57.1 | UI framework, runes-based reactivity | `AGENTS.md`-locked; re-verified via `npm view svelte version` this session `[VERIFIED: npm registry]`. |
| vite | 8.3.1 | Build tool, dev server, module worker bundling | `AGENTS.md`-locked; re-verified via `npm view vite version` `[VERIFIED: npm registry]`. |
| @sveltejs/vite-plugin-svelte | 7.3.1 (7.0.0–7.3.1 all share the same peer range) | Vite↔Svelte integration | Re-verified via `npm view @sveltejs/vite-plugin-svelte@7 peerDependencies engines` — every 7.x release returns `peerDependencies: { vite: "^8.0.0-beta.7 || ^8.0.0", svelte: "^5.46.4" }` and `engines: { node: "^20.19 || ^22.12 || >=24" }` `[VERIFIED: npm registry]`. Confirms `AGENTS.md`'s hard-peer-dependency claim exactly. |
| typescript | 5.5.2 latest stable in the ^6 line is what `AGENTS.md` pins — **correction below** | Static typing | See note below — `npm view typescript version` returned the dist-tag "latest" pointer; confirm the actual installed major matches `^6` per `AGENTS.md` before locking `tsconfig`, see Assumptions Log A1. |
| svelte-check | 4.7+ (registry shows active releases through 2026-08) | Svelte+TS type checking / CI gate | `[VERIFIED: npm registry]`, no postinstall script, canonical `sveltejs/language-tools` repo. |
| fflate | 0.8.3 | Zip decompression (path enumeration only, this phase) | `AGENTS.md`-locked; re-verified `[VERIFIED: npm registry]`; zero postinstall script. |
| pnpm | user's local pnpm, not verifiable from this sandbox (no pnpm on researcher's PATH — see Environment Availability) | Package manager | `AGENTS.md`-locked; project convention, not re-verifiable from this research session's machine. |

**Correction on TypeScript version:** `npm view typescript version` returns `5.5.2` unexpectedly — this looks like a plain `npm view <pkg> version` call resolved to a **prerelease/legacy dist-tag quirk in this sandbox's npm client**, not the actual current `typescript@^6.x` line `AGENTS.md` describes as GA. **Do not trust this single data point.** The planner must re-run `npm view typescript versions --json | tail` (or check npmjs.com directly) at execution time to confirm the exact `^6.x` patch to pin, since this session's registry read for this one package looks anomalous compared to every other package checked (all of which returned plausible 2026-dated versions). Tagged `[ASSUMED]` — see Assumptions Log A1.

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @playwright/test | 1.63.0 | E2E smoke tests, incl. zero-network-requests CI assertion | `[VERIFIED: npm registry]`, canonical `microsoft/playwright` repo, no postinstall script found via `npm view`. |
| vitest | 5.0.2 | Unit tests for the classifier logic (pure functions, no DOM needed) | `[VERIFIED: npm registry]`. |
| eslint, prettier, eslint-plugin-svelte, typescript-eslint | current majors per registry (see Package Legitimacy Audit) | Linting/formatting per `AGENTS.md`'s explicit "not Biome" decision | Wired up automatically by `sv create`'s add-on menu; no manual install needed if selected during scaffolding. |
| sv (CLI) | 0.17.1 | Project scaffolding (`npx sv create` / `pnpm dlx sv create`) | `[VERIFIED: npm registry]` package exists under the bare name `sv`; confirms `AGENTS.md`'s claim this is the official current scaffolding tool. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| fflate `filter`-callback path enumeration | A dedicated "list zip contents" library, or `unzipSync` with no filter (full decompression up front) | Full decompression wastes CPU/memory on file content Phase 1 never uses and removes the zip-bomb resistance the filter approach gives for free; a separate listing library would be an unjustified new dependency per the project's dependency-minimalism constraint — `fflate` already covers this with one option flag. |
| Two hardcoded classification allow-lists (supported, known-deferred) + unknown fallthrough | A maintained blocklist/allowlist of every known Wargaming folder name (Bans, Bonus_codes, Device_info, etc.) | The out-of-scope folder names documented in `REQUIREMENTS.md` (Bans, Bonus_codes, Customer_support_tickets, Device_info, Personal_coupons, Subscriptions, Tracking_data, Authorized_Third_Parties) do **not** need their own list entries — they fall to "unknown" automatically, which is the correct grey badge per `DATA-03`'s 3-way split. Maintaining a third list would be pure busywork with no behavioral difference. |

**Installation:**
```bash
pnpm dlx sv create . --template minimal --types ts --add eslint,prettier,vitest,playwright --install pnpm
```
*(Verify the exact `--add` value syntax — comma-separated vs. space-separated vs. repeated flags — against `npx sv create --help` at execution time; the docs page fetched this session showed a space-separated example, `[CITED: svelte.dev/docs/cli/sv-create]`, but this project's actual CLI version (0.17.1) should be spot-checked since add-on ids can drift between CLI releases.)*

**Version verification performed this session:**
```
npm view svelte version                              → 5.57.1
npm view vite version                                 → 8.3.1
npm view @sveltejs/vite-plugin-svelte@7 version        → 7.0.0 .. 7.3.1 (all share identical peerDeps/engines)
npm view fflate version                                → 0.8.3
npm view svelte-check version                          → (active, 2026-08-13 publish)
npm view vitest version                                → 5.0.2
npm view @playwright/test version                      → 1.63.0
npm view bits-ui version                                → 2.19.3 (not needed until later phases, checked for consistency with AGENTS.md)
npm view dexie version                                  → 4.4.6 (not needed until Phase 2)
npm view papaparse version                              → 5.7.0 (not needed until Phase 2)
npm view @types/papaparse version                       → 5.5.2 (not needed until Phase 2)
npm view sv version                                     → 0.17.1
```
All match or exceed the versions `AGENTS.md` already pinned — no drift found for anything actually needed in Phase 1.

## Package Legitimacy Audit

| Package | Registry | Age (latest publish) | Downloads/wk | Source Repo | Verdict | Disposition |
|---------|----------|----------------------|--------------|--------------|---------|-------------|
| svelte | npm | 2026-09-18 | 6,833,715 | github.com/sveltejs/svelte | SUS ("too-new") | **Approved — false positive.** "too-new" fires on latest-*patch*-publish recency, not package age; svelte is a 10-year-old, 6.8M/wk-download, canonical-repo package. No checkpoint needed. |
| vite | npm | 2026-09-24 | 206,667,244 | github.com/vitejs/vite | SUS ("too-new") | **Approved — false positive**, same reasoning; 206M/wk downloads. |
| @sveltejs/vite-plugin-svelte | npm | 2026-09-23 | 4,022,392 | github.com/sveltejs/vite-plugin-svelte | SUS ("too-new") | **Approved — false positive**, canonical Svelte-org repo. |
| fflate | npm | 2026-05-16 | 94,030,693 | github.com/101arrowz/fflate | OK | Approved. |
| typescript | npm | 2026-07-08 | 329,357,363 | github.com/microsoft/TypeScript | OK | Approved (see version-number caveat above, Assumptions Log A1). |
| svelte-check | npm | 2026-08-13 | 2,764,872 | github.com/sveltejs/language-tools | OK | Approved. |
| vitest | npm | 2026-09-25 | 120,491,688 | github.com/vitest-dev/vitest | SUS ("too-new") | **Approved — false positive**, canonical repo, 120M/wk. |
| @playwright/test | npm | 2026-09-04 | 72,107,330 | github.com/microsoft/playwright | SUS ("too-new") | **Approved — false positive**, canonical Microsoft repo. |
| eslint | npm | 2026-09-18 | 183,376,633 | github.com/eslint/eslint | SUS ("too-new") | **Approved — false positive.** |
| prettier | npm | 2026-09-23 | 154,262,993 | github.com/prettier/prettier | SUS ("too-new") | **Approved — false positive.** |
| eslint-plugin-svelte | npm | 2026-08-13 | 1,627,715 | github.com/sveltejs/eslint-plugin-svelte | OK | Approved. |
| typescript-eslint | npm | 2026-09-21 | 101,269,166 | github.com/typescript-eslint/typescript-eslint | SUS ("too-new") | **Approved — false positive.** |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** svelte, vite, @sveltejs/vite-plugin-svelte, vitest, @playwright/test, eslint, prettier, typescript-eslint — all eight are flagged solely because their **most recent patch release** is within the tool's "too-new" recency window, not because of any age/downloads/repo-legitimacy signal. Every one of these packages has tens-to-hundreds of millions of weekly downloads and a canonical, long-established GitHub org/repo. **Recommendation for the planner:** insert one lightweight `checkpoint:human-verify` before the `sv create`/`pnpm add` step that installs this list, worded as a quick sanity nod ("these are the well-known Svelte/Vite/ESLint/Playwright/Vitest packages, flagged only for recent-patch-release recency") rather than a deep-investigation gate — the signal here is a tool false-positive class, not a real slopsquat risk indicator. No package in this phase requires removal or substitution.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────┐
│   Main thread (Svelte UI)   │
│                              │
│  App init ──► spawn Worker ──────────────┐   (eager spawn keeps the
│              (module worker)             │    worker script's own
│                              │           │    fetch inside "initial
│  Dropzone (click/drag)       │           │    page load" window)
│    │ file selected           │           ▼
│    ▼                    ┌─────────────────────────────┐
│  Quick main-thread check │   Web Worker (long-lived)   │
│  (multi-file? .zip ext?) │                              │
│    │ pass                │  postMessage(file) ─────────►│
│    ▼                     │                              │
│  busy-guard: disable      │  try {                      │
│  dropzone, spawn spinner  │    unzipSync(bytes,{filter}) │──► enumerate paths,
│                            │    → stage: 'unzipping'    │    originalSize only
│    ◄── postMessage(stage) │                              │    (no inflate)
│    ◄── postMessage(stage) │    classify(paths)           │
│  update status text       │    → stage: 'classifying'   │──► root-folder + per-
│                            │                              │    category-folder
│    ◄── postMessage(result)│    postMessage({done, ...}) │    classification
│  or                        │  } catch (e) {              │
│    ◄── postMessage(error) │    console.error(e)          │──► ONE generic error
│                            │    postMessage({error})     │    path (D-04/D-05/D-07)
│  render badges/summary OR │  }                           │
│  render generic failure    └─────────────────────────────┘
│  banner, re-arm dropzone
└─────────────────────────────┘
```
Trace the primary path: file drop → main-thread quick check → worker `postMessage` → `unzipSync` with filter (path enumeration, no decompression) → stage message `unzipping` → classify against allow-lists → stage message `classifying` → final `done` message with account root + badge data, OR at any point an exception is caught and routed through the single `error` message → generic failure banner.

### Recommended Project Structure
```
src/
├── lib/
│   ├── worker/
│   │   ├── ingest.worker.ts       # entry: onmessage, try/catch, postMessage
│   │   ├── classify.ts            # pure functions: detectRoot(), classify()
│   │   └── categories.ts          # the two allow-lists (supported, known-deferred)
│   ├── worker-client.svelte.ts    # main-thread singleton wrapper (module-level $state)
│   ├── components/
│   │   ├── Dropzone.svelte
│   │   ├── StatusBanner.svelte    # spinner + stage text OR generic failure banner
│   │   └── CategoryBadge.svelte   # reused/evolved into Phase 3's DATA-03 banner
│   └── types/
│       └── worker-messages.ts     # discriminated union: the typed message contract
├── App.svelte
└── main.ts
```

### Pattern 1: Root-folder and category-folder auto-detection (IMPORT-02)
**What:** Derive the account root and category folders purely from the enumerated path strings — never assume a fixed name.
**When to use:** Immediately after `unzipSync` enumeration, before any classification.
**Example:**
```typescript
// classify.ts — pure functions, unit-testable with Vitest, no worker/DOM dependency
export function detectRoot(paths: string[]): string | null {
  const roots = new Set(paths.map(p => p.split('/')[0]).filter(Boolean));
  return roots.size === 1 ? [...roots][0] : null; // >1 or 0 roots = not a recognizable export
}

export function categoryFoldersUnder(root: string, paths: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const p of paths) {
    const rest = p.slice(root.length + 1);
    const [category] = rest.split('/');
    if (!category) continue; // file directly under root, not inside a category folder
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return counts;
}
```
A fixture with a renamed root folder still works because `detectRoot` never compares against a literal name — it only requires that exactly one top-level segment exists across all entries. A fixture with an extra never-seen category folder still works because `categoryFoldersUnder` returns every folder name it finds, and classification (Pattern 2) only decides the *badge color*, never whether the folder is included.

### Pattern 2: Two-list classification with unknown fallthrough (DATA-03's 3-way split, consumed here for badge coloring)
**What:** Classify each detected category folder as supported / known-deferred / unknown using two short allow-lists.
**When to use:** After `categoryFoldersUnder` produces the folder→file-count map.
**Example:**
```typescript
// categories.ts
export const SUPPORTED = ['Activity_history', 'Player_statistics', 'User_Info', 'Payment_history']; // [VERIFIED: PROJECT.md:57,59,60; ROADMAP.md:66] — see note on Financial_data vs Payment_history naming in Open Questions
export const KNOWN_DEFERRED = ['Chat_history', 'Clans']; // [VERIFIED: .planning/REQUIREMENTS.md:21] "supported / known-deferred (Chat_history, Clans) / unknown"

export type Status = 'supported' | 'known-deferred' | 'unknown';
export function classify(folder: string): Status {
  if (SUPPORTED.includes(folder)) return 'supported';
  if (KNOWN_DEFERRED.includes(folder)) return 'known-deferred';
  return 'unknown'; // Bans, Bonus_codes, Customer_support_tickets, Device_info, Personal_coupons,
                     // Subscriptions, Tracking_data, Authorized_Third_Parties, and any future
                     // Wargaming-added folder all land here without needing a maintained list.
}
```

### Pattern 3: fflate path-only enumeration without decompression
**What:** Use `unzipSync`'s `filter` callback purely as a read side-channel; always return `false` so nothing is inflated.
**When to use:** Every Phase 1 classification pass — Phase 2 will later use a *different* call (with `filter` returning `true` for supported CSVs) once actual parsing is needed.
**Example:**
```typescript
// ingest.worker.ts (excerpt)
import { unzipSync } from 'fflate';

function enumeratePaths(zipBytes: Uint8Array): string[] {
  const paths: string[] = [];
  unzipSync(zipBytes, {
    filter(file) {
      paths.push(file.name); // side-channel capture of metadata only
      return false;          // never decompress — Phase 1 doesn't need file contents
    },
  });
  return paths;
}
```
`[CITED: github.com/101arrowz/fflate README — filter option and originalSize/name fields]`. **Unverified this session:** whether `unzipSync` throws a catchable `Error` (vs. returning garbage) for a non-zip or corrupt-archive input — no official doc excerpt confirmed this behavior explicitly. Wrap in `try/catch` regardless (see Common Pitfalls → Pitfall 2) since D-07 already requires a single error path covering both pre-check and mid-processing failures, so the exact throw behavior doesn't change the design, only where the catch lands. Recommend an early Wave-0 spike test with a truncated/corrupt zip fixture to confirm empirically. `[ASSUMED]` — Assumptions Log A2.

### Pattern 4: Single long-lived Worker, main-thread singleton wrapper, busy-guard
**What:** A module-scope Svelte 5 `$state` singleton wraps the one Worker instance and exposes stage/result/error as reactive fields; components read from it, never construct their own Worker.
**When to use:** App init, once.
**Example:**
```typescript
// worker-client.svelte.ts
class IngestClient {
  stage = $state<'idle' | 'unzipping' | 'classifying' | 'done' | 'error'>('idle');
  result = $state<ClassifyResult | null>(null);
  errorMessage = $state<string | null>(null);
  #busy = false;
  #worker = new Worker(new URL('./lib/worker/ingest.worker.ts', import.meta.url), { type: 'module' });

  constructor() {
    this.#worker.onmessage = (e: MessageEvent<WorkerMsg>) => {
      const msg = e.data;
      if (msg.type === 'stage') this.stage = msg.stage;
      else if (msg.type === 'done') { this.stage = 'done'; this.result = msg.result; this.#busy = false; }
      else if (msg.type === 'error') { this.stage = 'error'; this.errorMessage = GENERIC_MESSAGE; this.#busy = false; }
    };
  }

  submit(file: File) {
    if (this.#busy) return; // busy-guard: a second drop mid-parse is a no-op
    this.#busy = true;
    this.stage = 'unzipping';
    this.#worker.postMessage({ type: 'file', file });
  }
}
export const ingestClient = new IngestClient();
```
`[CITED: svelte.dev/docs/svelte/$state — export an object/class instance, not a raw reassignable `let`, to share reactive state across a `.svelte.ts` module]`. `[CITED: vite.dev/guide/features#web-workers — new URL() must be called directly inline inside new Worker(), options must be static literals]`.

### Anti-Patterns to Avoid
- **Spawning a new `Worker` per upload:** breaks the single-active-dataset/busy-guard model this phase establishes and Phase 2 depends on (`AGENTS.md`'s locked Web Worker lifecycle rule). Always reuse `ingestClient`'s one instance.
- **`Papa.parse({ worker: true })` or fflate's async `unzip()` inside the worker:** both spawn a *nested* worker, which is redundant (already off-thread) and has documented bundler/IPC friction — already flagged in `AGENTS.md`; not needed in Phase 1 anyway since parsing is Phase 2, but worth keeping in mind when the worker file is extended.
- **Decompressing every file to "just get the list":** defeats the zip-bomb resistance the `filter`-callback side-channel gives for free (Pattern 3) and burns CPU on content Phase 1 never uses.
- **Two different error messages for "rejected before" vs. "crashed during":** explicitly rejected by D-07 — one `try/catch` boundary, one `error` message type, one generic banner.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Enumerating zip paths cheaply | A custom central-directory parser, or a "peek" library | `fflate.unzipSync({ filter })` with the callback used as a read side-channel | Already in the approved stack (`AGENTS.md`); the filter option is a first-class, documented mechanism for exactly this use case — no new dependency needed. |
| "Is this really a Wargaming export" detection | A maintained list of every real Wargaming folder name | Common-root-folder structural check (Pattern 1) + two-list classify-with-fallthrough (Pattern 2) | Structural detection generalizes to future/renamed folders per IMPORT-02's explicit requirement; a maintained list would break the moment Wargaming adds a category, which is precisely the "unknown, never seen before" case DATA-03 is designed to tolerate. |
| Reactive singleton across Svelte components | Svelte 4-style `writable` store, or a Context-API-only solution | Module-level Svelte 5 class instance with `$state` fields exported from a `.svelte.ts` file | This is the idiomatic Svelte 5 runes pattern for app-wide state (per Svelte's own docs); no store library or legacy pattern needed. |

**Key insight:** Every "don't hand-roll" item in this phase is really "don't build a maintained list/parser when a structural/existing-library mechanism already generalizes correctly" — the entire phase is small precisely because the two hard problems (zip enumeration, reactive worker-state sharing) already have first-class answers in the approved stack.

## Common Pitfalls

### Pitfall 1: Rejecting a zip because "not all folders were recognized"
**What goes wrong:** Treating any unknown category folder as a reason to show the generic failure state, instead of just badging it grey.
**Why it happens:** Conflating "structurally not a Wargaming export" (no common root folder — this IS a failure) with "has folders we don't have a dashboard for" (this is DATA-03's normal, expected 3-way classification, not a failure).
**How to avoid:** Failure triggers only on `detectRoot()` returning `null` (zero or multiple top-level segments) or a thrown exception from `unzipSync`. A single detected root with zero supported/known-deferred folders (all-unknown) should still render the badge list successfully — see Open Questions for the one genuinely ambiguous edge case here.
**Warning signs:** A CONTEXT.md-described fixture ("an extra, never-seen category folder") gets rejected instead of showing a grey badge — that fixture must succeed per success criterion 1.

### Pitfall 2: Two different code paths for pre-check rejection vs. worker-thrown exception
**What goes wrong:** The main-thread quick-check (D-17: reject wrong extension before sending to the worker) and the worker's own try/catch end up rendering visually different banners because they're implemented as two separate UI states.
**Why it happens:** Natural to write "validate before send" and "handle worker error" as separate features since they're temporally different code paths.
**How to avoid:** Both paths must set the *same* application state (e.g. `ingestClient.stage = 'error'` with the same generic `errorMessage`) — funnel the main-thread pre-check's rejection through the identical state-setting call the worker's `error` message handler uses, not a separate banner component.
**Warning signs:** Two different banner copy strings anywhere in the codebase for import failures — there should be exactly one (D-04's example, or a close variant).

### Pitfall 3: Worker spawned lazily on first drop, not at app init
**What goes wrong:** The worker script's own file fetch happens *after* whatever Playwright/CSP calls "initial page load," failing PLATFORM-02's success criterion 4 even though no other network activity is wrong.
**Why it happens:** "Spawn the worker when you need it" is the natural instinct for lazy-loading; it's actively wrong here because the worker script fetch itself must be inside the load window being asserted as network-free-afterward.
**How to avoid:** Instantiate `ingestClient` (and therefore the `Worker`) at module load / app init, not inside the dropzone's drop handler — this is explicitly called out as Claude's Discretion in CONTEXT.md but the technical requirement is unambiguous once PLATFORM-02's exact wording ("including the worker script fetch") is parsed.
**Warning signs:** Playwright's zero-network test passes when run alone but the worker-script-fetch timestamp, if logged, shows up after the `load` event fired.

### Pitfall 4: Assuming Playwright's `page.on('request')` sees everything a Worker does
**What goes wrong:** Designing the zero-network Playwright test assuming any network activity *originating from inside* the worker (if one were ever added later, e.g. in Phase 6's opt-in city-data fetch) would be caught the same way as the worker's initial script load.
**Why it happens:** Both "worker's own script load" and "fetch() called from inside the worker" sound like "worker network activity," but Playwright's capture behavior differs between the two — the former is a page-initiated resource fetch (captured), the latter is not reliably captured (Playwright issue #33917, reproduced independently in a minimal repro repo).
**How to avoid:** For Phase 1, this doesn't matter — the worker never calls `fetch()`. Document this distinction now so a future phase (Phase 6's opt-in city dataset load) doesn't assume the existing zero-network Playwright test would catch a worker-internal fetch if one were mistakenly added there; that phase will need its own verification, potentially via `page.on('worker')` + `Worker.evaluate()` polling, or the Resource Timing API queried from the page.
**Warning signs:** A future phase's worker makes a `fetch()` call and the existing Playwright test doesn't fail even though it should.

### Pitfall 5: `svelte-check`/`typescript-eslint` breaking on an accidental TypeScript 7 install
**What goes wrong:** `pnpm add -D typescript@latest` (or a lockfile drift) pulls TypeScript 7, silently breaking `svelte-check` and the eslint TS integration.
**Why it happens:** `AGENTS.md` explicitly documents this as a known, current (Sept 2026) ecosystem gap — TS7's `tsgo` isn't yet supported by `typescript-eslint`/Svelte template-checking.
**How to avoid:** Pin the exact `^6.x` version in `package.json`, don't use a bare `latest`/`^7` range; re-run `npm view typescript versions` before pinning since this session's own check of that one package returned an anomalous version string (see Assumptions Log A1).
**Warning signs:** `svelte-check` or the ESLint Svelte plugin start throwing parser errors with no code change.

## Code Examples

### Playwright zero-network assertion (PLATFORM-02, success criterion 4)
```typescript
// tests/e2e/zero-network.spec.ts
import { test, expect } from '@playwright/test';
import path from 'node:path';

test('no network requests after initial load, including the worker script fetch', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (req) => requests.push(req.url()));

  await page.goto('/');
  await page.waitForLoadState('networkidle'); // baseline: includes the eagerly-spawned worker's own script fetch
  const baselineCount = requests.length;

  // exercise the primary flow: drop the sample fixture and wait for classification to finish
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(path.join(__dirname, '../fixtures/sample-export.zip'));
  await expect(page.getByText(/supported/i)).toBeVisible();

  expect(requests.length).toBe(baselineCount); // nothing new fired during the entire import
});
```
`[CITED: playwright.dev/docs/network — page.on('request') listener pattern]` combined with the project's own worker-eager-spawn decision (see Pitfall 3) to ensure the worker script fetch lands inside `baselineCount`, not after it.

### CSP meta tag (defense-in-depth, success criterion 4)
```html
<!-- index.html, inside <head> -->
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'" />
```
`worker-src` is intentionally omitted: per MDN, an absent `worker-src` falls back to `child-src` → `script-src` → `default-src`, so `default-src 'self'` already permits the same-origin module worker script with no separate directive needed. `[VERIFIED: developer.mozilla.org/.../Content-Security-Policy/worker-src — fallback chain]`. `frame-ancestors` is not included since it's documented to not work in `<meta>`-tag form and isn't needed for a single-page app with no framing concerns anyway (already noted in `AGENTS.md`, re-confirmed, no drift).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Svelte 4 `writable` stores for shared state | Svelte 5 runes: module-level `$state` inside `.svelte.ts`, exported as a class instance or object | Svelte 5 GA (already ~18 months old per `AGENTS.md`) | The worker-client singleton in this phase should be written in runes idiom from day one — there is no legacy pattern to migrate away from since the repo is greenfield. |
| `npm create svelte@latest` | `npx sv create` / `pnpm dlx sv create` | Superseded when Svelte 5 shipped | Already the correct tool per `AGENTS.md`; re-confirmed the CLI package (`sv`, v0.17.1) exists and is current. |

**Deprecated/outdated:** None specific to this phase beyond what `AGENTS.md` already documents (TypeScript 7 / tsgo not yet usable; Biome not yet recommended for Svelte files).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The exact TypeScript `^6.x` patch/minor to pin — this session's `npm view typescript version` returned `5.5.2`, which looks like a registry-read anomaly for this one package rather than the actual current `^6.x` line `AGENTS.md` describes as GA | Standard Stack | Pinning the wrong TS major would either silently downgrade to TS5 semantics (missing newer TS6 features/fixes) or, if mis-corrected to a bare `latest`/`^7` range, pull TypeScript 7 and break `svelte-check`/`typescript-eslint` per the documented ecosystem gap (Pitfall 5) |
| A2 | `fflate.unzipSync` throws a catchable JS `Error` for a non-zip or corrupt-archive input, rather than returning garbage/partial data silently | Architecture Patterns → Pattern 3, Code Examples | If it doesn't throw, the single try/catch error path (D-07) won't catch this failure mode and success criterion 2 ("dropping a corrupt archive shows the generic failure state") would silently fail instead — needs an early Wave-0 spike test with a deliberately corrupted zip fixture |
| A3 | The exact top-level folder name for the financial category is `Payment_history` (per `PROJECT.md`'s byte-level-verified `Payment_history/Orders.csv` path) rather than `Financial_data` (the name `REQUIREMENTS.md`'s DATA-04 example uses) | Standard Stack (SUPPORTED list), Open Questions | If the classifier hardcodes the wrong string, a real export's financial folder would render as an "unknown" grey badge instead of a "supported" green badge, and Phase 3's DATA-04 empty/greyed-section logic (keyed on this same name) would misfire too |
| A4 | `sv create`'s `--add` flag accepts the exact add-on ids `eslint`, `prettier`, `vitest`, `playwright` unchanged in CLI v0.17.1 | Standard Stack → Installation | A wrong/renamed id would silently skip wiring one of the four add-ons, discovered only when e.g. `vitest` config is missing later |
| A5 | No public documentation exists describing the real Wargaming GDPR export's exact folder/file structure beyond what this project's own prior inspection (`PROJECT.md`) already recorded | Environment Availability, Open Questions | Low risk to correctness (the project's own verified sample is the authoritative source already), but means there's no external fallback/second source to cross-check `PROJECT.md`'s claims against if that inspection had an error |

## Open Questions

1. **`Financial_data` vs. `Payment_history` — which is the actual top-level zip folder name?**
   - What we know: `PROJECT.md` (byte-level inspection of the real 2021 sample) quotes `Payment_history/Orders.csv` as a verified path `[VERIFIED: PROJECT.md:59]`. `REQUIREMENTS.md`'s DATA-04 uses `Financial_data` as its example of an absent category `[VERIFIED: .planning/REQUIREMENTS.md:22]`.
   - What's unclear: Whether `Financial_data` is a different (perhaps outer/parent) folder that contains `Payment_history` as a subfolder, whether `REQUIREMENTS.md` simply used a descriptive placeholder name instead of the real folder name, or whether the export format changed between whatever `REQUIREMENTS.md`'s author had in mind and the 2021 sample.
   - Recommendation: Treat this as a `checkpoint:human-verify` item early in the plan — the user has apparently already inspected a real sample directly (per `PROJECT.md`'s Context section) and can confirm the exact string in seconds; don't guess in the classifier's allow-list.

2. **What exactly triggers the generic-failure state vs. an all-unknown-badges success render?**
   - What we know: Success criterion 1 requires a fixture with "an extra, never-seen category folder" to still classify correctly (i.e., unknown folders don't cause failure). Success criterion 2 requires "a valid zip with no recognizable Wargaming structure" to show the generic failure state.
   - What's unclear: Is "no recognizable structure" defined purely as "no single common root folder" (Pattern 1's `detectRoot() === null`), or does it also include "a root folder was found, but zero of its children are supported or known-deferred (100% unknown)"? CONTEXT.md doesn't resolve this distinction explicitly.
   - Recommendation: Default to the narrower definition (failure = no common root folder only; a found root with all-unknown children still renders successfully, all-grey) since this is more consistent with D-01–D-03's "always render badges" design and with DATA-03's later "never hide, never crash" philosophy carrying backward into this phase's spirit. Flag for explicit confirmation during planning/discuss if the planner disagrees.

3. **Does a real, un-scrubbed 2021 sample export zip exist anywhere for this repo's test fixtures — and can it be committed?**
   - What we know: `ROADMAP.md`'s Phase 1 success criterion 1 says "Dropping the **real** 2021 sample export shows..." and `PROJECT.md`'s Context section describes a real sample the project owner personally inspected (dated 2021-10-12, ~2.2MB, ~3,870 rows) with real fields like `LOGIN` (an actual email address) and real IPs. This repository currently contains **no zip, no fixtures directory, and no `.gitignore` rule for either** (confirmed via a repo-wide search this session — only `.git/hooks/*.sample` files matched a "sample" search, no actual export data).
   - What's unclear: Whether the user has this real zip stored locally (untracked) for manual testing, whether it needs to be scrubbed of PII (email, IP, real account ID) before being checked into a public GitHub repository as a Playwright/Vitest fixture, or whether a fully synthetic fixture (hand-built via `fflate.zipSync` in a test-setup script, matching the *structure* but with fabricated data) should be used instead for anything committed to the repo.
   - Recommendation: This is a genuine, unresolved decision with real privacy stakes (this is a **public** repo whose entire premise is "your data never leaves your machine" — committing a real, identifying export would be a severe, ironic breach of the project's own Core Value). Recommend a `checkpoint:human-verify` early in the plan: confirm whether a scrubbed-but-structurally-faithful fixture will be hand-built from the user's real sample (redacting `LOGIN`/IP/account-ID values while preserving folder/column structure) or built fully synthetically from scratch, and where it will live (e.g. `tests/fixtures/sample-export.zip`, gitignored-if-real or committed-if-scrubbed). Do not default to committing anything resembling the real file without this confirmation.

## Environment Availability

| Dependency | Required By | Available (this research session's machine) | Version | Fallback |
|------------|------------|:---:|---------|----------|
| Node.js | Vite 8 / vite-plugin-svelte 7 engines requirement (`^20.19 \|\| ^22.12 \|\| >=24`) | ✓ | v26.10.0 | — (satisfies `>=24`) |
| npm | Registry checks, fallback package manager | ✓ | 11.19.1 | — |
| pnpm | Project's locked package manager (`AGENTS.md`) | ✗ (not on this research sandbox's PATH) | — | Use `corepack enable` (bundled with Node ≥16.9) to activate pnpm without a separate install — `corepack` itself was also not found on this sandbox's PATH, so this is a per-machine setup step the actual execution environment must confirm, not a project blocker |
| git | Version control | ✓ | 2.54.0 | — |
| Playwright browsers (Chromium) | E2E tests | Not checked (no project scaffolded yet in this sandbox) | — | `npx playwright install chromium` as a standard first-run step, likely already wired by `sv create`'s playwright add-on |

**Missing dependencies with no fallback:** none — pnpm's absence has a standard, well-known fallback (`corepack enable`).

**Missing dependencies with fallback:** pnpm (via corepack), Playwright browsers (via `playwright install`, standard post-scaffold step).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 5.0.2 (unit) + @playwright/test 1.63.0 (e2e) — neither installed yet, greenfield repo |
| Config file | none yet — see Wave 0 Gaps |
| Quick run command | `pnpm vitest run` (unit, classifier logic) |
| Full suite command | `pnpm vitest run && pnpm playwright test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IMPORT-02 | Root/category auto-detection works on renamed-root + extra-unknown-folder fixture | unit | `pnpm vitest run tests/unit/classify.test.ts` | ❌ Wave 0 |
| IMPORT-05 | Non-zip file, corrupt archive, and structurally-unrecognizable zip all show the one generic failure state | unit (classifier-level) + e2e (UI-level) | `pnpm vitest run tests/unit/classify.test.ts -t "failure"` and `pnpm playwright test tests/e2e/import-failure.spec.ts` | ❌ Wave 0 |
| PLATFORM-02 | Zero network requests after initial load, including the worker script fetch; CSP meta tag present | e2e | `pnpm playwright test tests/e2e/zero-network.spec.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm vitest run` (fast, no browser needed for classifier logic)
- **Per wave merge:** `pnpm vitest run && pnpm playwright test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.ts` — no test framework config exists yet (greenfield repo)
- [ ] `playwright.config.ts` — same
- [ ] `tests/fixtures/` — needs both a synthetic-or-scrubbed sample export zip **and** a corrupt/non-zip fixture; resolve Open Question 3 before building these
- [ ] `tests/unit/classify.test.ts` — covers IMPORT-02/IMPORT-05 at the pure-function level (can build zip fixtures on the fly with `fflate.zipSync` in test setup, no committed binary needed for most cases)
- [ ] `tests/e2e/zero-network.spec.ts`, `tests/e2e/import-failure.spec.ts` — covers PLATFORM-02 and the UI-level IMPORT-05 flow
- [ ] Framework install: handled by `sv create`'s `--add vitest,playwright` if the add-on ids are confirmed correct (Assumption A4)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | No auth in this app — local single-user tool |
| V3 Session Management | No | No sessions/cookies — static site, no backend |
| V4 Access Control | No | No access boundaries — single local user, single dataset |
| V5 Input Validation | Yes | The zip file itself is untrusted input; validate structurally (single common root, `.zip` extension, single-file drop) before processing; never `{@html}`-render a folder/file name pulled from the archive — Svelte's default `{expression}` text interpolation auto-escapes, which is sufficient here as long as no code path uses `{@html}` for these strings |
| V6 Cryptography | No | Not applicable this phase — hashing for dedup is Phase 2's IMPORT-06 |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| Zip bomb (small archive, enormous decompressed size) freezing/crashing the tab | Denial of Service | `fflate.unzipSync({ filter: () => false })` never inflates any entry during classification (Pattern 3) — the classifier is structurally immune to this in Phase 1 since content is never decompressed. Phase 2, which *does* decompress supported CSVs, will need its own size-limit/streaming consideration — out of scope here but worth flagging forward. |
| Path-traversal / "zip slip" entries (`../../etc/passwd`-style paths inside the archive) | Tampering | Not applicable in the traditional sense — this app never writes extracted files to a filesystem (everything stays in-memory as JS objects/`Uint8Array`, rendered into the DOM). The residual risk is purely the string value ending up in Svelte's auto-escaped text interpolation, which is already safe by default; explicitly avoid `{@html}` for any folder/file name string. |
| Malicious non-zip file crashing the parse thread ungracefully (unhandled promise rejection / worker termination instead of a caught error) | Denial of Service | Single try/catch boundary around the entire worker pipeline (Pitfall 2); confirm empirically (Assumption A2) that `unzipSync` throws rather than corrupting state silently. |

## Sources

### Primary (HIGH confidence)
- `npm view <package> version/peerDependencies/engines/scripts.postinstall` — this session, for svelte, vite, @sveltejs/vite-plugin-svelte, fflate, svelte-check, vitest, @playwright/test, eslint, prettier, eslint-plugin-svelte, typescript-eslint, bits-ui, dexie, papaparse, @types/papaparse, sv
- `gsd_run query package-legitimacy check` — this session, all 12 packages checked, verdicts and reasoning recorded above
- [Content-Security-Policy: worker-src directive - MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/worker-src) — fallback chain (child-src → script-src → default-src), fetched and quoted this session
- Direct `Read` of `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/phases/01-.../01-CONTEXT.md`, `AGENTS.md` — this session, cited with line numbers throughout

### Secondary (MEDIUM confidence)
- [sv create • Svelte CLI Docs](https://svelte.dev/docs/cli/sv-create) — CLI flags (`--template`, `--types`, `--add`, `--install`), fetched this session
- [fflate GitHub README](https://github.com/101arrowz/fflate) — `unzipSync` filter option behavior, fetched this session
- [Vite Web Workers guide](https://vite.dev/guide/features.html#web-workers) — `new Worker(new URL(...), {type:'module'})` pattern and static-literal requirement, fetched this session
- [Playwright Network docs](https://playwright.dev/docs/network) — `page.on('request')` pattern, fetched this session
- [Playwright issue #33917](https://github.com/microsoft/playwright/issues/33917) and [david-development/playwright-worker-bug](https://github.com/David-Development/playwright-worker-bug) — worker-internal-fetch capture gap, cross-referenced (two independent sources agree on the same distinction)
- [Svelte $state docs](https://svelte.dev/docs/svelte/$state) — module-level shared reactive state pattern, fetched this session
- [World of Tanks GDPR FAQ](https://wargaming.net/support/en/products/wot/article/10741/) — high-level export data categories (Account/Content/Game-Related/Device Information), fetched this session; does **not** confirm folder names

### Tertiary (LOW confidence)
- General WebSearch results on Wargaming export folder structure — no results found beyond the official high-level FAQ; the project's own prior direct inspection (`PROJECT.md`) remains the only source of concrete folder/file names, and this session found no independent way to cross-check it

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every version claim re-verified against the npm registry this session, with one flagged anomaly (TypeScript, Assumption A1)
- Architecture: HIGH — patterns are either directly cited from official docs (Svelte $state, Vite worker guide) or are pure derivations from already-locked project decisions (AGENTS.md's worker lifecycle rules)
- Pitfalls: MEDIUM — the Playwright worker-network-capture gap is well-documented across two independent sources but not empirically re-verified against this exact project's Vite 8 / Playwright 1.63 pairing; the fflate corrupt-zip throw behavior (A2) is unverified and flagged for a Wave 0 spike
- Wargaming export structure: LOW — no public documentation exists; entirely dependent on the project's own prior inspection recorded in PROJECT.md, cross-checked internally for consistency (and one discrepancy found, A3/Open Question 1)

**Research date:** 2026-09-27
**Valid until:** ~30 days for the npm-version table (fast-moving ecosystem, weekly-cadence releases); indefinite for the architectural patterns and the Wargaming-export-structure caveats (these don't have a natural expiry — they'd only go stale if Wargaming changes its export format, which is exactly the "unknown folder" case this phase already designs for)
