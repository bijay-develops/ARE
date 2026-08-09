import type { CacheEntry } from './memory-cache.js';
import { logger } from '../utils/logger.js';

/**
 * Optional shared cache backed by Redis (ioredis). Used to demonstrate a cache
 * shared across edge nodes. If ioredis is not installed or the URL is unset,
 * this is a no-op and the system falls back to FS + memory.
 *
 * ioredis is an optionalDependency and imported dynamically so the build never
 * hard-fails when it is absent.
 */
export class RedisCache {
  private client: any = null;
  private ready = false;

  constructor(private readonly url: string | null) {}

  async connect(): Promise<void> {
    if (!this.url) return;
    try {
      const mod: any = await import('ioredis');
      const Redis = mod.default ?? mod;
      this.client = new Redis(this.url, { lazyConnect: true, maxRetriesPerRequest: 1 });
      await this.client.connect();
      this.ready = true;
      logger.are(`Redis edge cache connected: ${this.url}`);
    } catch (err) {
      logger.warn(`Redis unavailable, using FS+memory only (${(err as Error).message})`);
      this.client = null;
      this.ready = false;
    }
  }

  get available(): boolean {
    return this.ready && this.client !== null;
  }

  async get(key: string): Promise<CacheEntry | undefined> {
    if (!this.available) return undefined;
    const raw = await this.client.get(key);
    return raw ? (JSON.parse(raw) as CacheEntry) : undefined;
  }

  async set(key: string, value: string, ttlMs: number): Promise<void> {
    if (!this.available) return;
    const entry: CacheEntry = { value, storedAt: Date.now(), ttlMs };
    await this.client.set(key, JSON.stringify(entry), 'PX', ttlMs);
  }

  async delete(key: string): Promise<void> {
    if (!this.available) return;
    await this.client.del(key);
  }
}
