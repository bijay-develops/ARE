/**
 * Tracks which cache keys depend on which data sources, so that invalidating a
 * source can cascade to the pages built from it. Minimal in-memory graph.
 */
export class DependencyGraph {
  private readonly deps = new Map<string, Set<string>>(); // source -> cache keys

  add(source: string, cacheKey: string): void {
    const set = this.deps.get(source) ?? new Set<string>();
    set.add(cacheKey);
    this.deps.set(source, set);
  }

  dependents(source: string): string[] {
    return [...(this.deps.get(source) ?? [])];
  }
}
