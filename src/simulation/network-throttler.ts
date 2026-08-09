import type { NetworkSpeed } from '../core/types.js';
import { THRESHOLDS } from '../config/thresholds.js';

/** Artificial server-side delay (ms) modelling the requested network speed. */
export function delayForNetwork(speed: NetworkSpeed): number {
  return THRESHOLDS.NETWORK_DELAY_MS[speed] ?? 0;
}

export function sleep(ms: number): Promise<void> {
  return ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve();
}
