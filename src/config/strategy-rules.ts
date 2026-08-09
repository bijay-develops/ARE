import type { RequestContext, StrategyName } from '../core/types.js';

export interface StrategyRule {
  /** Predicate over the request context. First rule whose test passes wins. */
  test: (ctx: RequestContext) => boolean;
  strategy: StrategyName;
  reason: string;
}

/**
 * Authoritative decision table (see 7_code-generation-prompt.md §7.5).
 * Evaluated top-to-bottom; FIRST MATCH WINS. The final rule is an
 * unconditional fallback, so `decide` always returns a strategy.
 */
export const STRATEGY_RULES: StrategyRule[] = [
  {
    test: (c) => c.volatility === 'static' && c.cacheState !== 'cold',
    strategy: 'SSG',
    reason: 'Static content with usable cache → serve pre-built (SSG)',
  },
  {
    test: (c) => c.volatility === 'static' && c.isEdge,
    strategy: 'EDGE_ISR',
    reason: 'Static content at the edge → Edge-ISR with revalidation',
  },
  {
    test: (c) => c.load === 'high',
    strategy: 'ISR',
    reason: 'High load → shed origin work with cached + background revalidate (ISR)',
  },
  {
    test: (c) => c.volatility === 'realtime' && c.networkSpeed === 'fast' && c.device === 'desktop',
    strategy: 'CSR',
    reason: 'Realtime data on a capable client → fully interactive (CSR)',
  },
  {
    test: (c) => c.volatility === 'realtime' && c.device === 'mobile',
    strategy: 'SSR',
    reason: 'Realtime data on a weak device → fresh HTML, minimal JS (SSR)',
  },
  {
    test: (c) => c.volatility === 'periodic',
    strategy: 'ISR',
    reason: 'Periodically changing data → cache + revalidate on TTL (ISR)',
  },
  {
    test: (c) => c.heavyPayload && c.networkSpeed !== 'slow',
    strategy: 'STREAMING_SSR',
    reason: 'Large/interactive payload on a decent link → stream chunks (Streaming SSR)',
  },
  {
    test: (c) => c.networkSpeed === 'slow',
    strategy: 'SSR',
    reason: 'Slow network → avoid heavy hydration (SSR)',
  },
  {
    test: () => true,
    strategy: 'SSR',
    reason: 'Fallback → safe, correct default (SSR)',
  },
];
