# 10. Demo & Viva Guide — What to Show the Reviewer

A 5–8 minute live script with talking points, the exact commands, and the
verification story. Have **two terminals** open in the project root.

---

## 0. One-line pitch (say this first)
> "Existing frameworks make you choose a rendering strategy at build time. My
> Adaptive Rendering Engine chooses it **per request at runtime** — the *same URL*
> is rendered with a different strategy depending on network, device, cache, load
> and data volatility. Here it is running."

Optionally show `diagrams/system-architecture.svg` while saying this.

---

## 1. Show the system starts (Terminal 1)
```bash
cd ~/Projects/college-project/ARE
npm run dev
```
**Point at the boot log and say:**
```
[ARE] Adaptive Rendering Engine listening on :3000 (origin)
[ARE] Strategies registered: SSG, SSR, STREAMING_SSR, ISR, CSR, EDGE_ISR
```
> "All six rendering strategies are registered as pluggable modules behind one
> interface. The engine is now ready to decide per request."

---

## 2. The money shot — same URL, different strategy (Terminal 2)
```bash
BASE_URL=http://localhost:3000 bash scripts/switch-test.sh
```
**Output (all match expectations):**
```
static volatility, /static            -> SSG            (expect SSG)
realtime + fast + desktop, /dynamic   -> CSR            (expect CSR)
high load, /dynamic                   -> ISR            (expect ISR)
realtime + mobile, /dynamic           -> SSR            (expect SSR)
heavy payload + medium network        -> STREAMING_SSR  (expect STREAMING_SSR)
static + edge + cold cache            -> EDGE_ISR       (expect EDGE_ISR)
periodic, /dynamic                    -> ISR            (expect ISR)
```
> "Notice `/dynamic` appears five times with **different** strategies — only the
> request headers changed. That is the contribution: automated, runtime strategy
> selection."

**Then point back at Terminal 1** — every request logged its decision + reason:
```
[ARE] Context: net=fast device=desktop ... volatility=realtime ...
[ARE] Strategy selected: CSR — Realtime data on a capable client -> fully interactive (CSR)
```
> "The server log is the *decision*; the script output is the *proof header*. They
> always agree."

---

## 3. Show the proof header directly (Terminal 2)
```bash
curl -I -H "X-Network-Speed: slow" -H "X-Device-Type: mobile" http://localhost:3000/dynamic
```
> "Every response carries `X-Rendering-Strategy` and `X-Decision-Reason` — bulletproof,
> inspectable evidence, exactly as described in the validation plan."

---

## 4. Feature-by-feature testing (Terminal 2)
### 4a. Network Speed Impact
```bash
echo "=== Testing Network Speed ===" && \
for s in slow medium fast; do
  printf "%-7s -> " "$s"
  curl -s -D- -o /dev/null -H "X-Network-Speed: $s" -H 'X-Data-Volatility: realtime' \
       -H 'X-Device-Type: desktop' http://localhost:3000/dynamic \
    | awk 'tolower($1)=="x-rendering-strategy:"{gsub(/\r/,"");print $2}'
done
```
Expected output:
```
slow   -> SSR
medium -> SSR
fast   -> CSR
```
> "On a slow link the engine avoids shipping heavy JS and renders on the server;
> on a fast link it lets a capable client take over. The decision is contextual."

---

### 4b. Device Type Sensitivity
```bash
echo "=== Testing Device Type ===" && \
for d in mobile desktop; do
  printf "%-10s -> " "$d"
  curl -s -D- -o /dev/null -H "X-Device-Type: $d" -H 'X-Network-Speed: slow' \
       -H 'X-Data-Volatility: realtime' http://localhost:3000/dynamic \
    | awk 'tolower($1)=="x-rendering-strategy:"{gsub(/\r/,"");print $2}'
done
```
Expected output:
```
mobile     -> SSR
desktop    -> SSR
```
> "Mobile gets SSR regardless of network for safety; desktop on slow network also gets
> server-rendering. Change to `fast` network and watch desktop switch to CSR."

---

### 4c. Load Level Impact
```bash
echo "=== Testing Load Level ===" && \
for load in low medium high; do
  printf "%-7s -> " "$load"
  curl -s -D- -o /dev/null -H "X-Load-Level: $load" -H 'X-Network-Speed: fast' \
       -H 'X-Device-Type: desktop' -H 'X-Data-Volatility: realtime' http://localhost:3000/dynamic \
    | awk 'tolower($1)=="x-rendering-strategy:"{gsub(/\r/,"");print $2}'
done
```
Expected output:
```
low     -> CSR
medium  -> CSR
high    -> ISR
```
> "Under high load, the engine shifts to ISR (Incremental Static Regeneration) to
> serve cached pages faster and reduce server work."

---

### 4d. Cache State Handling
```bash
echo "=== Testing Cache State ===" && \
for cache in cold stale fresh; do
  printf "%-7s -> " "$cache"
  curl -s -D- -o /dev/null -H "X-Cache-State: $cache" -H 'X-Network-Speed: fast' \
       -H 'X-Device-Type: desktop' http://localhost:3000/dynamic \
    | awk 'tolower($1)=="x-rendering-strategy:"{gsub(/\r/,"");print $2}'
done
```
Expected output:
```
cold    -> EDGE_ISR
stale   -> ISR
fresh   -> CSR
```
> "Cold cache triggers EDGE_ISR (cache-miss recovery), stale triggers regeneration,
> fresh cache means we can go full CSR."

---

### 4e. Data Volatility Impact
```bash
echo "=== Testing Data Volatility ===" && \
for vol in static periodic realtime; do
  printf "%-10s -> " "$vol"
  curl -s -D- -o /dev/null -H "X-Data-Volatility: $vol" -H 'X-Network-Speed: fast' \
       -H 'X-Device-Type: desktop' http://localhost:3000/dynamic \
    | awk 'tolower($1)=="x-rendering-strategy:"{gsub(/\r/,"");print $2}'
done
```
Expected output:
```
static     -> SSG
periodic   -> ISR
realtime   -> CSR
```
> "Static data? Pre-build at deploy time (SSG). Changes periodically? Regenerate
> on demand (ISR). Real-time? Let the client fetch (CSR)."

---

### 4f. Heavy Payload Detection
```bash
echo "=== Testing Heavy Payload ===" && \
echo "Normal payload:" && \
curl -s -D- -o /dev/null -H "X-Network-Speed: medium" -H 'X-Device-Type: mobile' \
     http://localhost:3000/dynamic \
  | awk 'tolower($1)=="x-rendering-strategy:"{gsub(/\r/,"");print $2}' && \
echo "Heavy payload:" && \
curl -s -D- -o /dev/null -H "X-Data-Size: heavy" -H "X-Network-Speed: medium" \
     -H 'X-Device-Type: mobile' http://localhost:3000/heavy \
  | awk 'tolower($1)=="x-rendering-strategy:"{gsub(/\r/,"");print $2}'
```
Expected output:
```
Normal payload:
SSR
Heavy payload:
STREAMING_SSR
```
> "Large interactive pages trigger Streaming SSR to chunk the response and unblock
> the browser faster (progressive rendering)."

---

### 4g. Edge Node Detection
```bash
echo "=== Testing Edge Node ===" && \
echo "Origin server:" && \
curl -s -D- -o /dev/null http://localhost:3000/dynamic \
  | awk 'tolower($1)=="x-rendering-strategy:"{gsub(/\r/,"");print $2}' && \
echo "Edge node (cache cold):" && \
curl -s -D- -o /dev/null -H "X-Served-By: edge-node-1" -H 'X-Cache-State: cold' \
     http://localhost:3000/dynamic \
  | awk 'tolower($1)=="x-rendering-strategy:"{gsub(/\r/,"");print $2}'
```
Expected output:
```
Origin server:
CSR
Edge node (cache cold):
EDGE_ISR
```
> "When running behind a CDN edge node with a cold cache, EDGE_ISR is triggered
> to minimize time-to-first-byte."

---

## 5. Show measured performance (Terminal 2)
```bash
npm run report
```
> "Every request is measured. This aggregates TTFB, render time, response size and
> cache-hit rate per strategy."

**Point at the table** (`experiments/results/report.csv`/`.json`):
- CSR shell ≈ **400 bytes** vs Streaming heavy ≈ **20 KB** → adaptive payload.
- SSG / ISR / Edge-ISR **cache-hit rate = 1.0** → caching works.
- SSR / Streaming higher TTFB (real render) vs cached near-instant → the trade-off is real and measured.

---

## 6. Show correctness is tested (Terminal 2)
```bash
npm test
```
> "14 automated tests. The decision engine is a **pure function**, so every one of
> the nine rules has its own unit test — selection is provably deterministic, not
> hand-waved."

---

## 7. (Optional) The Docker private server
If Compose is installed:
```bash
docker compose up --build
# proxy → origin on :8080, edge-node-1 on :8081 (+20ms), edge-node-2 on :8082 (+80ms)
curl -s -D- -o /dev/null http://localhost:8081/static | grep -i x-rendering   # served at an edge
```
> "The same engine runs as an origin plus two edge nodes behind an nginx proxy,
> with a shared Redis cache — a zero-cost local model of a CDN, as in the server plan."

---

## How the local run worked (explain if asked)
1. `npm run dev` starts a **native Node HTTP server** (`src/server/server.ts`) — no
   Next.js/Express; the engine *is* the runtime.
2. On startup it **prebuilds static pages** to `public/ssg` and **registers the six
   strategies**.
3. For each request the engine runs a 4-step pipeline (see `diagrams/rendering-pipeline.svg`):
   - **Analyze** — `context-analyzer.ts` builds a `RequestContext` from `X-*` headers
     (with sensible inference fallbacks).
   - **Decide** — `decision-engine.ts` runs a pure rule table, first match wins.
   - **Render** — the chosen strategy renders with React 18 (string / stream / shell).
   - **Respond + Measure** — sets `X-Rendering-Strategy`, logs `[ARE]`, records metrics.

## How it was verified (the evidence chain)
| Claim | Evidence | Command |
| --- | --- | --- |
| Correct selection per context | 14 unit tests, all 9 rules | `npm test` |
| Live switching on same URL | 7/7 probes match | `scripts/switch-test.sh` |
| Decision is transparent | response header + server log agree | `curl -I ...` + Terminal 1 |
| It adapts to conditions | network sweep changes strategy | the `for` loop in §4 |
| Strategies have real trade-offs | per-strategy metrics | `npm run report` |
| Runs as real containers | image builds + serves | `docker compose up` / `docker run` |

---

## Likely reviewer questions (and crisp answers)
- **"Why React?"** It's the rendering primitive; the contribution is the *selector
  engine* around it, not a new view library.
- **"Is the edge real?"** It's emulated with separate containers + injected latency —
  a standard, accepted academic method; the architecture maps 1:1 to a real CDN.
- **"Rule-based, not ML?"** Yes — deterministic and explainable now; the `decide()`
  function is the single seam to swap for a trained model (future work).
- **"How is this different from Next.js?"** Next.js fixes the strategy at build time
  per route; here it's chosen at runtime per request from live context.
- **"Zero budget?"** Entirely open-source, runs locally on Linux + Docker; no cloud.
