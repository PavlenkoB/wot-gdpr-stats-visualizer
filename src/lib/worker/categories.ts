import type { CategoryStatus } from '../types/worker-messages.ts';

/**
 * Top-level zip folder names whose data we render in v1.
 *
 * These are the literal folder names verified in PROJECT.md's Context
 * section. The dashboard-section name used in PROJECT.md / ROADMAP.md
 * prose for the financial story is intentionally not a folder name —
 * it does not appear here.
 */
export const SUPPORTED: readonly string[] = [
  'Activity_history',
  'Player_statistics',
  'User_Info',
  'Payment_history',
];

/**
 * Top-level zip folder names that are real Wargaming categories but
 * whose dashboards are deferred past v1.
 */
export const KNOWN_DEFERRED: readonly string[] = ['Chat_history', 'Clans'];

/**
 * Display order for status groups (supported first, then known-deferred,
 * then unknown).
 */
export const CATEGORY_STATUS_ORDER = [
  'supported',
  'known-deferred',
  'unknown',
] as const satisfies readonly CategoryStatus[];

/**
 * Classify a single top-level folder name as supported / known-deferred /
 * unknown. Comparison is case-insensitive; anything not in either list
 * returns 'unknown' (no blocklist maintained — RESEARCH Pattern 2).
 */
export function classifyFolder(name: string): CategoryStatus {
  const lower = name.toLowerCase();
  if ((SUPPORTED as readonly string[]).some((n) => n.toLowerCase() === lower)) {
    return 'supported';
  }
  if ((KNOWN_DEFERRED as readonly string[]).some((n) => n.toLowerCase() === lower)) {
    return 'known-deferred';
  }
  return 'unknown';
}
