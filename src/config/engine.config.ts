/**
 * Typed runtime configuration sourced from environment variables (.env).
 * Read once at startup; pure consumers should import `config`.
 */
export interface EngineConfig {
  port: number;
  cacheDir: string;
  cacheTtlMs: number;
  redisUrl: string | null;
  edgeLatencyMs: number;
  servedBy: string | null;
  metricsDir: string;
}

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export const config: EngineConfig = {
  port: num(process.env.PORT, 3000),
  cacheDir: process.env.CACHE_DIR ?? './.cache',
  cacheTtlMs: num(process.env.CACHE_TTL_MS, 30_000),
  redisUrl: process.env.REDIS_URL ? process.env.REDIS_URL : null,
  edgeLatencyMs: num(process.env.EDGE_LATENCY_MS, 0),
  servedBy: process.env.SERVED_BY ? process.env.SERVED_BY : null,
  metricsDir: process.env.METRICS_DIR ?? './experiments/results/raw-data',
};
