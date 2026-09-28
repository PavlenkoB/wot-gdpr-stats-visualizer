import { IngestClient } from './worker-client.svelte.ts';
import type { WorkerLike } from './types/worker-messages.ts';

/**
 * Module-scope singleton. Evaluating this module (via App.svelte's
 * `import { ingestClient }`) creates the one Worker at app init.
 * Module scope is intentional — it means the Worker is created when
 * App.svelte is first rendered, not on first file drop, which keeps
 * the worker script fetch inside the "initial page load" window that
 * the zero-network CI assertion measures (PLATFORM-02 + RESEARCH
 * Pitfall 3).
 *
 * The `as unknown as WorkerLike` cast is the single site where the
 * real DOM Worker meets our typed contract; every other file sees
 * the WorkerLike structural shape only.
 */
export const ingestClient = new IngestClient(
  () =>
    new Worker(new URL('./worker/ingest.worker.ts', import.meta.url), {
      type: 'module',
    }) as unknown as WorkerLike,
);
