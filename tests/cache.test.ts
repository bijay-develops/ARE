import { describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { CacheManager } from '../src/cache/cache-manager.js';
import { classifyEntry, isStale } from '../src/cache/invalidation.js';

describe('cache layer', () => {
  it('classifies cold / fresh / stale correctly', () => {
    expect(classifyEntry(undefined)).toBe('cold');
    const fresh = { value: 'x', storedAt: Date.now(), ttlMs: 1000 };
    expect(classifyEntry(fresh)).toBe('fresh');
    const old = { value: 'x', storedAt: Date.now() - 5000, ttlMs: 1000 };
    expect(classifyEntry(old)).toBe('stale');
    expect(isStale(old)).toBe(true);
  });

  it('stores and retrieves through the manager (memory+file)', async () => {
    const dir = path.join(os.tmpdir(), `are-cache-${Date.now()}`);
    const cache = new CacheManager({ cacheDir: dir, redisUrl: null, defaultTtlMs: 1000 });
    await cache.init();
    expect((await cache.lookup('k')).state).toBe('cold');
    await cache.set('k', '<html>cached</html>');
    const hit = await cache.lookup('k');
    expect(hit.state).toBe('fresh');
    expect(hit.entry?.value).toContain('cached');
    await cache.invalidate('k');
    expect((await cache.lookup('k')).state).toBe('cold');
  });
});
