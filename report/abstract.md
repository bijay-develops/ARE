# Abstract

> Template — adapt in your own words. ~200 words.

Modern web frameworks support multiple rendering strategies but require the
developer to choose one statically at build time, which is often sub-optimal as
runtime conditions change. This project designs and implements the **Adaptive
Rendering Engine (ARE)**, a runtime that automatically selects the optimal
rendering strategy — SSG, SSR, Streaming SSR, ISR, CSR, or simulated Edge-ISR —
per request, based on real-time context (network speed, device, cache freshness,
server load, data volatility). The engine is built in TypeScript on Node.js with
React 18 as the rendering primitive and a native HTTP server, and is evaluated on
a zero-cost Docker-based private server that models an origin and multiple edge
nodes. A pure, rule-based decision engine maps request context to a strategy and
is fully unit-tested. Experiments measure TTFB, render time, response size and
cache-hit behavior across strategies and contexts, demonstrating that adaptive
selection outperforms any single fixed strategy on mixed workloads.
**[Insert your headline result numbers from `report.csv` here.]**
