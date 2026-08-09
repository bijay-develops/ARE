import type { DecisionTrace, RequestContext } from './types.js';
import { STRATEGY_RULES } from '../config/strategy-rules.js';

/**
 * Pure, deterministic, I/O-free strategy selection.
 * Evaluates STRATEGY_RULES top-to-bottom and returns the first match.
 * The rule table ends with an unconditional fallback, so this never throws.
 */
export function decide(ctx: RequestContext): DecisionTrace {
  for (const rule of STRATEGY_RULES) {
    if (rule.test(ctx)) {
      return { selected: rule.strategy, reason: rule.reason, context: ctx };
    }
  }
  // Unreachable given the fallback rule, but typed-safe.
  return { selected: 'SSR', reason: 'Fallback (no rule matched)', context: ctx };
}
