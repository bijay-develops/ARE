import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Header } from '../components/header.js';
import { LocalTime, PageNav, StrategyConsole } from '../components/strategy-console.js';
import type { PageModule, PageProps } from '../../core/types.js';

/**
 * The sharpest visible difference between CSR and the server-rendered
 * strategies: with CSR the server withholds data entirely (__ARE_DATA__ is
 * null) and the browser fetches it, so the first paint has no content. With
 * SSR/ISR/SSG the data arrived embedded in the HTML.
 */
function useDataOrigin(): 'embedded' | 'client-fetched' | 'unknown' {
  const [origin, setOrigin] = useState<'embedded' | 'client-fetched' | 'unknown'>('unknown');
  useEffect(() => {
    const embedded = (window as any).__ARE_DATA__;
    setOrigin(embedded == null ? 'client-fetched' : 'embedded');
  }, []);
  return origin;
}

function LiveClock() {
  const [now, setNow] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleTimeString());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <b className="mono">{now ?? '—'}</b>;
}

function DynamicPage({ data, strategy, reason, context }: PageProps) {
  const [mounted, setMounted] = useState(false);
  const [live, setLive] = useState(data);
  const [auto, setAuto] = useState(false);
  const [intervalMs, setIntervalMs] = useState(3000);
  const [refreshes, setRefreshes] = useState(0);
  const [samples, setSamples] = useState<number[]>([]);
  const [lastMs, setLastMs] = useState<number | null>(null);
  const busy = useRef(false);
  const origin = useDataOrigin();

  useEffect(() => setMounted(true), []);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    const t0 = performance.now();
    try {
      const res = await fetch('/api/data?route=/dynamic', { cache: 'no-store' });
      const next = await res.json();
      const elapsed = performance.now() - t0;
      setLive(next);
      setLastMs(elapsed);
      setRefreshes((n) => n + 1);
      // The random metric the endpoint returns, plotted over time.
      const metric = Number(String(next.items?.[1] ?? '').replace(/\D+/g, '')) || 0;
      setSamples((s) => [...s, metric].slice(-40));
    } catch {
      /* keep the last good data */
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    if (!auto) return;
    const id = setInterval(refresh, intervalMs);
    return () => clearInterval(id);
  }, [auto, intervalMs, refresh]);

  const max = Math.max(1, ...samples);

  return (
    <div>
      <Header title="Dynamic Page" strategy={strategy} context={context} />
      <PageNav current="/dynamic" />

      <section className="panel">
        <div className="panel-title">
          <h2>{live.title}</h2>
          <span className="pill">
            data arrived <b>{origin}</b>
          </span>
        </div>
        <p>{live.body}</p>
        <ul>
          {(live.items ?? []).map((it: string, i: number) => (
            <li key={i}>{it}</li>
          ))}
        </ul>

        <div className="stat-row" style={{ marginTop: 12 }}>
          <div className="stat">
            <span>Payload timestamp</span>
            <b className="mono"><LocalTime iso={live.generatedAt} /></b>
          </div>
          <div className="stat">
            <span>Browser clock</span>
            <LiveClock />
          </div>
          <div className="stat">
            <span>Refreshes</span>
            <b>{refreshes}</b>
          </div>
          <div className="stat">
            <span>Last fetch</span>
            <b>{lastMs === null ? '—' : `${lastMs.toFixed(0)} ms`}</b>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">
          <h2>Live data feed</h2>
          <span className={`pill ${auto ? 'live' : 'idle'}`}>{auto ? 'polling' : 'paused'}</span>
        </div>
        <p className="hint">
          Realtime data is exactly why this route resists SSG: anything cached is wrong a
          second later. Poll it and watch the payload timestamp move.
        </p>
        <div className="controls" style={{ marginTop: 12 }}>
          <div className="control">
            <label htmlFor="dyn-interval">Poll interval</label>
            <select
              id="dyn-interval"
              value={intervalMs}
              onChange={(e) => setIntervalMs(Number(e.target.value))}
            >
              <option value={1000}>1s</option>
              <option value={3000}>3s</option>
              <option value={5000}>5s</option>
              <option value={10000}>10s</option>
            </select>
          </div>
        </div>
        <div className="btn-row">
          <button className="primary" onClick={() => setAuto((a) => !a)} disabled={!mounted}>
            {auto ? 'Stop auto-refresh' : 'Start auto-refresh'}
          </button>
          <button onClick={refresh} disabled={!mounted}>
            Refresh once
          </button>
        </div>
        {samples.length > 1 && (
          <div className="bars">
            {samples.map((v, i) => (
              <div key={i} style={{ height: `${Math.max(4, (v / max) * 100)}%` }} />
            ))}
          </div>
        )}
      </section>

      <StrategyConsole
        route="/dynamic"
        strategy={strategy}
        reason={reason}
        context={context}
        note={
          <p className="hint">
            This route is the natural home of SSR: it is realtime, so with no headers at
            all it falls through to the safe default. Set network <b>fast</b> + device{' '}
            <b>desktop</b> to reach CSR, or load <b>high</b> to shed work with ISR.
          </p>
        }
      />
    </div>
  );
}

const page: PageModule = {
  route: '/dynamic',
  volatility: 'realtime',
  heavy: false,
  title: 'Dynamic Page',
  Component: DynamicPage,
  async getData() {
    return {
      title: 'Live Dashboard (Dynamic)',
      body: 'Data changes constantly, so the engine adapts: CSR on capable clients, SSR on weak ones, ISR under load.',
      items: [
        `Server time: ${new Date().toLocaleTimeString()}`,
        `Random metric: ${Math.floor(Math.random() * 1000)}`,
      ],
      generatedAt: new Date().toISOString(),
    };
  },
};

export default page;
