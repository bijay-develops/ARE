# Experiment: SSG vs SSR

**Hypothesis:** for static content, SSG yields much lower TTFB and offloads the
origin versus rendering the same page with SSR per request.

## Procedure
```bash
# Force SSG (static + warm cache) and SSR (realtime + mobile) on comparable pages
for i in $(seq 1 50); do curl -s -o /dev/null -H 'X-Data-Volatility: static' http://localhost:3000/static; done
for i in $(seq 1 50); do curl -s -o /dev/null -H 'X-Data-Volatility: realtime' -H 'X-Device-Type: mobile' http://localhost:3000/dynamic; done
npm run report
```

## Record (from report.csv)
| Strategy | avg TTFB (ms) | avg bytes | cache-hit |
| --- | --- | --- | --- |
| SSG | | | |
| SSR | | | |

**Observation:** _fill in._
