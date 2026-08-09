# 8. RUNBOOK — How to Execute the Adaptive Rendering Engine

This is the step-by-step guide to run, test, and capture evidence from the ARE.
Two ways to run: **(A) Local** (fastest for development/demo) and
**(B) Docker private server** (origin + edges + proxy — for the report/viva).

---

## 0. Prerequisites (one-time)

| Tool | Check | Install (Fedora) | Install (macOS) |
| --- | --- | --- | --- |
| Node ≥ 20 | `node --version` | `sudo dnf install nodejs` | `brew install node` |
| npm | `npm --version` | (ships with Node) | (ships with Node) |
| Docker | `docker --version` | `sudo dnf install docker` | Docker Desktop |
| Docker Compose v2 | `docker compose version` | `sudo dnf install docker-compose-plugin` | (bundled with Desktop) |
| Apache Bench (load test) | `ab -V` | `sudo dnf install httpd-tools` | preinstalled |

```bash
cd /path/to/ARE        # this repository
npm install            # installs deps from package.json
```

> **If `npm test` or `npm run build:client` fails with *"You installed esbuild for another
> platform"* or *"Cannot find module @rollup/rollup-darwin-arm64"***: `node_modules` was
> installed for a different OS/architecture. Fix with `npm install`. Docker is unaffected —
> it runs `npm ci` inside the image.

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

## C. The five test scenarios from `1_PROJECT-PROPOSAL.md` §5

### C.1 Functional — correct strategy selection
```bash
npm test                              # 28 unit tests incl. all 9 decision rules
BASE_URL=http://localhost:8080 bash scripts/switch-test.sh   # live header-driven switching

# Or with URLs alone — no headers needed, works in a browser address bar:
for u in "/static" "/static?cache=cold" "/static?volatility=periodic" \
         "/dynamic?net=fast&device=desktop" "/dynamic?device=mobile" \
         "/heavy" "/heavy?net=slow" "/edge1/static?cache=cold"; do
  printf '%-40s -> ' "$u"
  curl -s -D- -o /dev/null "http://localhost:8080$u" \
    | awk 'tolower($1)=="x-rendering-strategy:"{gsub(/\r/,"");print $2}'
done
```
> ⚠️ `switch-test.sh` row 6 prints **SSR** (not EDGE_ISR) when `BASE_URL` is the Docker
> proxy, because nginx overwrites the spoofed `X-Served-By`. Demonstrate EDGE_ISR with
> `/edge1/static?cache=cold` or `http://localhost:8081/static?cache=cold`.

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
Compare the observed strategies against the rule table in `7_code-generation-prompt.md`
§7.5, or against the **verified trigger matrix** in `0_PROJECT-CONTEXT.md` §5 (every row
there was executed against the running stack).

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

1. **Screenshot/log** of the strategy sweep — same URLs, six different strategies (§C.1).
2. **`docker compose logs origin`** lines showing `[ARE] Strategy selected: …`.
3. **`experiments/results/report.csv`** — performance table per strategy.
4. **`ab` output** from `load-test.sh` — requests/sec, stability.
5. **`curl -sI` headers** showing `X-Rendering-Strategy` + `X-Decision-Reason`.
6. **Browser screenshot** of the decision console on `/static` — server-rendered strategy +
   rule + context, the `hydrated ✓` marker, and the live rule table.
7. **`curl -s -D- -o /dev/null http://localhost:8080/heavy`** showing `Transfer-Encoding:
   chunked` + `x-streaming: true` — proof Streaming SSR actually streams rather than merely
   being labelled so. (Use a **GET**; `curl -I` sends HEAD, which has no body and therefore
   no `Transfer-Encoding` header.)

The full evidence chain, with the claim each item supports, is tabulated in
`0_PROJECT-CONTEXT.md` §11.

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
| Edits to `src/` don't change Docker behaviour | there are **no volume mounts** — rebuild: `docker compose up -d --build` |
| `EDGE_ISR` never appears | you're hitting the origin; the proxy overwrites `X-Served-By`. Use `/edge1/…` or `:8081` |
| Same command gives SSG once, SSR later | you used `/dynamic` with `volatility=static`; its ISR cache warmth decides it. Use `/static` for deterministic demos |
| `esbuild`/`rollup` platform error | `node_modules` built for another OS — run `npm install` |
