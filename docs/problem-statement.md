# Problem Statement

(Canonical source: `1_project-details.md` §1–§2. Summary for the docs set.)

Modern frameworks (Next.js, Remix) support multiple rendering strategies — SSG,
SSR, Streaming SSR, ISR, CSR, Partial Hydration — but the choice is **fixed by
the developer at build time** and applied uniformly to all users. Real-world
conditions (network quality, device capability, traffic spikes, data
volatility) vary per request, so a static choice is frequently sub-optimal:
high TTFB, excessive hydration JS, wasted server load, poor low-end UX.

**Core problem:** there is no automated system that selects the best rendering
strategy *at runtime* from real-time context.

**This project:** the Adaptive Rendering Engine (ARE) — a runtime that analyzes
each request's context and selects among six strategies per request, fully
open-source and runnable locally with zero budget.
