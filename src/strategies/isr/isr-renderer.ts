import type { CacheManager } from '../../cache/cache-manager.js';
import type {
  PageModule,
  RenderResult,
  RenderStrategy,
  RequestContext,
  StrategyName,
} from '../../core/types.js';
import { renderSSR } from '../ssr/ssr-renderer.js';
import { revalidateInBackground } from './revalidation.js';

/**
 * Incremental Static Regeneration (stale-while-revalidate):
 *   - fresh cache  → serve cached (fromCache=true)
 *   - stale cache  → serve cached immediately, revalidate in background
 *   - cold cache   → render now, cache, serve
 */
export class ISRStrategy implements RenderStrategy {
  readonly name: StrategyName = 'ISR';
  protected cacheKeyPrefix = 'isr';

  protected key(page: PageModule): string {
    return `${this.cacheKeyPrefix}:${page.route}`;
  }

  async render(ctx: RequestContext, page: PageModule, cache: CacheManager): Promise<RenderResult> {
    const key = this.key(page);
    const lookup = await cache.lookup(key);

    const produce = async () => (await renderSSR(ctx, page, this.name)).html;

    if (lookup.entry && !lookup.stale) {
      return this.result(lookup.entry.value, true, 'fresh');
    }

    if (lookup.entry && lookup.stale) {
      // serve stale, refresh in the background
      void revalidateInBackground(key, cache, produce, cache.defaultTtlMs);
      return this.result(lookup.entry.value, true, 'stale-revalidating');
    }

    // cold: render now and cache
    const html = await produce();
    await cache.set(key, html, cache.defaultTtlMs);
    return this.result(html, false, 'miss');
  }

  protected result(html: string, fromCache: boolean, state: string): RenderResult {
    return {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'x-isr-cache': state,
      },
      body: html,
      fromCache,
    };
  }
}
