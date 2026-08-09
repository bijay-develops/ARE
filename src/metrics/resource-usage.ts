import os from 'node:os';

export interface ResourceSample {
  rssMb: number;
  heapUsedMb: number;
  /** Process CPU time (user+system) in ms since process start. */
  cpuMs: number;
  loadAvg1m: number;
}

const mb = (bytes: number) => Math.round((bytes / 1024 / 1024) * 100) / 100;

export function sampleResources(): ResourceSample {
  const mem = process.memoryUsage();
  const cpu = process.cpuUsage();
  return {
    rssMb: mb(mem.rss),
    heapUsedMb: mb(mem.heapUsed),
    cpuMs: Math.round((cpu.user + cpu.system) / 1000),
    loadAvg1m: Math.round(os.loadavg()[0] * 100) / 100,
  };
}
