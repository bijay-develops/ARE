/**
 * Tiny in-process load generator (complements Apache Bench). Fires N concurrent
 * requests at a URL and reports basic timing. Use: `tsx src/simulation/traffic-simulator.ts <url> <n> <concurrency>`.
 */
export async function generateTraffic(url: string, total: number, concurrency: number): Promise<void> {
  let done = 0;
  const started = Date.now();
  async function worker() {
    while (done < total) {
      done++;
      try {
        await fetch(url);
      } catch {
        /* ignore individual failures */
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const ms = Date.now() - started;
  console.log(`[traffic] ${total} requests, concurrency ${concurrency}, ${ms}ms, ${Math.round((total / ms) * 1000)} req/s`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [url = 'http://localhost:3000/dynamic', n = '200', c = '20'] = process.argv.slice(2);
  void generateTraffic(url, Number(n), Number(c));
}
