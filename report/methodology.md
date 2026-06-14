# Methodology

> Template. Draw from `docs/architecture.md`, `docs/decision-algorithm.md`,
> `6_technology-and-docker-guide.md`, and docs 3–5.

- **Approach** — design-and-build (engineering) + experimental evaluation.
- **System design** — request lifecycle: analyze → decide → render → measure
  (insert the diagram from `docs/architecture.md`).
- **Decision logic** — the rule table and thresholds (`docs/decision-algorithm.md`).
- **Rendering strategies** — the six pluggable modules (`docs/rendering-strategies.md`).
- **Test environment** — Docker private server: origin + 2 edge nodes + proxy +
  Redis; justify zero-cost local/edge simulation (docs 3 & 4).
- **Validation method** — same URL, varied `X-*` headers; strategy returned in
  `X-Rendering-Strategy` and logged (doc 5).
- **Metrics** — TTFB, render time, bytes, cache-hit, CPU/memory
  (`docs/evaluation-metrics.md`).
