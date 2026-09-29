/**
 * SHA-256 of the raw zip bytes, in lowercase hex.
 *
 * Why this exists (RESEARCH.md Pattern 1, 02-01-PLAN Task 3):
 *   The dedup gate (IMPORT-06 / SC3) compares a hash of the dropped
 *   file against the hash stored on the previous import. Both must
 *   be derived from the same raw bytes (the in-memory `Uint8Array`
 *   fflate's `unzipSync` is about to consume), and both must be a
 *   stable string format so `existing.hash === hash` is byte-exact.
 *
 * `crypto.subtle.digest('SHA-256', bytes)` returns a 32-byte
 * `ArrayBuffer`; we re-encode it as 64 lowercase hex characters so
 * the value is IndexedDB-friendly and trivial to log.
 *
 * No local try/catch: any throw (e.g. SubtleCrypto unavailable)
 * propagates into the worker's single top-level try/catch and lands
 * in the existing generic failure banner — matching the
 * "single error path" pattern in `worker-client.svelte.ts` and
 * `ingest.worker.ts`.
 */
export async function digestFile(bytes: Uint8Array): Promise<string> {
  // crypto.subtle.digest's BufferSource type wants ArrayBuffer (not
  // SharedArrayBuffer). `bytes.buffer` is typed as `ArrayBufferLike`;
  // we own the bytes (they came from `file.arrayBuffer()`), so the
  // cast to `BufferSource` is sound.
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
