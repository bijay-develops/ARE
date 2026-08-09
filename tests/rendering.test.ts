import { describe, expect, it } from 'vitest';
import { CacheManager } from '../src/cache/cache-manager.js';
import { SSRStrategy } from '../src/strategies/ssr/ssr-handler.js';
import { CSRStrategy } from '../src/strategies/csr/csr-handler.js';
import dynamicPage from '../src/frontend/pages/dynamic.js';
import type { RequestContext } from '../src/core/types.js';

function ctx(): RequestContext {
  return {
    url: '/dynamic',
    networkSpeed: 'fast',
    device: 'desktop',
    cacheState: 'cold',
    load: 'low',
    volatility: 'realtime',
    heavyPayload: false,
    isEdge: false,
    rawHeaders: {},
  };
}

const cache = new CacheManager({ cacheDir: '/tmp/are-test-cache', redisUrl: null, defaultTtlMs: 1000 });

describe('rendering strategies', () => {
  it('SSR returns full HTML with embedded data for hydration', async () => {
    const res = await new SSRStrategy().render(ctx(), dynamicPage, cache);
    const html = res.body as string;
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('id="are-root"');
    expect(html).toContain('Live Dashboard');
    expect(html).toMatch(/__ARE_DATA__=\{/); // data embedded
    expect(html).toContain('/client.js');
  });

  it('CSR returns an empty shell and withholds data (client fetches it)', async () => {
    const res = await new CSRStrategy().render(ctx(), dynamicPage, cache);
    const html = res.body as string;
    expect(html).toContain('id="are-root"></div>'); // empty root
    expect(html).toContain('__ARE_DATA__=null'); // withheld
    expect(html).toContain('/client.js');
  });
});
