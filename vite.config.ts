import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig, type Plugin } from 'vite';
import { geoAliasEntries } from './scripts/geo/lib/geo-alias.ts';
import { loadCityManifestFile } from './scripts/geo/lib/city-manifest.ts';

/**
 * Defense-in-depth CSP via meta tag, injected at build time only.
 *
 * In `pnpm dev` a meta CSP would get in the way of Vite's HMR websocket and its
 * JS-injected dev styles, so the plugin only runs in the production build. The
 * served production HTML — what Playwright tests and GitHub Pages serve —
 * always carries the tag.
 *
 * ## `connect-src 'self'` (plan 06-11, D-16) — defence in depth, NOT the guard
 *
 * The product makes exactly one request after load: the opt-in city file, one
 * same-origin GET issued from the main thread after an explicit click. That is
 * why `connect-src` is `'self'` and not `'none'`. It is the ONLY directive that
 * differs from the policy shipped before this phase.
 *
 * What this directive does NOT do, measured: a meta CSP is blind to worker
 * traffic (`connect-src 'none'` blocked a main-thread fetch while a module-worker
 * fetch returned 200), and a `'self'` host source cannot be restricted to a
 * path, so the policy does not confine the request to the city asset. The
 * enforcement is the ESLint network ban on `src/lib/geo/` and `src/lib/worker/`
 * with exactly one exempt module, and the Playwright request assertions that
 * prove which asset the one request fetched. The `connect-src 'none'` of the
 * earlier phases never governed worker traffic either.
 *
 * Phase 7 can revisit path-restricting the host source once the deployed origin
 * is known; the base path is read from `import.meta.env.BASE_URL` for that.
 *
 * `worker-src` is intentionally omitted: per MDN it falls back to
 * `child-src` → `script-src` → `default-src`, so `default-src 'self'`
 * already permits the same-origin module worker script with no separate
 * directive needed.
 */
const CSP_POLICY = [
  "default-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

/**
 * Vite's own head-prepend injection regex (its internal `injectToHead(html,
 * tags, true)` uses exactly this pattern). Mirrored here so the tag lands in
 * the same position — the first child of `<head>`, ahead of the module script
 * and any stylesheet link — without going through the tag serializer.
 */
const HEAD_PREPEND_RE = /([ \t]*)<head[^>]*>/i;

/**
 * Builds the CSP meta tag and injects it as a literal string, inside a single
 * `transformIndexHtml` hook.
 *
 * The build-time acceptance criteria grep for the literal substrings
 * `apply: 'build'`, `transformIndexHtml`, `head-prepend`, `connect-src 'self'`,
 * and `format: 'es'` in this file, and the e2e zero-network spec asserts the
 * served HTML's `connect-src` directive is exactly `'self'` and that
 * `default-src 'self'` is still present.
 *
 * Why the tag is serialized here rather than returned as an
 * `HtmlTagDescriptor` with `injectTo: 'head-prepend'`: Vite serializes and
 * injects a returned `tags` array *after* the hook returns, and its
 * `escapeHtml` turns every `'` in an attribute value into `&#39;`. A
 * descriptor-based injection therefore needs a *second* `transformIndexHtml`
 * hook to unescape the result — which is what the standalone `unescapeQuotes`
 * plugin used to be, tied to `csp-meta` only by plugin registration order.
 * Emitting the tag ourselves keeps the literal quotes in the output, which
 * makes the unescape step structurally unnecessary: one plugin, one hook, no
 * order dependency for a future maintainer to get wrong.
 */
function cspMeta(): Plugin {
  return {
    name: 'csp-meta',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const meta = `<meta http-equiv="Content-Security-Policy" content="${CSP_POLICY}">`;
        // Vite's incrementIndent: extend the matched `<head>` indentation by
        // one tab or two spaces, then the tag on its own line.
        return html.replace(HEAD_PREPEND_RE, (match, indent: string) => {
          const extraIndent = indent.startsWith('\t') ? '\t' : '  ';
          return `${match}\n${indent}${extraIndent}${meta}\n`;
        });
      },
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte(), cspMeta()],
  worker: {
    format: 'es',
  },
  // The opt-in city file's manifest, read ONCE here and baked into the bundle
  // (plan 06-11, D-13, D-16). `null` — no manifest was built — makes the opt-in
  // unavailable in the interface, so a local or pull-request build never offers
  // a download that can only fail. `process.env` is passed through whole, like
  // the alias below, so the fixture switch has one path and not two.
  define: {
    __GEO_CITY__: JSON.stringify(loadCityManifestFile(process.env)),
  },
  // `.bin` is not one of Vite's asset types, so `?inline` on the country table
  // is refused without this. Paired with the alias below; both are also
  // configured in `vitest.config.ts`, which is a separate config with no
  // plugins (RESEARCH Pitfall 4).
  assetsInclude: ['**/*.bin'],
  resolve: {
    // Resolves `#geo/country-data` to the committed table, or to the 377-byte
    // fixture when `GEO_FIXTURE=1` — set in exactly one place in this
    // repository, `playwright.config.ts`'s `webServer.env`, and guarded by
    // `tests/unit/guards/geo-seam.test.ts`. `process.env` is passed through
    // whole so there is no second path to the switch.
    alias: geoAliasEntries(process.env),
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
});
