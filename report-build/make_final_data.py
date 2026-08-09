#!/usr/bin/env python3
"""
Consolidates the measured final-evaluation data for the ARE Final Report and
renders the result charts used by both the DOCX and the PDF renderer.

Inputs  : raw experiment output produced by the experiment driver (EXP dir)
Outputs : report-build/data/final_results.json
          report-build/figs/fig_*.png

Read-only with respect to the engine source tree.
"""
import json, os, glob, collections, statistics as st

HERE = os.path.dirname(os.path.abspath(__file__))
EXP = os.environ.get("EXP", "/private/tmp/claude-501/-Users-bijayb-k-Downloads-ARE/"
                            "36e99720-8253-48c9-a818-4fac8eabbdfe/scratchpad/exp")
DATA = os.path.join(HERE, "data"); os.makedirs(DATA, exist_ok=True)
FIGS = os.path.join(HERE, "figs"); os.makedirs(FIGS, exist_ok=True)

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

plt.rcParams.update({
    "font.family": "serif", "font.serif": ["Times New Roman", "DejaVu Serif"],
    "font.size": 10, "axes.titlesize": 11, "axes.titleweight": "bold",
    "axes.grid": True, "grid.alpha": .3, "grid.linestyle": ":",
    "figure.dpi": 200, "savefig.bbox": "tight",
})
ORDER = ["SSG", "SSR", "CSR", "ISR", "STREAMING_SSR", "EDGE_ISR"]
COLOR = {"SSG": "#2e7d32", "SSR": "#c62828", "CSR": "#1565c0",
         "ISR": "#00838f", "STREAMING_SSR": "#e65100", "EDGE_ISR": "#6a1b9a"}

def pct(xs, p):
    xs = sorted(xs); k = (len(xs) - 1) * p; f = int(k); c = min(f + 1, len(xs) - 1)
    return xs[f] + (xs[c] - xs[f]) * (k - f)

R = {}

# ── 1. strategy-selection trigger matrix ─────────────────────────────────────
matrix = []
for line in open(f"{EXP}/A_matrix.tsv"):
    url, exp, got, ok, note = line.rstrip("\n").split("\t")
    matrix.append({"url": url.replace("http://localhost:", ":"),
                   "expected": exp, "observed": got, "ok": ok, "rule": note})
R["trigger_matrix"] = matrix
R["trigger_pass"] = sum(1 for m in matrix if m["ok"] == "PASS")

# ── 2. per-strategy engine cost (server-side metrics, exp=B) ─────────────────
recs = []
for f in glob.glob(f"{EXP}/metrics_are-*.ndjson"):
    for l in open(f):
        if l.strip():
            r = json.loads(l)
            if "exp=B" in r["url"]:
                recs.append(r)
by = collections.defaultdict(list)
for r in recs:
    by[r["strategy"]].append(r)
server = {}
for k in ORDER:
    v = by.get(k, [])
    if not v: continue
    tt = [r["ttfbMs"] for r in v]
    server[k] = {"n": len(v), "ttfb": round(st.mean(tt), 3),
                 "ttfb_p95": round(pct(tt, .95), 3),
                 "render": round(st.mean(r["renderMs"] for r in v), 3),
                 "total": round(st.mean(r["totalMs"] for r in v), 3),
                 "bytes": round(st.mean(r["bytes"] for r in v)),
                 "hit": round(sum(r["fromCache"] for r in v) / len(v), 2)}
R["per_strategy_server"] = server

# ── 3. per-strategy client wall clock ────────────────────────────────────────
cl = collections.defaultdict(list)
for line in open(f"{EXP}/B_bench.tsv"):
    n, t, ttfb, sz = line.split()
    cl[n].append(float(t) * 1000)
R["per_strategy_client"] = {k: {"n": len(v), "mean": round(st.mean(v), 2),
                                "median": round(st.median(v), 2),
                                "p95": round(pct(v, .95), 2),
                                "min": round(min(v), 2), "max": round(max(v), 2)}
                            for k, v in cl.items()}

# ── 4. ISR lifecycle ─────────────────────────────────────────────────────────
life = []
for line in open(f"{EXP}/C_cache.tsv"):
    i, el, t, state = line.split()
    life.append({"i": int(i), "t": float(el), "ms": round(float(t) * 1000, 2), "state": state})
R["isr_lifecycle"] = life

# ── 5. network sweep + 6. edge ───────────────────────────────────────────────
net = collections.defaultdict(list)
for line in open(f"{EXP}/D_network.tsv"):
    n, t = line.split(); net[n].append(float(t) * 1000)
R["network"] = {k: {"mean": round(st.mean(v), 2), "median": round(st.median(v), 2),
                    "n": len(v)} for k, v in net.items()}
edge = collections.defaultdict(list)
for line in open(f"{EXP}/E_edge.tsv"):
    n, t = line.split(); edge[n].append(float(t) * 1000)
base = st.mean(edge["origin"])
R["edge"] = {k: {"mean": round(st.mean(v), 2), "median": round(st.median(v), 2),
                 "delta": round(st.mean(v) - base, 2)} for k, v in edge.items()}

# ── 7. load tests ────────────────────────────────────────────────────────────
def ab(path):
    o = {}
    for l in open(path):
        s = l.strip()
        if s.startswith("Requests per second"): o["rps"] = float(s.split()[3])
        elif s.startswith("Time per request") and "across" not in s: o["mean_ms"] = float(s.split()[3])
        elif s.startswith("Document Length"): o["doc_bytes"] = int(s.split()[2])
        elif s.startswith("Total transferred"): o["total_bytes"] = int(s.split()[2])
        elif s.startswith("Complete requests"): o["n"] = int(s.split()[2])
        elif s.startswith("Failed requests"): o["failed"] = int(s.split()[2])
        elif s.startswith("50%"): o["p50"] = int(s.split()[1])
        elif s.startswith("90%"): o["p90"] = int(s.split()[1])
        elif s.startswith("95%"): o["p95"] = int(s.split()[1])
        elif s.startswith("99%"): o["p99"] = int(s.split()[1])
        elif s.startswith("100%"): o["max"] = int(s.split()[1])
    return o

def mix(metrics_file, tag):
    rows = [json.loads(l) for l in open(metrics_file) if l.strip()]
    sub = [r for r in rows if tag in r["url"]]
    if not sub: return {}
    return {"strategies": dict(collections.Counter(r["strategy"] for r in sub)),
            "load": dict(collections.Counter(r["load"] for r in sub)),
            "ttfb": round(st.mean(r["ttfbMs"] for r in sub), 3),
            "bytes": round(st.mean(r["bytes"] for r in sub)),
            "hit": round(sum(r["fromCache"] for r in sub) / len(sub), 2),
            "cpu_ms": sub[-1]["resources"]["cpuMs"] - sub[0]["resources"]["cpuMs"],
            "rss_mb": round(st.mean(r["resources"]["rssMb"] for r in sub), 1)}

R["load_fast"] = {"fixed_ssr": {**ab(f"{EXP}/F2_ab_fixed_ssr.txt"),
                                **mix(f"{EXP}/metrics_F2_origin.ndjson", "F2_fixed_ssr")},
                  "adaptive": {**ab(f"{EXP}/F2_ab_adaptive.txt"),
                               **mix(f"{EXP}/metrics_F2_origin.ndjson", "F2_adaptive")}}
R["load_medium"] = {"fixed_ssr": {**ab(f"{EXP}/G2_ab_fixed_ssr.txt"),
                                  **mix(f"{EXP}/metrics_G2_origin.ndjson", "G2_fixed_ssr")},
                    "adaptive": {**ab(f"{EXP}/G2_ab_adaptive.txt"),
                                 **mix(f"{EXP}/metrics_G2_origin.ndjson", "G2_adaptive")}}

# ── 8. decision-engine enumeration (from the tsx harness) ────────────────────
R["decision_space"] = {
    "total": 648,
    "byStrategy": {"SSG": 144, "ISR": 300, "SSR": 124, "EDGE_ISR": 36,
                   "STREAMING_SSR": 20, "CSR": 24},
    "byRule": {1: 144, 2: 36, 3: 156, 4: 24, 5: 72, 6: 144, 7: 20, 8: 32, 9: 20},
    "deterministic": True, "ns_per_decision": 26.53, "decisions_per_second": 37693089,
}
R["tests"] = {"files": 4, "total": 28,
              "detail": {"decision-engine": 10, "context-analyzer": 14,
                         "rendering": 2, "cache": 2}}

json.dump(R, open(f"{DATA}/final_results.json", "w"), indent=2)

# ════════════════════════════════════════════════════════════════════ charts ══
def save(fig, name):
    fig.savefig(os.path.join(FIGS, name)); plt.close(fig); print("  wrote", name)

# 5.1 engine cost per strategy
ks = [k for k in ORDER if k in server]
fig, ax = plt.subplots(figsize=(6.4, 3.1))
ax.bar([k.replace("STREAMING_SSR", "STREAM.\nSSR").replace("EDGE_ISR", "EDGE\nISR") for k in ks],
       [server[k]["ttfb"] for k in ks], color=[COLOR[k] for k in ks], width=.62)
for i, k in enumerate(ks):
    ax.text(i, server[k]["ttfb"] + .03, f"{server[k]['ttfb']:.2f}", ha="center", fontsize=9)
ax.set_ylabel("mean server-side TTFB (ms)")
ax.set_title("Server-side cost per rendering strategy (n = 60 requests each)")
ax.set_ylim(0, max(server[k]["ttfb"] for k in ks) * 1.25)
save(fig, "fig_ttfb.png")

# 5.2 payload per strategy
fig, ax = plt.subplots(figsize=(6.4, 3.1))
ax.bar([k.replace("STREAMING_SSR", "STREAM.\nSSR").replace("EDGE_ISR", "EDGE\nISR") for k in ks],
       [server[k]["bytes"] / 1024 for k in ks], color=[COLOR[k] for k in ks], width=.62)
for i, k in enumerate(ks):
    ax.text(i, server[k]["bytes"] / 1024 + .4, f"{server[k]['bytes']:,}", ha="center", fontsize=8)
ax.set_ylabel("mean response size (KB)")
ax.set_title("Bytes placed on the wire per rendering strategy")
ax.set_ylim(0, max(server[k]["bytes"] for k in ks) / 1024 * 1.18)
save(fig, "fig_bytes.png")

# 5.3 ISR lifecycle
fig, ax = plt.subplots(figsize=(6.6, 3.0))
xs = [p["t"] for p in life]; ys = [p["ms"] for p in life]
ax.plot(xs, ys, "-", color="#455a64", lw=1.1, zorder=1)
mk = {"miss": ("o", "#c62828", "cold miss (render + cache)"),
      "fresh": ("s", "#2e7d32", "fresh cache hit"),
      "stale-revalidating": ("^", "#e65100", "stale → serve + revalidate")}
seen = set()
for p in life:
    m, c, lab = mk[p["state"]]
    ax.scatter(p["t"], p["ms"], marker=m, color=c, s=42, zorder=3,
               label=lab if lab not in seen else None); seen.add(lab)
ax.set_xlabel("elapsed time (s)"); ax.set_ylabel("response time (ms)")
ax.set_title("ISR stale-while-revalidate lifecycle at a 30 s TTL")
ax.legend(fontsize=8, loc="upper right", framealpha=.95)
save(fig, "fig_isr_lifecycle.png")

# 5.4 load test comparison
fig, axes = plt.subplots(1, 2, figsize=(7.0, 3.0))
for ax, (key, title) in zip(axes, [("load_fast", "Fast link (0 ms)"),
                                   ("load_medium", "Medium link (100 ms)")]):
    d = R[key]; labels = ["p50", "p90", "p95", "p99"]
    fx = [d["fixed_ssr"][k] for k in labels]; ad = [d["adaptive"][k] for k in labels]
    x = range(len(labels)); w = .36
    ax.bar([i - w / 2 for i in x], fx, w, label="fixed SSR policy", color="#c62828")
    ax.bar([i + w / 2 for i in x], ad, w, label="adaptive (ARE)", color="#1565c0")
    ax.set_xticks(list(x)); ax.set_xticklabels(labels)
    ax.set_title(f"{title}\n800 requests, concurrency 50", fontsize=9.5)
    ax.set_ylabel("latency (ms)"); ax.legend(fontsize=8)
save(fig, "fig_loadtest.png")

# 5.5 context-space coverage
fig, axes = plt.subplots(1, 2, figsize=(7.0, 2.9))
bs = R["decision_space"]["byStrategy"]
ks2 = [k for k in ORDER if k in bs]
axes[0].bar([k.replace("STREAMING_SSR", "STR.").replace("EDGE_ISR", "EDGE") for k in ks2],
            [bs[k] for k in ks2], color=[COLOR[k] for k in ks2], width=.62)
axes[0].set_ylabel("contexts"); axes[0].set_title("Strategy share of the 648-point\ncontext space", fontsize=9.5)
br = R["decision_space"]["byRule"]
axes[1].bar([str(i) for i in range(1, 10)], [br[i] for i in range(1, 10)],
            color="#37474f", width=.62)
axes[1].set_xlabel("rule number"); axes[1].set_ylabel("contexts matched")
axes[1].set_title("Rule firing frequency\n(every rule is reachable)", fontsize=9.5)
save(fig, "fig_context_space.png")

# 5.6 network + edge
fig, axes = plt.subplots(1, 2, figsize=(7.0, 2.8))
nk = ["slow", "medium", "fast"]
axes[0].bar(nk, [R["network"][k]["mean"] for k in nk], color="#5c6bc0", width=.55)
for i, k in enumerate(nk):
    axes[0].text(i, R["network"][k]["mean"] + 8, f"{R['network'][k]['mean']:.0f}", ha="center", fontsize=9)
axes[0].set_ylabel("end-to-end time (ms)")
axes[0].set_title("Simulated link classes\n(configured 400 / 100 / 0 ms)", fontsize=9.5)
ek = ["origin", "edge-node-1", "edge-node-2"]
axes[1].bar([e.replace("edge-node-", "edge ") for e in ek],
            [R["edge"][k]["mean"] for k in ek], color="#00897b", width=.55)
for i, k in enumerate(ek):
    axes[1].text(i, R["edge"][k]["mean"] + 2, f"{R['edge'][k]['mean']:.1f}", ha="center", fontsize=9)
axes[1].set_ylabel("end-to-end time (ms)")
axes[1].set_title("Edge nodes vs origin\n(configured +20 / +80 ms)", fontsize=9.5)
save(fig, "fig_network_edge.png")

print(f"\nwrote {DATA}/final_results.json")
