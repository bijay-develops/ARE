import type { PageModule, StrategyName } from '../../core/types.js';
import { ISRStrategy } from '../isr/isr-renderer.js';
import { edgeKey } from './edge-cache.js';

/**
 * Edge-ISR: ISR semantics, but the cache key is namespaced per edge node and
 * (when Redis is configured) shared across edges. Demonstrates short-TTL static
 * content served close to the user. Reuses the ISR stale-while-revalidate logic.
 */
export class EdgeISRStrategy extends ISRStrategy {
  override readonly name: StrategyName = 'EDGE_ISR';

  protected override key(page: PageModule): string {
    return edgeKey(page.route);
  }
}
