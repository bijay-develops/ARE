# Architecture

## Request lifecycle
```
HTTP request
   │
   ▼
server.ts ── normalize headers, inject SERVED_BY, apply network/edge latency
   │          maintain live concurrency counter, peek cache state
   ▼
Engine.handle()           (src/core/engine.ts)
   │ 1. analyze  → context-analyzer.ts → RequestContext
   │ 2. decide   → decision-engine.ts  → DecisionTrace (pure, rule-based)
   │ 3. render   → strategy-registry.get(name).render(ctx, page, cache)
   │ 4. respond  → set X-Rendering-Strategy + X-Decision-Reason, stream/send body
   │ 5. measure  → metrics-collector.record(...)
   ▼
HTTP response (+ [ARE] logs)
```

## Module map
| Layer | Files | Responsibility |
| --- | --- | --- |
| Core | `core/engine.ts`, `context-analyzer.ts`, `decision-engine.ts`, `strategy-registry.ts`, `types.ts` | Orchestration + the decision pipeline |
| Config | `config/strategy-rules.ts`, `thresholds.ts`, `engine.config.ts` | Rule table, tunable numbers, env config |
| Strategies | `strategies/{ssg,ssr,streaming-ssr,isr,csr,edge-isr}/*` | Six pluggable renderers, one interface |
| Cache | `cache/{cache-manager,memory-cache,file-cache,redis-cache,invalidation}.ts` | 3-tier cache + freshness classification |
| Metrics | `metrics/{metrics-collector,timing,resource-usage,report-generator}.ts` | Per-request measurement + aggregation |
| Simulation | `simulation/{network-throttler,device-profiler,traffic-simulator}.ts` | Network/device/load simulation |
| Server | `server/{server,router,middleware}.ts` | Native HTTP, routing, header parsing |
| Frontend | `frontend/pages/*`, `components/*`, `client/entry-client.tsx` | React test pages + hydration entry |

## Key design properties
- **Pluggable strategies:** every strategy implements `RenderStrategy`
  (`render(ctx, page, cache)`) and self-registers — adding a strategy = one file + one `.register()`.
- **Pure decision engine:** `decide(ctx)` does no I/O, so it is fully unit-testable
  and deterministic (see `tests/decision-engine.test.ts`).
- **Transport honesty:** Streaming SSR returns a real `Readable` the server pipes
  to the socket — it is not buffered.
- **Observability:** strategy + reason on every response header and in `[ARE]` logs.

## Containers (Docker)
See `6_technology-and-docker-guide.md`. Origin and edges run the *same image*;
edges differ only by `SERVED_BY` (self-identify as edge) and `EDGE_LATENCY_MS`
(injected delay). A shared Redis demonstrates a cross-edge cache.
