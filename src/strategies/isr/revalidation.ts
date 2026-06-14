import type { CacheManager } from '../../cache/cache-manager.js';

/**
 * Background revalidation tracker. Ensures only one revalidation runs per key
 * at a time (stale-while-revalidate), so a burst of stale hits does not stampede.
 */
const inFlight = new Set<string>();

export async function revalidateInBackground(
  key: string,
  cache: CacheManager,
  produce: () => Promise<string>,
  ttlMs: number,
): Promise<void> {
  if (inFlight.has(key)) return;
  inFlight.add(key);
  try {
    const fresh = await produce();
    await cache.set(key, fresh, ttlMs);
  } finally {
    inFlight.delete(key);
  }
}
