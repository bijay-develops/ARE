import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { StrategyName } from '../core/types.js';
import { sampleResources, type ResourceSample } from './resource-usage.js';

export interface MetricRecord {
  ts: string;
  url: string;
  strategy: StrategyName;
  reason: string;
  ttfbMs: number; // time to first byte (server-side render-to-send)
  renderMs: number; // pure render duration
  totalMs: number;
  fromCache: boolean;
  bytes: number;
  network: string;
  device: string;
  load: string;
  isEdge: boolean;
  resources: ResourceSample;
}

/**
 * Collects per-request metrics in memory and appends them to a newline-delimited
 * JSON file (NDJSON) under METRICS_DIR. report-generator.ts aggregates these.
 */
export class MetricsCollector {
  private readonly buffer: MetricRecord[] = [];

  constructor(private readonly dir: string) {}

  async record(rec: Omit<MetricRecord, 'ts' | 'resources'>): Promise<void> {
    const full: MetricRecord = {
      ...rec,
      ts: new Date().toISOString(),
      resources: sampleResources(),
    };
    this.buffer.push(full);
    try {
      await fs.mkdir(this.dir, { recursive: true });
      await fs.appendFile(path.join(this.dir, 'metrics.ndjson'), JSON.stringify(full) + '\n', 'utf8');
    } catch {
      /* never let metrics I/O break a response */
    }
  }

  all(): MetricRecord[] {
    return [...this.buffer];
  }
}
