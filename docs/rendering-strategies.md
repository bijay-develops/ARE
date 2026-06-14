# Rendering Strategies

All six implement the same `RenderStrategy` interface and live under `src/strategies/`.

| Strategy | React API | Cache | When chosen | Output characteristic |
| --- | --- | --- | --- | --- |
| **SSG** | `renderToStaticMarkup` (prebuilt) | reads `public/ssg/*.html` | static content, cache usable | zero per-request render; full HTML + hydration data |
| **SSR** | `renderToString` | none | slow network, realtime+mobile, fallback | fresh full HTML each request |
| **Streaming SSR** | `renderToPipeableStream` + `<Suspense>` | none | heavy payload on non-slow link | chunked; shell first, sections stream in |
| **ISR** | `renderToString` + TTL cache | memory→redis→file | periodic data, high load | serve cached; stale-while-revalidate in background |
| **CSR** | client `hydrateRoot`/`createRoot` | shell only | realtime + fast + desktop | tiny empty shell; data fetched from `/api/data` |
| **Edge-ISR** | ISR semantics, edge-namespaced key | per-edge (Redis-shareable) | static content at an edge node | short-TTL static served close to user |

## How the page/data/hydration contract works
The server embeds three globals so the client bundle knows what to do:
```js
window.__ARE_ROUTE__     // which page component to mount
window.__ARE_STRATEGY__  // strategy that produced the page (shown in UI)
window.__ARE_DATA__      // data for hydration; null for pure CSR
```
- **SSR/Streaming/ISR/SSG/Edge-ISR:** markup + `__ARE_DATA__` present → client **hydrates**.
- **CSR:** markup empty + `__ARE_DATA__ = null` → client **fetches** `/api/data` then renders.

## Adding a new strategy
1. Create `src/strategies/<name>/<name>.ts` implementing `RenderStrategy`.
2. Add its `StrategyName` to `src/core/types.ts`.
3. Add a rule (or branch) in `src/config/strategy-rules.ts`.
4. `.register(new XStrategy())` in `src/server/server.ts`.
