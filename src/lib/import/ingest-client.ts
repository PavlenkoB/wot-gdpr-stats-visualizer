import { IngestClient } from './worker-client.svelte.ts';
import type { WorkerLike } from '../core/types/worker-messages.ts';

/**
 * Module-scope singleton. Evaluating this module (via App.svelte's
 * `import { ingestClient }`) creates the one Worker at app init.
 * Module scope is intentional — it means the Worker is created when
 * App.svelte is first rendered, not on first file drop, which keeps
 * the worker script fetch inside the "initial page load" window that
 * the zero-network CI assertion measures (PLATFORM-02 + RESEARCH
 * Pitfall 3).
 *
 * As of 02-02, the cache-check handshake piggybacks on this same
 * ready handshake: the worker module-load 'ready' message is what
 * prompts `IngestClient` to post its 'check-cache' request, and the
 * worker's reply decides whether to render the cached results view
 * or the empty dropzone. See `worker-client.svelte.ts` for the state
 * machine details.
 *
 * The `as unknown as WorkerLike` cast is the single site where the
 * real DOM Worker meets our typed contract; every other file sees
 * the WorkerLike structural shape only.
 */
export const ingestClient = new IngestClient(
  () =>
    new Worker(new URL('../worker/ingest.worker.ts', import.meta.url), {
      type: 'module',
    }) as unknown as WorkerLike,
);

/**
 * D-06: best-effort persistent-storage hint. The Storage Manager
 * API's `persist()` is `[Exposed=Window]` only (WebIDL) — it cannot
 * be called from inside a Web Worker — so this MUST live on the main
 * thread, decoupled from the per-import critical path. We do not
 * await or branch on the result: a denied request is fine, the
 * browser's IndexedDB quota is the real backstop. Per D-06, a
 * quota failure is surfaced through the existing single worker-
 * error path, not via a size-based rejection here.
 */
void navigator.storage?.persist?.();
