# Evaluation Metrics

## What is measured (per request)
Collected by `src/metrics/metrics-collector.ts`, appended as NDJSON to
`experiments/results/raw-data/metrics.ndjson`:

| Field | Meaning |
| --- | --- |
| `ttfbMs` | time from request start to first byte sent (server-side) |
| `renderMs` | pure render duration |
| `totalMs` | full handle time |
| `fromCache` | whether the response was served from cache |
| `bytes` | response size (proxy for JS/HTML weight) |
| `strategy` / `reason` | chosen strategy + the rule that fired |
| `network` / `device` / `load` / `isEdge` | the context that drove the decision |
| `resources` | RSS, heap, CPU ms, 1-min load average |

> Note: **FCP** (First Contentful Paint) is a *browser* metric. Capture it from
> Chrome DevTools → Lighthouse/Performance for the report; the server-side proxy
> for it here is `ttfbMs` + `bytes` (smaller shell + earlier bytes ⇒ faster FCP).

## Aggregation
`npm run report` (`scripts/generate-report.ts`) reads the NDJSON and writes
`experiments/results/report.json` and `report.csv` with per-strategy averages:
`count, avgTtfbMs, avgRenderMs, avgTotalMs, cacheHitRate, avgBytes`.

## Experiments to run (maps to `1_project-details.md` §5 and the `experiments/` folder)
| Experiment | Method | Expected finding |
| --- | --- | --- |
| `ssg-vs-ssr` | request `/static` forcing each strategy | SSG much lower TTFB + cache hit |
| `ssr-vs-streaming` | request `/heavy` as SSR vs Streaming | Streaming lower *perceived* TTFB |
| `adaptive-vs-static` | fixed strategy vs engine choice across contexts | adaptive wins on mixed workloads |
| network sweep | `X-Network-Speed` slow/medium/fast | strategy shifts toward server-side on slow |
| load test | `ab -n 1000 -c 50` | high load → ISR; stable req/s |

## Suggested table for the report
| Strategy | avg TTFB (ms) | avg bytes | cache-hit | Notes |
| --- | --- | --- | --- | --- |
| SSG | low | full HTML | yes | best for static |
| CSR | low (shell) | tiny shell | no | client does the work |
| Streaming SSR | low perceived | large | no | progressive for heavy pages |
| ISR / Edge-ISR | low (warm) | full HTML | yes | balances freshness + cost |
| SSR | higher | full HTML | no | freshest, most server cost |

Fill the numbers from your `report.csv`.
