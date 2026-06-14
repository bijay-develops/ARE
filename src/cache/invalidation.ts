import type { CacheEntry } from './memory-cache.js';
import type { CacheState } from '../core/types.js';

/** Is the entry past its TTL (stale) but still present? */
export function isStale(entry: CacheEntry, now = Date.now()): boolean {
  return now - entry.storedAt >= entry.ttlMs;
}

/** Classify a cache lookup result into the engine's CacheState vocabulary. */
export function classifyEntry(entry: CacheEntry | undefined, now = Date.now()): CacheState {
  if (!entry) return 'cold';
  return isStale(entry, now) ? 'stale' : 'fresh';
}
