import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  CacheState,
  DeviceType,
  LoadLevel,
  NetworkSpeed,
  PublicContext,
  RequestContext,
  Volatility,
} from '../../core/types.js';
import { STRATEGY_RULES } from '../../config/strategy-rules.js';
import { QUERY_ALIASES } from '../../core/context-analyzer.js';

/**
 * The in-page decision console.
 *
 * Reuses the engine's own rule table (STRATEGY_RULES) rather than restating it,
 * so what the page shows can never drift from what the server does. The rules
 * are pure predicates over a context, which makes them safe to evaluate in the
 * browser against a *simulated* context — that is the "predicted" strategy.
 * Every prediction is then confirmed against the real server via a probe fetch.
 *
 * HYDRATION CONTRACT: the first render must depend only on props. Anything that
 * touches window/Date/performance is gated behind `mounted`, which starts false
 * on both the server and the client and only flips inside an effect.
 */

const NETWORKS: NetworkSpeed[] = ['slow', 'medium', 'fast'];
const DEVICES: DeviceType[] = ['mobile', 'desktop'];
const CACHES: CacheState[] = ['fresh', 'stale', 'cold'];
const LOADS: LoadLevel[] = ['low', 'medium', 'high'];
const VOLATILITIES: Volatility[] = ['static', 'periodic', 'realtime'];

export interface Sim {
  net: NetworkSpeed;
  device: DeviceType;
  cache: CacheState;
  load: LoadLevel;
  volatility: Volatility;
  heavy: boolean;
  edge: boolean;
}

function simFromContext(ctx: PublicContext | undefined, route: string): Sim {
  return {
    net: ctx?.networkSpeed ?? 'medium',
    device: ctx?.device ?? 'desktop',
    cache: ctx?.cacheState ?? 'cold',
    load: ctx?.load ?? 'low',
    volatility: ctx?.volatility ?? 'static',
    heavy: ctx?.heavyPayload ?? route === '/heavy',
    edge: ctx?.isEdge ?? false,
  };
}

/** Shape a Sim into the RequestContext the real rule predicates expect. */
function simToContext(sim: Sim, route: string): RequestContext {
  return {
    url: route,
    networkSpeed: sim.net,
    device: sim.device,
    cacheState: sim.cache,
    load: sim.load,
    volatility: sim.volatility,
    heavyPayload: sim.heavy,
    isEdge: sim.edge,
    rawHeaders: {},
  };
}

/** Index of the first rule that matches — i.e. the one that would fire. */
function matchingRuleIndex(ctx: RequestContext): number {
  return STRATEGY_RULES.findIndex((rule) => rule.test(ctx));
}

/** Control headers equivalent to a Sim, for probe requests. */
function simToHeaders(sim: Sim): Record<string, string> {
  return {
    'X-Network-Speed': sim.net,
    'X-Device-Type': sim.device,
    'X-Cache-State': sim.cache,
    'X-Load-Level': sim.load,
    'X-Data-Volatility': sim.volatility,
    'X-Data-Size': sim.heavy ? 'heavy' : 'light',
  };
}

/** The same Sim as a query string, for a real navigation (§2 of the plan). */
export function simToQuery(sim: Sim): string {
  const q = new URLSearchParams({
    [QUERY_ALIASES['x-network-speed']]: sim.net,
    [QUERY_ALIASES['x-device-type']]: sim.device,
    [QUERY_ALIASES['x-cache-state']]: sim.cache,
    [QUERY_ALIASES['x-load-level']]: sim.load,
    [QUERY_ALIASES['x-data-volatility']]: sim.volatility,
    [QUERY_ALIASES['x-data-size']]: sim.heavy ? 'heavy' : 'light',
  });
  return q.toString();
}

/**
 * Renders a timestamp without breaking hydration. `toLocaleTimeString()` is
 * timezone- and locale-dependent, so the server (UTC in the container) and the
 * browser produce different strings for the same instant. Render the stable UTC
 * form first and localise only after mount.
 */
export function LocalTime({ iso }: { iso: string }) {
  const [local, setLocal] = useState<string | null>(null);
  useEffect(() => setLocal(new Date(iso).toLocaleTimeString()), [iso]);
  return <>{local ?? `${iso.slice(11, 19)} UTC`}</>;
}

export function StrategyBadge({ name, large }: { name?: string; large?: boolean }) {
  const label = name ?? 'unknown';
  return <span className={`badge s-${label}${large ? ' badge-lg' : ''}`}>{label}</span>;
}

interface HistoryEntry {
  at: string;
  strategy: string;
  reason: string;
}

export interface StrategyConsoleProps {
  route: string;
  strategy?: string;
  reason?: string;
  context?: PublicContext;
  /** Extra note rendered under the header (e.g. the SSG staleness caveat). */
  note?: React.ReactNode;
}

export function StrategyConsole({ route, strategy, reason, context, note }: StrategyConsoleProps) {
  const [mounted, setMounted] = useState(false);
  const [sim, setSim] = useState<Sim>(() => simFromContext(context, route));
  const [probe, setProbe] = useState<{ strategy: string; reason: string } | null>(null);
  const [probing, setProbing] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => setMounted(true), []);

  // Local prediction: run the engine's real rules against the simulated context.
  const predictedIndex = useMemo(() => matchingRuleIndex(simToContext(sim, route)), [sim, route]);
  const predicted = STRATEGY_RULES[predictedIndex];

  const runProbe = useCallback(async () => {
    setProbing(true);
    try {
      const res = await fetch(route, { headers: simToHeaders(sim), cache: 'no-store' });
      const got = {
        strategy: res.headers.get('X-Rendering-Strategy') ?? 'unknown',
        reason: res.headers.get('X-Decision-Reason') ?? 'n/a',
      };
      setProbe(got);
      setHistory((h) =>
        [{ at: new Date().toLocaleTimeString(), ...got }, ...h].slice(0, 12),
      );
    } catch {
      setProbe({ strategy: 'unreachable', reason: 'probe failed' });
    } finally {
      setProbing(false);
    }
  }, [route, sim]);

  // Confirm every simulated change against the real server.
  useEffect(() => {
    if (!mounted) return;
    const t = setTimeout(runProbe, 180); // debounce rapid dropdown changes
    return () => clearTimeout(t);
  }, [mounted, runProbe]);

  const applyAndReload = () => {
    window.location.assign(`${route}?${simToQuery(sim)}`);
  };

  const set = <K extends keyof Sim>(key: K) => (value: Sim[K]) =>
    setSim((s) => ({ ...s, [key]: value }));

  // Prediction vs reality. They can legitimately differ: SSG serves a prebuilt
  // artifact, so /static answers from disk regardless of the simulated context.
  const disagrees = probe && predicted && probe.strategy !== predicted.strategy;

  return (
    <section className="panel">
      <div className="panel-title">
        <h2>Decision console</h2>
        <span className={`pill ${mounted ? 'live' : 'idle'}`}>
          {mounted ? 'hydrated ✓ interactive' : 'server-rendered — not yet hydrated'}
        </span>
      </div>

      <div className="are-strategy-row">
        <StrategyBadge name={strategy} large />
        <span className="hint">rendered this page</span>
      </div>
      <p className="hint">
        <b>Rule that fired:</b> {reason ?? 'not reported'}
      </p>
      {note}

      <h3 style={{ marginTop: 18 }}>What the engine observed</h3>
      <div className="ctx-grid">
        <div className="ctx-item"><span>Network</span><b>{context?.networkSpeed ?? '?'}</b></div>
        <div className="ctx-item"><span>Device</span><b>{context?.device ?? '?'}</b></div>
        <div className="ctx-item"><span>Cache</span><b>{context?.cacheState ?? '?'}</b></div>
        <div className="ctx-item"><span>Load</span><b>{context?.load ?? '?'}</b></div>
        <div className="ctx-item"><span>Volatility</span><b>{context?.volatility ?? '?'}</b></div>
        <div className="ctx-item"><span>Heavy</span><b>{String(context?.heavyPayload ?? false)}</b></div>
        <div className="ctx-item"><span>Edge</span><b>{String(context?.isEdge ?? false)}</b></div>
      </div>

      <h3 style={{ marginTop: 18 }}>Re-trigger the engine</h3>
      <div className="controls">
        <div className="control">
          <label htmlFor="sc-net">Network</label>
          <select id="sc-net" value={sim.net} onChange={(e) => set('net')(e.target.value as NetworkSpeed)}>
            {NETWORKS.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div className="control">
          <label htmlFor="sc-device">Device</label>
          <select id="sc-device" value={sim.device} onChange={(e) => set('device')(e.target.value as DeviceType)}>
            {DEVICES.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div className="control">
          <label htmlFor="sc-cache">Cache state</label>
          <select id="sc-cache" value={sim.cache} onChange={(e) => set('cache')(e.target.value as CacheState)}>
            {CACHES.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div className="control">
          <label htmlFor="sc-load">Load</label>
          <select id="sc-load" value={sim.load} onChange={(e) => set('load')(e.target.value as LoadLevel)}>
            {LOADS.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div className="control">
          <label htmlFor="sc-vol">Volatility</label>
          <select id="sc-vol" value={sim.volatility} onChange={(e) => set('volatility')(e.target.value as Volatility)}>
            {VOLATILITIES.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div className="control">
          <label htmlFor="sc-size">Payload</label>
          <select id="sc-size" value={sim.heavy ? 'heavy' : 'light'} onChange={(e) => set('heavy')(e.target.value === 'heavy')}>
            <option value="light">light</option>
            <option value="heavy">heavy</option>
          </select>
        </div>
      </div>

      <div className="btn-row">
        <button className="primary" onClick={applyAndReload} disabled={!mounted}>
          Apply &amp; reload this page
        </button>
        <button onClick={runProbe} disabled={!mounted || probing}>
          {probing ? 'Probing…' : 'Probe server again'}
        </button>
        <button onClick={() => setSim(simFromContext(context, route))} disabled={!mounted}>
          Reset to actual
        </button>
      </div>

      <div className="are-strategy-row" style={{ marginTop: 14 }}>
        <span className="pill">
          predicted locally <b>{predicted?.strategy ?? '?'}</b>
        </span>
        <span className="pill">
          server says <b>{mounted ? (probe?.strategy ?? '…') : 'probe runs after hydration'}</b>
        </span>
        {disagrees && (
          <span className="pill" style={{ borderColor: 'var(--warn)', color: '#f0c674' }}>
            differs — the route answered from a cached/prebuilt artifact
          </span>
        )}
      </div>
      {mounted && probe && <p className="hint">Server reason: {probe.reason}</p>}

      <h3 style={{ marginTop: 18 }}>Rule table — first match wins</h3>
      <div className="rules">
        {STRATEGY_RULES.map((rule, i) => {
          const cls = i === predictedIndex ? 'match' : i < predictedIndex ? 'skip' : 'after';
          return (
            <div key={i} className={`rule ${cls}`}>
              <span className="n">{i + 1}</span>
              <StrategyBadge name={rule.strategy} />
              <span className="why">{rule.reason}</span>
            </div>
          );
        })}
      </div>
      <p className="hint">
        Evaluated in your browser using the engine&apos;s own rule table, against the
        simulated context above. Rules above the match are skipped; rules below are
        never reached.
      </p>

      {mounted && history.length > 0 && (
        <>
          <h3 style={{ marginTop: 18 }}>Decision history</h3>
          <div className="history">
            {history.map((h, i) => (
              <div key={i} className="hrow">
                <span className="t">{h.at}</span>
                <StrategyBadge name={h.strategy} />
                <span>{h.reason}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/** Cross-page navigation, preserving nothing — each hop re-runs the engine. */
export function PageNav({ current }: { current: string }) {
  const routes = ['/static', '/dynamic', '/heavy'];
  return (
    <nav className="nav">
      {routes.map((r) => (
        <a key={r} href={r}>
          <span className="badge" style={r === current ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : undefined}>
            {r}
          </span>
        </a>
      ))}
      <a href="/control"><span className="badge">/control</span></a>
    </nav>
  );
}
