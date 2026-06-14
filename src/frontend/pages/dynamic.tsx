import React from 'react';
import { Header } from '../components/header.js';
import { Content } from '../components/content.js';
import type { PageModule } from '../../core/types.js';

function DynamicPage({ data, strategy }: { data: any; strategy?: string }) {
  return (
    <div>
      <Header strategy={strategy} />
      <Content
        title={data.title}
        body={data.body}
        items={data.items}
        generatedAt={data.generatedAt}
      />
    </div>
  );
}

const page: PageModule = {
  route: '/dynamic',
  volatility: 'realtime',
  heavy: false,
  title: 'Dynamic Page',
  Component: DynamicPage,
  async getData() {
    return {
      title: 'Live Dashboard (Dynamic)',
      body: 'Data changes constantly, so the engine adapts: CSR on capable clients, SSR on weak ones, ISR under load.',
      items: [`Server time: ${new Date().toLocaleTimeString()}`, `Random metric: ${Math.floor(Math.random() * 1000)}`],
      generatedAt: new Date().toISOString(),
    };
  },
};

export default page;
