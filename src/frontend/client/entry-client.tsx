import React from 'react';
import { hydrateRoot, createRoot } from 'react-dom/client';
import staticPage from '../pages/static.js';
import dynamicPage from '../pages/dynamic.js';
import heavyPage from '../pages/heavy.js';
import type { PageModule, PublicContext } from '../../core/types.js';

/**
 * Client entry, bundled by esbuild → public/client.js.
 *
 * The server embeds these globals on the page:
 *   window.__ARE_ROUTE__    — which page to mount
 *   window.__ARE_DATA__     — data (present for SSR/Streaming/ISR hydration; absent for CSR)
 *   window.__ARE_STRATEGY__ — the strategy that produced the page
 *   window.__ARE_REASON__   — the decision rule that fired
 *   window.__ARE_CONTEXT__  — what the engine observed about this request
 *
 * If server markup exists (data present) we hydrate; for pure CSR we fetch data
 * then render into the empty shell. Both paths must pass the SAME props the
 * server rendered with, or hydration mismatches.
 */
const pages: Record<string, PageModule> = {
  '/static': staticPage,
  '/dynamic': dynamicPage,
  '/heavy': heavyPage,
};

async function bootstrap() {
  const w = window as any;
  const route = w.__ARE_ROUTE__ as string;
  const strategy = w.__ARE_STRATEGY__ as string | undefined;
  const reason = (w.__ARE_REASON__ ?? undefined) as string | undefined;
  const context = (w.__ARE_CONTEXT__ ?? undefined) as PublicContext | undefined;
  let data = w.__ARE_DATA__;
  const page = pages[route];
  const container = document.getElementById('are-root');
  if (!page || !container) return;

  const isCSR = data == null;
  if (isCSR) {
    // CSR path: fetch the data the server intentionally withheld, then render.
    const res = await fetch(`/api/data?route=${encodeURIComponent(route)}`);
    data = await res.json();
    createRoot(container).render(
      <page.Component data={data} strategy={strategy} reason={reason} context={context} />,
    );
  } else {
    // SSR/Streaming/ISR path: hydrate the server-rendered markup.
    hydrateRoot(
      container,
      <page.Component data={data} strategy={strategy} reason={reason} context={context} />,
    );
  }
}

void bootstrap();
