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
├── docker/                       # 🐳 PRIVATE SERVER (origin + edge + proxy)
│   ├── Dockerfile                # Multi-stage build for the ARE Node service
│   ├── nginx/
│   │   ├── edge.conf             # Edge node: adds latency, forwards to origin
│   │   └── proxy.conf            # Front reverse proxy / router
│   └── README.md                 # How the containers map to the architecture
│
├── docker-compose.yml            # origin + edge-node-1 + edge-node-2 + redis + proxy
│
├── docs/                         # Thesis / documentation
│   ├── problem-statement.md
│   ├── architecture.md
│   ├── rendering-strategies.md
│   ├── decision-algorithm.md
│   ├── evaluation-metrics.md
│   └── future-work.md
│
├── diagrams/                     # Architecture diagrams (draw.io exports)
│   ├── system-architecture.png
│   ├── decision-flow.png
│   └── rendering-pipeline.png
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
│   │   │   ├── dynamic.tsx       # High volatility → expect SSR/ISR
│   │   │   └── heavy.tsx         # Large/interactive → expect Streaming SSR/CSR
│   │   ├── components/
│   │   │   ├── header.tsx           # Page header + strategy badge
│   │   │   └── strategy-console.tsx # In-page decision console (reuses STRATEGY_RULES)
│   │   ├── are-page.css          # Shared styling for engine-rendered pages
│   │   └── client/
│   │       └── entry-client.tsx  # Hydration entry, bundled by esbuild
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
├── public/                       # Built client bundle + SSG/static output (served)
│   └── .gitkeep
│
├── experiments/                  # BENCHMARKING & COMPARISONS
│   ├── ssg-vs-ssr.md
│   ├── ssr-vs-streaming.md
│   ├── adaptive-vs-static.md
│   └── results/
│       ├── graphs/
│       └── raw-data/
│
├── scripts/                      # AUTOMATION (run on host or in containers)
│   ├── build-client.ts           # esbuild → public/ (CSR/hydration bundle)
│   ├── build-ssg.ts              # Pre-render static pages to public/
│   ├── switch-test.sh            # Batch curl: same URL, different X-* headers (doc 5)
│   ├── verify-headers.sh         # curl -I to read X-Rendering-Strategy (doc 5)
│   ├── load-test.sh              # Apache Bench against origin/edge (doc 5)
│   └── generate-report.ts        # Aggregates metrics into experiments/results
│
├── tests/
│   ├── decision-engine.test.ts   # Context → expected strategy (core proof)
│   ├── context-analyzer.test.ts  # Header/query overrides → context (URL re-triggering)
│   ├── cache.test.ts
│   └── rendering.test.ts
│
└── report/                       # FINAL YEAR SUBMISSION
    ├── abstract.md
    ├── introduction.md
    ├── methodology.md
    ├── implementation.md
    ├── results.md
    ├── conclusion.md
    └── references.md
```

---

# ✅ Coverage check — can this structure execute every task in `1_project-details.md`?

| Requirement (doc 1) | Where it lives | Status |
| --- | --- | --- |
| Context Analyzer (network/device/cache/volatility/load) | `core/context-analyzer.ts` + `simulation/` | ✅ |
| Decision Engine (rule-based selection) | `core/decision-engine.ts` + `config/strategy-rules.ts` | ✅ |
| SSG / SSR / Streaming SSR / ISR / CSR / Edge-ISR | `strategies/*` (one interface each) | ✅ |
| Metrics & feedback (TTFB/FCP/bundle/CPU/mem) | `metrics/*` | ✅ |
| Caching & invalidation | `cache/*` | ✅ |
| Private server, origin + edge | `docker/`, `docker-compose.yml` | ✅ (was missing) |
| Edge simulation + latency | `docker/nginx/edge.conf`, `simulation/network-throttler.ts` | ✅ (was missing) |
| Strategy switching by header (doc 5) | `server/middleware.ts`, `scripts/switch-test.sh` | ✅ (was missing) |
| Proof via `X-Rendering-Strategy` + logs | `server/middleware.ts`, `utils/logger.ts` | ✅ |
| Load testing | `scripts/load-test.sh` (`ab`) | ✅ (was missing) |
| CSR / hydration bundle | `frontend/client/`, `scripts/build-client.ts` (esbuild) | ✅ (was missing) |
| Functional + performance tests | `tests/`, `experiments/` | ✅ |
| Reports & diagrams | `report/`, `docs/`, `diagrams/` | ✅ |

Every task in document 1 now maps to a concrete location. Build contracts (interfaces, decision rules, npm scripts) are in `7_code-generation-prompt.md`.

---
