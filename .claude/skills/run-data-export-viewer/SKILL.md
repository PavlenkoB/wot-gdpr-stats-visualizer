---
name: run-data-export-viewer
description: Build, run, and drive the WG Data Export Viewer. Use when asked to start the app, run the preview server, take a screenshot of the UI, drop a synthetic export through the page, or interact with the running app's dropzone / results view.
---

Headless-Chromium driver over the WG Data Export Viewer (Phase 1). Drive
it via `.claude/skills/run-data-export-viewer/driver.mjs` against a
running `pnpm run preview` on port 4173.

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
   `fflate.zipSync` and drops it through `[data-testid="file-input"]`.
4. Captures the processing paragraph (the spinner + per-stage text),
   then the results view (`Account: 123456789` + summary + 8 color-coded
   badges + Start over).
5. Clicks Start over and screenshots the re-armed dropzone.
6. Drops a `readme.txt` to demonstrate the failure banner.
7. Closes the browser.

Screenshots land in `/tmp/wot-viewer-shots/`:

```
01-empty-dropzone.png
02-processing.png       (may be skipped if processing is faster than the screenshot grab)
03-results.png
04-start-over.png
05-failure-banner.png
```

Override the URL with `--url http://localhost:5173` to drive the dev
server instead of the preview (no CSP, no built artifacts required).

## Run (human path)

```bash
pnpm run preview
```

Open <http://localhost:4173>, drop a `.zip` from the file picker, watch
the badge list render. Dev server (`pnpm run dev`, port 5173) is for
editing only — no CSP, HMR websocket allowed.

## Test

```bash
pnpm run lint
pnpm run check
pnpm run test:unit    # 143 unit tests, ~1s
pnpm run test:e2e     # 20 e2e tests, ~20-60s of actual test time —
                       # but see the webServer-teardown Gotcha below,
                       # the command frequently HANGS after printing
                       # the last ✓ and never exits on its own.
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

- **`pnpm run test:e2e` hangs after the last test passes** — reproduced
  3 times in a row. All 20 tests print `✓` and finish in well under a
  minute, but the `playwright test` process itself does not exit — it's
  waiting on the `vite preview` process it spawned via the compound
  `webServer.command: 'pnpm run build && pnpm run preview'`
  (playwright.config.ts) to die, and signal delivery through the
  `pnpm -> vite.js preview` child chain doesn't reliably reach it on
  teardown. Confirmed fix: once every test shows `✓`, find and
  `kill -TERM` the leftover `vite.js preview` process yourself —
  `playwright test` then prints its `20 passed (Ns)` summary and exits
  within ~3s:
  ```bash
  pkill -f 'vite.js preview'
  ```
  If running `test:e2e` non-interactively (backgrounded, CI-like), poll
  for the last `✓` line in its output and send this the moment it
  appears rather than waiting on the process to exit on its own — it
  may not, for minutes.
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
- **CSP blocks `connect-src`** — the served HTML has
  `default-src 'self'; connect-src 'none'`. No fetch/XHR/WS to anywhere.
  Verified by `tests/e2e/zero-network.spec.ts`. Don't try to call an
  external API from the app.
- **Real exports are PII** — `tests/fixtures/README.md` records the
  `fixture=synthetic` policy. Never commit a real Wargaming zip; drop
  it from anywhere outside the repo into the running app to verify the
  end-to-end flow.

## Troubleshooting

- **`pnpm run test:e2e` shows every `✓` but the final `N passed`
  summary never prints and the command never returns**: it hung in
  webServer teardown (see Gotcha above). Run `pkill -f 'vite.js
  preview'` — the test process exits within seconds and prints its
  summary.
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
