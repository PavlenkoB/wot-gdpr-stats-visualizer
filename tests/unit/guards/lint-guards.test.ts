import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { ESLint } from 'eslint';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// =============================================================================
// Lint-guard probes
// =============================================================================
//
// Why this file exists (01-02-PLAN Task 2, RED then GREEN):
//   Playwright proves the *running* app makes zero network requests after
//   initial load. That assertion is missing the worker context, which
//   playwright/request observation cannot reach (01-RESEARCH Pitfall 4).
//   The only way to close that blind spot is to ban the network APIs at lint
//   time so they cannot be introduced at all under src/, including
//   src/lib/worker/. Adding a lint rule without proving it fires is unsafe;
//   this file's tests are the proof.
//
// The probes never exist on disk. ESLint's Node API accepts a `filePath` so
// the resolved config can match its `files` glob; the literal `__lint_probe__`
// token only appears in the path, never as a real file. The asserts run
// against the REAL eslint.config.js at the repo root.
//
// This file lives under tests/, which is OUTSIDE the src/** rule scope, so
// its own code never trips the rules. The clean-control probe lives under
// src/lib/ to make sure the absence of guard rule ids there is real.
// =============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

const GUARD_RULE_IDS = [
  'no-restricted-globals',
  'no-restricted-properties',
  'svelte/no-at-html-tags',
  'svelte/no-inline-styles',
  'no-restricted-imports',
] as const;

const PROBE_PATH = 'src/lib/__lint_probe__.ts';
const WORKER_PROBE_PATH = 'src/lib/worker/__lint_probe__.ts';
const SVELTE_PROBE_PATH = 'src/lib/shell/__lint_probe__.svelte';

const eslintState: { instance: ESLint | null } = { instance: null };
const lintTimeoutMs = 60_000;

beforeAll(async () => {
  eslintState.instance = new ESLint({
    cwd: REPO_ROOT,
    overrideConfigFile: path.join(REPO_ROOT, 'eslint.config.js'),
  });
});

afterAll(async () => {
  // ESLint holds its own resolved-config cache; resetting the reference is
  // sufficient — the GC reclaims the rest.
  eslintState.instance = null;
});

function eslint(): ESLint {
  if (!eslintState.instance) throw new Error('ESLint not initialized');
  return eslintState.instance;
}

/**
 * Run ESLint over an in-memory source string, reporting back ONLY the rule
 * IDs that fired at severity 2 (error). Warnings and the auto-attached
 * recommended-config rules are filtered out so the assertions are scoped
 * to the guards this plan adds.
 */
async function ruleIdsAtError(src: string, filePath: string): Promise<string[]> {
  const results = await eslint().lintText(src, { filePath });
  const ids: string[] = [];
  for (const result of results) {
    for (const message of result.messages) {
      if (message.severity === 2 && message.ruleId) {
        ids.push(message.ruleId);
      }
    }
  }
  return ids;
}

// -----------------------------------------------------------------------------
// Network ban: no-restricted-globals (raw identifiers)
// -----------------------------------------------------------------------------
const GLOBAL_CONSTRUCTS = [
  'fetch',
  'fetchLater',
  'XMLHttpRequest',
  'WebSocket',
  'WebTransport',
  'EventSource',
  'RTCPeerConnection',
  'importScripts',
] as const;

describe('network ban — no-restricted-globals', () => {
  test.each(GLOBAL_CONSTRUCTS)(
    '%s as a raw identifier in src/lib fires no-restricted-globals',
    async (name) => {
      const src = `${name};`;
      const ids = await ruleIdsAtError(src, PROBE_PATH);
      expect(ids).toContain('no-restricted-globals');
    },
    lintTimeoutMs,
  );

  test.each(GLOBAL_CONSTRUCTS)(
    '%s as a raw identifier also fires inside src/lib/worker (worker code is not exempt)',
    async (name) => {
      const src = `${name};`;
      const ids = await ruleIdsAtError(src, WORKER_PROBE_PATH);
      expect(ids).toContain('no-restricted-globals');
    },
    lintTimeoutMs,
  );
});

// -----------------------------------------------------------------------------
// Network ban: no-restricted-properties (window./self./globalThis. prefixes +
// navigator.sendBeacon)
// -----------------------------------------------------------------------------
type PropertyTest = { prefix: string; name: string };

const PROPERTY_CONSTRUCTS: PropertyTest[] = (
  ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource'] as const
).flatMap((name) => [
  { prefix: 'window.', name },
  { prefix: 'self.', name },
  { prefix: 'globalThis.', name },
]);

PROPERTY_CONSTRUCTS.push({ prefix: 'navigator.', name: 'sendBeacon' });

describe('network ban — no-restricted-properties', () => {
  test.each(PROPERTY_CONSTRUCTS)(
    'window/self/globalThis/navigator prefix in src/lib fires no-restricted-properties',
    async ({ prefix, name }) => {
      const src = `${prefix}${name};`;
      const ids = await ruleIdsAtError(src, PROBE_PATH);
      expect(ids).toContain('no-restricted-properties');
    },
    lintTimeoutMs,
  );

  test.each(PROPERTY_CONSTRUCTS)(
    'window/self/globalThis/navigator prefix in src/lib/worker also fires (worker code is not exempt)',
    async ({ prefix, name }) => {
      const src = `${prefix}${name};`;
      const ids = await ruleIdsAtError(src, WORKER_PROBE_PATH);
      expect(ids).toContain('no-restricted-properties');
    },
    lintTimeoutMs,
  );
});

// -----------------------------------------------------------------------------
// Markup ban: svelte/no-at-html-tags and svelte/no-inline-styles
// -----------------------------------------------------------------------------
describe('markup ban — Svelte rules', () => {
  test(
    '{@html expression} fires svelte/no-at-html-tags',
    async () => {
      const src = `<p>{@html unsafe}</p>`;
      const ids = await ruleIdsAtError(src, SVELTE_PROBE_PATH);
      expect(ids).toContain('svelte/no-at-html-tags');
    },
    lintTimeoutMs,
  );

  test(
    'style="..." attribute fires svelte/no-inline-styles',
    async () => {
      const src = `<div style="color: red">x</div>`;
      const ids = await ruleIdsAtError(src, SVELTE_PROBE_PATH);
      expect(ids).toContain('svelte/no-inline-styles');
    },
    lintTimeoutMs,
  );
});

// -----------------------------------------------------------------------------
// Worker-boundary import ban: no-restricted-imports (fflate outside the worker)
// -----------------------------------------------------------------------------
describe('worker-boundary import ban — no-restricted-imports (fflate)', () => {
  test(
    'importing fflate from src/lib (non-worker) fires no-restricted-imports',
    async () => {
      const src = `import { unzipSync } from 'fflate';`;
      const ids = await ruleIdsAtError(src, PROBE_PATH);
      expect(ids).toContain('no-restricted-imports');
    },
    lintTimeoutMs,
  );

  test(
    'importing fflate from src/lib/worker does NOT fire no-restricted-imports',
    async () => {
      const src = `import { unzipSync } from 'fflate';`;
      const ids = await ruleIdsAtError(src, WORKER_PROBE_PATH);
      expect(ids).not.toContain('no-restricted-imports');
    },
    lintTimeoutMs,
  );
});

// -----------------------------------------------------------------------------
// Clean control: a benign file under src/lib reports none of the guard ids.
// -----------------------------------------------------------------------------
describe('clean control', () => {
  test(
    'a benign exported constant reports none of the guard rule ids',
    async () => {
      const src = `export const x = 1;`;
      const ids = await ruleIdsAtError(src, PROBE_PATH);
      const guardHits = ids.filter((id) => (GUARD_RULE_IDS as readonly string[]).includes(id));
      expect(guardHits).toEqual([]);
    },
    lintTimeoutMs,
  );
});
