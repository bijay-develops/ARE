import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { config } from '../config/engine.config.js';
import { Engine } from '../core/engine.js';
import { StrategyRegistry } from '../core/strategy-registry.js';
import type { CacheState, PageModule, RequestContext } from '../core/types.js';
import { CacheManager } from '../cache/cache-manager.js';
import { MetricsCollector } from '../metrics/metrics-collector.js';
import { resolvePage, allPages } from './router.js';
import { normalizeHeaders, pathnameOf, queryOf } from './middleware.js';
import { delayForNetwork, sleep } from '../simulation/network-throttler.js';
import { SSRStrategy } from '../strategies/ssr/ssr-handler.js';
import { SSGStrategy } from '../strategies/ssg/ssg-renderer.js';
import { ISRStrategy } from '../strategies/isr/isr-renderer.js';
import { EdgeISRStrategy } from '../strategies/edge-isr/edge-simulator.js';
import { CSRStrategy } from '../strategies/csr/csr-handler.js';
import { StreamingSSRStrategy } from '../strategies/streaming-ssr/stream-renderer.js';
import { readSSG, writeSSG } from '../strategies/ssg/ssg-cache.js';
import { renderSSR } from '../strategies/ssr/ssr-renderer.js';
import { logger } from '../utils/logger.js';

// ── Wiring ───────────────────────────────────────────────────────────────────
const cache = new CacheManager({
  cacheDir: config.cacheDir,
  redisUrl: config.redisUrl,
  defaultTtlMs: config.cacheTtlMs,
});
const metrics = new MetricsCollector(config.metricsDir);
const registry = new StrategyRegistry()
  .register(new SSGStrategy())
  .register(new SSRStrategy())
  .register(new StreamingSSRStrategy())
  .register(new ISRStrategy())
  .register(new CSRStrategy())
  .register(new EdgeISRStrategy());
const engine = new Engine({ registry, cache, metrics });

// Live concurrency counter → feeds the load classifier in the analyzer.
let inFlight = 0;

/** Build a synthetic context for prebuild / API data (no live request). */
function syntheticCtx(page: PageModule): RequestContext {
  return {
    url: page.route,
    networkSpeed: 'fast',
    device: 'desktop',
    cacheState: 'cold',
    load: 'low',
    volatility: page.volatility,
    heavyPayload: page.heavy === true,
    isEdge: false,
    rawHeaders: {},
  };
}

/** Cache state the analyzer should see for this page (SSG file or ISR entry). */
async function peekCacheState(page: PageModule): Promise<CacheState> {
  if (page.volatility === 'static') {
    return (await readSSG(page.route)) ? 'fresh' : 'cold';
  }
  return cache.peekState(`isr:${page.route}`);
}

/** Pre-render static pages to public/ssg so SSG is selectable from the first hit. */
async function prebuildStatic(): Promise<void> {
  for (const page of allPages()) {
    if (page.volatility === 'static') {
      // Rule 1 only serves this artifact when the cache is usable, so embed the
      // context it will actually be served under — not the cold cache that
      // exists at prebuild time. Otherwise the page reports a context that
      // contradicts the SSG badge it is served with.
      const ctx = { ...syntheticCtx(page), cacheState: 'fresh' as const };
      const { html } = await renderSSR(ctx, page, 'SSG', {
        reason: 'Static content with usable cache - serve pre-built (SSG)',
      });
      await writeSSG(page.route, html);
      logger.are(`Prebuilt SSG: ${page.route}`);
    }
  }
}

async function serveClientBundle(res: ServerResponse): Promise<void> {
  try {
    const js = await fs.readFile(path.resolve('public', 'client.js'));
    res.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8' });
    res.end(js);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('client bundle not built — run `npm run build:client`');
  }
}

async function serveApiData(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const route = queryOf(req).get('route') ?? '/';
  const page = resolvePage(route);
  if (!page) {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end('{}');
    return;
  }
  const data = page.getData ? await page.getData(syntheticCtx(page)) : {};
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

// ── Request handler ──────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  inFlight++;
  try {
    const pathname = pathnameOf(req);
    const headers = normalizeHeaders(req);

        // ==========================================================
    // 🌐 SERVE frontend (/) + control_panel (/control)
    // ==========================================================
    let baseDir: string;
    let reqFile: string;
    if (pathname === '/control' || pathname === '/control/' || pathname.startsWith('/control/')) {
      baseDir = path.join(process.cwd(), 'src', 'control_panel');
      reqFile = (pathname === '/control' || pathname === '/control/')
        ? 'index.html'
        : pathname.slice('/control/'.length);
    } else {
      baseDir = path.join(process.cwd(), 'src', 'frontend');
      reqFile = pathname === '/' ? 'index.html' : pathname;
    }
    const fullPath = path.join(baseDir, reqFile);

    try {
      await fs.access(fullPath);
      const extname = path.extname(fullPath).toLowerCase();
      const contentTypes: Record<string, string> = {
        '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
        '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
      };
      const contentType = contentTypes[extname] || 'application/octet-stream';
      const content = await fs.readFile(fullPath);
      // Browser-cache policy: HTML haru pachi revalidate, assets 60s cache
      const cacheControl = extname === '.html' ? 'no-cache' : 'public, max-age=60';
      res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': cacheControl });
      return void res.end(content);
    } catch (err) {
      // custom file bhettiyena → ARE engine le /static, /dynamic, /heavy handle garcha
    } 

    // Self-identify the node: an edge container (SERVED_BY set) tags its own
    // requests so the analyzer sees isEdge=true. An explicit client header wins
    // (used by tests to exercise edge logic against a single origin).
    if (!headers['x-served-by'] && config.servedBy) {
      headers['x-served-by'] = config.servedBy;
    }

    if (pathname === '/client.js') return await serveClientBundle(res);
    if (pathname === '/api/data') return await serveApiData(req, res);
    if (pathname === '/health') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      return void res.end('ok');
    }

    const page = resolvePage(pathname);
    if (!page) {
      res.writeHead(404, { 'content-type': 'text/html' });
      return void res.end('<h1>404 — no such page</h1>');
    }

    // Simulate network conditions + edge latency (container-driven). Honours the
    // ?net= alias too, so the simulated delay matches the strategy that is chosen.
    const speed = (headers['x-network-speed'] ??
      queryOf(req).get('net') ??
      'medium') as any;
    await sleep(delayForNetwork(speed));
    if (config.edgeLatencyMs > 0) await sleep(config.edgeLatencyMs);

    const cacheState = await peekCacheState(page);
    await engine.handle({
      url: req.url ?? pathname,
      headers,
      page,
      signals: { concurrency: inFlight, cacheState },
      res,
    });
  } catch (err) {
    logger.error(`Unhandled: ${(err as Error).message}`);
    if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain' });
    res.end('Internal error');
  } finally {
    inFlight--;
  }
});

async function start() {
  await cache.init();
  await prebuildStatic();
  server.listen(config.port, () => {
    logger.are(`Adaptive Rendering Engine listening on :${config.port}` +
      (config.servedBy ? ` (node=${config.servedBy}, +${config.edgeLatencyMs}ms)` : ' (origin)'));
    logger.are(`Strategies registered: ${registry.list().join(', ')}`);
  });
}

void start();
