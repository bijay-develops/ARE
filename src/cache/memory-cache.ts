export interface CacheEntry {
  value: string;
  /** Epoch ms when the entry was stored. */
  storedAt: number;
  /** TTL in ms; entry is considered stale after storedAt + ttlMs. */
  ttlMs: number;
}

/** Simple in-process LRU-ish cache (Map preserves insertion order). */
export class MemoryCache {
  private readonly store = new Map<string, CacheEntry>();
  constructor(private readonly maxEntries = 200) {}

  get(key: string): CacheEntry | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    // refresh recency
    this.store.delete(key);
    this.store.set(key, entry);
    return entry;
  }

  set(key: string, value: string, ttlMs: number): void {
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, { value, storedAt: Date.now(), ttlMs });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}
