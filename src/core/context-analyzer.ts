import type {
  CacheState,
  DeviceType,
  LoadLevel,
  NetworkSpeed,
  PageModule,
  RequestContext,
  Volatility,
} from './types.js';
import { THRESHOLDS } from '../config/thresholds.js';

/** Signals the server provides that are not derivable from the request alone. */
export interface ServerSignals {
  /** Number of requests currently in flight (used to classify load). */
  concurrency: number;
  /** Cache state for the resolved page key, looked up before analysis. */
  cacheState: CacheState;
}

function header(headers: Record<string, string>, name: string): string | undefined {
  return headers[name.toLowerCase()];
}

function classifyLoad(concurrency: number): LoadLevel {
  if (concurrency >= THRESHOLDS.HIGH_LOAD_CONCURRENCY) return 'high';
  if (concurrency >= THRESHOLDS.MEDIUM_LOAD_CONCURRENCY) return 'medium';
  return 'low';
}

function inferDevice(headers: Record<string, string>): DeviceType {
  const explicit = header(headers, 'x-device-type');
  if (explicit === 'mobile' || explicit === 'desktop') return explicit;
  const ua = (header(headers, 'user-agent') ?? '').toLowerCase();
  return /mobi|android|iphone|ipad/.test(ua) ? 'mobile' : 'desktop';
}

function inferNetwork(headers: Record<string, string>): NetworkSpeed {
  const explicit = header(headers, 'x-network-speed');
  if (explicit === 'slow' || explicit === 'medium' || explicit === 'fast') return explicit;
  return 'medium';
}

function inferVolatility(
  headers: Record<string, string>,
  page: PageModule,
): Volatility {
  const explicit = header(headers, 'x-data-volatility');
  if (explicit === 'static' || explicit === 'periodic' || explicit === 'realtime') return explicit;
  return page.volatility;
}

function inferHeavy(headers: Record<string, string>, page: PageModule): boolean {
  const explicit = header(headers, 'x-data-size');
  if (explicit) return explicit.toLowerCase() === 'heavy';
  return page.heavy === true;
}

/**
 * Builds a fully-populated RequestContext. OBSERVATION ONLY — no rendering,
 * no strategy decision. Control headers (doc 5) override inference.
 */
export function analyze(
  url: string,
  headers: Record<string, string>,
  page: PageModule,
  signals: ServerSignals,
): RequestContext {
  const explicitCache = header(headers, 'x-cache-state');
  const cacheState: CacheState =
    explicitCache === 'fresh' || explicitCache === 'stale' || explicitCache === 'cold'
      ? explicitCache
      : signals.cacheState;

  const explicitLoad = header(headers, 'x-load-level');
  const load: LoadLevel =
    explicitLoad === 'low' || explicitLoad === 'medium' || explicitLoad === 'high'
      ? explicitLoad
      : classifyLoad(signals.concurrency);

  const servedBy = header(headers, 'x-served-by');

  return {
    url,
    networkSpeed: inferNetwork(headers),
    device: inferDevice(headers),
    cacheState,
    load,
    volatility: inferVolatility(headers, page),
    heavyPayload: inferHeavy(headers, page),
    isEdge: Boolean(servedBy && servedBy !== 'origin'),
    rawHeaders: headers,
  };
}
