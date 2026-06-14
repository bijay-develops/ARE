# Future Work

(Canonical source: `1_project-details.md` §7.)

- **Framework plugin** — expose the engine as Next.js/Remix middleware so the
  decision runs inside a real framework request pipeline.
- **Real edge deployment** — replace the simulated edge containers with actual
  edge runtimes (e.g. Cloudflare Workers) for true geographic distribution.
- **ML-based decisions** — replace the rule table in `decision-engine.ts` with a
  model trained on the collected metrics; the `RequestContext → StrategyName`
  seam is already isolated for this swap (see `docs/decision-algorithm.md`).
- **Partial hydration / islands** — extend `csr/hydration.ts` to hydrate only
  interactive islands rather than the whole tree.
- **Richer feedback loop** — feed `experiments/results` back into thresholds so
  the engine self-tunes (`config/thresholds.ts`).
- **Production hardening** — security headers, compression, real FCP capture,
  per-route cache policies.
