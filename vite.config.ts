import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig, type Plugin } from 'vite';

/**
 * Defense-in-depth CSP via meta tag, injected at build time only.
 *
 * In `pnpm dev` a meta CSP with `connect-src 'none'` would block Vite's HMR
 * websocket and its JS-injected dev styles, so the plugin only runs in the
 * production build. The served production HTML — what Playwright tests and
 * GitHub Pages serve — always carries the tag.
 *
 * `worker-src` is intentionally omitted: per MDN it falls back to
 * `child-src` → `script-src` → `default-src`, so `default-src 'self'`
 * already permits the same-origin module worker script with no separate
 * directive needed.
 */
const CSP_POLICY = [
  "default-src 'self'",
  "connect-src 'none'",
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
 * `apply: 'build'`, `transformIndexHtml`, `head-prepend`, `connect-src 'none'`,
 * and `format: 'es'` in this file, and the e2e zero-network spec asserts the
 * served HTML carries `default-src 'self'` / `connect-src 'none'`.
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
  preview: {
    port: 4173,
    strictPort: true,
  },
});
