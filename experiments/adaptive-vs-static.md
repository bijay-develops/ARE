# Experiment: Adaptive vs Fixed Strategy

**Hypothesis:** across a *mixed* workload (varied network/device/load/volatility),
the adaptive engine beats any single fixed strategy on average.

## Procedure
1. **Adaptive run** — let the engine decide; drive a realistic mix:
   ```bash
   bash scripts/switch-test.sh          # spans all contexts
   BASE_URL=http://localhost:8080 N=500 C=25 bash scripts/load-test.sh /dynamic
   npm run report                       # record adaptive averages
   ```
2. **Fixed baselines** — repeat the same mix but pin one strategy by sending
   headers that always select it (e.g. force SSR everywhere with
   `X-Network-Speed: slow`), record each baseline's averages.
3. Compare adaptive vs each fixed baseline.

## Record
| Mode | avg TTFB (ms) | avg bytes | cache-hit | server CPU |
| --- | --- | --- | --- | --- |
| Adaptive | | | | |
| Fixed: SSR | | | | |
| Fixed: CSR | | | | |
| Fixed: SSG | | | | |

**Observation:** adaptive should win or tie the best fixed strategy on each
sub-workload while no single fixed strategy wins across *all* of them.
