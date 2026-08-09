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
                       routes to edge or origin
            ┌──────────────────────┼──────────────────────┐
            ▼                       ▼                      ▼
   ┌─────────────────┐   ┌─────────────────┐    ┌────────────────────┐
   │ edge-node-1     │   │ edge-node-2     │    │ origin             │
   │ nginx edge.conf │   │ nginx edge.conf │    │ ARE Node service   │
   │ +20ms latency   │   │ +80ms latency   │    │ (engine + server)  │
   │ → forwards to   │   │ → forwards to   │    │  :3000             │
   │   origin        │   │   origin        │    └─────────┬──────────┘
   └─────────────────┘   └─────────────────┘              │
                                                          ▼
                                              ┌────────────────────────┐
                                              │ redis (shared cache)   │
                                              │  :6379  (optional)     │
                                              └────────────────────────┘

   Shared Docker network: every container reaches the others by name
   (e.g. the engine connects to "redis:6379"; edges proxy_pass to "origin:3000").
   Volumes: ./public and ./experiments/results are mounted so SSG output and
   metrics persist on the host even after containers stop.
```

### Container roles

| Container | Built from | Role in the project | Tasks it enables (doc 1 / doc 5) |
| --- | --- | --- | --- |
| **origin** | `docker/Dockerfile` (our Node image) | Runs the ARE engine + native HTTP server on `:3000` | Strategy selection, all six renderers, metrics, caching |
| **edge-node-1** | nginx + `edge.conf` | Low-latency edge (+20 ms), forwards to origin | Edge-ISR simulation, "edge serves SSG/Edge-ISR" |
| **edge-node-2** | nginx + `edge.conf` | High-latency edge (+80 ms) | Network-condition variation, edge-vs-origin comparison |
| **proxy** | nginx + `proxy.conf` | Single front door on `:8080`, routes to edge/origin | One stable URL for `curl`/`ab` while topology varies |
| **redis** (optional) | official `redis` image | Shared cache across edges | ISR revalidation, cold-vs-warm cache, cache-hit metrics |

---

## 6.4 How the containers *connect* (the wiring)

1. **One Docker network.** Compose puts every service on a private bridge network. Containers address each other **by service name**, not IP — `proxy` → `edge-node-1`, edges → `origin:3000`, engine → `redis:6379`. No public IP, no domain (doc 3 confirms none needed).
2. **Ports.** Only the proxy publishes a host port (`8080:80`). Everything else is reachable *inside* the network only — that is what makes it a **private server**.
3. **Latency injection.** Each edge's `edge.conf` adds artificial delay before `proxy_pass http://origin:3000;`, simulating geographic edge distance (doc 5, section "Edge vs Origin").
4. **Volumes (data that must survive restarts).**
   - `./public` → SSG output + the esbuild client bundle (so static pages persist).
   - `./experiments/results` → metrics JSON/CSV written by `metrics/report-generator.ts`.
   - `./src` (dev only) → bind-mounted for hot reload during development.
5. **Environment.** `.env` (from `.env.example`) supplies `PORT`, `EDGE_LATENCY_MS`, `CACHE_DIR`, `REDIS_URL`, `CACHE_TTL_MS`, etc. Each edge container gets a different `EDGE_LATENCY_MS`.

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

## 6.6 The key files Docker needs (to be generated next chat)

- **`docker/Dockerfile`** — multi-stage: stage 1 installs deps + builds TS and the esbuild client bundle; stage 2 is a slim runtime image running `node dist/server/server.js`.
- **`docker-compose.yml`** — declares `origin`, `edge-node-1`, `edge-node-2`, `proxy`, `redis`; the shared network; volumes; per-service `EDGE_LATENCY_MS`.
- **`docker/nginx/edge.conf`** — adds latency, `proxy_pass` to `origin:3000`, passes through `X-*` headers.
- **`docker/nginx/proxy.conf`** — routes `/` to origin and (optionally) path/header-based routing to edges.
- **`.dockerignore`** — excludes `node_modules`, `.git`, `experiments/results` from the build context.
- **`.env.example`** — documents every environment variable.

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
bash scripts/switch-test.sh
bash scripts/verify-headers.sh        # reads X-Rendering-Strategy

# Load test through the proxy (doc 5)
bash scripts/load-test.sh             # wraps: ab -n 1000 -c 50 http://localhost:8080/page

# Tear everything down
docker compose down                   # add -v to also drop volumes (clears caches)
```

### Development without rebuilding every time
For fast iteration, bind-mount `./src` and run the dev server (`tsx watch`) inside the origin container; only rebuild the image when dependencies change. Production/benchmark runs use the built image for honest performance numbers.

---

## 6.8 Two-line summary for the report

> "The Adaptive Rendering Engine is a TypeScript/Node runtime that uses React 18 as its rendering primitive and selects one of six rendering strategies per request. It is deployed on a zero-cost, Docker-based private server that models a real CDN — one origin container running the engine, multiple nginx edge containers with injected latency, and an optional shared Redis cache — enabling controlled, reproducible evaluation of rendering strategies without any commercial cloud."

---
