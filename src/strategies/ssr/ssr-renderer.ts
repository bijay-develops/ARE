import React from 'react';
import { renderToString } from 'react-dom/server';
import type { PageModule, RequestContext } from '../../core/types.js';
import { htmlShell } from '../../utils/helpers.js';

/** Render a page to a complete HTML string on the server (per request). */
export async function renderSSR(
  ctx: RequestContext,
  page: PageModule,
  strategy: string,
): Promise<{ html: string; bytes: number; data: unknown }> {
  const data = page.getData ? await page.getData(ctx) : {};
  const bodyHtml = renderToString(React.createElement(page.Component, { data, strategy }));
  const html = htmlShell({
    title: page.title,
    route: page.route,
    strategy,
    bodyHtml,
    data, // embed for hydration
    includeClient: true,
  });
  return { html, bytes: Buffer.byteLength(html), data };
}
