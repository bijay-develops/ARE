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

/**
 * Query-string aliases for the X-* control headers. Browsers cannot set custom
 * headers on a normal navigation, so these let a plain link or reload trigger a
 * different strategy — which is what makes the in-page controls work.
 */
export const QUERY_ALIASES = {
  'x-network-speed': 'net',
  'x-device-type': 'device',
  'x-cache-state': 'cache',
  'x-load-level': 'load',
  'x-data-volatility': 'volatility',
  'x-data-size': 'size',
  'x-served-by': 'served',
} as const;

function header(headers: Record<string, string>, name: string): string | undefined {
  return headers[name.toLowerCase()];
}

export function queryParams(url: string): URLSearchParams {
  return new URL(url, 'http://localhost').searchParams;
}

/**
 * Resolve one control signal. Precedence: header > query > undefined.
 * Headers remain the documented control surface (doc 5); the query string is
 * the browser-usable layer over the same values.
 */
function override(
  headers: Record<string, string>,
  query: URLSearchParams,
  headerName: keyof typeof QUERY_ALIASES,
): string | undefined {
  return header(headers, headerName) ?? query.get(QUERY_ALIASES[headerName]) ?? undefined;
}

/** Resolve a signal constrained to a fixed set of values, else undefined. */
function oneOf<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
): T | undefined {
  return allowed.includes(value as T) ? (value as T) : undefined;
}

function classifyLoad(concurrency: number): LoadLevel {
  if (concurrency >= THRESHOLDS.HIGH_LOAD_CONCURRENCY) return 'high';
  if (concurrency >= THRESHOLDS.MEDIUM_LOAD_CONCURRENCY) return 'medium';
  return 'low';
}

function inferDevice(headers: Record<string, string>): DeviceType {
  const ua = (header(headers, 'user-agent') ?? '').toLowerCase();
  return /mobi|android|iphone|ipad/.test(ua) ? 'mobile' : 'desktop';
}

/**
 * Builds a fully-populated RequestContext. OBSERVATION ONLY — no rendering,
 * no strategy decision. Control headers (doc 5) and their query aliases
 * override inference.
 */
export function analyze(
  url: string,
  headers: Record<string, string>,
  page: PageModule,
  signals: ServerSignals,
): RequestContext {
  const query = queryParams(url);
  const pick = (name: keyof typeof QUERY_ALIASES) => override(headers, query, name);

  const size = pick('x-data-size');
  const servedBy = pick('x-served-by');

  return {
    url,
    networkSpeed:
      oneOf<NetworkSpeed>(pick('x-network-speed'), ['slow', 'medium', 'fast']) ?? 'medium',
    device: oneOf<DeviceType>(pick('x-device-type'), ['mobile', 'desktop']) ?? inferDevice(headers),
    cacheState:
      oneOf<CacheState>(pick('x-cache-state'), ['fresh', 'stale', 'cold']) ?? signals.cacheState,
    load: oneOf<LoadLevel>(pick('x-load-level'), ['low', 'medium', 'high']) ??
      classifyLoad(signals.concurrency),
    volatility:
      oneOf<Volatility>(pick('x-data-volatility'), ['static', 'periodic', 'realtime']) ??
      page.volatility,
    heavyPayload: size ? size.toLowerCase() === 'heavy' : page.heavy === true,
    isEdge: Boolean(servedBy && servedBy !== 'origin'),
    rawHeaders: headers,
  };
}
