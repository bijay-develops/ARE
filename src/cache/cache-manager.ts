import { MemoryCache, type CacheEntry } from './memory-cache.js';
import { FileCache } from './file-cache.js';
import { RedisCache } from './redis-cache.js';
import { classifyEntry, isStale } from './invalidation.js';
import type { CacheState } from '../core/types.js';

export interface CacheLookup {
  entry: CacheEntry | undefined;
  state: CacheState;
  stale: boolean;
}

/**
 * Unified cache API over three backends:
 *   - memory  (fastest, per-process)
 *   - file    (persistent, zero-cost, survives restarts)
 *   - redis   (optional, shared across edge nodes)
 *
 * Reads check memory → redis → file (promoting hits upward). Writes fan out to
 * all available backends. This is what powers ISR/Edge-ISR cold-vs-warm timing.
 */
export class CacheManager {
  private readonly memory: MemoryCache;
  private readonly file: FileCache;
  private readonly redis: RedisCache;

  constructor(opts: { cacheDir: string; redisUrl: string | null; defaultTtlMs: number }) {
    this.memory = new MemoryCache();
    this.file = new FileCache(opts.cacheDir);
    this.redis = new RedisCache(opts.redisUrl);
    this.defaultTtlMs = opts.defaultTtlMs;
  }

  readonly defaultTtlMs: number;

  async init(): Promise<void> {
    await this.redis.connect();
  }

  /** Look up an entry and classify its freshness without mutating anything. */
  async lookup(key: string): Promise<CacheLookup> {
    let entry = this.memory.get(key);
    if (!entry && this.redis.available) {
      entry = await this.redis.get(key);
      if (entry) this.memory.set(key, entry.value, entry.ttlMs);
    }
    if (!entry) {
      entry = await this.file.get(key);
      if (entry) this.memory.set(key, entry.value, entry.ttlMs);
    }
    return { entry, state: classifyEntry(entry), stale: entry ? isStale(entry) : false };
  }

  /** Probe freshness only — used by the analyzer before a decision is made. */
  async peekState(key: string): Promise<CacheState> {
    return (await this.lookup(key)).state;
  }

  async set(key: string, value: string, ttlMs = this.defaultTtlMs): Promise<void> {
    this.memory.set(key, value, ttlMs);
    await this.file.set(key, value, ttlMs);
    await this.redis.set(key, value, ttlMs);
  }

  async invalidate(key: string): Promise<void> {
    this.memory.delete(key);
    await this.file.delete(key);
    await this.redis.delete(key);
  }
}
