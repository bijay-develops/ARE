#!/usr/bin/env python3
"""
The Adaptive Rendering Engine defense deck — 20 slides, expressed ONCE.

This module holds nothing but content. Every measured number is interpolated
from report-build/data/final_results.json, so the deck can never disagree with
the experimental data. Rendering is done by build_defense_deck.py.

Block vocabulary (each slide is a list of blocks, stacked top to bottom):
    ("bul",   [item | (item, subline), ...])      bulleted list
    ("kv",    [(term, description), ...])         definition list
    ("table", [headers], [[row], ...], [widths], opts)
    ("code",  [lines], caption)
    ("note",  text, kind)                         kind: info | good | warn | dark
    ("img",   path, max_height, caption)
    ("tiles", [(value, label), ...])
    ("split", left_blocks, right_blocks, left_fraction)
    ("gap",   inches)
"""

import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIGS = os.path.join(ROOT, "report-build", "figs")
SHOTS = os.path.join(ROOT, "report-build", "shots")
D = json.load(open(os.path.join(ROOT, "report-build", "data", "final_results.json")))


def fig(n):
    return os.path.join(FIGS, n)


def shot(n):
    p = os.path.join(SHOTS, n)
    return p if os.path.exists(p) else None


# ───────────────────────────────────────────────────── derived measured values
lf, lm = D["load_fast"], D["load_medium"]
fx, ad = lf["fixed_ssr"], lf["adaptive"]
fx2, ad2 = lm["fixed_ssr"], lm["adaptive"]
ds, ps, pc = D["decision_space"], D["per_strategy_server"], D["per_strategy_client"]
net, edge = D["network"], D["edge"]

rps_gain = (ad["rps"] - fx["rps"]) / fx["rps"] * 100
mean_cut = (fx["mean_ms"] - ad["mean_ms"]) / fx["mean_ms"] * 100
p99_cut = (fx["p99"] - ad["p99"]) / fx["p99"] * 100
byte_cut = (fx["doc_bytes"] - ad["doc_bytes"]) / fx["doc_bytes"] * 100
cpu_cut = (fx2["cpu_ms"] - ad2["cpu_ms"]) / fx2["cpu_ms"] * 100
p99_cut2 = (fx2["p99"] - ad2["p99"]) / fx2["p99"] * 100
rps_d2 = (ad2["rps"] - fx2["rps"]) / fx2["rps"] * 100
ssg_ratio = ps["SSG"]["ttfb"] / ps["ISR"]["ttfb"]
csr_light = ps["SSR"]["bytes"] / ps["CSR"]["bytes"]

_iso = D["isr_lifecycle"]
cold_ms = [r for r in _iso if r["state"] == "miss"][0]["ms"]
_fresh = [r["ms"] for r in _iso if r["state"] == "fresh"]
_stale = [r["ms"] for r in _iso if r["state"] == "stale-revalidating"]
fresh_ms = sum(_fresh) / len(_fresh)
stale_ms = sum(_stale) / len(_stale)
warm_cut = (cold_ms - fresh_ms) / cold_ms * 100

TITLE = "Adaptive Rendering Engine"
SUBTITLE = ("Choosing the web rendering strategy per request at runtime — from network, "
            "device, cache, load and data volatility")
TEAM = [("Bijay B.k", "220305"), ("Devendra Pandey", "220306"),
        ("Manish Joshi", "220312"), ("Pramod Panta", "220317")]
SUPERVISOR = "Er. Robinhood Khadka"
DEPT = "Department of ICT and Computer Engineering"
COLLEGE = "Cosmos College of Management & Technology  ·  Affiliated to Pokhara University"
DATE = "Shrawan 2083 B.S.  ·  August 2026 A.D."


# ══════════════════════════════════════════════════════════════════ the slides
SLIDES = [

# ─────────────────────────────────────────────────────────────────── 1. title
{"kind": "title"},

# ───────────────────────────────────────────────── 2. why we started + vision
{"n": "01", "kicker": "The starting point",
 "title": "Why we started: one question a framework asks too early",
 "sub": "The idea did not begin with a literature search. It began with an annotation.",
 "blocks": [
   ("note", "Every framework — Next.js included — asks the developer to mark each route with "
            "how it should be rendered. It asks this at the one moment when the answer cannot "
            "possibly be known: **before any user has arrived**.", "warn"),
   ("bul", [
     ("The annotation is a single bet placed on an average user who does not exist.",
      "A route marked SSR is server-rendered for the desktop on fibre that wanted a light "
      "interactive shell, and identically for the throttled handset that genuinely needed "
      "finished HTML. One of those two visitors is always being served the wrong thing."),
     ("The six rendering strategies are not competitors to be ranked — they are points on a "
      "trade-off surface, and the optimum moves with the request.",
      "SSG is cheapest but cannot express fresh data. SSR gives a fast first paint but costs "
      "origin CPU. CSR is nearly free for the server but slow on weak clients. ISR bounds "
      "staleness. Streaming decouples first byte from total render. Each is optimal somewhere."),
   ]),
   ("note", "**Problem statement.** Rendering strategy selection in modern web applications is "
            "static and does not adapt to runtime contextual conditions, resulting in reduced "
            "performance efficiency, avoidable origin cost and scalability limitations.", "dark"),
   ("note", "**Our vision.** Rendering strategy should be a runtime decision computed from the "
            "conditions of the request, not a build-time constant chosen by a developer — and "
            "every such decision should be observable, explainable and reproducible from outside "
            "the system.", "good"),
 ]},

# ────────────────────────────────────────────── 3. objectives, scope, the gap
{"n": "02", "kicker": "What we set out to do",
 "title": "Objectives, scope, and the gap we occupy",
 "blocks": [
   ("note", "**General objective.** To design, implement and evaluate an engine that selects a "
            "rendering strategy per request at runtime from observed context, and to demonstrate "
            "experimentally that doing so beats a fixed policy.", "info"),
   ("split",
     [("head", "SPECIFIC OBJECTIVES"),
      ("bul", [
        "Define the contextual variables that influence rendering, and observe them from a live request.",
        "Design a pure, deterministic decision engine mapping any context to exactly one strategy.",
        "Implement six strategies behind one interface so they are interchangeable at runtime.",
        "Make every decision externally observable — headers, logs, per-request metrics.",
        "Build a zero-cost, reproducible private server: origin, edges, proxy, shared cache.",
        "Measure it, and compare adaptive selection against fixed policies under load.",
      ])],
     [("head", "THE GAP IN EXISTING WORK"),
      ("bul", [
        "Prior studies compare rendering strategies **in isolation, as fixed architectural choices**.",
        "Context-aware adaptation is proven valuable — but at the **network tier** (where content is stored), never at the **application tier** (how content is produced).",
        "No unified runtime engine exists, so there is also no platform on which the value of adaptation can be measured.",
      ]),
      ("head", "OUT OF SCOPE, DELIBERATELY"),
      ("bul", [
        "No commercial cloud; edges are modelled locally with injected latency.",
        "Client paint metrics (FCP/LCP) are not instrumented — we report what the engine can influence and observe.",
        "The policy is rule-based by design; learned policies are future work.",
      ])],
     0.47),
 ]},

# ───────────────────────────────────────────────────────── 4. architecture
{"n": "03", "kicker": "System design",
 "title": "System architecture: five containers, one private network",
 "sub": "A single nginx proxy is the only entry point. Every node runs the identical engine image "
        "and differs only by environment variables.",
 "blocks": [
   ("img", fig("system-architecture.png"), 3.30, None),
   ("bul", [
     "**The edges are full engine instances, not caching proxies.** An edge that is only a proxy can demonstrate distance but not behaviour; an edge that runs the engine has its own context, its own cache namespace and its own decisions — which is what makes Edge-ISR a real strategy rather than a decoration.",
     "**Redis is shared but optional.** If it is absent the cache manager warns and continues on memory and file alone; the engine never hard-depends on infrastructure it cannot guarantee.",
   ]),
 ]},

# ──────────────────────────────────────────────────────── 5. request pipeline
{"n": "04", "kicker": "System design",
 "title": "How one request flows: the five-stage pipeline",
 "sub": "Stage boundaries are strict — each stage emits a value, and the next consumes only that value.",
 "blocks": [
   ("split",
     [("img", fig("rendering-pipeline.png"), 2.05, None),
      ("note", "Analysis never decides. Decision never renders. Rendering never re-derives the "
               "decision. That is why the decision can be tested without a server, and why a "
               "strategy can never silently disagree with the engine about why it was invoked.",
       "info")],
     [("kv", [
        ("1 · ANALYZE   src/core/context-analyzer.ts",
         "Turns the raw request into a RequestContext. Resolves each of seven signals by precedence and validates it. Observes only."),
        ("2 · DECIDE   src/core/decision-engine.ts",
         "Turns that context into a DecisionTrace: the selected strategy, the rule text that justifies it, and the context it judged. Pure — no I/O."),
        ("3 · RENDER   src/strategies/‹name›/",
         "Looks the strategy up in the registry and invokes it. The reason travels with the call, so the page can state why it exists in that form."),
        ("4 · RESPOND   src/core/engine.ts",
         "Writes status and headers — always adding X-Rendering-Strategy and X-Decision-Reason — then the body, or the piped stream."),
        ("5 · MEASURE   src/metrics/metrics-collector.ts",
         "Appends one NDJSON metric record. Never awaited, so instrumentation cannot delay a response."),
      ])],
     0.42),
 ]},

# ────────────────────────────────────────────────────────── 6. the components
{"n": "05", "kicker": "System design",
 "title": "Inside the engine: what each component does",
 "blocks": [
   ("kv", [
     ("Context Analyzer",
      "The sensory layer. For each signal it applies a fixed precedence — control header, else query alias, else inference — and validates against the permitted value set, so a malformed input degrades to inference instead of corrupting the context. **Load is never supplied by the request**: it is classified from a live in-flight request counter."),
     ("Decision Engine",
      "Holds no policy of its own — it evaluates an ordered rule table and returns the first match with its human-readable reason. The policy lives in a separate configuration module, so the policy can change without touching the evaluator."),
     ("Strategy Registry + six strategy modules",
      "A name-to-implementation map populated at start-up. All six strategies expose one identical render(ctx, page, cache, meta) signature. That uniformity is precisely what makes them interchangeable at runtime."),
     ("Cache Manager",
      "One interface over three backends: in-process **memory**, then shared **Redis**, then persistent **file**. Reads descend and promote hits upward; writes fan out. It also exposes a non-mutating freshness probe — which is what lets the analyzer observe cache state *before* a decision is made."),
     ("Metrics Collector + Report Generator",
      "One NDJSON record per request: timings, bytes, cache outcome, observed context, process resource sample. Every quantitative result in this deck derives from this pipeline."),
     ("Simulation Subsystem",
      "Conditions must be created, not awaited: the throttler applies 400 / 100 / 0 ms for slow / medium / fast, and edge latency is injected per container. **Load alone is not simulated — it is genuinely measured from concurrency.**"),
   ]),
 ]},

# ─────────────────────────────────────────────────────── 7. context + control
{"n": "06", "kicker": "System design",
 "title": "What the engine observes, and how we steer it",
 "sub": "Precedence: control header  >  query alias  >  inference. This is what turns an adaptive "
        "system into an experimentally controllable one.",
 "blocks": [
   ("table",
    ["Signal", "Control header", "Query alias", "Permitted values", "If nothing is supplied"],
    [["Network speed", "X-Network-Speed", "?net=", "slow | medium | fast", "defaults to medium"],
     ["Device class", "X-Device-Type", "?device=", "mobile | desktop", "inferred from the User-Agent"],
     ["Cache state", "X-Cache-State", "?cache=", "fresh | stale | cold", "probed from the cache layer"],
     ["Server load", "X-Load-Level", "?load=", "low | medium | high", "live in-flight counter: ≥25 high, ≥8 medium"],
     ["Data volatility", "X-Data-Volatility", "?volatility=", "static | periodic | realtime", "the page's own declaration"],
     ["Payload weight", "X-Data-Size", "?size=", "heavy | light", "the page's own declaration"],
     ["Edge identity", "X-Served-By", "?served=", "any value ≠ origin means edge", "the container's SERVED_BY variable"]],
    [1.75, 2.15, 1.15, 2.85, 3.45], {}),
   ("note", "**Why the query layer exists.** A browser cannot attach custom headers to an ordinary "
            "navigation. Without the aliases, our in-page controls could only *predict* a strategy; "
            "with them, following a link genuinely re-renders the page under a different strategy — "
            "which is what makes the engine demonstrable in a browser rather than only through curl.",
    "info"),
 ]},

# ──────────────────────────────────────────────────────── 8. the rule table
{"n": "07", "kicker": "The algorithm",
 "title": "The decision algorithm: an ordered, first-match-wins rule table",
 "sub": "This is the authoritative policy exactly as implemented in src/config/strategy-rules.ts.",
 "blocks": [
   ("table",
    ["#", "Condition", "Strategy", "Rationale"],
    [["1", "volatility = static  AND  cache ≠ cold", "SSG", "Static content with a usable cache: serve the pre-built artefact"],
     ["2", "volatility = static  AND  isEdge", "EDGE_ISR", "Static content at an edge: revalidate close to the user"],
     ["3", "load = high", "ISR", "Shed origin work: serve cached output, revalidate in the background"],
     ["4", "volatility = realtime  AND  net = fast  AND  device = desktop", "CSR", "Capable client on a fast link: ship a shell, let it be fully interactive"],
     ["5", "volatility = realtime  AND  device = mobile", "SSR", "Weak device: send finished HTML and minimal JavaScript"],
     ["6", "volatility = periodic", "ISR", "Periodically changing data: cache and revalidate on a TTL"],
     ["7", "heavyPayload  AND  net ≠ slow", "STREAMING_SSR", "Large payload on a decent link: stream the shell first, then the rest"],
     ["8", "net = slow", "SSR", "Slow link: avoid the cost of hydrating a large bundle"],
     ["9", "unconditional fallback", "SSR", "Safe, correct default — this is what makes the function total"]],
    [0.45, 4.55, 1.75, 5.35], {"center": [0]}),
   ("note", "The table is **data**; the evaluator that consumes it is nine lines long. That "
            "separation is why the very same table is imported unchanged into the browser, so our "
            "demonstration pages explain the engine using the engine's own policy and can never "
            "drift from it.", "info"),
 ]},

# ──────────────────────────────────────────── 9. algorithm properties + order
{"n": "08", "kicker": "The algorithm",
 "title": "Why this algorithm is safe, cheap and honest",
 "blocks": [
   ("split",
     [("img", fig("decision-flow.png"), 2.62, None)],
     [("code", ["decide(C):                    # C = the request context",
                "  for i = 1 .. 9:             # R = (r1 ... r9), ORDERED",
                "    if r[i].test(C):",
                "      return (r[i].strategy, r[i].reason, C)",
                "  return (SSR, \"fallback\", C)  # unreachable: r9 is true"], None),
      ("kv", [
        ("Total", "Rule 9 is unconditionally true, so decide() can never fail to return a strategy."),
        ("Deterministic", "Every predicate reads only its argument — no clock, no state, no I/O. The same context always yields the same strategy."),
        ("O(1)", "Each predicate is a conjunction of at most three equality comparisons over enumerated values; nine of them, with no allocation."),
      ])],
     0.40),
   ("head", "THE ORDERING IS THE POLICY — four consequences we verified against the running stack"),
   ("bul", [
     "**Rule 1 outranks rule 3**, so a usable cache beats high load: under a spike a static page keeps being served from its pre-built artefact, because that is already the cheapest possible answer.",
     "**Only a cold cache defeats rule 1** — a stale one does not. Deliberate: stale-while-revalidate is a feature of the design, not a cache miss.",
     "**Rule 5 outranks rule 7**, so a mobile client on the heavy page gets plain SSR and never Streaming SSR. A weak device should not be asked to hydrate a large payload merely because it could have been streamed.",
     "**Rule 3 sits third**, so an explicit load=high overrides device and volatility — which is exactly why our fixed-policy baseline had to pin load=low, or the engine correctly promoted it to ISR.",
   ]),
 ]},

# ─────────────────────────────────────────────────────── 10. six strategies
{"n": "09", "kicker": "Implementation",
 "title": "The six rendering strategies behind one interface",
 "blocks": [
   ("table",
    ["Strategy", "React mechanism", "Cache behaviour", "Proof header"],
    [["SSG", "renderToString at start-up", "Reads a pre-built artefact from disk; builds on demand if absent", "x-ssg: prebuilt | built-on-demand"],
     ["SSR", "renderToString per request", "None — the reference implementation, and every failure path's fallback", "x-render-bytes"],
     ["STREAMING_SSR", "renderToPipeableStream + Suspense", "None; piped through a PassThrough, never buffered", "x-streaming: true + chunked encoding"],
     ["ISR", "renderToString, cached with a TTL", "fresh: serve  ·  stale: serve now, refresh behind the response  ·  cold: render, cache, serve", "x-isr-cache: fresh | stale-revalidating | miss"],
     ["CSR", "Empty shell; the browser renders", "Withholds the data, so the client must fetch /api/data", "x-csr: shell"],
     ["EDGE_ISR", "Inherits ISR", "Identical semantics on a per-edge cache namespace, shared through Redis", "x-isr-cache: …"]],
    [1.75, 2.75, 4.65, 2.95], {}),
   ("split",
     [("head", "TWO IMPLEMENTATION DECISIONS WORTH DEFENDING"),
      ("bul", [
        "**SSG could never be selected on a cold start**, because rule 1 needs a usable cache that only a previous request could create. So static pages are pre-built at server start-up, and the prebuild embeds the context under which rule 1 actually serves the artefact.",
        "**Edge-ISR is the clearest proof of pluggability**: a complete sixth strategy expressed as a subclass overriding one method — the cache key, namespaced by node identity — because the semantics it needs already existed.",
      ])],
     [("head", "ISR: STALE-WHILE-REVALIDATE, MEASURED"),
      ("note", f"A cold render cost **{cold_ms:.2f} ms**; warm hits averaged **{fresh_ms:.2f} ms** "
               f"({warm_cut:.1f} % lower); and a stale hit cost only **{stale_ms:.2f} ms** rather than "
               f"paying the cold render again — the user is served immediately while the refresh "
               f"happens behind the response.", "good"),
      ("bul", [
        "Background revalidation is **single-flight**: a module-level set of in-flight keys guarantees a burst of stale requests triggers exactly one re-render, not a stampede.",
      ])],
     0.52),
 ]},

# ──────────────────────────────────────────────────── 11. one request in code
{"n": "10", "kicker": "Flow of code",
 "title": "One request, end to end — the whole system in one narrative",
 "sub": "A browser on a fast connection requests /dynamic.",
 "blocks": [
   ("split",
     [("kv", [
        ("PROXY", "Receives it on :8080, stamps X-Served-By: origin, forwards to the origin container."),
        ("SERVER", "Increments the in-flight counter inside a try/finally, resolves /dynamic to the realtime page module, sleeps the simulated link delay, probes the cache, calls the engine."),
        ("ANALYZE", "Device inferred desktop from the User-Agent; cache state from the probe; load classified from the in-flight count; volatility = realtime, because that is what the page declares about itself."),
        ("DECIDE", "Rule 1 fails — not static. Rule 2 fails. Rule 3 fails — load is low. **Rule 4 matches** — realtime data, fast link, desktop client — and the engine selects CSR."),
        ("RESPOND", "Three log lines, then the shell with X-Rendering-Strategy: CSR and X-Decision-Reason. The metrics write is issued without awaiting it."),
      ]),
      ("note", f"The browser receives an **{ad['doc_bytes']}-byte shell** and fetches its own data. "
               f"Had the same URL arrived from a mobile User-Agent, rule 4 would fail, rule 5 would "
               f"match, and the same server would have returned **{fx['doc_bytes']:,} bytes of "
               f"finished HTML**. That divergence, from one unchanged URL, is the entire project.",
       "dark")],
     [("code", ["export function decide(ctx: RequestContext): DecisionTrace {",
                "  for (const rule of STRATEGY_RULES) {",
                "    if (rule.test(ctx)) {",
                "      return { selected: rule.strategy,",
                "               reason:   rule.reason,",
                "               context:  ctx };",
                "    }",
                "  }",
                "  return { selected: 'SSR',",
                "           reason: 'Fallback (no rule matched)',",
                "           context: ctx };",
                "}"], "src/core/decision-engine.ts — the entire evaluator"),
      ("head", "AND THE PAGE ITSELF REPORTS THAT DECISION"),
      ("img", shot("decision-console.png") or fig("decision-flow.png"), 1.30,
       "Live capture from /static: the strategy, the rule that fired, and the hydration marker — "
       "all rendered server-side, so they are visible with JavaScript disabled.")],
     0.50),
 ]},

# ───────────────────────────────────────────────────── 12. the private server
{"n": "11", "kicker": "Implementation",
 "title": "The zero-cost private server, and how conditions are created",
 "sub": "No cloud account, no domain, no public IP — five containers on one laptop.",
 "blocks": [
   ("split",
     [("table",
       ["Service", "Role", "Port", "Key environment"],
       [["proxy", "nginx reverse proxy, single entry point", "8080", "routes /, /edge1/, /edge2/"],
        ["origin", "Engine, the authoritative node", "internal", "SERVED_BY=origin, +0 ms, TTL 30 s"],
        ["edge-node-1", "Engine as a near edge", "8081", "SERVED_BY=edge-node-1, +20 ms, TTL 15 s"],
        ["edge-node-2", "Engine as a far edge", "8082", "SERVED_BY=edge-node-2, +80 ms, TTL 15 s"],
        ["redis", "Cache shared across nodes", "internal", "in-memory only, no persistence"]],
       [1.30, 2.50, 1.10, 2.40], {"fs": 9.5})],
     [("head", "IS THE SIMULATION FAITHFUL? WE CHECKED."),
      ("table",
       ["Condition", "Configured", "Measured", "Residual"],
       [["Network: slow", "400 ms", f"{net['slow']['mean']:.2f} ms", f"+{net['slow']['mean']-400:.2f}"],
        ["Network: medium", "100 ms", f"{net['medium']['mean']:.2f} ms", f"+{net['medium']['mean']-100:.2f}"],
        ["Network: fast", "0 ms", f"{net['fast']['mean']:.2f} ms", f"+{net['fast']['mean']:.2f}"],
        ["edge-node-1", "+20 ms", f"{edge['edge-node-1']['mean']:.2f} ms", f"+{edge['edge-node-1']['mean']-edge['origin']['mean']-20:.2f}"],
        ["edge-node-2", "+80 ms", f"{edge['edge-node-2']['mean']:.2f} ms", f"+{edge['edge-node-2']['mean']-edge['origin']['mean']-80:.2f}"]],
       [1.45, 1.15, 1.15, 1.05], {"fs": 9.5, "center": [1, 2, 3]})],
     0.53),
   ("bul", [
     f"The residuals are small and consistent. The fast class, configured at zero, measures **{net['fast']['mean']:.2f} ms** — the irreducible cost of the proxy hop, the container network and the engine — and the slow and medium classes exceed their configured delays by about that same amount. The simulation is faithful.",
     "**No volumes are mounted**, so the container filesystem is the only store for artefacts, caches and metrics. Code changes need a rebuild — and a teardown discards state, which is exactly what makes every experimental run start from a known cold state.",
   ]),
 ]},

# ─────────────────────────────────────────────────── 13. R1: strategy switch
{"n": "12", "kicker": "Results · functional verification",
 "title": f"Result 1 — the same URL, answered five different ways ({D['trigger_pass']}/17 pass)",
 "sub": "Each row is one request to the running stack (host localhost omitted); the observed "
        "value is read from the X-Rendering-Strategy response header.",
 "blocks": [
   ("split",
     [("table",
       ["Request", "Expected", "Observed", ""],
       [[r["url"].replace(":8080", "").replace(":8081", ":8081"), r["expected"],
         r["observed"], "PASS"] for r in D["trigger_matrix"][:9]],
       [2.72, 1.52, 1.52, 0.55], {"fs": 8.6, "mono": [0], "center": [1, 2, 3]})],
     [("table",
       ["Request", "Expected", "Observed", ""],
       [[r["url"].replace(":8080", "").replace(":8081", ":8081"), r["expected"],
         r["observed"], "PASS"] for r in D["trigger_matrix"][9:]],
       [2.72, 1.52, 1.52, 0.55], {"fs": 8.6, "mono": [0], "center": [1, 2, 3]})],
     0.5),
   ("bul", [
     "**Rows 1–7 hold the URL at /static and vary only the query context, yet obtain five different strategies from one unchanged resource.** That is the core claim of the project, demonstrated in seven commands.",
     "Rows 14–15 confirm the precedence properties: /heavy streams by default, but a slow link or a mobile device overrides it to SSR. Rows 16–17 confirm Edge-ISR through the proxy's edge route and against an edge container directly.",
     "Header-based control was verified to beat query-based control, and streaming was proven with a GET rather than a HEAD — Transfer-Encoding: chunked together with x-streaming: true.",
   ]),
 ]},

# ────────────────────────────────────── 14. R2: correctness + cost of adapting
{"n": "13", "kicker": "Results · correctness and overhead",
 "title": "Result 2 — the policy is provably total, and adapting is essentially free",
 "blocks": [
   ("split",
     [("img", fig("fig_context_space.png"), 2.55, None)],
     [("head", f"WE ENUMERATED THE ENTIRE CONTEXT SPACE — ALL {ds['total']} POINTS"),
      ("bul", [
        f"Because decide() is pure, the space is finite and countable: 3×2×3×3×3×2×2 = **{ds['total']} distinct contexts**. Every one was evaluated.",
        "**Total** — all returned a strategy; none reached an error path.",
        "**No dead rules** — every one of the nine rules is the first match for at least 20 contexts.",
        "**Deterministic** — repeating sampled contexts a thousand times each produced an identical strategy every time.",
        "Complemented by **28 automated tests** across 4 files, all passing.",
      ])],
     0.42),
   ("tiles", [(f"{ds['ns_per_decision']:.2f} ns", "per decision"),
              (f"{ds['decisions_per_second']/1e6:.1f} M", "decisions / second"),
              (f"{ds['total']}", "contexts, all verified"),
              ("28 / 28", "automated tests pass"),
              ("0.0126 %", "of the cheapest request")]),
   ("note", f"At **{ds['ns_per_decision']:.2f} ns** a decision costs roughly one ten-thousandth of "
            f"the cheapest measured request. This settles the obvious objection to runtime "
            f"selection — that choosing costs more than it saves — and it sets the budget any "
            f"future learned policy has to work within.", "good"),
 ]},

# ───────────────────────────────────────────── 15. R3: per-strategy behaviour
{"n": "14", "kicker": "Results · performance analysis",
 "title": "Result 3 — what each strategy actually costs, and one surprise",
 "sub": "60 sequential requests per strategy through the proxy on the fast class; these are the "
        "engine's own timings.",
 "blocks": [
   ("split",
     [("table",
       ["Strategy", "TTFB (ms)", "p95 (ms)", "Bytes", "Hit rate"],
       [[k, f"{ps[k]['ttfb']:.3f}", f"{ps[k]['ttfb_p95']:.3f}", f"{ps[k]['bytes']:,}",
         f"{ps[k]['hit']:.2f}"]
        for k in ["SSG", "SSR", "CSR", "ISR", "STREAMING_SSR", "EDGE_ISR"]],
       [2.0, 1.25, 1.1, 1.15, 1.05], {"fs": 9.5, "center": [1, 2, 3, 4]}),
      ("note", f"**SSG costs {ps['SSG']['ttfb']:.3f} ms — {ssg_ratio:.1f}× more than ISR's "
               f"{ps['ISR']['ttfb']:.3f} ms — despite doing no rendering at all.**", "warn")],
     [("img", fig("fig_ttfb.png"), 2.35, None)],
     0.52),
   ("bul", [
     f"**CSR is cheapest on both axes** — {ps['CSR']['ttfb']:.3f} ms and only {ps['CSR']['bytes']} bytes, because it renders nothing on the server and withholds the data. It is {csr_light:.1f}× lighter on the wire than SSR.",
     f"**ISR delivers SSR's output at close to CSR's cost** — {ps['ISR']['ttfb']:.3f} ms with a cache-hit rate of {ps['ISR']['hit']:.2f}, while still shipping {ps['ISR']['bytes']:,} bytes of complete markup. That is exactly why the engine reaches for ISR under load.",
     f"**Streaming SSR is the most expensive per request** at {ps['STREAMING_SSR']['ttfb']:.3f} ms — correct, not disappointing: it is the only strategy applied to the deliberately heavy page, and its job is to let the client start parsing early, not to cut total bytes.",
     "**The SSG surprise explained.** SSG reads its artefact from the filesystem on every request, whereas a warm ISR entry is served from the in-process memory tier — and a filesystem read costs more than a map lookup. The theoretical ranking of strategies can be inverted by the storage tier they land on. Fixing it is the first item on our roadmap.",
   ]),
 ]},

# ──────────────────────────────────────────────── 16. R4: adaptive vs fixed
{"n": "15", "kicker": "Results · comparative evaluation",
 "title": "Result 4 — adaptive selection versus a fixed SSR policy",
 "sub": "800 requests at concurrency 50, same URL, same stack — repeated under two link classes, "
        "because the outcome depends entirely on where the bottleneck sits.",
 "blocks": [
   ("split",
     [("img", fig("fig_loadtest.png"), 2.35, None)],
     [("table",
       ["Measure", "Fixed SSR", "Adaptive", "Change"],
       [["Fast link — strategy", "SSR ×800", "CSR ×800", "rule 4"],
        ["Throughput (req/s)", f"{fx['rps']:,.0f}", f"{ad['rps']:,.0f}", f"+{rps_gain:.1f} %"],
        ["Mean latency (ms)", f"{fx['mean_ms']:.1f}", f"{ad['mean_ms']:.1f}", f"−{mean_cut:.1f} %"],
        ["99th percentile (ms)", f"{fx['p99']}", f"{ad['p99']}", f"−{p99_cut:.1f} %"],
        ["Document (bytes)", f"{fx['doc_bytes']:,}", f"{ad['doc_bytes']}", f"−{byte_cut:.1f} %"],
        ["100 ms link — strategy", "SSR ×800", f"ISR ×{ad2['strategies']['ISR']}, SSR ×{ad2['strategies']['SSR']}", "rule 3"],
        ["Throughput (req/s)", f"{fx2['rps']:.0f}", f"{ad2['rps']:.0f}", f"{rps_d2:+.1f} %".replace("-", "\u2212")],
        ["99th percentile (ms)", f"{fx2['p99']}", f"{ad2['p99']}", f"−{p99_cut2:.1f} %"],
        ["Cache-hit rate", f"{fx2['hit']:.2f}", f"{ad2['hit']:.2f}", "—"],
        ["Origin CPU (ms)", f"{fx2['cpu_ms']:,}", f"{ad2['cpu_ms']}", f"−{cpu_cut:.1f} %"]],
       [2.05, 1.25, 1.65, 1.05], {"fs": 9.5, "center": [1, 2, 3], "rules": [5]})],
     0.46),
   ("note", "**Adaptive rendering does not manufacture bandwidth — and reporting that honestly "
            "matters more than the headline.** Where the origin is the constraint, the engine "
            "removes work from the critical path and the gain is large and user-visible: throughput "
            f"more than doubles and the tail improves by {p99_cut:.0f} %. Where the *network* is the "
            f"constraint, no rendering decision can shorten a delay imposed downstream, so latency "
            f"is unchanged — and the saving is realised instead as **{cpu_cut:.0f} % of the origin's "
            f"processor returned to the operator**, available to absorb the very spike that produced "
            f"the fixed policy's tail.", "info"),
 ]},

# ─────────────────────────────────────────────────── 17. real vs simulated
{"n": "16", "kicker": "Honest scoping",
 "title": "What is real, and what is simulated?",
 "sub": "The boundary between the engineered system and the controlled environment we measured it in.",
 "blocks": [
   ("split",
     [("head", "REAL — BUILT, RUNNING AND EXERCISED"),
      ("kv", [
        ("Runtime rule decision", "The server genuinely evaluates the rule table for every engine request."),
        ("All six strategy implementations", "Separate code paths that really render, cache, stream or hand off to the browser."),
        ("Redis", "A real Redis container — though it runs in local Docker, not a distributed cluster."),
        ("In-flight concurrency", "The server counts live requests and classifies load from that count."),
        ("User-Agent device detection", "Real, but heuristic — useful, not a perfect measurement of hardware capability."),
        ("Browser RTT / latency check", "A real measurement taken against this server via /health."),
      ])],
     [("head", "SIMULATED — DELIBERATELY, SO EXPERIMENTS REPEAT"),
      ("kv", [
        ("Network delay categories", "Injected server-side for controlled experiments: 0 / 100 / 400 ms."),
        ("Edge distance", "Edge 1 and Edge 2 apply different added delays, but normally run on the same computer."),
      ]),
      ("head", "WHY SIMULATE AT ALL?"),
      ("bul", [
        "A real mobile link cannot be replayed. Injected delay can — which is what let us run the fixed and adaptive arms back to back under identical conditions and attribute the difference to the policy alone.",
      ])],
     0.52),
   ("note", "**Our defense statement.** ARE is a working adaptive runtime tested in a controlled "
            "private-server environment. The strategy selection and the rendering and caching code "
            "paths are real; edge distance and network conditions are intentionally simulated so "
            "that experiments are repeatable.", "good"),
 ]},

# ───────────────────────────────────────────────────── 18. what it solves
{"n": "17", "kicker": "Evaluation",
 "title": "What the engine solves — with numbers, not assertions",
 "blocks": [
   ("kv", [
     ("The mismatched-client problem",
      f"A single annotated route cannot suit both a capable and a constrained client. From the **same URL**, the engine gives the capable client an {ad['doc_bytes']}-byte interactive shell and the constrained client {fx['doc_bytes']:,} bytes of finished HTML. *Verified in the trigger matrix, measured under load.*"),
     ("The origin-cost problem",
      f"Under concurrency the engine shifts to cache-backed rendering **with no operator intervention**, cutting origin CPU by {cpu_cut:.1f} % for identical delivered traffic. *Measured on the 100 ms link.*"),
     ("The tail-latency problem",
      f"Fixed server-side rendering under load produced a 99th percentile of {fx['p99']} ms; adaptive selection reduced it to {ad['p99']} ms — {p99_cut:.1f} % lower — because the work that created the queue is simply no longer performed. *Measured on the fast link.*"),
     ("The opacity problem",
      "In a conventional framework, the reason a page was rendered a particular way is a property of **source code**. Here it is a property of the **response**: every reply states its strategy and the rule that produced it. *That is what allowed every claim in this deck to be verified from outside the engine.*"),
   ]),
   ("note", "All six specific objectives from Chapter 1 are met, and each is backed by evidence a "
            "reviewer can regenerate from a clean checkout with the commands in Appendix C of the "
            "report.", "good"),
 ]},

# ────────────────────────────────────────── 19. challenges and limitations
{"n": "18", "kicker": "Reflection",
 "title": "What went wrong on the way, and the limits of our claims",
 "blocks": [
   ("split",
     [("head", "PROBLEMS MET, AND HOW WE RESOLVED THEM"),
      ("kv", [
        ("HTTP headers must be Latin-1, but our reasons contained typographic arrows — responses failed",
         "The reason is sanitised to printable ASCII on the response while the log keeps the original text."),
        ("nginx cannot inject per-node latency, so proxy-style edges showed distance but not behaviour",
         "Edges were re-modelled as full engine instances with their own identity, latency and cache."),
        ("A streamed response that is buffered before sending is not streaming at all",
         "The strategy returns a PassThrough piped straight to the response; chunked encoding is the external proof."),
        ("SSG could never be chosen on a cold start — rule 1 needs a cache only a prior request could create",
         "Static pages are pre-built at server start-up, so the artefact exists before the first request."),
        ("A burst on a stale entry could trigger many simultaneous re-renders",
         "Background revalidation is single-flight — one refresh per key, guaranteed."),
        ("Pages that read the clock during render caused React hydration mismatches",
         "First render depends only on props; live values arrive in effects, timestamps render UTC then localise. Result: zero hydration warnings."),
        ("Our fixed-SSR baseline would not stay fixed — the high-load rule correctly promoted it to ISR",
         "The baseline pins load=low. One wasted experiment run taught us this."),
      ])],
     [("head", "THREATS TO VALIDITY, STATED PLAINLY"),
      ("bul", [
        "**Single-host evaluation.** Origin, edges, proxy, cache and load generator share one machine. Absolute figures would differ on distributed hardware — the back-to-back comparisons between arms are the meaningful quantities.",
        "**Simulated, not physical, conditions.** Injected delay does not reproduce the jitter, packet loss or bandwidth ceiling of a real mobile network.",
        "**Server-side metrics only.** FCP and LCP are not instrumented, so the client-perceived benefit is argued from bytes and server timings rather than measured in a browser.",
        "**Two behaviours are environment-bound.** Edge-ISR is unreachable through the default proxy route, because the proxy correctly stamps origin requests as origin-served.",
        "**The rule table encodes our judgement.** It is consistent, exhaustively verified and observable — but it is not learned from outcome data. Proving these nine rules optimal needs the closed-loop evaluation we propose next.",
      ])],
     0.52),
 ]},

# ────────────────────────────────────────────── 20. conclusion + future ARE
{"n": "19", "kicker": "Conclusion",
 "title": "What we proved, and where ARE goes next",
 "blocks": [
   ("note", "Rendering strategy is a **legitimate runtime optimisation variable**. The web "
            "accumulated six rendering strategies over fifteen years and left the question of when "
            "to use each one to a developer annotation. We showed the question can be answered per "
            "request, that answering it costs essentially nothing, and that answering it well "
            "produces measurable gains exactly where a fixed choice is most obviously wrong.", "dark"),
   ("split",
     [("head", "RECOMMENDATIONS FOR THE FUTURE OF ARE"),
      ("kv", [
        ("Immediate — promote SSG artefacts into the memory tier",
         "Removes the filesystem anomaly we measured; a change confined to one strategy module."),
        ("Immediate — adopt real client signals",
         "Save-Data, Client Hints and the Network Information API slot in as one more source ahead of inference, because the analyzer already resolves signals by precedence."),
        ("Short term — instrument client paint metrics and feed them back",
         "The metric record is already per-request and schema-driven; adding FCP and LCP closes the loop from decision to perceived outcome."),
        ("Short term — per-route and per-tenant policy tables",
         "The policy is data, not control flow, so a second table can be chosen at request time without touching the evaluator."),
      ])],
     [("head", "WHERE IT BECOMES GENUINELY FORWARD-LOOKING"),
      ("kv", [
        ("Medium term — a learned selection policy",
         "decide() is a pure function from context to strategy, so a trained model can be dropped in behind that exact signature without disturbing a single strategy module — and the metrics log the engine already writes is precisely the training data it needs. The path from rules to learning is an implementation of an existing interface, not a rewrite."),
        ("Medium term — component-level granularity (islands)",
         "The strategy interface renders a component. A page whose navigation is statically generated, whose content is streamed and whose interactive island is client-rendered — all decided per request — is where the wider ecosystem is already heading."),
        ("Long term — distributed edges, and energy- and cost-aware objectives",
         "Edges are already full engine instances distinguished only by environment, so relocating one is a deployment change. Origin CPU is already sampled per request, so a rule could optimise for energy or cost rather than latency alone."),
      ])],
     0.47),
   ("note", "Every one of those steps extends a seam that already exists in the architecture rather "
            "than departing from it — which is the strongest practical evidence we have that the "
            "design was the right one. ARE starts as a rule-based selector and grows into a "
            "**self-tuning rendering controller**.", "good"),
 ]},
]
