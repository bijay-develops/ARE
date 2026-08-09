import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { MetricRecord } from './metrics-collector.js';

interface Aggregate {
  strategy: string;
  count: number;
  avgTtfbMs: number;
  avgRenderMs: number;
  avgTotalMs: number;
  cacheHitRate: number;
  avgBytes: number;
}

/** Read the NDJSON metrics log and produce per-strategy aggregates (JSON + CSV). */
export async function generateReport(metricsDir: string, outDir: string): Promise<Aggregate[]> {
  const file = path.join(metricsDir, 'metrics.ndjson');
  let lines: string[] = [];
  try {
    lines = (await fs.readFile(file, 'utf8')).trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
  const records = lines.map((l) => JSON.parse(l) as MetricRecord);

  const byStrategy = new Map<string, MetricRecord[]>();
  for (const r of records) {
    const arr = byStrategy.get(r.strategy) ?? [];
    arr.push(r);
    byStrategy.set(r.strategy, arr);
  }

  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const round = (n: number) => Math.round(n * 100) / 100;

  const aggregates: Aggregate[] = [...byStrategy.entries()].map(([strategy, rs]) => ({
    strategy,
    count: rs.length,
    avgTtfbMs: round(avg(rs.map((r) => r.ttfbMs))),
    avgRenderMs: round(avg(rs.map((r) => r.renderMs))),
    avgTotalMs: round(avg(rs.map((r) => r.totalMs))),
    cacheHitRate: round(rs.filter((r) => r.fromCache).length / rs.length),
    avgBytes: Math.round(avg(rs.map((r) => r.bytes))),
  }));

  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, 'report.json'), JSON.stringify(aggregates, null, 2), 'utf8');

  const header = 'strategy,count,avgTtfbMs,avgRenderMs,avgTotalMs,cacheHitRate,avgBytes';
  const csv = [header, ...aggregates.map((a) =>
    [a.strategy, a.count, a.avgTtfbMs, a.avgRenderMs, a.avgTotalMs, a.cacheHitRate, a.avgBytes].join(','),
  )].join('\n');
  await fs.writeFile(path.join(outDir, 'report.csv'), csv, 'utf8');

  return aggregates;
}
