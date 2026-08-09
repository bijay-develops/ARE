import React from 'react';
import { Header } from '../components/header.js';
import { Content } from '../components/content.js';
import type { PageModule } from '../../core/types.js';

function StaticPage({ data, strategy }: { data: any; strategy?: string }) {
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
  route: '/static',
  volatility: 'static',
  heavy: false,
  title: 'Static Page',
  Component: StaticPage,
  async getData() {
    return {
      title: 'About this Engine (Static)',
      body: 'This page rarely changes, so the engine prefers SSG / Edge-ISR.',
      items: ['Zero per-request render cost', 'Cache-friendly', 'Ideal for docs/marketing'],
      generatedAt: new Date().toISOString(),
    };
  },
};

export default page;
