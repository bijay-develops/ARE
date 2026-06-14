import { allPages } from '../src/server/router.js';
import { renderSSR } from '../src/strategies/ssr/ssr-renderer.js';
import { writeSSG } from '../src/strategies/ssg/ssg-cache.js';
import type { RequestContext, PageModule } from '../src/core/types.js';

function ctx(page: PageModule): RequestContext {
  return {
    url: page.route,
    networkSpeed: 'fast',
    device: 'desktop',
    cacheState: 'cold',
    load: 'low',
    volatility: page.volatility,
    heavyPayload: page.heavy === true,
    isEdge: false,
    rawHeaders: {},
  };
}

/** Pre-render every static-volatility page to public/ssg. */
async function main() {
  for (const page of allPages()) {
    if (page.volatility === 'static') {
      const { html } = await renderSSR(ctx(page), page, 'SSG');
      await writeSSG(page.route, html);
      console.log(`[build:ssg] ${page.route}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
