# wot-gdpr-stats-visualizer

A browser-only, zero-backend tool that turns a Wargaming GDPR personal-data export
(the "Data Export" zip Wargaming provides on request for World of Tanks, WoT
Blitz, World of Warships, and World of Warplanes accounts) into an interactive
dashboard. Everything happens client-side: unzip, parse, store, and render,
with zero network requests after the page loads.

**Your data never leaves your machine.** This is the whole point — see
`AGENTS.md` for the constraints that follow from it.

## Quick start

Requires Node 22.12+ and pnpm 12.6+.

```bash
pnpm install --frozen-lockfile
pnpm run build
pnpm run preview
```

Opens at <http://localhost:4173>. Drop the Wargaming GDPR export zip you
received into the page; the account root and category folders are classified
inside one long-lived Web Worker and rendered. No network requests are made
after the initial page load — the DevTools Network tab stays empty after
the drop.

For local development with HMR (no CSP meta applied):

```bash
pnpm run dev
```

## Verifying the privacy guarantee

```bash
pnpm run lint           # Prettier + ESLint (source-level network ban)
pnpm run check          # svelte-check + tsc over app, node, and test configs
pnpm run test:unit      # Vitest: 143 unit tests
pnpm run test:e2e       # Playwright: 20 e2e tests against the built app
```

The Playwright suite includes `tests/e2e/zero-network.spec.ts` — it asserts
exactly one worker URL is loaded eagerly, every URL is same-origin, and
zero requests happen after the initial-load baseline. CI runs the same four
gates on every push (see `.github/workflows/ci.yml`).

## Test fixtures

All test zips are generated in memory by `tests/fixtures/export-fixtures.ts`
with fabricated values only (account ID `123456789`, emails at
`example.invalid`, IPs in the RFC 5737 documentation ranges). No real
export data may ever be committed — see `tests/fixtures/README.md` and
`.gitignore`. If you have your own Wargaming export, keep it outside the
repo and drop it into the running app to verify the end-to-end flow.

## Stack

Svelte 5 (runes) + Vite 8 + TypeScript 6, fflate + PapaParse for unzip and
CSV (both run inside the Web Worker, not the main thread), Dexie for
IndexedDB persistence (added in Phase 2). Charts and the file dropzone are
hand-rolled — see `AGENTS.md` for the rationale. ESLint flat config +
Prettier + Vitest + Playwright with SHA-pinned GitHub Actions.

See `.planning/ROADMAP.md` for the phased build plan and `AGENTS.md` for
the locked stack and worker-lifecycle constraints.
