# Adaptive Rendering Engine (ARE)

A runtime that **automatically selects the optimal web rendering strategy per
request** — SSG, SSR, Streaming SSR, ISR, CSR or (simulated) Edge-ISR — from
real-time context: network speed, device, cache freshness, server load and data
volatility. Built as *technology* (an engine), open-source, zero-budget.

> **Start with [`0_PROJECT-CONTEXT.md`](0_PROJECT-CONTEXT.md)** — the verified single source
> of truth (architecture, rule table, trigger matrix, caveats, evidence chain).
> Then: `1_project-details.md` (problem), `2_ARE-folder-structure.md` (layout),
> `6_technology-and-docker-guide.md` (stack + Docker), `7_code-generation-prompt.md`
> (contracts). Server choice & validation method: docs 3–5. Run it: docs 8–9. Demo it: doc 10.

## How it works
```
Request → Context Analyzer → Decision Engine → Strategy Executor → Response + Metrics
```
- **Context Analyzer** (`src/core/context-analyzer.ts`) builds a `RequestContext`
  from `X-*` control headers, `?query=` aliases, or inference — in that precedence.
- **Decision Engine** (`src/core/decision-engine.ts`) is a pure, rule-based,
  unit-tested function (`src/config/strategy-rules.ts`).
- **Strategies** (`src/strategies/*`) each implement one `RenderStrategy`
  interface and self-register.
- Every response carries `X-Rendering-Strategy` + `X-Decision-Reason` and logs
  `[ARE] Strategy selected: <X>`.

## Tech stack
Node 20+ · TypeScript · React 18 (SSR/streaming/hydration) · native `http` ·
esbuild · Vitest · nginx · Docker Compose · optional Redis.

## Quick start (local)
```bash
npm install
npm run build:client          # bundle the React client → public/client.js
npm run dev                   # start the engine on :3000 (tsx watch)

# Prove strategy switching on the SAME url:
BASE_URL=http://localhost:3000 bash scripts/switch-test.sh
```

## Quick start (Docker private server)
```bash
docker compose up -d --build  # origin + 2 edges + proxy + redis
curl -sI http://localhost:8080/static           # via proxy → origin
curl -sI http://localhost:8081/dynamic          # directly at edge-node-1
docker compose logs -f origin | grep '\[ARE\]'
```
> There are **no volume mounts** — code changes need `docker compose up -d --build`.

## See all six strategies from the address bar
Every control header has a query alias, so a plain URL re-triggers the engine
(verified against the running stack):

| URL | Strategy |
| --- | --- |
| `/static` | SSG |
| `/static?cache=cold` | SSR |
| `/static?volatility=periodic` | ISR |
| `/dynamic?net=fast&device=desktop` | CSR |
| `/dynamic?device=mobile` | SSR |
| `/heavy` | STREAMING_SSR |
| `/heavy?net=slow` | SSR |
| `/edge1/static?cache=cold` | EDGE_ISR |

Aliases: `?net= ?device= ?cache= ?load= ?volatility= ?size= ?served=`
(headers still win over query params).

## Pages (test targets)
| Route | Volatility | Default strategy | Demonstrates |
| --- | --- | --- | --- |
| `/static` | static | SSG | Artifact ageing (frozen timestamp vs live clock) + cache lab |
| `/dynamic` | realtime | SSR | Embedded vs client-fetched data (CSR tell) + live polling |
| `/heavy` | realtime + heavy | Streaming SSR | Shell-then-stream + client-side filter/sort/page |

Each page renders an **interactive decision console**: the strategy, the rule that
fired and the observed context are server-rendered (visible with JS off), then the
page hydrates and evaluates the engine's *own* rule table live in the browser.

Also served: `/` (portfolio demo page) and `/control` (control panel).

## Scripts
- `npm test` — 28 tests: decision rules, context/query overrides, cache, rendering
- `npm run build` — compile server (tsc) + bundle client (esbuild)
- `npm run build:ssg` — pre-render static pages to `public/ssg`
- `npm run report` — aggregate metrics → `experiments/results/report.{json,csv}`
- `scripts/switch-test.sh` · `verify-headers.sh` · `load-test.sh` — validation (doc 5)

## Decision rules (authoritative)
See `src/config/strategy-rules.ts` — first match wins:
1. static + usable cache → **SSG**
2. static + edge → **EDGE_ISR**
3. high load → **ISR**
4. realtime + fast + desktop → **CSR**
5. realtime + mobile → **SSR**
6. periodic → **ISR**
7. heavy + non-slow network → **STREAMING_SSR**
8. slow network → **SSR**
9. fallback → **SSR**

**Precedence effects worth knowing:** rule 1 outranks rule 3 (so `load=high` alone
won't give ISR on `/static` — add `cache=cold`); `stale` counts as a *usable* cache;
rule 5 outranks rule 7 (mobile on `/heavy` gets SSR, not streaming); and EDGE_ISR is
unreachable through the proxy's default route because nginx stamps
`X-Served-By: origin`. Full detail in `0_PROJECT-CONTEXT.md` §7.
