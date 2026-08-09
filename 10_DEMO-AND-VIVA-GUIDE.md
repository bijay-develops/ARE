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

> **Which environment?** The commands below use the Docker stack on **`:8080`** (what you
> demo for the report). To run without Docker use `npm run dev` and swap `:8080` → `:3000`
> — every command works on both, *except* the edge tests in §4g, which need the containers.

---

## 1. Show the system starts (Terminal 1)
```bash
cd /path/to/ARE          # this repo
npm run dev              # local, :3000 — or: docker compose up --build  (:8080)
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
**Output (6 of 7 match; see the note):**
```
static volatility, /static            -> SSG            (expect SSG)
realtime + fast + desktop, /dynamic   -> CSR            (expect CSR)
high load, /dynamic                   -> ISR            (expect ISR)
realtime + mobile, /dynamic           -> SSR            (expect SSR)
heavy payload + medium network        -> STREAMING_SSR  (expect STREAMING_SSR)
static + edge + cold cache            -> EDGE_ISR       (expect EDGE_ISR)
periodic, /dynamic                    -> ISR            (expect ISR)
```

> ⚠️ **Row 6 only prints EDGE_ISR against a direct origin (`:3000`).** Through the Docker
> proxy (`BASE_URL=http://localhost:8080`) it prints **SSR**, because nginx overwrites the
> spoofed `X-Served-By` header — see §4g. If you are demoing on `:8080`, either say this
> up front ("the proxy refuses to let a client pretend to be an edge — here's the real
> edge instead") and run the §4g block, or run this script against `:3000`.

**Or show the same thing as plain URLs** — no headers, no curl flags, works in a browser:
```bash
strategy() {   # works in bash AND zsh
  curl -s -D- -o /dev/null "$@" \
    | awk -F': ' 'tolower($1)=="x-rendering-strategy"{gsub(/\r/,"");print $2}'
}
for u in "/static" "/static?cache=cold" "/static?volatility=periodic" \
         "/dynamic" "/dynamic?net=fast&device=desktop" "/dynamic?device=mobile" \
         "/heavy" "/heavy?net=slow" "/edge1/static?cache=cold"; do
  printf '%-45s -> %s\n' "$u" "$(strategy "http://localhost:8080$u")"
done
```
```
/static                                       -> SSG
/static?cache=cold                            -> SSR
/static?volatility=periodic                   -> ISR
/dynamic                                      -> SSR
/dynamic?net=fast&device=desktop              -> CSR
/dynamic?device=mobile                        -> SSR
/heavy                                        -> STREAMING_SSR
/heavy?net=slow                               -> SSR
/edge1/static?cache=cold                      -> EDGE_ISR
```
> "All six strategies, from nine URLs, with no special tooling — you can paste any of
> these into a browser address bar."
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
Cache state only steers the decision for **static** content (rules 1–2). Demonstrate it on
`/static`, not `/dynamic` — on a realtime page with a fast desktop client, rule 4 fires
first and the cache state is never consulted.

```bash
echo "=== Testing Cache State (on /static) ===" && \
for cache in fresh stale cold; do
  printf "%-7s -> " "$cache"
  curl -s -D- -o /dev/null -H "X-Cache-State: $cache" http://localhost:8080/static \
    | awk 'tolower($1)=="x-rendering-strategy:"{gsub(/\r/,"");print $2}'
done
```
Expected output (verified):
```
fresh   -> SSG
stale   -> SSG
cold    -> SSR
```
> "A *usable* cache — fresh **or stale** — serves the pre-built artifact: stale-while-revalidate
> is a feature, not a miss. Only a genuinely cold cache forces the engine to render."

**Contrast (also verified):** the same sweep on `/dynamic` with `-H 'X-Network-Speed: fast'
-H 'X-Device-Type: desktop'` returns **CSR for all three** — proof that first-match-wins
ordering really is doing the work.

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
Use **desktop** here. Rule 5 (`realtime + mobile → SSR`) is evaluated *before* rule 7, so a
mobile client on `/heavy` deliberately gets plain SSR — weak devices are not asked to
hydrate a large payload.

```bash
strategy() {   # reusable helper — paste once, use everywhere below
  curl -s -D- -o /dev/null "$@" \
    | awk -F': ' 'tolower($1)=="x-rendering-strategy"{gsub(/\r/,"");print $2}'
}

echo "=== Testing Heavy Payload ==="
echo "light payload : $(strategy -H 'X-Data-Size: light' -H 'X-Network-Speed: medium' \
                                 -H 'X-Device-Type: desktop' http://localhost:8080/dynamic)"
echo "heavy payload : $(strategy -H 'X-Data-Size: heavy' -H 'X-Network-Speed: medium' \
                                 -H 'X-Device-Type: desktop' http://localhost:8080/heavy)"
```
Expected output (verified):
```
light payload : SSR
heavy payload : STREAMING_SSR
```
> "Large interactive pages trigger Streaming SSR to chunk the response and unblock
> the browser faster (progressive rendering)."

**Show it really streams** — stronger evidence than the strategy name alone:
```bash
curl -s -D- -o /dev/null http://localhost:8080/heavy | grep -iE 'transfer-encoding|x-streaming'
#   Transfer-Encoding: chunked
#   x-streaming: true
```
> ⚠️ Use a **GET** (`-D- -o /dev/null`), not `curl -I`. A HEAD request has no body, so the
> server omits `Transfer-Encoding` and you would only see `x-streaming: true`.

**The instructive counter-example** (say this before they ask):
```bash
curl -sI "http://localhost:8080/heavy?device=mobile" | grep -i x-rendering-strategy  # → SSR
curl -sI "http://localhost:8080/heavy?net=slow"      | grep -i x-rendering-strategy  # → SSR
```
> "Two different rules outrank streaming here, and both are protecting a weak client.
> That precedence is a design decision, not an accident."

---

### 4g. Edge Node Detection
> ⚠️ **Do not try to fake this with a header at `:8080`.** The proxy sets
> `proxy_set_header X-Served-By origin;` on `location /`, which overwrites whatever the
> client sends — so `-H "X-Served-By: edge-node-1"` against `:8080` returns **SSR**, not
> EDGE_ISR. Hit a *real* edge instead (that is the point of running three containers).

```bash
echo "=== Testing Edge Node ==="
echo "origin : $(strategy -H 'X-Cache-State: cold' http://localhost:8080/static)"
echo "edge-1 : $(strategy -H 'X-Cache-State: cold' http://localhost:8080/edge1/static)"
echo "edge-2 : $(strategy -H 'X-Cache-State: cold' http://localhost:8082/static)"
```
Expected output (verified):
```
origin   -> SSR
edge-1   -> EDGE_ISR
edge-2   -> EDGE_ISR
```
> "The *same request* to the *same path* returns a different strategy purely because it
> was served at an edge. The edge containers are real ARE processes with their own caches
> and injected latency — `SERVED_BY` is what makes the analyzer report `isEdge=true`."

**If asked why the origin can't be spoofed into an edge:** because that would be a lie the
architecture refuses to tell — the proxy stamps the truth about which node served you.

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

## 5b. The browser demo — pages that explain themselves ⭐

This is the strongest visual moment; budget 2 minutes for it.

Open **http://localhost:8080/static** and point at the **decision console**:
- The strategy badge, the **rule that fired**, and the full observed context are rendered
  **server-side** — view-source shows them with JavaScript disabled.
- A `hydrated ✓ interactive` pill appears once JS attaches — proof the page is live.
- The **rule table** shows all 9 rules with the winning one highlighted. It is evaluated in
  the browser using the engine's *own* `STRATEGY_RULES` import, so it can never disagree
  with the server.
- Change a dropdown → the prediction updates instantly **and** a background probe confirms
  it against the real server.
- Press **Apply & reload** → the page navigates with query params and genuinely
  re-renders under a different strategy.

> "The page is not describing the engine from a hard-coded list — it imports the very same
> rule table the server uses and evaluates it live. If I changed a rule, this display would
> change with it."

Then show the **artifact ageing** demo on the same page:
> "This SSG page was generated once at server start. The timestamp is frozen, but the
> counter beside it keeps climbing — that growing gap *is* staleness, and bounding it is
> exactly what ISR exists to do."

Finish on **/heavy**: the shell paints, then the 400-row table streams in; the table then
filters, sorts and pages entirely client-side.

---

## 6. Show correctness is tested (Terminal 2)
```bash
npm test
```
> "28 automated tests across four files. The decision engine is a **pure function**, so
> every one of the nine rules has its own unit test, and a second suite proves that
> header- and URL-driven overrides produce the expected strategy end-to-end — selection
> is provably deterministic, not hand-waved."

```
tests/decision-engine.test.ts   (10)   one assertion per rule row
tests/context-analyzer.test.ts  (14)   query aliases, precedence, 8 URL→strategy cases
tests/rendering.test.ts          (2)   SSR embeds data; CSR withholds it
tests/cache.test.ts              (2)   set/lookup + staleness classification
```

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
| Correct selection per context | 28 unit tests, all 9 rules + override precedence | `npm test` |
| Live switching on same URL | 9 URLs → 6 strategies | the URL loop in §2 |
| Decision is transparent | response header + server log agree | `curl -sI ...` + Terminal 1 |
| It adapts to conditions | network/device/load sweeps change strategy | the `for` loops in §4 |
| Streaming really streams | `Transfer-Encoding: chunked` + `x-streaming: true` | `curl -s -D- -o /dev/null /heavy` (GET, not `-I`) |
| Edge behaves differently from origin | same path, different strategy | §4g |
| Strategies have real trade-offs | per-strategy metrics | `npm run report` |
| Hydration is real, not asserted | `hydrated ✓` appears; 0 console errors | browser §5b |
| Runs as real containers | 5 containers; edges are full engines | `docker compose up -d --build` |

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
- **"Zero budget?"** Entirely open-source, runs locally on Linux/macOS + Docker; no cloud.
- **"Why does a stale cache still serve SSG?"** Because stale-while-revalidate is the
  intended behaviour: serve instantly, refresh in the background. Only a *cold* cache
  forces a render. That is rule 1's `cacheState !== 'cold'`, not an oversight.
- **"Why does mobile get SSR on the heavy page instead of streaming?"** Rule 5 is
  evaluated before rule 7 by design — a weak device should not be handed a large payload
  to hydrate. Precedence order encodes policy.
- **"Could a client lie about its context?"** Yes — the `X-*` headers and `?` aliases are
  deliberately client-controllable because they are the *experimental* control surface for
  reproducible testing. In production these would be derived from trusted signals
  (`Client-Hints`, `Save-Data`, real RTT, server load) rather than accepted from the client.
  The engine's structure is unchanged; only the analyzer's inputs would be hardened.
- **"What's actually novel?"** Not the renderers — React provides those. The contribution
  is the *runtime selector*: a pure, explainable, unit-tested decision function plus the
  plumbing that proves its choice on every response.

---

## Known limitations (state these before the examiner finds them)
1. **Edge is emulated**, not geographically distributed — separate containers with injected latency and independent caches.
2. **Network speed is simulated** by server-side delay, not real bandwidth shaping.
3. **EDGE_ISR cannot be demonstrated through the default proxy route** — the proxy stamps `X-Served-By: origin`; use `/edge1/…` or `:8081` (§4g).
4. **Rule-based, not learned.** `decide()` is the single seam where a trained model could replace the table — deliberately left as future work.
5. **`/dynamic` + `volatility=static` is cache-state dependent** and can answer SSG or SSR depending on whether an ISR entry is warm. Use `/static` for deterministic volatility demos.
6. **Caches do not survive `docker compose down`** — there are no volumes, so cold-vs-warm comparisons must be done within one session.
