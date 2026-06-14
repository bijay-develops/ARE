# Implementation

> Template. Reference real files (clickable in your editor / repo).

- **Stack** — Node 20 + TypeScript, React 18, native `http`, esbuild, Vitest,
  nginx, Docker Compose, optional Redis.
- **Core engine** — `src/core/engine.ts` orchestrates the pipeline; the analyzer
  (`context-analyzer.ts`) and the pure decision engine (`decision-engine.ts`).
- **Strategies** — one `RenderStrategy` interface (`src/core/types.ts`); six
  implementations under `src/strategies/`; registered in `src/server/server.ts`.
- **Caching** — 3-tier `CacheManager` (memory → redis → file) with
  stale-while-revalidate ISR (`src/strategies/isr/`).
- **Metrics** — per-request NDJSON + aggregation (`src/metrics/`).
- **Containerization** — multi-stage `docker/Dockerfile`; topology in
  `docker-compose.yml`; edges = same image with `SERVED_BY` + `EDGE_LATENCY_MS`.
- **Testing** — `tests/` (decision rules, cache, rendering); validation scripts
  in `scripts/`.

Include 2–3 key code excerpts (the rule table, the engine pipeline, a strategy).
