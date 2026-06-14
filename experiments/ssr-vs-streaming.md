# Experiment: SSR vs Streaming SSR

**Hypothesis:** for a heavy page, Streaming SSR improves *perceived* load (shell
arrives first) versus buffered SSR that waits for the full render.

## Procedure
```bash
# Streaming (heavy + non-slow) vs SSR (heavy + slow forces SSR by rule 8)
for i in $(seq 1 50); do curl -s -o /dev/null -H 'X-Data-Size: heavy' -H 'X-Network-Speed: medium' http://localhost:3000/heavy; done
for i in $(seq 1 50); do curl -s -o /dev/null -H 'X-Data-Size: heavy' -H 'X-Network-Speed: slow'   http://localhost:3000/heavy; done
npm run report
```
Also capture FCP/streaming behavior in Chrome DevTools (Network → "Fetch/XHR"
shows progressive chunks; Performance shows earlier first paint).

## Record
| Strategy | avg TTFB (ms) | avg bytes | notes |
| --- | --- | --- | --- |
| Streaming SSR | | | shell flushed first |
| SSR | | | full buffer |

**Observation:** _fill in._
