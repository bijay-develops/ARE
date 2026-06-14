import type { RenderStrategy, StrategyName } from './types.js';

/**
 * Holds the pluggable rendering strategies. Each strategy implements the same
 * RenderStrategy interface and is registered here at startup.
 */
export class StrategyRegistry {
  private readonly strategies = new Map<StrategyName, RenderStrategy>();

  register(strategy: RenderStrategy): this {
    this.strategies.set(strategy.name, strategy);
    return this;
  }

  get(name: StrategyName): RenderStrategy {
    const strategy = this.strategies.get(name);
    if (!strategy) {
      throw new Error(`No rendering strategy registered for "${name}"`);
    }
    return strategy;
  }

  has(name: StrategyName): boolean {
    return this.strategies.has(name);
  }

  list(): StrategyName[] {
    return [...this.strategies.keys()];
  }
}
