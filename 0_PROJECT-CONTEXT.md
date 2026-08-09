# 0. PROJECT CONTEXT — Single Source of Truth

**Read this first.** This file is the durable, verified record of what the Adaptive
Rendering Engine *actually is and actually does*, written so that the final report and
the defense slides can be produced later without re-deriving anything.

Everything below was **verified against the running system** on 2026-08-09 (Docker stack
on `localhost:8080`), not copied from older design documents. Where an older document
disagrees with this file, **this file is correct** — the discrepancies are listed in §12.

---

## 1. Identity

| Field | Value |
| --- | --- |
| Title | **Adaptive Rendering Engine for Modern Web Applications** |
| Type | **Technology / runtime engine** — not an application |
| Core claim | Rendering strategy is chosen **per request at runtime** from live context, not fixed at build time by a developer |
| Stack | Node ≥ 20 · TypeScript · React 18 · native `http` · esbuild · Vitest · nginx · Docker Compose · optional Redis |
| Budget | Zero — entirely open-source, runs on a laptop, no cloud, no domain, no public IP |
| Repo | `git` — branch `main` |

**One-sentence thesis (use verbatim in the report/slides):**
> Existing frameworks require the rendering strategy to be selected at development time;
> the Adaptive Rendering Engine selects it per request at runtime from network speed,
> device class, cache state, server load and data volatility, and proves the choice via a
> response header and a server log line.

---

## 2. Architecture — the five-step pipeline

```
Request
  ↓
[1] ANALYZE   src/core/context-analyzer.ts   → RequestContext   (observation only)
  ↓
[2] DECIDE    src/core/decision-engine.ts    → DecisionTrace    (pure, no I/O)
  ↓
[3] RENDER    src/strategies/<name>/         → RenderResult     (pluggable)
  ↓
[4] RESPOND   src/core/engine.ts             → sets X-Rendering-Strategy + X-Decision-Reason
  ↓
[5] MEASURE   src/metrics/metrics-collector  → experiments/results/raw-data/metrics.ndjson
```

Orchestrated by `Engine.handle()` in [src/core/engine.ts](src/core/engine.ts).

**Design properties that matter academically:**
- **Separation of concerns.** Analysis never decides; decision never renders; rendering never re-decides.
- **Purity.** `decide(ctx)` is a pure function with no I/O — which is *why* every rule is unit-testable and the selection is provably deterministic.
- **Pluggability.** All six strategies implement one `RenderStrategy` interface and self-register in `strategy-registry.ts`. Adding a seventh strategy touches no existing strategy.
- **Transparency.** Every response carries the decision *and its reason*; every request logs it.
- **Graceful degradation.** If a strategy throws, the engine falls back to SSR and says so in the reason ([engine.ts](src/core/engine.ts)).

---

## 3. The decision rule table (authoritative)

Defined in [src/config/strategy-rules.ts](src/config/strategy-rules.ts). Evaluated **top to
bottom; first match wins**. The last rule is unconditional, so `decide()` never throws.

| # | Condition | Strategy | Rationale |
| --- | --- | --- | --- |
| 1 | `volatility='static'` AND `cacheState≠'cold'` | **SSG** | Static + usable cache → serve pre-built |
| 2 | `volatility='static'` AND `isEdge` | **EDGE_ISR** | Static at the edge → revalidate close to user |
| 3 | `load='high'` | **ISR** | Shed origin work: cached + background revalidate |
| 4 | `volatility='realtime'` AND `net='fast'` AND `device='desktop'` | **CSR** | Capable client → full interactivity |
| 5 | `volatility='realtime'` AND `device='mobile'` | **SSR** | Weak device → fresh HTML, minimal JS |
| 6 | `volatility='periodic'` | **ISR** | Cache + revalidate on TTL |
| 7 | `heavyPayload` AND `net≠'slow'` | **STREAMING_SSR** | Large payload, decent link → stream chunks |
| 8 | `net='slow'` | **SSR** | Avoid heavy hydration on slow links |
| 9 | *fallback* | **SSR** | Safe, correct default |

### Non-obvious precedence effects (examiners ask about these)
- **Rule 1 outranks rule 3.** `load=high` alone does *not* give ISR on `/static` — a usable cache still wins with SSG. You must also send `cache=cold`.
- **`stale` is a usable cache.** Only `cold` defeats rule 1. This is deliberate: stale-while-revalidate is a *feature*, not a miss.
- **Rule 5 outranks rule 7.** A mobile device on `/heavy` gets plain SSR, never Streaming SSR — weak clients should not be asked to hydrate a large payload.
- **Rule 2 is unreachable through the default proxy route.** See §7.

---

## 4. Control surfaces — how a request is steered

Two equivalent layers. **Precedence: header > query > inference.**

| Signal | Header | Query alias | Values |
| --- | --- | --- | --- |
| Network | `X-Network-Speed` | `?net=` | `slow` \| `medium` \| `fast` |
| Device | `X-Device-Type` | `?device=` | `mobile` \| `desktop` |
| Cache | `X-Cache-State` | `?cache=` | `fresh` \| `stale` \| `cold` |
| Load | `X-Load-Level` | `?load=` | `low` \| `medium` \| `high` |
| Volatility | `X-Data-Volatility` | `?volatility=` | `static` \| `periodic` \| `realtime` |
| Payload | `X-Data-Size` | `?size=` | `heavy` \| `light` |
| Edge id | `X-Served-By` | `?served=` | any value ≠ `origin` ⇒ `isEdge=true` |

Defined by `QUERY_ALIASES` in [src/core/context-analyzer.ts](src/core/context-analyzer.ts).

**Why the query layer exists:** a browser cannot attach custom headers to a normal
navigation. Without `?net=…`, the in-page controls could only *predict* a strategy; with
it, a reload genuinely re-renders under a different strategy. This is what makes the
interactive pages demonstrable in a browser rather than only via `curl`.

**Inference when nothing is supplied:** device from `User-Agent`; network defaults to
`medium`; load from a live in-process concurrency counter (thresholds: ≥25 → high, ≥8 →
medium); volatility from the page's own declaration; cache state probed from the cache
layer; `isEdge` from the container's `SERVED_BY` env var.

---

## 5. Verified trigger matrix

Every row below was executed against the running stack and produced exactly this result.
**These are the commands to use in the report and the live demo.**

| Command | Result |
| --- | --- |
| `curl -sI localhost:8080/static` | **SSG** |
| `curl -sI "localhost:8080/static?cache=cold"` | **SSR** (fallback) |
| `curl -sI "localhost:8080/static?cache=cold&net=slow"` | **SSR** (rule 8) |
| `curl -sI "localhost:8080/static?volatility=periodic"` | **ISR** |
| `curl -sI "localhost:8080/static?cache=cold&load=high"` | **ISR** |
| `curl -sI "localhost:8080/static?volatility=realtime&net=fast&device=desktop"` | **CSR** |
| `curl -sI localhost:8080/dynamic` | **SSR** (fallback — its natural default) |
| `curl -sI "localhost:8080/dynamic?net=fast&device=desktop"` | **CSR** |
| `curl -sI "localhost:8080/dynamic?device=mobile"` | **SSR** (rule 5) |
| `curl -sI "localhost:8080/dynamic?load=high"` | **ISR** |
| `curl -sI "localhost:8080/dynamic?volatility=periodic"` | **ISR** |
| `curl -sI localhost:8080/heavy` | **STREAMING_SSR** |
| `curl -sI "localhost:8080/heavy?net=slow"` | **SSR** (rule 8 beats rule 7) |
| `curl -sI "localhost:8080/heavy?device=mobile"` | **SSR** (rule 5 beats rule 7) |
| `curl -sI "localhost:8080/edge1/static?cache=cold"` | **EDGE_ISR** |
| `curl -sI "localhost:8081/static?cache=cold"` | **EDGE_ISR** (direct edge) |

Header form works identically and **overrides** the query form:
`curl -sI -H 'X-Device-Type: desktop' -H 'X-Network-Speed: fast' "localhost:8080/dynamic?device=mobile"` → **CSR**.

---

## 6. The six strategies

| Strategy | Module | React API | Cache behaviour | Marker header |
| --- | --- | --- | --- | --- |
| **SSG** | `strategies/ssg/ssg-renderer.ts` | `renderToString` at prebuild | Reads `public/ssg/<route>.html` from disk; builds on demand if absent | `x-ssg: prebuilt \| built-on-demand` |
| **SSR** | `strategies/ssr/ssr-handler.ts` | `renderToString` per request | None | `x-render-bytes` |
| **STREAMING_SSR** | `strategies/streaming-ssr/stream-renderer.ts` | `renderToPipeableStream` + `<Suspense>` | None; streams via `PassThrough` | `x-streaming: true` + `Transfer-Encoding: chunked` |
| **ISR** | `strategies/isr/isr-renderer.ts` | `renderToString`, cached with TTL | fresh → serve; stale → serve + revalidate in background; cold → render, cache, serve | `x-isr-cache: fresh \| stale-revalidating \| miss` |
| **CSR** | `strategies/csr/csr-handler.ts` | Empty shell; client renders | Withholds data (`__ARE_DATA__=null`); client fetches `/api/data` | `x-csr: shell` |
| **EDGE_ISR** | `strategies/edge-isr/edge-simulator.ts` | Extends ISR | Same stale-while-revalidate, but namespaced per edge via `edgeKey()`; shared through Redis | `x-isr-cache: …` |

**Cache layering** ([src/cache/cache-manager.ts](src/cache/cache-manager.ts)): reads check
memory → Redis → file, promoting hits upward; writes fan out to all three. Redis is
optional — the engine degrades to file+memory with a warning.

---

## 7. ⚠️ Known behaviours that look like bugs but are not

These cost hours to rediscover. **Record them in the report's limitations section.**

### 7.1 EDGE_ISR is unreachable through the default proxy route
[docker/nginx/proxy.conf](docker/nginx/proxy.conf) sets `proxy_set_header X-Served-By origin;`
on `location /`, which **overwrites any client-supplied `X-Served-By`** before it reaches
the origin. So no header or query value can make `localhost:8080/static` return EDGE_ISR.

This is *correct* — the origin genuinely is not an edge — but it means EDGE_ISR must be
demonstrated one of these ways:
- `http://localhost:8080/edge1/...` or `/edge2/...` (proxy does not override there), or
- `http://localhost:8081/...` / `:8082/...` (direct to an edge container).

**Consequence:** `scripts/switch-test.sh` row 6 ("static + edge + cold cache") prints
**SSR, not EDGE_ISR**, when `BASE_URL=http://localhost:8080`. The script is only fully
correct against a direct origin with no nginx in front (e.g. local `npm run dev` on
`:3000`). Verified 2026-08-09.

### 7.2 `/dynamic` + `volatility=static` is non-deterministic
The result depends on whether `/dynamic`'s ISR cache entry happens to be warm:

| State | Result |
| --- | --- |
| ISR cache warm (a previous ISR request ran within TTL) | **SSG** (rule 1: cache is usable) |
| Cold restart, first request | **SSR** (rule 1 fails on cold, falls to rule 9) |

Verified by restarting the stack. **For a demo, use `/static` for volatility
demonstrations** — its SSG artifact is prebuilt at startup, so it is always deterministic.

### 7.3 Disabling browser cache does not change the strategy
"SSG" here means *the server serves a pre-rendered file from disk*, not *the browser
cached it*. Responses on `/static` carry no `Cache-Control`/`ETag`, so the browser was
never caching them. `cacheState` comes from the server-side cache probe, never from the
browser. Toggling DevTools "Disable cache" therefore has no effect on strategy selection.

### 7.4 SSG replays a frozen artifact
Because SSG returns a byte-identical prebuilt file, the reason and context embedded in
that HTML are the ones captured **at prebuild time**, not for the live request. The live
decision is always in the `X-Decision-Reason` response header. The prebuild deliberately
stamps `cacheState: 'fresh'` so the embedded context matches the condition under which
rule 1 actually serves it.

---

## 8. Docker topology (verified against `docker-compose.yml`)

```
browser / curl ──▶ proxy (nginx, :8080) ──┬──▶ origin       (ARE, SERVED_BY=origin,     +0ms)
                                          ├──▶ edge-node-1  (ARE, SERVED_BY=edge-node-1,+20ms)  :8081
                                          └──▶ edge-node-2  (ARE, SERVED_BY=edge-node-2,+80ms)  :8082
                                                    │
                                                    └──▶ redis (shared cache, internal only)
```

| Service | Image | Published port | Env |
| --- | --- | --- | --- |
| `proxy` | built from `docker/nginx/Dockerfile` | **8080** → 80 | — |
| `origin` | built from `docker/Dockerfile` → `are:latest` | none (internal) | `SERVED_BY=origin`, `EDGE_LATENCY_MS=0`, `CACHE_TTL_MS=30000` |
| `edge-node-1` | reuses `are:latest` | **8081** → 3000 | `SERVED_BY=edge-node-1`, `EDGE_LATENCY_MS=20`, `CACHE_TTL_MS=15000` |
| `edge-node-2` | reuses `are:latest` | **8082** → 3000 | `SERVED_BY=edge-node-2`, `EDGE_LATENCY_MS=80`, `CACHE_TTL_MS=15000` |
| `redis` | `redis:7-alpine` | none (internal) | in-memory only (`--save "" --appendonly no`) |

**Critical facts, often misdescribed in older docs:**
- Edge nodes are **full ARE Node instances**, *not* nginx proxies. They run the same image
  and self-identify via `SERVED_BY`. There is **no `docker/nginx/edge.conf`** — it does not exist.
- **There are no volume mounts.** Removed in commit `c678660`. Therefore **code changes
  require an image rebuild**: `docker compose up -d --build`. Caches, SSG output and
  metrics live inside the containers and are lost on `down`.
- Only `origin` and `proxy` have `build:` sections; the edges reuse `are:latest`, so
  rebuilding origin is what updates them.

Proxy routing ([docker/nginx/proxy.conf](docker/nginx/proxy.conf)): `/` → origin (forcing
`X-Served-By: origin`), `/edge1/` → edge-node-1, `/edge2/` → edge-node-2.

---

## 9. Test inventory — 28 tests, 4 files

| File | Tests | Proves |
| --- | --- | --- |
| `tests/decision-engine.test.ts` | 10 | One assertion per rule row + reason/context always present |
| `tests/context-analyzer.test.ts` | 14 | Query aliases, header-beats-query precedence, invalid-value rejection, UA inference, and 8 URL-only end-to-end triggers |
| `tests/rendering.test.ts` | 2 | SSR embeds data for hydration; CSR withholds it and ships an empty root |
| `tests/cache.test.ts` | 2 | Cache set/lookup and staleness classification |

Run: `npm test`. All 28 pass as of 2026-08-09.

---

## 10. The three demonstration pages

All three are interactive React pages that explain their own rendering. Shared component:
[src/frontend/components/strategy-console.tsx](src/frontend/components/strategy-console.tsx).

| Route | Volatility | Heavy | Default strategy | What it demonstrates |
| --- | --- | --- | --- | --- |
| `/static` | static | no | SSG | **Artifact ageing**: the frozen `generatedAt` vs a live clock — the visible staleness ISR exists to bound. Plus a cache lab (fresh/stale/cold). |
| `/dynamic` | realtime | no | SSR | **CSR vs SSR**: shows whether data arrived embedded or was client-fetched (`__ARE_DATA__ == null`). Live polling feed + sparkline. |
| `/heavy` | realtime | yes | STREAMING_SSR | **Streaming**: shell flushed first, `<Suspense>` section streamed after. Client-side filter/sort/paging over 400 rows + real TTFB/DOM/load timings. |

### The strategy console (on every page)
- Renders the strategy, the rule that fired, and the observed context **server-side** — visible in view-source with JavaScript disabled.
- Shows a `hydrated ✓` marker that is `false` on the server and flips after mount — the proof interactivity is real.
- **Imports the engine's own `STRATEGY_RULES`** and evaluates the full table client-side, highlighting the winning rule. It therefore can never drift from server behaviour.
- Probes the live server via `fetch` and cross-checks its local prediction against the real `X-Rendering-Strategy` header.
- **Apply & reload** navigates with query params, so the real page re-renders under a new strategy.

**Hydration discipline** (why the pages don't warn in console): first render depends only
on props. No `Date.now()`, `Math.random()`, `navigator`, `window` or `performance` during
render — all live values start from props and update inside `useEffect`. Timestamps render
as stable UTC and localise after mount (the server container is UTC; browsers are not).
Verified: **zero hydration warnings** in headless Chrome across all pages and strategies.

---

## 11. Evidence chain for the report

| Claim | Evidence | Command |
| --- | --- | --- |
| Selection is correct & deterministic | 28 unit tests, one per rule | `npm test` |
| Same URL → different strategy | Trigger matrix §5 | `curl -sI` rows, or `scripts/switch-test.sh` |
| Decision is transparent | Response header + server log agree | `curl -sI …` + `docker compose logs origin \| grep '\[ARE\]'` |
| Adapts to conditions | Network/device/load sweeps | loops in `10_DEMO-AND-VIVA-GUIDE.md` §4 |
| Strategies have real trade-offs | Per-strategy TTFB/bytes/cache-hit | `npm run report` → `experiments/results/report.csv` |
| Streaming genuinely streams | `Transfer-Encoding: chunked` + `x-streaming: true` | `curl -s -D- -o /dev/null localhost:8080/heavy` (**GET, not `-I`** — a HEAD has no body, so `Transfer-Encoding` is omitted) |
| Runs as real containers | 5 containers, edge vs origin differ | `docker compose up -d --build` |
| Hydration is real, not claimed | `hydrated ✓` appears post-JS; zero console errors | headless Chrome `--dump-dom` |

Log format: `[ARE] Request: …` / `[ARE] Context: net=… device=… cache=… load=… volatility=… heavy=… edge=…` / `[ARE] Strategy selected: X — reason`.

Metrics record (NDJSON, one line per request): `ts, url, strategy, reason, ttfbMs,
renderMs, totalMs, fromCache, bytes, network, device, load, isEdge, resources{}`.

---

## 12. Where the older documents are wrong

Corrected in this pass, but noted here because earlier drafts circulated:

| Document | Was wrong | Truth |
| --- | --- | --- |
| `6_technology-and-docker-guide.md` | Edges are nginx containers with `edge.conf` forwarding to origin | Edges are full ARE Node containers; `edge.conf` does not exist |
| `6_…` | Volumes mount `./public`, `./experiments/results`, `./src` | No volumes at all since `c678660` |
| `6_…` | "Only the proxy publishes a host port" | Edges publish 8081 and 8082 too |
| `10_DEMO-AND-VIVA-GUIDE.md` §4d | cache cold→EDGE_ISR, stale→ISR, fresh→CSR on `/dynamic` | All three → **CSR** (rule 4 fires before cache matters) |
| `10_…` §4f | `/heavy` + mobile → STREAMING_SSR | → **SSR** (rule 5 outranks rule 7) |
| `10_…` §4g | `X-Served-By` header at `:8080` → EDGE_ISR | → **SSR** (nginx overwrites it); use `/edge1/` or `:8081` |
| `7_code-generation-prompt.md` §7.3 | Interfaces lack `heavyPayload`, `RenderMeta`, `PageProps` | Updated to the real `types.ts` |
| Several | "14 tests" | **28 tests** |

---

## 13. History — nothing is lost

Documentation removed in commit `9f4674d` ("remove obsolete mid-term presentation and
report files") is **still in git history** and recoverable:

```bash
git show 9f4674d --stat                       # what was removed
git show c678660:docs/architecture.md         # read any deleted file
git checkout c678660 -- docs/ report/         # restore a whole directory
```

Removed then: `ARE_MidTerm_Presentation.pptx`, `ARE_MidTerm_Report.docx/.pdf`,
`LOGBOOK.md`, `LOGBOOK-SUMMARY.md`, `docs/` (6 files: problem-statement, architecture,
rendering-strategies, decision-algorithm, evaluation-metrics, future-work),
`experiments/*.md` (3 comparison write-ups), `report/` (7 chapter stubs: abstract,
introduction, methodology, implementation, results, conclusion, references).

`report-build/` (`build_report.py`, `build_pptx.py`, `driver.py`, `extract_toc.py`,
`toc_map.json`, `headings.json`, `figs/`) still exists but its inputs (`report/*.md`) were
deleted, so it will not run as-is. It is retained as tooling for the future report task.

---

## 14. Commit history

| Commit | Meaning |
| --- | --- |
| `4075b99` | first commit — full engine, docs, midterm deliverables |
| `c678660` | Docker refactor: removed volume mounts; proxy builds from its own Dockerfile |
| `df2c870` | **Interactive pages**: reason threading, query overrides, strategy console, stylesheet, 14 new tests |
| `9f4674d` | Removed midterm deliverables + `docs/`, `report/`, logbooks |

---

## 15. Environment notes

- **Development machine is macOS (arm64)**; the docs were originally written for Fedora Linux. Docker Compose behaves identically; only the install commands differ.
- **Shell portability.** The default shell here is **zsh**, which — unlike bash — does *not*
  word-split unquoted variables. Snippets using `set -- $var` to split a string silently
  break in zsh (`$1` gets the whole string, `$2` is empty). Demo snippets have been
  rewritten to avoid word-splitting; prefer a `strategy() { … }` helper plus explicit
  arguments, which behaves identically in both shells.
- **`curl -I` vs GET.** `-I` sends HEAD. `X-Rendering-Strategy` and `X-Decision-Reason`
  appear on both, but `Transfer-Encoding: chunked` only appears on a **GET** (a HEAD has no
  body). Use `curl -s -D- -o /dev/null <url>` whenever streaming is the thing being proven.
- **Known local hazard:** `node_modules` was at one point installed for `linux-x64`, which breaks `npm test` and `npm run build:client` on macOS with *"You installed esbuild for another platform"* / *"Cannot find module @rollup/rollup-darwin-arm64"*. Fix: `npm install` (or `npm install --no-save --no-package-lock @esbuild/darwin-arm64@<v> @rollup/rollup-darwin-arm64@<v>`). Docker is unaffected — it runs `npm ci` inside the image.
- Node 24/25 works despite `engines: >=20`.

---

## 16. Reading order

**To understand the project:** this file → `1_project-details.md` (problem framing) →
`2_ARE-folder-structure.md` (layout) → `6_technology-and-docker-guide.md` (stack + Docker).

**To run it:** `9_ZERO-TO-RUNNING.md` → `8_RUNBOOK.md`.

**To demo it:** `10_DEMO-AND-VIVA-GUIDE.md`.

**To extend it:** `7_code-generation-prompt.md` (contracts) + §3 and §7 of this file.

---

## 17. Status and next steps

**Done and verified:** all six strategies select correctly and render correctly; query-param
re-triggering; interactive self-explaining pages with zero hydration errors; 28 passing
tests; 5-container Docker stack; metrics pipeline.

**Not yet done (future tasks, deliberately not started):**
1. **Final college report** — awaiting the required format/template.
2. **Defense slides** — awaiting the required format.

Both should be built from this file plus §5 (verified commands), §9 (test evidence),
§11 (evidence chain) and §7 (limitations). Do not re-derive results from older documents
without re-verifying them against the running system.
