import React from 'react';
import { hydrateRoot, createRoot } from 'react-dom/client';
import staticPage from '../pages/static.js';
import dynamicPage from '../pages/dynamic.js';
import heavyPage from '../pages/heavy.js';
import type { PageModule } from '../../core/types.js';

/**
 * Client entry, bundled by esbuild → public/client.js.
 *
 * The server embeds two globals on the page:
 *   window.__ARE_ROUTE__    — which page to mount
 *   window.__ARE_DATA__     — data (present for SSR/Streaming/ISR hydration; absent for CSR)
 *   window.__ARE_STRATEGY__ — the strategy that produced the page
 *
 * If server markup exists (data present) we hydrate; for pure CSR we fetch data
 * then render into the empty shell.
 */
const pages: Record<string, PageModule> = {
  '/static': staticPage,
  '/dynamic': dynamicPage,
  '/heavy': heavyPage,
};

async function bootstrap() {
  const route = (window as any).__ARE_ROUTE__ as string;
  const strategy = (window as any).__ARE_STRATEGY__ as string | undefined;
  let data = (window as any).__ARE_DATA__;
  const page = pages[route];
  const container = document.getElementById('are-root');
  if (!page || !container) return;

  const isCSR = data == null;
  if (isCSR) {
    // CSR path: fetch the data the server intentionally withheld, then render.
    const res = await fetch(`/api/data?route=${encodeURIComponent(route)}`);
    data = await res.json();
    createRoot(container).render(<page.Component data={data} strategy={strategy} />);
  } else {
    // SSR/Streaming/ISR path: hydrate the server-rendered markup.
    hydrateRoot(container, <page.Component data={data} strategy={strategy} />);
  }
}

void bootstrap();
