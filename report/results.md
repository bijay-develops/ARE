# Results & Evaluation

> Template. Fill with data from `experiments/results/report.csv` and `ab` runs.

1. **Functional correctness** — table of (context → expected vs actual strategy)
   from `scripts/switch-test.sh`; note all 9 rules covered by passing unit tests.
2. **Performance per strategy** — paste the `report.csv` table; chart avg TTFB
   and avg bytes per strategy (graphs → `experiments/results/graphs/`).
3. **Network sensitivity** — strategy + TTFB across slow/medium/fast.
4. **Load behavior** — `ab -n 1000 -c 50` requests/sec, failures, and the
   strategy shift to ISR under high concurrency.
5. **Cache effectiveness** — cold vs warm TTFB for ISR/Edge-ISR; cache-hit rate.
6. **Adaptive vs fixed** — show a mixed workload where adaptive beats any single
   fixed strategy.

Discuss threats to validity (simulated network/edge, single host, synthetic pages).
