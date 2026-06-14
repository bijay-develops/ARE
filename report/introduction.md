# Introduction

> Template. Draw from `1_project-details.md` §1–§2 and `docs/problem-statement.md`.

1. **Context** — rendering strategies and their trade-offs (performance,
   freshness, scalability, resource use).
2. **Problem** — static, developer-chosen strategy does not adapt to runtime
   conditions; cite the limitations (TTFB, hydration cost, load, low-end UX).
3. **Aim & objectives** — build a runtime that selects strategy per request;
   evaluate it on a private server.
4. **Scope** — six strategies, rule-based decision, local/Docker evaluation;
   ML and real edge deployment are future work.
5. **Contributions** — (a) the adaptive engine, (b) the pluggable strategy
   architecture, (c) the zero-budget Docker evaluation methodology.
6. **Report structure** — outline the remaining chapters.
