import type { CacheManager } from '../../cache/cache-manager.js';
import type {
  PageModule,
  RenderMeta,
  RenderResult,
  RenderStrategy,
  RequestContext,
} from '../../core/types.js';
import { renderSSR } from './ssr-renderer.js';

/** Server-Side Rendering: fresh HTML every request, no cache. */
export class SSRStrategy implements RenderStrategy {
  readonly name = 'SSR' as const;

  async render(
    ctx: RequestContext,
    page: PageModule,
    _cache: CacheManager,
    meta?: RenderMeta,
  ): Promise<RenderResult> {
    const { html, bytes } = await renderSSR(ctx, page, this.name, meta);
    return {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8', 'x-render-bytes': String(bytes) },
      body: html,
      fromCache: false,
    };
  }
}
