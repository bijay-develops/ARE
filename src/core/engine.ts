import type { ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import type { CacheManager } from '../cache/cache-manager.js';
import type { MetricsCollector } from '../metrics/metrics-collector.js';
import { Timer } from '../metrics/timing.js';
import { analyze, type ServerSignals } from './context-analyzer.js';
import { decide } from './decision-engine.js';
import { StrategyRegistry } from './strategy-registry.js';
import type { PageModule, RenderResult } from './types.js';
import { logger } from '../utils/logger.js';

export interface EngineDeps {
  registry: StrategyRegistry;
  cache: CacheManager;
  metrics: MetricsCollector;
}

/**
 * Orchestrates a single request:
 *   analyze → decide → registry.get(strategy).render → measure → respond.
 * Always sets X-Rendering-Strategy + X-Decision-Reason and logs the decision.
 */
export class Engine {
  constructor(private readonly deps: EngineDeps) {}

  async handle(params: {
    url: string;
    headers: Record<string, string>;
    page: PageModule;
    signals: ServerSignals;
    res: ServerResponse;
  }): Promise<void> {
    const { url, headers, page, signals, res } = params;
    const timer = new Timer();

    // 1) ANALYZE — observe context (no decisions, no rendering)
    const ctx = analyze(url, headers, page, signals);

    // 2) DECIDE — pure rule-based selection
    const trace = decide(ctx);

    logger.are(`Request: ${url}`);
    logger.are(
      `Context: net=${ctx.networkSpeed} device=${ctx.device} cache=${ctx.cacheState} ` +
        `load=${ctx.load} volatility=${ctx.volatility} heavy=${ctx.heavyPayload} edge=${ctx.isEdge}`,
    );
    logger.are(`Strategy selected: ${trace.selected} — ${trace.reason}`);

    // 3) RENDER — delegate to the chosen pluggable strategy
    let result: RenderResult;
    try {
      result = await this.deps.registry.get(trace.selected).render(ctx, page, this.deps.cache);
    } catch (err) {
      logger.error(`Render failed for ${trace.selected}: ${(err as Error).message}; falling back to SSR`);
      result = await this.deps.registry.get('SSR').render(ctx, page, this.deps.cache);
    }

    // 4) RESPOND — always advertise the strategy + reason
    const headersOut: Record<string, string> = {
      ...result.headers,
      'x-rendering-strategy': trace.selected,
      // HTTP header values must be ASCII (latin1); strip any non-ASCII (e.g. arrows).
      'x-decision-reason': trace.reason.replace(/[^\x20-\x7E]/g, '-'),
    };
    res.writeHead(result.status, headersOut);
    const ttfbMs = timer.elapsedMs();

    let bytes = 0;
    if (typeof result.body === 'string') {
      bytes = Buffer.byteLength(result.body);
      res.end(result.body);
    } else {
      const stream = result.body as Readable;
      stream.on('data', (c: Buffer) => (bytes += c.length));
      await new Promise<void>((resolve) => {
        stream.on('end', resolve);
        stream.on('error', () => resolve());
        stream.pipe(res);
      });
    }

    // 5) MEASURE — persist per-request metrics (never blocks the response)
    const totalMs = timer.elapsedMs();
    void this.deps.metrics.record({
      url,
      strategy: trace.selected,
      reason: trace.reason,
      ttfbMs: Math.round(ttfbMs * 100) / 100,
      renderMs: Math.round((totalMs - ttfbMs) * 100) / 100,
      totalMs: Math.round(totalMs * 100) / 100,
      fromCache: result.fromCache,
      bytes,
      network: ctx.networkSpeed,
      device: ctx.device,
      load: ctx.load,
      isEdge: ctx.isEdge,
    });
  }
}
