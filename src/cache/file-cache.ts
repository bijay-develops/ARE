import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { CacheEntry } from './memory-cache.js';

/** Persistent filesystem cache. Survives container restarts via a mounted volume. */
export class FileCache {
  constructor(private readonly dir: string) {}

  private file(key: string): string {
    const hash = createHash('sha1').update(key).digest('hex');
    return path.join(this.dir, `${hash}.json`);
  }

  async get(key: string): Promise<CacheEntry | undefined> {
    try {
      const raw = await fs.readFile(this.file(key), 'utf8');
      return JSON.parse(raw) as CacheEntry;
    } catch {
      return undefined;
    }
  }

  async set(key: string, value: string, ttlMs: number): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
    const entry: CacheEntry = { value, storedAt: Date.now(), ttlMs };
    await fs.writeFile(this.file(key), JSON.stringify(entry), 'utf8');
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(this.file(key));
    } catch {
      /* already gone */
    }
  }
}
