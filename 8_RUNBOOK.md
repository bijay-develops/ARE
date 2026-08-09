# 8. RUNBOOK — How to Execute the Adaptive Rendering Engine

This is the step-by-step guide to run, test, and capture evidence from the ARE.
Two ways to run: **(A) Local** (fastest for development/demo) and
**(B) Docker private server** (origin + edges + proxy — for the report/viva).

---

## 0. Prerequisites (one-time)

| Tool | Check | Install (Fedora) |
| --- | --- | --- |
| Node ≥ 20 | `node --version` | `sudo dnf install nodejs` |
| npm | `npm --version` | (ships with Node) |
| Docker | `docker --version` | `sudo dnf install docker` |
| Docker Compose v2 | `docker compose version` | `sudo dnf install docker-compose-plugin` |
| Apache Bench (load test) | `ab -V` | `sudo dnf install httpd-tools` |

```bash
cd /home/bijaybk/Projects/college-project/ARE
npm install            # installs deps from package.json
```

---

## A. Run locally (no Docker)

```bash
npm run build:client   # bundle the React client → public/client.js (needed once)
npm run dev            # starts the engine on http://localhost:3000 (auto-reload)
```
Leave that running. In a **second terminal**:

```bash
# Prove strategy switching on the SAME url with different headers:
BASE_URL=http://localhost:3000 bash scripts/switch-test.sh
```
Expected output:
```
static volatility, /static                     -> SSG             (expect SSG)
realtime + fast + desktop, /dynamic            -> CSR             (expect CSR)
high load, /dynamic                            -> ISR             (expect ISR)
realtime + mobile, /dynamic                    -> SSR             (expect SSR)
heavy payload + medium network, /heavy         -> STREAMING_SSR   (expect STREAMING_SSR)
static + edge + cold cache, /dynamic           -> EDGE_ISR        (expect EDGE_ISR)
periodic, /dynamic                             -> ISR             (expect ISR)
```

### Open in a browser
- http://localhost:3000/static  → SSG page (pre-rendered)
- http://localhost:3000/dynamic → adapts to your device/network
- http://localhost:3000/heavy   → streams progressively

Stop the server with `Ctrl-C`.

---

## B. Run the Docker private server (origin + 2 edges + proxy + redis)

```bash
cp .env.example .env          # optional — compose has inline defaults
docker compose up --build     # builds the image, starts 5 containers
```
You'll see each container log `[ARE] … listening`. Endpoints:

| URL | Hits | Behavior |
| --- | --- | --- |
| http://localhost:8080/... | proxy → **origin** | no latency |
| http://localhost:8081/... | **edge-node-1** | +20 ms, own cache, `isEdge=true` |
| http://localhost:8082/... | **edge-node-2** | +80 ms, own cache, `isEdge=true` |

In another terminal:
```bash
BASE_URL=http://localhost:8080 bash scripts/switch-test.sh      # via proxy
BASE_URL=http://localhost:8081 bash scripts/verify-headers.sh /static   # at edge
docker compose logs -f origin | grep '\[ARE\]'                 # watch decisions live
```
Tear down:
```bash
docker compose down            # stop; add -v to also wipe caches/volumes
```

> If `docker compose` is unavailable, you can still run a single node:
> `docker build -f docker/Dockerfile -t are:latest . && docker run -p 8080:3000 are:latest`

---

## C. The five test scenarios from `1_project-details.md` §5

### C.1 Functional — correct strategy selection
```bash
npm test                              # 14 unit tests incl. all 9 decision rules
bash scripts/switch-test.sh           # live header-driven switching
```

### C.2 Performance — adaptive vs static
```bash
# Generate traffic across strategies, then aggregate:
bash scripts/switch-test.sh
npm run report                        # → experiments/results/report.{json,csv}
```
`report.csv` gives per-strategy avg TTFB, render time, total, cache-hit rate, bytes.

### C.3 Network simulation (2G/3G/4G)
The engine applies artificial delay per `X-Network-Speed` (slow=400ms, medium=100ms, fast=0).
```bash
for s in slow medium fast; do
  echo -n "$s -> "
  curl -s -D- -o /dev/null -H "X-Network-Speed: $s" http://localhost:3000/dynamic \
    | awk 'tolower($1)=="x-rendering-strategy:"{gsub(/\r/,"");print $2}'
done
```

### C.4 Load testing
```bash
# Low load → SSR/CSR; under high concurrency the engine prefers cached ISR.
BASE_URL=http://localhost:8080 N=1000 C=50 bash scripts/load-test.sh /dynamic
```

### C.5 Strategy accuracy
Compare `scripts/switch-test.sh` output against the rule table in
`7_code-generation-prompt.md` §7.5 (and `docs/decision-algorithm.md`).

---

## D. Build / quality commands

| Command | What it does |
| --- | --- |
| `npm run typecheck` | `tsc --noEmit` — type safety |
| `npm test` | Vitest unit tests |
| `npm run build` | compile server (tsc) + bundle client (esbuild) → `dist/`, `public/` |
| `npm run build:ssg` | pre-render static pages → `public/ssg` |
| `npm start` | run compiled build (`node dist/server/server.js`) |
| `npm run report` | aggregate metrics → `experiments/results/` |

---

## E. What evidence to capture for the report

1. **Screenshot/log** of `scripts/switch-test.sh` — same URL, 7 different strategies.
2. **`docker compose logs origin`** lines showing `[ARE] Strategy selected: …`.
3. **`experiments/results/report.csv`** — performance table per strategy.
4. **`ab` output** from `load-test.sh` — requests/sec, stability.
5. **`curl -I` headers** showing `X-Rendering-Strategy` + `X-Decision-Reason`.

These five map directly to the thesis chapters in `report/` (see `docs/evaluation-metrics.md`).

---

## F. Troubleshooting

| Symptom | Cause / Fix |
| --- | --- |
| `client bundle not built` in page | run `npm run build:client` |
| `docker: unknown command: compose` | install `docker-compose-plugin` (see §0) |
| `ab: command not found` | install `httpd-tools` |
| Redis warning in logs | harmless — engine falls back to FS+memory; Redis is optional |
| Port already in use | change `PORT` (local) or the published ports in `docker-compose.yml` |
| Static page not SSG on first hit | server prebuilds SSG at startup; check the `[ARE] Prebuilt SSG` log line |
