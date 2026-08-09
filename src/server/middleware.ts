import type { IncomingMessage } from 'node:http';

/** Normalise Node's raw header bag into a flat lowercase string map. */
export function normalizeHeaders(req: IncomingMessage): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined) continue;
    out[k.toLowerCase()] = Array.isArray(v) ? v.join(',') : v;
  }
  return out;
}

/** Parse the pathname (ignoring query) from a request URL. */
export function pathnameOf(req: IncomingMessage): string {
  const url = new URL(req.url ?? '/', 'http://localhost');
  return url.pathname;
}

export function queryOf(req: IncomingMessage): URLSearchParams {
  return new URL(req.url ?? '/', 'http://localhost').searchParams;
}
