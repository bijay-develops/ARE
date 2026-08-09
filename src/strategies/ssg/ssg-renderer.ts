import type { CacheManager } from '../../cache/cache-manager.js';
import type {
  PageModule,
  RenderMeta,
  RenderResult,
  RenderStrategy,
  RequestContext,
} from '../../core/types.js';
import { renderSSR } from '../ssr/ssr-renderer.js';
import { readSSG, writeSSG } from './ssg-cache.js';

/**
 * Static Site Generation: serve pre-built HTML from public/ssg.
 * If a page has not been pre-built yet, render once and persist it
 * (build-on-first-request), so subsequent hits are zero-cost reads.
 */
export class SSGStrategy implements RenderStrategy {
  readonly name = 'SSG' as const;

  async render(
    ctx: RequestContext,
    page: PageModule,
    _cache: CacheManager,
    meta?: RenderMeta,
  ): Promise<RenderResult> {
    // NOTE: the prebuilt artifact is byte-identical for every request, so the
    // reason baked into it is the one from prebuild time — not `meta.reason`.
    // That staleness is inherent to SSG; the live reason still ships as a header.
    const prebuilt = await readSSG(page.route);
    if (prebuilt) {
      return {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8', 'x-ssg': 'prebuilt' },
        body: prebuilt,
        fromCache: true,
      };
    }
    const { html } = await renderSSR(ctx, page, this.name, meta);
    await writeSSG(page.route, html);
    return {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8', 'x-ssg': 'built-on-demand' },
      body: html,
      fromCache: false,
    };
  }
}
