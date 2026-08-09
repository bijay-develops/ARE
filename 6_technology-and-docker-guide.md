# 6. Technology & Docker Guide — How the ARE Actually Runs

This document explains **what technology we use, why, and exactly how Docker powers the project**: how the containers map to the architecture, how they connect, and how each one helps us execute the tasks in `1_project-details.md`. Read this together with `2_ARE-folder-structure.md` (where things live) and `7_code-generation-prompt.md` (the build contracts).

---

## 6.1 The technology stack (and the *why*)

| Layer | Technology | Why this and not something else |
| --- | --- | --- |
| Runtime language | **Node.js ≥ 20 + TypeScript** | One language for engine + view; types make the decision logic verifiable. Free. |
| View / rendering | **React 18** | The *only* mainstream lib that natively supports all six strategies: `renderToString` (SSR), `renderToStaticMarkup` (SSG), `renderToPipeableStream` (Streaming SSR + Suspense), `hydrateRoot` (CSR / partial hydration). We are **not** rebuilding React — we build the *engine that chooses how to use it*. |
| HTTP server | **Native Node `http`** | The deliverable is an *engine*, not a Next.js app. Using a framework would hide exactly the logic we are graded on. Native `http` streams responses, which Streaming SSR needs. |
| Client bundling | **esbuild** | One command turns `frontend/client/entry-client.tsx` into the browser hydration bundle. Zero config, free, ~instant. |
| Caching | **FS + in-memory**, optional **Redis** | FS cache is persistent and free (good for SSG/ISR output). Redis container demonstrates a *shared* cache across edge nodes. |
| Edge / proxy | **nginx** containers | Simulate edge nodes and inject artificial latency in front of the origin. |
| Tests | **Vitest** | TS-native, fast; proves "context → expected strategy". |
| Load testing | **Apache Bench (`ab`)** | Already specified in doc 5; sends concurrent requests to stress the engine. |
| Orchestration | **Docker + Docker Compose** | The chosen private-server environment (docs 3 & 4). |

> **Academic framing for the viva:** "We use React purely as the rendering primitive. The contribution is the *runtime engine* that analyzes request context and selects among SSG, SSR, Streaming SSR, ISR, CSR and Edge-ISR per request — something no existing framework does automatically."

---

## 6.2 What Docker is, in one paragraph (for the report)

Docker packages an application **and everything it needs to run** (Node, our code, dependencies, environment) into a **container** — an isolated, reproducible process. Unlike a virtual machine, a container shares the host Linux kernel, so it starts in milliseconds and uses almost no extra resources. **Docker Compose** lets us define *several* containers and the network between them in one `docker-compose.yml` file, and bring the whole system up with a single command. On Linux, Docker runs **natively** (no VirtualBox layer), which is why docs 3 and 4 chose it.

---

## 6.3 How Docker maps to *our* architecture

We run **one image** (the ARE Node service, built from `docker/Dockerfile`) as **multiple containers** with different roles, plus supporting containers. This is exactly how real CDNs are modelled — one origin, many edges.

```
                     ┌──────────────────────────────┐
   Browser / curl ─▶ │  proxy  (nginx)              │   :8080  ← single entry point
   / ab              │  docker/nginx/proxy.conf     │
                     └──────────────┬───────────────┘
              /  →  origin   |   /edge1/ →  edge-1   |   /edge2/ →  edge-2
            ┌──────────────────────┼──────────────────────┐
            ▼                      ▼                      ▼
   ┌─────────────────┐   ┌─────────────────┐    ┌────────────────────┐
   │ edge-node-1     │   │ edge-node-2     │    │ origin             │
   │ ARE Node image  │   │ ARE Node image  │    │ ARE Node image     │
   │ SERVED_BY=edge- │   │ SERVED_BY=edge- │    │ SERVED_BY=origin   │
   │   node-1, +20ms │   │   node-2, +80ms │    │ +0ms               │
   │ own cache :3000 │   │ own cache :3000 │    │  :3000             │
   │ published :8081 │   │ published :8082 │    └─────────┬──────────┘
   └────────┬────────┘   └────────┬────────┘              │
            └─────────────────────┴─────────────────────┬─┘
                                                        ▼
                                              ┌────────────────────────┐
                                              │ redis (shared cache)   │
                                              │  :6379  (optional)     │
                                              └────────────────────────┘

   Shared Docker network: every container reaches the others by name
   (e.g. every ARE instance connects to "redis:6379"; the proxy proxy_passes
   to "origin:3000" / "edge-node-1:3000" / "edge-node-2:3000").
```

> **Important — edges are real engines, not nginx shims.** All three ARE containers run
> the **same `are:latest` image**. An edge differs only by two environment variables:
> `SERVED_BY` (which makes the analyzer report `isEdge=true`) and `EDGE_LATENCY_MS`
> (injected delay). Each therefore has its **own process, own cache and own latency** —
> a far more honest CDN model than faking edges with nginx delays. There is **no
> `docker/nginx/edge.conf`**; earlier drafts of this document described one that was
> never built.

### Container roles

| Container | Built from | Role in the project | Tasks it enables (doc 1 / doc 5) |
| --- | --- | --- | --- |
| **origin** | `docker/Dockerfile` → `are:latest` | Runs the ARE engine + native HTTP server on `:3000` | Strategy selection, all six renderers, metrics, caching |
| **edge-node-1** | reuses `are:latest` | Low-latency edge (+20 ms), own cache, published on **:8081** | Edge-ISR simulation, "edge serves SSG/Edge-ISR" |
| **edge-node-2** | reuses `are:latest` | High-latency edge (+80 ms), own cache, published on **:8082** | Network-condition variation, edge-vs-origin comparison |
| **proxy** | `docker/nginx/Dockerfile` + `proxy.conf` | Front door on `:8080`; `/`→origin, `/edge1/`→edge-1, `/edge2/`→edge-2 | One stable URL for `curl`/`ab` while topology varies |
| **redis** (optional) | official `redis:7-alpine` | Shared cache across edges | ISR revalidation, cold-vs-warm cache, cache-hit metrics |

---

## 6.4 How the containers *connect* (the wiring)

1. **One Docker network.** Compose puts every service on a private bridge network. Containers address each other **by service name**, not IP — `proxy` → `origin:3000` / `edge-node-1:3000` / `edge-node-2:3000`; every ARE instance → `redis:6379`. No public IP, no domain (doc 3 confirms none needed).
2. **Ports.** The proxy publishes `8080:80`; the two edges publish `8081:3000` and `8082:3000` so they can be probed directly (this is how EDGE_ISR is demonstrated — see §6.9). The origin and Redis are reachable *inside* the network only — that is what makes it a **private server**.
3. **Latency injection.** Each edge sets `EDGE_LATENCY_MS`, and the ARE server sleeps that long per request ([`src/server/server.ts`](src/server/server.ts)), simulating geographic edge distance (doc 5, "Edge vs Origin"). Network speed adds a second, independent delay via `simulation/network-throttler.ts` (slow 400 ms / medium 100 ms / fast 0).
4. **Volumes — there are none.** Bind mounts were removed in commit `c678660`. Caches, SSG output and metrics live *inside* each container and are discarded on `docker compose down`.
   > **Consequence:** editing `src/` has **no effect** on a running stack. You must rebuild:
   > `docker compose up -d --build`. Only `origin` and `proxy` declare `build:`; the edges
   > reuse `are:latest`, so rebuilding the origin image is what updates them.
5. **Environment.** `.env` (from `.env.example`) supplies `PORT`, `EDGE_LATENCY_MS`, `CACHE_DIR`, `REDIS_URL`, `CACHE_TTL_MS`, `SERVED_BY`, `METRICS_DIR`. Compose also sets these inline per service, so `.env` is optional. Edges use a shorter `CACHE_TTL_MS` (15 s) than the origin (30 s).

---

## 6.5 How Docker helps us *execute each task* in document 1

| Task from `1_project-details.md` | How Docker makes it possible |
| --- | --- |
| **Per-request strategy selection** | The origin container runs the engine; `curl`/`ab` hit the proxy → we observe live decisions. |
| **Edge-ISR (simulated)** | Real, separate edge containers with their own caches and latency — not a fake in-code flag. |
| **Network simulation (2G/3G/4G)** | Per-edge latency via nginx + per-request `X-Network-Speed` honored by `network-throttler.ts`. |
| **Load testing** | `ab -n 1000 -c 50 http://localhost:8080/page` stresses the proxy → engine; container isolation keeps results clean and reproducible. |
| **Cache cold vs warm / ISR revalidation** | Restart the origin (cold) or share Redis across edges (warm); volumes preserve FS cache. |
| **Reproducibility for examiners** | `docker compose up` rebuilds the *entire* environment identically on any Linux machine — no "works on my laptop". |
| **Metrics collection** | Results volume persists TTFB/CPU/memory data on the host for the report. |

---

## 6.6 The key files Docker needs (all present)

- **`docker/Dockerfile`** — multi-stage: stage 1 runs `npm ci` and builds TS + the esbuild client bundle; stage 2 is a slim runtime image running `node dist/server/server.js`. It copies `dist/`, `public/`, `src/frontend/` and `src/control_panel/` into the runtime layer (which is why `are-page.css` and the control panel are served).
- **`docker-compose.yml`** — declares `origin`, `edge-node-1`, `edge-node-2`, `proxy`, `redis`; the shared network; per-service `SERVED_BY`, `EDGE_LATENCY_MS` and `CACHE_TTL_MS`. No volumes.
- **`docker/nginx/Dockerfile`** + **`docker/nginx/proxy.conf`** — the front proxy: `/` → origin (stamping `X-Served-By: origin`), `/edge1/` → edge-node-1, `/edge2/` → edge-node-2, forwarding all `X-*` control headers.
- **`.dockerignore`** — excludes `node_modules`, `.git` etc. from the build context.
- **`.env.example`** — documents every environment variable.

> There is **no `docker/nginx/edge.conf`**. Edges are ARE containers, not nginx (see §6.3).

---

## 6.7 Day-to-day commands (cheat sheet)

```bash
# Build images and start the whole private server (origin + edges + proxy + redis)
docker compose up --build

# Start in the background
docker compose up -d --build

# Watch the engine's decisions live (proof of strategy switching)
docker compose logs -f origin        # look for: [ARE] Strategy selected: SSG

# Validate strategy switching — same URL, different headers (doc 5)
BASE_URL=http://localhost:8080 bash scripts/switch-test.sh
BASE_URL=http://localhost:8080 bash scripts/verify-headers.sh /static

# Load test through the proxy (doc 5)
BASE_URL=http://localhost:8080 N=1000 C=50 bash scripts/load-test.sh /dynamic

# Tear everything down
docker compose down                   # no volumes to drop; caches die with the containers
```

### Development without rebuilding every time
There are no bind mounts, so **edits to `src/` never reach a running container**. For fast
iteration, develop **outside Docker** (`npm run dev` on `:3000`, `tsx watch` auto-reloads)
and use Docker only for the multi-node/benchmark runs — which is also the honest way to
report performance numbers. After any code change destined for the stack:
`docker compose up -d --build`.

---

## 6.9 Demonstrating EDGE_ISR (read before the viva)

`proxy.conf` sets `proxy_set_header X-Served-By origin;` on `location /`, which
**overwrites whatever the client sent**. That is correct — the origin is not an edge — but
it means **no header or query value can produce EDGE_ISR at `http://localhost:8080/…`**.

Use one of these instead:

```bash
# via the proxy's edge routes (nginx does not override X-Served-By here)
curl -sI "http://localhost:8080/edge1/static?cache=cold" | grep -i x-rendering-strategy
#   → EDGE_ISR

# or straight at an edge container
curl -sI "http://localhost:8081/static?cache=cold" | grep -i x-rendering-strategy
#   → EDGE_ISR
```

Both verified 2026-08-09. Note this also means `scripts/switch-test.sh` row 6 reports
**SSR** rather than EDGE_ISR when `BASE_URL` points at `:8080`; it only yields EDGE_ISR
against a direct origin with no nginx in front (local `npm run dev` on `:3000`).

---

## 6.8 Two-line summary for the report

> "The Adaptive Rendering Engine is a TypeScript/Node runtime that uses React 18 as its rendering primitive and selects one of six rendering strategies per request. It is deployed on a zero-cost, Docker-based private server that models a real CDN — one origin container running the engine, multiple nginx edge containers with injected latency, and an optional shared Redis cache — enabling controlled, reproducible evaluation of rendering strategies without any commercial cloud."

---
