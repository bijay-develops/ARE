# Decision Algorithm

The decision engine (`src/core/decision-engine.ts`) is a **pure function**
`decide(ctx: RequestContext) → DecisionTrace`. It evaluates the rule table in
`src/config/strategy-rules.ts` **top-to-bottom; first match wins**. The final
rule is an unconditional fallback, so a strategy is always returned.

## Inputs (RequestContext)
Built by `context-analyzer.ts` from `X-*` headers (with inference fallbacks):

| Field | Source header | Fallback |
| --- | --- | --- |
| `networkSpeed` | `X-Network-Speed` | `medium` |
| `device` | `X-Device-Type` | inferred from `User-Agent` |
| `cacheState` | `X-Cache-State` | looked up from cache/SSG store |
| `load` | `X-Load-Level` | live concurrency vs thresholds |
| `volatility` | `X-Data-Volatility` | page-declared volatility |
| `heavyPayload` | `X-Data-Size: heavy` | page `heavy` flag |
| `isEdge` | `X-Served-By` ≠ origin | node's `SERVED_BY` config |

## Rule table (authoritative)
| # | Condition (first match wins) | Strategy |
| --- | --- | --- |
| 1 | `volatility=static` AND `cacheState≠cold` | SSG |
| 2 | `volatility=static` AND `isEdge` | EDGE_ISR |
| 3 | `load=high` | ISR |
| 4 | `volatility=realtime` AND `network=fast` AND `device=desktop` | CSR |
| 5 | `volatility=realtime` AND `device=mobile` | SSR |
| 6 | `volatility=periodic` | ISR |
| 7 | `heavyPayload` AND `network≠slow` | STREAMING_SSR |
| 8 | `network=slow` | SSR |
| 9 | fallback | SSR |

## Thresholds (`src/config/thresholds.ts`)
| Constant | Value | Meaning |
| --- | --- | --- |
| `HIGH_LOAD_CONCURRENCY` | 25 | in-flight requests → `load=high` |
| `MEDIUM_LOAD_CONCURRENCY` | 8 | → `load=medium` |
| `ISR_TTL_MS` | 30000 | ISR/Edge-ISR revalidation window |
| `HEAVY_PAYLOAD_BYTES` | 50000 | streaming candidate threshold |
| `NETWORK_DELAY_MS` | slow 400 / medium 100 / fast 0 | simulated latency |

## Why rule order matters
Earlier rules are higher priority. E.g. **high load (rule 3) overrides** a
realtime+fast+desktop request that would otherwise be CSR (rule 4) — under load
the engine deliberately sheds origin work by serving cached ISR. This ordering
is asserted in `tests/decision-engine.test.ts`.

## Extending to heuristics / ML (future)
`decide` is the single seam to replace: swap the rule loop for a scoring
function or a trained model that consumes the same `RequestContext` and returns
a `StrategyName`. Nothing else in the engine changes.
