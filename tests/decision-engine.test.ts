import { describe, expect, it } from 'vitest';
import { decide } from '../src/core/decision-engine.js';
import type { RequestContext } from '../src/core/types.js';

/** Build a context with sensible defaults, overriding only what a test cares about. */
function ctx(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    url: '/page',
    networkSpeed: 'medium',
    device: 'desktop',
    cacheState: 'fresh',
    load: 'low',
    volatility: 'periodic',
    heavyPayload: false,
    isEdge: false,
    rawHeaders: {},
    ...overrides,
  };
}

describe('decision-engine: one assertion per rule row (§7.5)', () => {
  it('rule 1: static + usable cache → SSG', () => {
    expect(decide(ctx({ volatility: 'static', cacheState: 'fresh' })).selected).toBe('SSG');
    expect(decide(ctx({ volatility: 'static', cacheState: 'stale' })).selected).toBe('SSG');
  });

  it('rule 2: static + cold cache at edge → EDGE_ISR', () => {
    expect(
      decide(ctx({ volatility: 'static', cacheState: 'cold', isEdge: true })).selected,
    ).toBe('EDGE_ISR');
  });

  it('rule 3: high load → ISR (regardless of other realtime signals)', () => {
    expect(
      decide(ctx({ load: 'high', volatility: 'realtime', networkSpeed: 'fast', device: 'desktop' }))
        .selected,
    ).toBe('ISR');
  });

  it('rule 4: realtime + fast + desktop → CSR', () => {
    expect(
      decide(ctx({ volatility: 'realtime', networkSpeed: 'fast', device: 'desktop' })).selected,
    ).toBe('CSR');
  });

  it('rule 5: realtime + mobile → SSR', () => {
    expect(
      decide(ctx({ volatility: 'realtime', device: 'mobile', networkSpeed: 'fast' })).selected,
    ).toBe('SSR');
  });

  it('rule 6: periodic → ISR', () => {
    expect(decide(ctx({ volatility: 'periodic' })).selected).toBe('ISR');
  });

  it('rule 7: heavy payload on non-slow link → STREAMING_SSR', () => {
    expect(
      decide(ctx({ volatility: 'realtime', device: 'desktop', networkSpeed: 'medium', heavyPayload: true }))
        .selected,
    ).toBe('STREAMING_SSR');
  });

  it('rule 8: slow network → SSR', () => {
    expect(
      decide(ctx({ volatility: 'realtime', device: 'desktop', networkSpeed: 'slow', heavyPayload: true }))
        .selected,
    ).toBe('SSR');
  });

  it('rule 9: fallback → SSR', () => {
    // realtime + medium network + desktop + not heavy + low load matches nothing above
    expect(
      decide(ctx({ volatility: 'realtime', device: 'desktop', networkSpeed: 'medium', heavyPayload: false }))
        .selected,
    ).toBe('SSR');
  });

  it('always returns a reason and echoes the context', () => {
    const trace = decide(ctx());
    expect(trace.reason).toBeTruthy();
    expect(trace.context).toBeDefined();
  });
});
