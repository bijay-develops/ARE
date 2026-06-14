# Adaptive Rendering Engine (ARE)

A runtime that **automatically selects the optimal web rendering strategy per
request** — SSG, SSR, Streaming SSR, ISR, CSR or (simulated) Edge-ISR — from
real-time context: network speed, device, cache freshness, server load and data
volatility. Built as *technology* (an engine), open-source, zero-budget.

> Background & design: `1_project-details.md` (problem), `2_ARE-folder-structure.md`
> (layout), `6_technology-and-docker-guide.md` (stack + Docker), `7_code-generation-prompt.md`
> (contracts). Server choice & validation method: docs 3–5.

## How it works
```
Request → Context Analyzer → Decision Engine → Strategy Executor → Response + Metrics
```
- **Context Analyzer** (`src/core/context-analyzer.ts`) builds a `RequestContext`
  from `X-*` control headers (with sensible inference fallbacks).
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

# In another terminal — prove strategy switching on the SAME url:
BASE_URL=http://localhost:3000 bash scripts/switch-test.sh
```

## Quick start (Docker private server)
```bash
docker compose up --build     # origin + 2 edges + proxy + redis
curl -I http://localhost:8080/static            # via proxy → origin
curl -I http://localhost:8081/dynamic           # directly at edge-node-1
BASE_URL=http://localhost:8080 bash scripts/switch-test.sh
docker compose logs -f origin | grep '\[ARE\]'
```

## Pages (test targets)
| Route | Volatility | Typical strategy |
| --- | --- | --- |
| `/static` | static | SSG / Edge-ISR |
| `/dynamic` | realtime | CSR / SSR / ISR (context-dependent) |
| `/heavy` | realtime + heavy | Streaming SSR |

## Scripts
- `npm test` — decision-rule + cache + rendering unit tests
- `npm run build` — compile server (tsc) + bundle client (esbuild)
- `npm run build:ssg` — pre-render static pages to `public/ssg`
- `npm run report` — aggregate metrics → `experiments/results/report.{json,csv}`
- `scripts/switch-test.sh` · `verify-headers.sh` · `load-test.sh` — validation (doc 5)

## Decision rules (authoritative)
See `7_code-generation-prompt.md` §7.5 — first match wins:
1. static + usable cache → **SSG**
2. static + edge → **EDGE_ISR**
3. high load → **ISR**
4. realtime + fast + desktop → **CSR**
5. realtime + mobile → **SSR**
6. periodic → **ISR**
7. heavy + non-slow network → **STREAMING_SSR**
8. slow network → **SSR**
9. fallback → **SSR**
