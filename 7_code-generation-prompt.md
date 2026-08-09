# 7. Code-Generation Prompt — START HERE in the next chat

This file is the **ready-to-use prompt + build contract** for generating the Adaptive Rendering Engine code. Paste section 7.1 into the next chat as the instruction, and keep sections 7.2–7.10 as the binding specification the generated code must satisfy.

> **Why this exists:** documents 1–6 define *what* and *why*. This file pins the *exact* contracts (interfaces, decision rules, thresholds, file responsibilities, scripts, acceptance criteria) so code can be generated deterministically, with no ambiguity left to guess.

---

## 7.1 The prompt to paste next chat

> You are a senior TypeScript/Node engineer building the **Adaptive Rendering Engine (ARE)** described in `1_project-details.md`. Implement the project **exactly** per the folder structure in `2_ARE-folder-structure.md`, the Docker design in `6_technology-and-docker-guide.md`, and the contracts in `7_code-generation-prompt.md` (this file).
>
> **Hard rules:**
> 1. Stack is fixed: Node 20+, TypeScript, React 18, native `http`, esbuild, Vitest, nginx, Docker Compose. No Express, no Next.js.
> 2. Every rendering strategy implements the **same `RenderStrategy` interface** (§7.3) and self-registers in `strategy-registry.ts`.
> 3. The decision engine is **pure and rule-based** (§7.5) — deterministic, unit-testable, no I/O.
> 4. Every response sets the **`X-Rendering-Strategy`** header and logs `[ARE] Strategy selected: <X>` (§7.6).
> 5. Everything runs with `docker compose up --build` and is verifiable with the scripts in §7.8.
>
> Build in the **order in §7.9**. After each phase, state what to run to verify it. Produce complete, compiling files — no `// TODO` stubs in core logic.

---

## 7.2 Build order summary (detail in §7.9)

1. Project scaffolding (package.json, tsconfig, configs) →
2. Core types + context analyzer + decision engine (+ unit tests) →
3. Native HTTP server + middleware + router →
4. The six strategy modules + registry →
5. Cache layer →
6. Metrics →
7. Frontend test pages + client bundle (esbuild) →
8. Docker (Dockerfile, compose, nginx) →
9. Validation scripts + experiments.

---

## 7.3 Core interfaces (`src/core/types.ts`) — the contract everything depends on

```ts
export type StrategyName =
  | 'SSG' | 'SSR' | 'STREAMING_SSR' | 'ISR' | 'CSR' | 'EDGE_ISR';

export type NetworkSpeed = 'slow' | 'medium' | 'fast';   // ~2G/3G | 4G | wifi
export type DeviceType   = 'mobile' | 'desktop';
export type CacheState   = 'fresh' | 'stale' | 'cold';
export type LoadLevel    = 'low' | 'medium' | 'high';
export type Volatility   = 'static' | 'periodic' | 'realtime'; // page data change rate

export interface RequestContext {
  url: string;
  networkSpeed: NetworkSpeed;
  device: DeviceType;
  cacheState: CacheState;
  load: LoadLevel;          // derived from concurrent in-flight requests
  volatility: Volatility;   // declared per page (see frontend pages)
  isEdge: boolean;          // true when served behind an edge node
  rawHeaders: Record<string, string>;
}

export interface RenderResult {
  status: number;
  headers: Record<string, string>;     // engine adds X-Rendering-Strategy
  body: string | NodeJS.ReadableStream; // string for buffered, stream for Streaming SSR
  fromCache: boolean;
}

export interface RenderStrategy {
  readonly name: StrategyName;
  /** Render the page for this context. May read/write the provided cache. */
  render(ctx: RequestContext, page: PageModule, cache: CacheManager): Promise<RenderResult>;
}

export interface PageModule {
  route: string;                 // e.g. "/static"
  volatility: Volatility;
  Component: React.ComponentType<any>;
  getData?: (ctx: RequestContext) => Promise<unknown>;
}

export interface DecisionTrace {       // returned with every decision for proof/logging
  selected: StrategyName;
  reason: string;                      // human-readable rule that fired
  context: RequestContext;
}
```

---

## 7.4 Context analyzer (`src/core/context-analyzer.ts`)

- Reads control headers (doc 5): `X-Network-Speed`, `X-Device-Type`, `X-Cache-State`, `X-Load-Level`, `X-Data-Volatility`.
- Falls back to inference when a header is absent: device from `User-Agent`; network defaults to `medium`; load from a live in-process counter of concurrent requests; volatility from the matched `PageModule.volatility`; cache state from the cache layer.
- Returns a fully-populated `RequestContext`. **No rendering, no decisions** — only observation.

---

## 7.5 Decision engine (`src/core/decision-engine.ts` + `config/strategy-rules.ts` + `config/thresholds.ts`)

Pure function: `decide(ctx: RequestContext): DecisionTrace`. Rules evaluated **top to bottom; first match wins**. This table is the authoritative spec — generate code that matches it and a unit test per row.

| # | Condition (first match wins) | Selected strategy | Reason |
| --- | --- | --- | --- |
| 1 | `volatility === 'static'` AND `cacheState !== 'cold'` | **SSG** | Static content, serve pre-built |
| 2 | `volatility === 'static'` AND `isEdge === true` | **EDGE_ISR** | Static at the edge with revalidation |
| 3 | `load === 'high'` | **ISR** | Shed origin load with cached + background revalidate |
| 4 | `volatility === 'realtime'` AND `networkSpeed === 'fast'` AND `device === 'desktop'` | **CSR** | Capable client, fully interactive |
| 5 | `volatility === 'realtime'` AND `device === 'mobile'` | **SSR** | Fresh data, minimal client JS for weak device |
| 6 | `volatility === 'periodic'` | **ISR** | Periodic data, cache + revalidate on TTL |
| 7 | data payload large / page flagged `heavy` AND `networkSpeed !== 'slow'` | **STREAMING_SSR** | Stream chunks for fast first paint |
| 8 | `networkSpeed === 'slow'` | **SSR** | Avoid heavy hydration on slow links |
| 9 | *fallback (no rule matched)* | **SSR** | Safe, correct default |

Thresholds live in `config/thresholds.ts`, e.g.:
```ts
export const THRESHOLDS = {
  HIGH_LOAD_CONCURRENCY: 25,   // in-flight requests → load='high'
  MEDIUM_LOAD_CONCURRENCY: 8,
  ISR_TTL_MS: 30_000,          // ISR/Edge-ISR revalidation window
  HEAVY_PAYLOAD_BYTES: 50_000, // → streaming candidate
  NETWORK_DELAY_MS: { slow: 400, medium: 100, fast: 0 },
};
```
The engine must be **deterministic and dependency-free** so `tests/decision-engine.test.ts` can assert every row.

---

## 7.6 Server + middleware (`src/server/*`)

- `server.ts`: native `http.createServer`; maintains the live concurrency counter (for `load`); on each request calls `engine.handle(req)`.
- `engine.ts` (core): `analyze → decide → registry.get(strategy).render → attach metrics → respond`. Always:
  - sets `res.setHeader('X-Rendering-Strategy', trace.selected)`,
  - sets `X-Decision-Reason: <reason>`,
  - logs `[ARE] Request: <url>` / `[ARE] Context: <summary>` / `[ARE] Strategy selected: <X>`.
- `middleware.ts`: header parsing, response-time start mark, error → fallback strategy.
- `router.ts`: maps URL → `PageModule` (`/static`, `/dynamic`, `/heavy`); 404 otherwise.
- Streaming SSR must pipe `renderToPipeableStream` directly to the response (do **not** buffer).

---

## 7.7 Strategy modules (`src/strategies/*`) — all implement `RenderStrategy`

| Module | React API | Cache behavior |
| --- | --- | --- |
| `ssg` | `renderToStaticMarkup` (build-time) | Serve pre-built HTML from `public/`; build via `scripts/build-ssg.ts` |
| `ssr` | `renderToString` per request | No cache |
| `streaming-ssr` | `renderToPipeableStream` + `<Suspense>` | No cache; streams |
| `isr` | `renderToString`, cache with TTL | Serve cached; revalidate in background after `ISR_TTL_MS` (stale-while-revalidate) |
| `csr` | minimal shell + `<script src="/client.js">` | Shell cacheable; data fetched client-side |
| `edge-isr` | like ISR but reads/writes the **edge** cache (Redis) | Per-edge cache, short TTL |

CSR/partial hydration uses `frontend/client/entry-client.tsx` → `hydrateRoot`, bundled to `public/client.js` by `scripts/build-client.ts` (esbuild).

---

## 7.8 Validation scripts (`scripts/*`) — must produce examiner-ready proof

- `switch-test.sh` — same URL, varied `X-*` headers; prints chosen strategy per request (doc 5).
- `verify-headers.sh` — `curl -I http://localhost:8080/<page>` and grep `X-Rendering-Strategy`.
- `load-test.sh` — `ab -n 1000 -c 50 http://localhost:8080/dynamic`; capture before/after strategy.
- `build-client.ts`, `build-ssg.ts`, `generate-report.ts` — esbuild bundle, SSG prerender, metrics aggregation to `experiments/results/`.

Expected demo (proof of the core thesis):
```bash
curl -s -D- -o/dev/null -H "X-Data-Volatility: static"  http://localhost:8080/static  | grep X-Rendering
#   X-Rendering-Strategy: SSG
curl -s -D- -o/dev/null -H "X-Data-Volatility: realtime" -H "X-Network-Speed: fast" -H "X-Device-Type: desktop" http://localhost:8080/dynamic | grep X-Rendering
#   X-Rendering-Strategy: CSR
curl -s -D- -o/dev/null -H "X-Load-Level: high"          http://localhost:8080/dynamic | grep X-Rendering
#   X-Rendering-Strategy: ISR
```

---

## 7.9 Detailed build phases (each ends with a verify step)

1. **Scaffold** — `package.json` (deps: `react`, `react-dom`; dev: `typescript`, `tsx`, `esbuild`, `vitest`, `@types/*`), `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `.dockerignore`, `.env.example`. *Verify:* `npm i && npx tsc --noEmit`.
2. **Core** — `types.ts`, `context-analyzer.ts`, `decision-engine.ts`, `strategy-rules.ts`, `thresholds.ts`, `strategy-registry.ts` + `tests/decision-engine.test.ts`. *Verify:* `npx vitest run` (all rule rows pass).
3. **Server** — `server.ts`, `middleware.ts`, `router.ts`, `engine.ts`, `logger.ts`. *Verify:* `tsx src/server/server.ts` then `curl -I localhost:3000/static`.
4. **Strategies** — all six modules. *Verify:* curl each page, confirm header matches expected strategy.
5. **Cache** — `cache-manager.ts`, `file-cache.ts`, `memory-cache.ts`, `redis-cache.ts`, `invalidation.ts`. *Verify:* ISR cold-vs-warm timing differs; cache test passes.
6. **Metrics** — collector, timing, resource-usage, report-generator. *Verify:* a request writes a metrics record.
7. **Frontend + bundle** — pages, components, client entry; `build-client.ts`. *Verify:* `/dynamic` hydrates in a browser (CSR path).
8. **Docker** — `Dockerfile`, `docker-compose.yml`, `nginx/edge.conf`, `nginx/proxy.conf`. *Verify:* `docker compose up --build`; `curl localhost:8080/static`.
9. **Validation + experiments** — the scripts in §7.8; run them, save outputs to `experiments/results/`.

---

## 7.10 Acceptance criteria (definition of done)

- [ ] `docker compose up --build` brings up origin + 2 edges + proxy + redis; `http://localhost:8080` responds.
- [ ] Same URL returns **different** `X-Rendering-Strategy` values as `X-*` headers change, matching §7.5.
- [ ] `[ARE] Strategy selected: <X>` appears in `docker compose logs origin` for every request.
- [ ] All six strategies render correctly; Streaming SSR actually streams (chunked), CSR hydrates in the browser.
- [ ] ISR/Edge-ISR show warm-cache speed-up; high load forces a cached strategy.
- [ ] `npx vitest run` passes (every decision rule row covered).
- [ ] Metrics (TTFB, render time, CPU/mem, cache hit/miss) are written to `experiments/results/`.
- [ ] `scripts/switch-test.sh`, `verify-headers.sh`, `load-test.sh` run and produce examiner-ready output.

---

**Reading order for the next session:** `1_project-details.md` → `2_ARE-folder-structure.md` → `6_technology-and-docker-guide.md` → this file. Documents 3, 4, 5 are the rationale/validation references.
