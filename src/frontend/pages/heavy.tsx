import React, { Suspense } from 'react';
import { Header } from '../components/header.js';
import { Content } from '../components/content.js';
import type { PageModule } from '../../core/types.js';

/**
 * A deliberately "heavy" section. Wrapped in <Suspense> so Streaming SSR can
 * flush the shell first and stream this part when ready.
 */
function HeavySection({ rows }: { rows: string[] }) {
  return (
    <section>
      <h3>Large data table ({rows.length} rows)</h3>
      <ul>
        {rows.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>
    </section>
  );
}

function HeavyPage({ data, strategy }: { data: any; strategy?: string }) {
  return (
    <div>
      <Header strategy={strategy} />
      <Content title={data.title} body={data.body} generatedAt={data.generatedAt} />
      <Suspense fallback={<p>Loading large section…</p>}>
        <HeavySection rows={data.rows} />
      </Suspense>
    </div>
  );
}

const page: PageModule = {
  route: '/heavy',
  volatility: 'realtime',
  heavy: true,
  title: 'Heavy Page',
  Component: HeavyPage,
  async getData() {
    const rows = Array.from({ length: 400 }, (_, i) => `Row ${i + 1}: value ${Math.floor(Math.random() * 10000)}`);
    return {
      title: 'Heavy Interactive Page',
      body: 'Large payload + interactivity → the engine prefers Streaming SSR on decent links.',
      rows,
      generatedAt: new Date().toISOString(),
    };
  },
};

export default page;
