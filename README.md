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

The Playwright suite runs two projects: `chromium` (desktop) and `chromium-mobile`
(375x812 with touch, running only the `touch-*.spec.ts` specs). The pre-deploy gate
is separate: `pnpm exec playwright test -c tests/deploy/playwright.gate.config.ts`
(see "Publishing to GitHub Pages").

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

## Publishing to GitHub Pages

The site is published by `.github/workflows/deploy.yml`, and only by a manual
dispatch (`workflow_dispatch`). A push to `main` runs CI (`ci.yml`) and nothing
else, so a commit nobody has verified cannot ship by accident. Four jobs run in
order:

1. **preflight** refuses unless the run is on `main` and that exact commit has a
   successful `ci.yml` push run on `main`. It has no inputs to inject into.
2. **build** runs on a GitHub-hosted runner. It resolves the DB-IP month, restores
   or generates the real city dataset (`pnpm run geo:city -- --download`, cached
   by month, with no fallback to an older month), builds with
   `VITE_BASE=/wot-gdpr-stats-visualizer/`, and runs the pre-deploy gate on the
   built `dist`: the CSP, the worker and favicon resolving under the base, zero
   requests after load, exactly one opt-in request for exactly the manifest's file
   with its bytes and sha256, and the artifact's contents against an allowlist.
   Only then is `dist` uploaded as the Pages artifact.
3. **deploy** is the only job with Pages permissions.
4. **smoke** waits until the live site serves this build's entry script, then runs
   the same spec against the live URL. A wrong live site turns the run red.

### Preconditions (owner-only)

None of these can be set from the repository or checked from CI.

- [ ] The repository's visibility permits GitHub Pages. On the free plan that means
      a public repository. The repository was private when this was written, and
      whether to make it public is the owner's decision. It is not made, prepared
      or audited by this project (no pre-publication review of the committed
      files has been scheduled).
- [ ] Settings > Pages > Build and deployment > Source is **GitHub Actions**.
- [ ] Optional: Settings > Environments > `github-pages` is restricted to the
      `main` branch.
- [ ] The work is merged to `main` and CI is green there. The workflow cannot run
      before that, because a dispatch uses the workflow file on the default branch.

The owner's recorded answer (plan 07-01) is `deferred: repo stays private for
now`: neither of the first two settings is satisfied, and publishing is
consciously deferred until they are.

### Dispatching, the live URL and rollback

Dispatch from the Actions tab (Deploy > Run workflow, branch `main`), or:

```bash
gh workflow run deploy.yml --ref main
```

There are no inputs. The live URL is
`https://pavlenkob.github.io/wot-gdpr-stats-visualizer/` (GitHub lowercases the
owner in the Pages host); the page URL printed by the run's deploy job is
authoritative if it ever differs.

To roll back, open an earlier green Deploy run on the Actions tab and choose
**Re-run all jobs**. It redeploys that run's commit, and the preflight asks the
CI question again for it. Nothing in the workflow deletes a deployment or
rewrites a branch.

### Rehearsing the gate locally

The sequence below is what the deploy build does, with the committed fixture
CSV standing in for the real DB-IP download. It builds under the Pages subpath,
runs the gate, and removes the generated directory (which is gitignored):

```bash
node scripts/geo/build-city-dataset.ts --csv tests/fixtures/geo/city-fixture.csv --month 2026-10
VITE_BASE=/wot-gdpr-stats-visualizer/ pnpm run build
VITE_BASE=/wot-gdpr-stats-visualizer/ EXPECT_CITY_MONTH=2026-10 \
  pnpm exec playwright test -c tests/deploy/playwright.gate.config.ts
rm -rf public/geo-city-data
```

The gate config serves the `dist` already on disk with `vite preview` and never
rebuilds it. To run the live-site spec against a locally served build, start
`VITE_BASE=/wot-gdpr-stats-visualizer/ pnpm exec vite preview` and, in another
shell:

```bash
LIVE_URL=http://localhost:4173/wot-gdpr-stats-visualizer/ \
  pnpm exec playwright test -c tests/deploy/playwright.live.config.ts
```

`LIVE_URL` must be https unless it is `localhost` or `127.0.0.1`. The live config
runs `deployed-build.spec.ts` only; `dist-artifact.spec.ts` reads a build's
filesystem and has nothing to read on a live site.

### What only a person can check

None of this can run before the branch is merged to `main`:

1. The owner-only preconditions above.
2. The first real dispatch from `main`: preflight, build (gate green), deploy and
   smoke are all green, the printed URL serves the dashboard shell and dropzone,
   and importing a real export works with an empty Network tab after load.
3. On the live URL, import an export, scroll to the Login history block and press
   the city-level opt-in once. The Network tab shows exactly one request after
   load, for `geo-city-data/city-YYYY-MM.citydb.bin`, and the block reaches its
   ready state (a failed download shows the existing error line).
4. On a real phone: tap the heatmap, hour grid, bar chart and map marks (taps pin
   and move tooltips, a tap outside dismisses them, nothing scrolls the page
   sideways), check that the map's country targets are reachable with a thumb at
   375px, and try the city opt-in. It should finish (peak decode memory is about
   120 MB by estimate) or show its error line without crashing the tab.
5. At 375px by 812px, the first screen shows the count tiles, the start of the
   login table or heatmap, and the map within the first 812px. The UI spec's
   focal-point sentence could not be asserted by a test as written (the map sits
   below the Playtime block in document order), so a person judges it.
6. With a real screen reader, both tooltip announcements ("Tooltip pinned." and
   "Tooltip dismissed.") are spoken from the one page-level live region.

### Caveats

- Every Pages project of one owner shares the origin `<owner>.github.io`. A
  different project published under the same account can read this app's
  IndexedDB cache from the browser. Nothing sensitive leaves the machine through
  this app, but the cached parsed export sits in origin storage, so publish only
  projects you trust under the same account.
- The CSP is defence in depth. Enforcement is the lint ban plus request counting,
  as described under "What the page requests, and what enforces it".

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
