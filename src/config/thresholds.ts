/**
 * Numeric thresholds used by the context analyzer and decision engine.
 * Centralised so experiments can tune behavior without touching logic.
 */
export const THRESHOLDS = {
  /** In-flight request count at/above which load is classified 'high'. */
  HIGH_LOAD_CONCURRENCY: 25,
  /** In-flight request count at/above which load is classified 'medium'. */
  MEDIUM_LOAD_CONCURRENCY: 8,
  /** ISR / Edge-ISR revalidation window (stale-while-revalidate). */
  ISR_TTL_MS: 30_000,
  /** Estimated payload size at/above which a page is a streaming candidate. */
  HEAVY_PAYLOAD_BYTES: 50_000,
  /** Artificial network delay applied per simulated network speed. */
  NETWORK_DELAY_MS: { slow: 400, medium: 100, fast: 0 } as Record<string, number>,
} as const;
