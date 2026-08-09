import { describe, expect, it } from 'vitest';
import { analyze, type ServerSignals } from '../src/core/context-analyzer.js';
import { decide } from '../src/core/decision-engine.js';
import staticPage from '../src/frontend/pages/static.js';
import dynamicPage from '../src/frontend/pages/dynamic.js';

const signals: ServerSignals = { concurrency: 0, cacheState: 'fresh' };

/** Analyse a URL with optional headers, against the given page module. */
function ctxFor(url: string, headers: Record<string, string> = {}, page = staticPage) {
  return analyze(url, headers, page, signals);
}

describe('context-analyzer: query-string overrides', () => {
  it('reads each signal from its query alias', () => {
    const ctx = ctxFor(
      '/static?net=slow&device=mobile&cache=cold&load=high&volatility=realtime&size=heavy',
    );
    expect(ctx.networkSpeed).toBe('slow');
    expect(ctx.device).toBe('mobile');
    expect(ctx.cacheState).toBe('cold');
    expect(ctx.load).toBe('high');
    expect(ctx.volatility).toBe('realtime');
    expect(ctx.heavyPayload).toBe(true);
  });

  it('treats ?served= as an edge node unless it is the origin', () => {
    expect(ctxFor('/static?served=edge-node-1').isEdge).toBe(true);
    expect(ctxFor('/static?served=origin').isEdge).toBe(false);
    expect(ctxFor('/static').isEdge).toBe(false);
  });

  it('lets headers win over query params', () => {
    const ctx = ctxFor('/static?net=slow&device=mobile', {
      'x-network-speed': 'fast',
      'x-device-type': 'desktop',
    });
    expect(ctx.networkSpeed).toBe('fast');
    expect(ctx.device).toBe('desktop');
  });

  it('ignores unrecognised values and falls back to inference', () => {
    const ctx = ctxFor('/static?net=hyperspeed&cache=warm&load=extreme');
    expect(ctx.networkSpeed).toBe('medium'); // default
    expect(ctx.cacheState).toBe('fresh'); // from signals
    expect(ctx.load).toBe('low'); // from concurrency
  });

  it('falls back to the page declaration when nothing overrides it', () => {
    expect(ctxFor('/static').volatility).toBe('static');
    expect(ctxFor('/dynamic', {}, dynamicPage).volatility).toBe('realtime');
  });

  it('infers device from the user-agent when neither header nor query is set', () => {
    expect(ctxFor('/static', { 'user-agent': 'Mozilla/5.0 (iPhone)' }).device).toBe('mobile');
    expect(ctxFor('/static', { 'user-agent': 'Mozilla/5.0 (Macintosh)' }).device).toBe('desktop');
  });
});

describe('context-analyzer → decision-engine: a URL alone re-triggers the strategy', () => {
  // These are the cases a browser can reach by navigation, which headers cannot.
  const cases: Array<[string, string]> = [
    ['/static', 'SSG'],
    ['/static?cache=cold', 'SSR'],
    ['/static?volatility=periodic', 'ISR'],
    ['/static?cache=cold&load=high', 'ISR'],
    ['/static?cache=cold&served=edge-1', 'EDGE_ISR'],
    ['/static?volatility=realtime&net=fast&device=desktop', 'CSR'],
    ['/static?cache=cold&net=slow', 'SSR'],
    ['/static?volatility=realtime&size=heavy&net=medium&device=desktop', 'STREAMING_SSR'],
  ];

  it.each(cases)('%s → %s', (url, expected) => {
    expect(decide(ctxFor(url)).selected).toBe(expected);
  });
});
