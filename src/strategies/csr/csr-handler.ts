import type { CacheManager } from '../../cache/cache-manager.js';
import type { PageModule, RenderResult, RenderStrategy, RequestContext } from '../../core/types.js';
import { htmlShell } from '../../utils/helpers.js';

/**
 * Client-Side Rendering: send a minimal shell with NO data and NO server markup.
 * The client bundle fetches data from /api/data and renders in the browser.
 * Best for capable clients on fast networks where interactivity matters most.
 */
export class CSRStrategy implements RenderStrategy {
  readonly name = 'CSR' as const;

  async render(_ctx: RequestContext, page: PageModule, _cache: CacheManager): Promise<RenderResult> {
    const html = htmlShell({
      title: page.title,
      route: page.route,
      strategy: this.name,
      bodyHtml: '', // empty shell — client renders everything
      data: null, // withhold data → client fetches it
      includeClient: true,
    });
    return {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8', 'x-csr': 'shell' },
      body: html,
      fromCache: false,
    };
  }
}
