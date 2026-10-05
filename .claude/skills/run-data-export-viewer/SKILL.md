---
name: run-data-export-viewer
description: Build, run, and drive the WG Data Export Viewer. Use when asked to start the app, run the preview server, take a screenshot of the UI, drop a synthetic export through the page, or interact with the running app's dropzone / dashboard.
---

Headless-Chromium driver over the WG Data Export Viewer. Drive it via
`.claude/skills/run-data-export-viewer/driver.mjs` against a running
`pnpm run preview` on port 4173.

All paths below are relative to the repo root.

## Prerequisites

- macOS or Linux
- Node 22.12+ (`node --version`)
- pnpm 12.6+ (Node 26+ no longer ships corepack; install via `brew install pnpm` or `npm install -g pnpm@12.6.0`)
- Chromium binary downloaded by Playwright (`pnpm exec playwright install chromium` — already done if you've run the e2e suite once)

## Setup

```bash
pnpm install --frozen-lockfile
```

If `pnpm` isn't on PATH yet:

```bash
npm install -g pnpm@12.6.0 --cache "$TMPDIR/npm-cache"
```

## Build

```bash
pnpm run build
```

Produces `dist/` (CSP meta injected into `dist/index.html` ahead of all
scripts/stylesheets). The preview server serves this directory.

## Run (agent path)

Start the preview server in the background, wait for it to bind, then
run the driver:

```bash
lsof -ti:4173 2>/dev/null | xargs -r kill 2>/dev/null
pnpm run preview > /tmp/wot-viewer-preview.log 2>&1 &
for i in $(seq 1 30); do curl -sf http://localhost:4173 >/dev/null 2>&1 && break; sleep 1; done
node .claude/skills/run-data-export-viewer/driver.mjs
lsof -ti:4173 2>/dev/null | xargs -r kill
```

The driver:
1. Loads `http://localhost:4173`, waits for `main[data-worker-ready="true"]`.
2. Screenshots the empty dropzone.
3. Builds a synthetic 12-file Wargaming-shaped export in memory with
   `fflate.zipSync` and drops it through `[data-testid="file-input"]`. The
   `Sessions.csv` it carries is built by `sessions-csv.mjs` and has the **real
   six-column header**
   (`SESSION_START;SESSION_END;CLIENT_BUILD;CLIENT_PLATFORM;SERVER_NAME;IP`),
   30 usable sessions over 21 days in three servers (EU1, EU2, NA1), plus one
   row with an empty end that the aggregator counts as excluded. A two-column
   file is classified `no-usable-sessions`, so the shape is load-bearing. Its
   `Logins.csv` carries the four real columns and six rows over three RFC 5737
   documentation addresses, so the Login history block reaches `ready`.
4. Captures the processing paragraph (the spinner + per-stage text, in
   the import bar's notice slot), then the dashboard: the identity
   header (nickname + `Account ID: …`), one card per supported section
   with its counts, and one banner per unsupported folder.
5. Waits for the Playtime block to reach `data-state="ready"`, logs the
   three tile texts, the selector's option count and the calendar-cell,
   hour-cell and duration-bin counts, then screenshots it. TILE TEXT AND
   COUNTS ONLY — no CSV row and no address ever reaches the log.
6. Waits for the Login history block, logs its `data-state`, the six tile texts
   (the most-used address is masked, and the driver never presses the reveal
   control), the `login-row` and `login-country` counts and the city opt-in's
   `data-state`, then screenshots it. Against the PRODUCTION country table the
   documentation addresses are reserved space, so the demo reads `ready` with 3
   addresses, 0 countries and 3 unknown. On a build with no city file the
   opt-in reads `unavailable` and makes no request.
7. Clicks Start over, screenshots its confirmation panel, confirms, and
   screenshots the re-armed full-variant bar.
8. Drops a `readme.txt` to demonstrate the failure banner.
9. Logs `requests after load: N`, the number of requests made after the
   initial-load baseline (the worker script and module graph are inside the
   baseline). It must be 0: the opt-in is never pressed here, so even its one
   sanctioned request is not made. A count only, never a URL.
10. Closes the browser.

Screenshots land in `/tmp/wot-viewer-shots/`:

```
01-empty-dropzone.png
02-processing.png       (may be skipped if processing is faster than the screenshot grab)
03-dashboard.png
03b-playtime.png
03c-logins.png
04-start-over-confirm.png
05-start-over-cleared.png
06-failure-banner.png
```

Override the URL with `--url http://localhost:5173` to drive the dev
server instead of the preview (no CSP, no built artifacts required).

## Checking the demo data without a browser

```bash
node .claude/skills/run-data-export-viewer/sessions-csv.mjs --check
```

Parses its own output independently (split on the carriage return, then on the
semicolon) and asserts the closed form over the demo layout, then prints one
summary line. This is the fast way to check a change to the demo data: the
driver's expected tiles are 31.2 hours, 30 sessions and 21 active days, with
366 calendar cells (2024 is a leap year), 168 hour cells, 12 duration bins and
a four-option selector (All, EU1, EU2, NA1).

## Run (human path)

```bash
pnpm run preview
```

Open <http://localhost:4173>, drop a `.zip` from the file picker, watch
the dashboard fill in. Dev server (`pnpm run dev`, port 5173) is for
editing only — no CSP, HMR websocket allowed.

## Test

```bash
pnpm run lint
pnpm run check
pnpm run test:unit    # fast
pnpm run test:e2e     # the slow one — a failing spec burns a 30 s
                      # timeout each, so a green run is much quicker
                      # than a red one. The historic teardown hang
                      # is fixed and regression-guarded; see the
                      # `pnpm run test:e2e` teardown Gotcha below.
```

## Direct invocation

For PRs that touch internal functions without spinning up the full
app, import them directly:

```bash
node -e "import('./src/lib/worker/classify.ts').then(m => console.log(m.analyzeExport(['a/x.csv','a/y.csv'])))"
# -> { ok: false, reason: 'no-category-folders' }
```

No Vite or Playwright needed — Node 22+'s built-in TypeScript type-stripping
(`--experimental-strip-types`, on by default as of this project's pinned
Node 26.10) imports `.ts` files directly. Verified working with a plain
`node -e "import('./src/lib/....ts')..."`, no flag required.

## Gotchas

- **Driver sandbox flag** — `driver.mjs` launches Chromium with
  `chromium.launch({ args: ['--no-sandbox'] })`. Some sandboxed agent
  runtimes already sandbox the agent process, and a second sandbox layer
  there stops Chromium from launching. It is a dev-driver choice only:
  the shipped app never launches Chromium, and the runtime CSP is
  unrelated to it. Do not remove the flag without first confirming the
  agent runtime can launch Chromium with the default sandbox enabled.
- **`pnpm run test:e2e` teardown** — the historic hang after the last
  test passed (a pnpm-wrapped `vite preview` escaping Playwright's
  process-group SIGKILL) is fixed in `playwright.config.ts` (direct
  binary invocation, no pnpm wrapper) and guarded by
  `tests/unit/guards/webserver-teardown.test.ts`. If a webServer teardown hang
  recurs, check that `webServer.command` is still on the direct-binary
  form before anything else — config drift is the most likely cause.
- **`pnpm` not on PATH on Node 26+** — Node 26 dropped corepack. Install
  with `npm install -g pnpm@12.6.0 --cache "$TMPDIR/npm-cache"`, or use
  Homebrew.
- **`@playwright/test` only, no `playwright`** — `node_modules/playwright`
  isn't installed. Import the `chromium` browser from `@playwright/test`
  instead of `playwright`. The driver already does this.
- **Preview port 4173 is `strictPort`** — if it's busy, `pnpm run
  preview` errors instead of falling back. Kill the previous listener
  with `lsof -ti:4173 | xargs -r kill` before relaunching.
- **`dist/` is gitignored** — every fresh checkout needs
  `pnpm run build` before `pnpm run preview`. Dev server (`pnpm run
  dev`) doesn't need it.
- **CSP is `connect-src 'self'`, and it is defence in depth only** — the
  served HTML has `default-src 'self'; connect-src 'self'; object-src 'none';
  base-uri 'none'; form-action 'none'`. The ONLY network request the app may
  ever make after load is the single opt-in same-origin GET for the city
  dataset (`geo-city-data/<file>.citydb.bin`), after an explicit click, from
  the main thread (`src/lib/geo/city-fetch.ts`). Nothing else is permitted:
  no other request, no third-party host, no analytics, no live geo lookup.
  The CSP does NOT enforce that on its own: a meta CSP is blind to worker
  traffic (measured: a module-worker fetch returned 200 under
  `connect-src 'none'`), and a `'self'` host source cannot be restricted to a
  path. The real enforcement is the ESLint network ban (`src/lib/geo/` and
  `src/lib/worker/`, with `city-fetch.ts` the one exempt file; a source scan
  in `tests/unit/guards/fetch-scan.test.ts` counts exactly one call site) and
  the Playwright request counting in `tests/e2e/guards/zero-network.spec.ts`,
  where Playwright DOES see a worker's requests. Don't call an external API
  from the app.
- **Real exports are PII** — `tests/fixtures/README.md` records the
  `fixture=synthetic` policy. Never commit a real Wargaming zip; drop
  it from anywhere outside the repo into the running app to verify the
  end-to-end flow. `tests/fixtures/private/` does not exist on a fresh
  checkout and is gitignored; create it locally if you want to keep a
  real export inside the repo tree.

## Troubleshooting

- **`pnpm run test:e2e` shows every `✓` but the final `N passed`
  summary never prints and the command never returns**: it is hanging in
  webServer teardown, which means `playwright.config.ts`'s
  `webServer.command` has drifted back to a pnpm-wrapped form. Restore
  the direct-binary invocation — `tests/unit/guards/webserver-teardown.test.ts`
  fails on exactly that drift.
- **`http://localhost:4173 is already used`**: kill the listener
  (`lsof -ti:4173 | xargs -r kill`) and retry.
- **`pnpm: command not found`**: Node 26 dropped corepack. Install pnpm
  via npm (see Setup).
- **Driver hangs on `worker ready`**: the worker script never reached
  the `postMessage({type:'ready'})` line. Open
  `/tmp/wot-viewer-preview.log`, look for worker import errors (a
  failing `import` blocks the entire worker module).
- **Driver screenshots blank**: the worker isn't building (look for
  `dist/assets/ingest.worker-*.js`). If it's missing,
  `pnpm run build` failed silently — re-run with `pnpm run build` and
  inspect stderr.
- **No `data-worker-ready="true"` after 10s**: check
  `dist/index.html` for the CSP meta; if it's missing, the build is
  stale. Re-run `pnpm run build`.
