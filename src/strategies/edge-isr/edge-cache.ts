import { config } from '../../config/engine.config.js';

/** Namespaces an ISR cache key to the current edge node (from SERVED_BY). */
export function edgeKey(route: string): string {
  const node = config.servedBy ?? 'edge';
  return `edge-isr:${node}:${route}`;
}
