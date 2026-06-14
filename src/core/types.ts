import type { ComponentType } from 'react';
import type { CacheManager } from '../cache/cache-manager.js';

export type StrategyName =
  | 'SSG'
  | 'SSR'
  | 'STREAMING_SSR'
  | 'ISR'
  | 'CSR'
  | 'EDGE_ISR';

export type NetworkSpeed = 'slow' | 'medium' | 'fast'; // ~2G/3G | 4G | wifi
export type DeviceType = 'mobile' | 'desktop';
export type CacheState = 'fresh' | 'stale' | 'cold';
export type LoadLevel = 'low' | 'medium' | 'high';
export type Volatility = 'static' | 'periodic' | 'realtime'; // page data change rate

export interface RequestContext {
  url: string;
  networkSpeed: NetworkSpeed;
  device: DeviceType;
  cacheState: CacheState;
  load: LoadLevel; // derived from concurrent in-flight requests
  volatility: Volatility; // declared per page (see frontend pages)
  /** True when the page payload is large/interactive (rule 7 of the decision table). */
  heavyPayload: boolean;
  isEdge: boolean; // true when served behind an edge node
  rawHeaders: Record<string, string>;
}

export interface RenderResult {
  status: number;
  headers: Record<string, string>; // engine adds X-Rendering-Strategy
  body: string | NodeJS.ReadableStream; // string for buffered, stream for Streaming SSR
  fromCache: boolean;
}

export interface PageModule {
  route: string; // e.g. "/static"
  volatility: Volatility;
  /** Marks a large/interactive page (drives the STREAMING_SSR rule). */
  heavy?: boolean;
  title: string;
  Component: ComponentType<any>;
  getData?: (ctx: RequestContext) => Promise<unknown>;
}

export interface RenderStrategy {
  readonly name: StrategyName;
  /** Render the page for this context. May read/write the provided cache. */
  render(ctx: RequestContext, page: PageModule, cache: CacheManager): Promise<RenderResult>;
}

export interface DecisionTrace {
  // returned with every decision for proof/logging
  selected: StrategyName;
  reason: string; // human-readable rule that fired
  context: RequestContext;
}
