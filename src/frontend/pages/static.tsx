import React, { useEffect, useState } from 'react';
import { Header } from '../components/header.js';
import { LocalTime, PageNav, StrategyBadge, StrategyConsole } from '../components/strategy-console.js';
import type { CacheState, PageModule, PageProps } from '../../core/types.js';

/**
 * The clearest demonstration of SSG staleness in the project: this page is
 * served from a prebuilt artifact, so `generatedAt` is frozen at build time
 * while the clock beside it keeps running. The gap between them IS the
 * staleness that ISR exists to bound.
 */
function ArtifactAge({ generatedAt }: { generatedAt: string }) {
  // Starts null so server and client render identically; the live clock only
  // begins after hydration.
  const [ageMs, setAgeMs] = useState<number | null>(null);

  useEffect(() => {
    const built = new Date(generatedAt).getTime();
    const tick = () => setAgeMs(Date.now() - built);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [generatedAt]);

  const human = (ms: number) => {
    const s = Math.max(0, Math.round(ms / 1000));
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ${s % 60}s`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  };

  return (
    <div className="stat-row">
      <div className="stat">
        <span>Artifact generated at</span>
        <b className="mono"><LocalTime iso={generatedAt} /></b>
      </div>
      <div className="stat">
        <span>Age right now</span>
        <b className="age">{ageMs === null ? 'measuring…' : human(ageMs)}</b>
      </div>
    </div>
  );
}

/** Fire the same route with each cache state and show how the choice moves. */
function CacheLab({ route }: { route: string }) {
  const [rows, setRows] = useState<Record<string, { strategy: string; reason: string }>>({});
  const [busy, setBusy] = useState(false);
  const states: CacheState[] = ['fresh', 'stale', 'cold'];

  const run = async () => {
    setBusy(true);
    const next: Record<string, { strategy: string; reason: string }> = {};
    for (const state of states) {
      try {
        const res = await fetch(route, {
          headers: { 'X-Cache-State': state },
          cache: 'no-store',
        });
        next[state] = {
          strategy: res.headers.get('X-Rendering-Strategy') ?? '?',
          reason: res.headers.get('X-Decision-Reason') ?? '',
        };
      } catch {
        next[state] = { strategy: 'unreachable', reason: '' };
      }
    }
    setRows(next);
    setBusy(false);
  };

  return (
    <section className="panel">
      <div className="panel-title">
        <h2>Cache lab</h2>
        <button onClick={run} disabled={busy}>
          {busy ? 'Running…' : 'Run all three'}
        </button>
      </div>
      <p className="hint">
        Rule 1 fires whenever the cache is usable. Only <code>cold</code> defeats it —
        <code> stale</code> still counts as usable, which is why a stale cache still serves SSG.
      </p>
      <div className="rules" style={{ marginTop: 12 }}>
        {states.map((s) => (
          <div key={s} className="rule" style={{ gridTemplateColumns: '80px 130px 1fr' }}>
            <span className="n">{s}</span>
            {rows[s] ? <StrategyBadge name={rows[s].strategy} /> : <span className="badge">—</span>}
            <span className="why">{rows[s]?.reason ?? 'not run yet'}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function StaticPage({ data, strategy, reason, context }: PageProps) {
  const [mounted, setMounted] = useState(false);
  const [clicks, setClicks] = useState(0);
  useEffect(() => setMounted(true), []);

  const servedFromArtifact = strategy === 'SSG';

  return (
    <div>
      <Header title="Static Page" strategy={strategy} context={context} />
      <PageNav current="/static" />

      <section className="panel">
        <h2>{data.title}</h2>
        <p>{data.body}</p>
        <ul>
          {data.items.map((it: string, i: number) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
        <ArtifactAge generatedAt={data.generatedAt} />
        <p className="hint">
          {servedFromArtifact
            ? 'This HTML came off disk unchanged — the timestamp above will never move until the artifact is rebuilt.'
            : 'This HTML was rendered for your request, so the timestamp above is current.'}
        </p>
      </section>

      <section className="panel">
        <div className="panel-title">
          <h2>Is this page actually alive?</h2>
          <span className={`pill ${mounted ? 'live' : 'idle'}`}>
            {mounted ? 'JavaScript attached' : 'static markup only'}
          </span>
        </div>
        <p className="hint">
          The button proves hydration ran. On SSG/SSR the text above was already in the
          HTML; the interactivity was bolted on afterwards.
        </p>
        <div className="btn-row" style={{ marginTop: 10 }}>
          <button onClick={() => setClicks((c) => c + 1)} disabled={!mounted}>
            Clicked {clicks} time{clicks === 1 ? '' : 's'}
          </button>
        </div>
      </section>

      <StrategyConsole
        route="/static"
        strategy={strategy}
        reason={reason}
        context={context}
        note={
          servedFromArtifact ? (
            <p className="hint">
              Note: SSG replays a prebuilt file, so the rule quoted above is the one that
              fired <b>at prebuild time</b>. The live decision for your request is in the
              <code> X-Decision-Reason</code> response header — the probe below reads it.
            </p>
          ) : null
        }
      />

      <CacheLab route="/static" />
    </div>
  );
}

const page: PageModule = {
  route: '/static',
  volatility: 'static',
  heavy: false,
  title: 'Static Page',
  Component: StaticPage,
  async getData() {
    return {
      title: 'About this Engine (Static)',
      body: 'This page rarely changes, so the engine prefers SSG / Edge-ISR.',
      items: ['Zero per-request render cost', 'Cache-friendly', 'Ideal for docs/marketing'],
      generatedAt: new Date().toISOString(),
    };
  },
};

export default page;
