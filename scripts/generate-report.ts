import path from 'node:path';
import { generateReport } from '../src/metrics/report-generator.js';
import { config } from '../src/config/engine.config.js';

/** Aggregate collected metrics into experiments/results (report.json + report.csv). */
async function main() {
  const outDir = path.resolve('experiments/results');
  const aggregates = await generateReport(config.metricsDir, outDir);
  if (aggregates.length === 0) {
    console.log('[report] no metrics yet — run some requests first.');
    return;
  }
  console.table(aggregates);
  console.log(`[report] wrote ${outDir}/report.json and report.csv`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
