Below is the **corrected, execution-ready structure** for the **Adaptive Rendering Engine (ARE)** that:

* separates **decision logic**, **rendering strategies**, **caching**, and **metrics**
* works **offline / zero budget**
* runs inside a **Docker-based private server** (origin + simulated edge nodes) — see `6_technology-and-docker-guide.md`
* looks like a **real framework / runtime**, not a demo project

> **What changed from the first draft (and why):** the original structure had no Docker layer, no client-bundle path, no reverse-proxy/edge config, and no load-test scripts. Those are mandatory because documents 3, 4 and 5 make a Docker private server (origin + edge) the execution environment and header-driven request switching the validation method. The structure below adds all of them and pins the technology stack. See `6_technology-and-docker-guide.md` for the rationale and `7_code-generation-prompt.md` for the build contracts.

---

# 📦 Technology Stack (pinned — do not deviate without reason)

| Concern | Choice | Why |
| --- | --- | --- |
| Language | **TypeScript** (Node.js ≥ 20 LTS) | Type-safe engine, industry standard, free |
| View layer | **React 18** (`react`, `react-dom`) | Only library that cleanly supports SSR + `renderToPipeableStream` (Streaming SSR) + `hydrateRoot` (CSR/partial hydration) — we build the *strategy selector*, not a new React |
| HTTP server | **Native Node `http` module** (no Express/Next) | The project *is* an engine; using a framework would defeat the academic point. Streaming works natively. |
| Client bundler | **esbuild** | Zero-config, instant, free; produces the CSR/hydration bundle |
| Cache | **Filesystem + in-memory**, optional **Redis** container | Zero cost; Redis only to demo a shared edge cache |
| Reverse proxy / edge | **nginx** (in containers) | Simulates edge nodes + injects latency |
| Tests | **Vitest** | Fast, TS-native |
| Load testing | **Apache Bench (`ab`)** + bash | Already specified in doc 5, zero cost |
| Orchestration | **Docker + Docker Compose** | The chosen private-server environment (docs 3/4) |

---

# 📁 **Adaptive Rendering Engine – Folder Structure**

```
adaptive-rendering-engine/
│
├── README.md
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .gitignore
├── .dockerignore
├── .env.example                  # PORT, EDGE_LATENCY_MS, CACHE_DIR, REDIS_URL, etc.
│
├── docker/                       # 🐳 PRIVATE SERVER (origin + edges + proxy)
│   ├── Dockerfile                # Multi-stage build for the ARE Node service
│   ├── nginx/
│   │   ├── Dockerfile            # Builds the proxy image
│   │   └── proxy.conf            # / → origin, /edge1/ → edge-1, /edge2/ → edge-2
│   └── README.md                 # How the containers map to the architecture
│
├── docker-compose.yml            # origin + edge-node-1 + edge-node-2 + redis + proxy
│
├── diagrams/                     # Architecture diagrams (SVG, editable)
│   ├── system-architecture.svg
│   ├── decision-flow.svg
│   ├── rendering-pipeline.svg
│   ├── data-flow.svg
│   └── data-flow.mmd             # Mermaid source for data-flow.svg
│
├── src/
│   │
│   ├── core/                     # CORE RUNTIME (MOST IMPORTANT)
│   │   ├── engine.ts             # Orchestrates analyze → decide → render → measure
│   │   ├── context-analyzer.ts   # Builds RequestContext from headers/device/load
│   │   ├── decision-engine.ts    # Rule-based strategy selection (see thresholds)
│   │   ├── strategy-registry.ts  # Registers/looks up pluggable strategies
│   │   └── types.ts              # Shared interfaces (RequestContext, Strategy, etc.)
│   │
│   ├── strategies/               # RENDERING STRATEGIES (PLUGGABLE, one interface)
│   │   ├── ssg/
│   │   │   ├── ssg-renderer.ts
│   │   │   └── ssg-cache.ts
│   │   ├── ssr/
│   │   │   ├── ssr-renderer.ts
│   │   │   └── ssr-handler.ts
│   │   ├── streaming-ssr/
│   │   │   ├── stream-renderer.ts
│   │   │   └── suspense-handler.ts
│   │   ├── isr/
│   │   │   ├── isr-renderer.ts
│   │   │   ├── revalidation.ts
│   │   │   └── dependency-graph.ts
│   │   ├── csr/
│   │   │   ├── csr-handler.ts
│   │   │   └── hydration.ts
│   │   └── edge-isr/
│   │       ├── edge-simulator.ts
│   │       └── edge-cache.ts
│   │
│   ├── cache/                    # CACHING & INVALIDATION
│   │   ├── cache-manager.ts      # Unified API over the backends below
│   │   ├── file-cache.ts         # Filesystem cache (zero cost, persistent)
│   │   ├── memory-cache.ts       # In-process LRU
│   │   ├── redis-cache.ts        # Optional shared edge cache (container)
│   │   └── invalidation.ts       # TTL / stale-while-revalidate logic
│   │
│   ├── metrics/                  # PERFORMANCE MEASUREMENT
│   │   ├── metrics-collector.ts  # TTFB, render time, cache hit/miss per request
│   │   ├── timing.ts
│   │   ├── resource-usage.ts     # CPU/memory via process + os
│   │   └── report-generator.ts   # Writes JSON/CSV to experiments/results
│   │
│   ├── simulation/               # EDGE / NETWORK / DEVICE SIMULATION
│   │   ├── network-throttler.ts  # Applies artificial delay per X-Network-Speed
│   │   ├── device-profiler.ts    # Classifies device from headers
│   │   └── traffic-simulator.ts  # Local load generator (complements `ab`)
│   │
│   ├── server/                   # HTTP SERVER (NATIVE, MINIMAL)
│   │   ├── server.ts             # Native http server, entry point
│   │   ├── router.ts             # Maps URL → page handler
│   │   └── middleware.ts         # Header parsing, X-Rendering-Strategy response, logging
│   │
│   ├── frontend/                 # TEST PAGES + CLIENT ENTRY (the render target)
│   │   ├── pages/
│   │   │   ├── static.tsx        # Low volatility → expect SSG/Edge-ISR
│   │   │   ├── dynamic.tsx       # High volatility → expect SSR/ISR/CSR
│   │   │   └── heavy.tsx         # Large/interactive → expect Streaming SSR
│   │   ├── components/
│   │   │   ├── header.tsx           # Page header + strategy badge
│   │   │   └── strategy-console.tsx # In-page decision console (reuses STRATEGY_RULES)
│   │   ├── are-page.css          # Shared styling for engine-rendered pages
│   │   ├── index.html            # Portfolio landing page served at /
│   │   ├── script.js             # Client script for the landing page
│   │   ├── style.css             # Styling for the landing page
│   │   └── client/
│   │       └── entry-client.tsx  # Hydration entry, bundled by esbuild
│   │
│   ├── control_panel/            # Operator UI served at /control
│   │   ├── index.html            # Inspector, traffic generator, edge race, cache lab
│   │   ├── script.js
│   │   └── style.css
│   │
│   ├── config/
│   │   ├── engine.config.ts      # Reads .env, exposes typed config
│   │   ├── strategy-rules.ts     # The decision rule table
│   │   └── thresholds.ts         # Numeric thresholds (latency, load, TTL)
│   │
│   └── utils/
│       ├── logger.ts             # Structured logs incl. "[ARE] Strategy selected: X"
│       ├── file-utils.ts
│       └── helpers.ts
│
├── public/                       # Built client bundle + SSG output (served)
│   ├── client.js                 # esbuild output (+ .map)
│   └── ssg/                      # Prebuilt SSG artifacts, e.g. static.html
│
├── experiments/                  # BENCHMARKING & COMPARISONS
│   └── results/
│       ├── graphs/
│       ├── raw-data/             # metrics.ndjson — one JSON record per request
│       ├── report.csv            # aggregated by `npm run report`
│       └── report.json
│
├── scripts/                      # AUTOMATION (run on host or in containers)
│   ├── build-client.ts           # esbuild → public/ (CSR/hydration bundle)
│   ├── build-ssg.ts              # Pre-render static pages to public/
│   ├── switch-test.sh            # Batch curl: same URL, different X-* headers (doc 5)
│   ├── verify-headers.sh         # curl -I to read X-Rendering-Strategy (doc 5)
│   ├── load-test.sh              # Apache Bench against origin/edge (doc 5)
│   └── generate-report.ts        # Aggregates metrics into experiments/results
│
├── tests/                        # 28 tests total
│   ├── decision-engine.test.ts   # (10) Context → expected strategy (core proof)
│   ├── context-analyzer.test.ts  # (14) Header/query overrides → context + URL re-triggering
│   ├── cache.test.ts             # (2)
│   └── rendering.test.ts         # (2)
│
├── report-build/                 # Tooling for generating the report/slides (Python)
│   ├── build_report.py           # → .docx     ⚠️ inputs in report/ were removed (see below)
│   ├── build_pptx.py             # → .pptx
│   ├── driver.py, extract_toc.py
│   ├── toc_map.json, headings.json
│   └── figs/                     # PNG exports of the diagrams
│
└── 0_PROJECT-CONTEXT.md          # ⭐ Verified single source of truth — read first
    1_…10_*.md                    # The numbered design/run/demo document series
```

> **Removed in commit `9f4674d`:** `docs/` (6 thesis files), `report/` (7 chapter stubs),
> `LOGBOOK.md`, `LOGBOOK-SUMMARY.md` and the mid-term `.docx/.pdf/.pptx` deliverables.
> They remain recoverable from git history — see `0_PROJECT-CONTEXT.md` §13. The final
> report and defense slides will be regenerated from `0_PROJECT-CONTEXT.md` under a
> format to be specified.

---

# ✅ Coverage check — can this structure execute every task in `1_project-details.md`?

| Requirement (doc 1) | Where it lives | Status |
| --- | --- | --- |
| Context Analyzer (network/device/cache/volatility/load) | `core/context-analyzer.ts` + `simulation/` | ✅ |
| Decision Engine (rule-based selection) | `core/decision-engine.ts` + `config/strategy-rules.ts` | ✅ |
| SSG / SSR / Streaming SSR / ISR / CSR / Edge-ISR | `strategies/*` (one interface each) | ✅ |
| Metrics & feedback (TTFB/FCP/bundle/CPU/mem) | `metrics/*` | ✅ |
| Caching & invalidation | `cache/*` | ✅ |
| Private server, origin + edge | `docker/`, `docker-compose.yml` | ✅ |
| Edge simulation + latency | `EDGE_LATENCY_MS` per container + `simulation/network-throttler.ts` | ✅ |
| Strategy switching by header (doc 5) | `core/context-analyzer.ts`, `scripts/switch-test.sh` | ✅ |
| Strategy switching by **plain URL** | `QUERY_ALIASES` in `core/context-analyzer.ts` | ✅ (added) |
| Proof via `X-Rendering-Strategy` + logs | `core/engine.ts`, `utils/logger.ts` | ✅ |
| Load testing | `scripts/load-test.sh` (`ab`) | ✅ |
| CSR / hydration bundle | `frontend/client/`, `scripts/build-client.ts` (esbuild) | ✅ |
| Functional + performance tests | `tests/` (28), `experiments/results/` | ✅ |
| In-page decision transparency | `frontend/components/strategy-console.tsx` | ✅ (added) |
| Diagrams | `diagrams/` (SVG) | ✅ |
| Reports | `report-build/` tooling; content from `0_PROJECT-CONTEXT.md` | ⏳ pending format |

Every task in document 1 maps to a concrete location. Build contracts (interfaces, decision
rules, npm scripts) are in `7_code-generation-prompt.md`; verified runtime behaviour is in
`0_PROJECT-CONTEXT.md`.

> **Two structural notes.** Edge simulation is done by running the *same ARE image* with
> different `SERVED_BY`/`EDGE_LATENCY_MS` env vars — there is no `docker/nginx/edge.conf`,
> despite what earlier drafts of docs 2 and 6 said. And the strategy header is set in
> `core/engine.ts`, not `server/middleware.ts` (which only normalises headers and parses URLs).

---
