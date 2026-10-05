# wot-gdpr-stats-visualizer

A browser-only, zero-backend tool that turns a Wargaming GDPR personal-data export
(the "Data Export" zip Wargaming provides on request for World of Tanks, WoT
Blitz, World of Warships, and World of Warplanes accounts) into an interactive
dashboard. Everything happens client-side: unzip, parse, store, and render,
with zero network requests after the page loads. The one exception is an
optional, user-initiated same-origin download of city-level detail, described
under "What the page requests".

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
the drop, and stays empty unless you click the optional city-level detail
button (see "What the page requests").

For local development with HMR:

```bash
pnpm run dev
```

The dev server applies no CSP meta tag — that tag is injected at build time,
so it only exists in `dist/`. The zero-network assertion (PLATFORM-02, checked
by `tests/e2e/guards/zero-network.spec.ts`) therefore applies only to
`pnpm run build && pnpm run preview` and to CI's e2e step, never to
`pnpm run dev`. Use the dev server for editing with HMR, and verify any privacy
or network change against the built preview.

## Verifying the privacy guarantee

```bash
pnpm run lint           # Prettier + ESLint (source-level network ban)
pnpm run check          # tsc -b over app, node, and test configs, then svelte-check over the app config (reads the .svelte files tsc skips)
pnpm run test:unit      # Vitest: 337 unit tests
pnpm run test:e2e       # Playwright: 86 e2e tests against the built app
```

The Playwright suite includes `tests/e2e/guards/zero-network.spec.ts` — it asserts
exactly one worker URL is loaded eagerly, every URL is same-origin, and
zero requests happen after the initial-load baseline. CI runs the same four
gates on every push (see `.github/workflows/ci.yml`).

## What the page requests, and what enforces it

After the page has loaded the app makes **no** network request while you import,
browse, sort, reveal addresses or open the map. There is exactly **one**
sanctioned exception: the city-level detail in the login history is an opt-in.
Nothing is downloaded until you press its button, and then the page asks for ONE
static file from its own origin (`geo-city-data/<name>.citydb.bin`) with a plain
GET, made from the main thread by `src/lib/geo/city-fetch.ts`. The file is the
same for every visitor, so the request reveals nothing about the account's
addresses, and nothing it fetches is persisted. A build that carries no city file
shows the button as unavailable and makes no request at all.

The Content-Security-Policy meta tag (`default-src 'self'; connect-src 'self'; ...`)
is **defence in depth only**. A meta CSP does not govern a Web Worker (a
module-worker `fetch` returned 200 under `connect-src 'none'` when this was
measured), and a `'self'` source cannot be restricted to a path, so the policy
does not and cannot limit the one request to the city file. What actually
enforces the promise:

- the ESLint network ban over `src/lib/geo/` and `src/lib/worker/`, with exactly
  one exempt file (`city-fetch.ts`), plus a source scan
  (`tests/unit/guards/fetch-scan.test.ts`) that counts one call site;
- the Playwright request counting in `tests/e2e/guards/zero-network.spec.ts`,
  which sees a worker's traffic as well as the page's and fails on any request
  after the load baseline, any second worker and any CSP violation, through
  every flow including a 10,000-row import; and
- the city opt-in specs, which assert WHICH asset the one request fetched.

## Offline geolocation

Addresses are placed on a country (and, if you opt in, a city) from DB-IP Lite
data that is processed **at build time**; the browser never asks a geo service.
Five scripts do the work, and `geo:map:check` verifies one of them:

```bash
pnpm run geo:country -- --download   # country range table -> src/lib/geo/assets/country-table.bin
pnpm run geo:country:fixture         # the 377-byte documentation-range table for tests
pnpm run geo:map                     # the world map -> src/lib/geo/world-map.generated.ts
pnpm run geo:map:check               # regenerate in memory, fail if it differs from the committed map
pnpm run geo:city -- --download      # the city dataset -> public/geo-city-data/ (gitignored)
pnpm run geo:city:fixture            # the few-hundred-byte city fixture for tests
```

The country table and the map module are committed generated assets: the table
is inlined into the worker chunk (so there is no country file to request or to
404) and the map is a list of plain SVG paths. The city dataset is far larger
(about 11.85 MB gzipped), is generated outside git and ships through the build
as one static file. `GEO_FIXTURE=1` points the build at the committed fixture
tables so that RFC 5737 and RFC 3849 documentation addresses resolve to
countries in tests; it is set only by the Playwright `webServer` (and by Vitest),
never for a real build.

IP geolocation data is by [DB-IP](https://db-ip.com) (IP to Country Lite and IP
to City Lite, CC BY 4.0). The attribution is shown beside the map in the app.

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
