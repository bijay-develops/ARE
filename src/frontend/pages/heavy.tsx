import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { Header } from '../components/header.js';
import { PageNav, StrategyConsole } from '../components/strategy-console.js';
import type { PageModule, PageProps } from '../../core/types.js';

interface Row {
  id: number;
  label: string;
  value: number;
}

type SortKey = keyof Row;

/**
 * The deliberately heavy section. Still wrapped in <Suspense> so Streaming SSR
 * can flush the shell first and stream this part when ready — do not remove the
 * boundary, the STREAMING_SSR strategy depends on it.
 *
 * All filtering/sorting/paging happens in the browser, so the cost of this
 * table is paid once on the server and then stays interactive for free.
 */
function HeavySection({ rows }: { rows: Row[] }) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('id');
  const [asc, setAsc] = useState(true);
  const [pageSize, setPageSize] = useState(25);
  const [pageIndex, setPageIndex] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? rows.filter((r) => r.label.toLowerCase().includes(q) || String(r.value).includes(q))
      : rows;
    const sorted = [...base].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv));
      return asc ? cmp : -cmp;
    });
    return sorted;
  }, [rows, query, sortKey, asc]);

  // Before hydration, render the first page so the server output is meaningful.
  const start = mounted ? pageIndex * pageSize : 0;
  const visible = filtered.slice(start, start + pageSize);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setAsc((a) => !a);
    else {
      setSortKey(key);
      setAsc(true);
    }
    setPageIndex(0);
  };

  return (
    <section className="panel">
      <div className="panel-title">
        <h2>Large data table</h2>
        <span className="pill">
          <b>{filtered.length}</b> of {rows.length} rows
        </span>
      </div>

      <div className="controls">
        <div className="control">
          <label htmlFor="hv-q">Filter</label>
          <input
            id="hv-q"
            type="text"
            placeholder="label or value…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPageIndex(0);
            }}
            disabled={!mounted}
          />
        </div>
        <div className="control">
          <label htmlFor="hv-size">Rows per page</label>
          <select
            id="hv-size"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPageIndex(0);
            }}
            disabled={!mounted}
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th onClick={() => toggleSort('id')}>
                # {sortKey === 'id' ? (asc ? '▲' : '▼') : ''}
              </th>
              <th onClick={() => toggleSort('label')}>
                Label {sortKey === 'label' ? (asc ? '▲' : '▼') : ''}
              </th>
              <th onClick={() => toggleSort('value')}>
                Value {sortKey === 'value' ? (asc ? '▲' : '▼') : ''}
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id}>
                <td className="num">{r.id}</td>
                <td>{r.label}</td>
                <td className="num">{r.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="btn-row" style={{ marginTop: 12 }}>
        <button onClick={() => setPageIndex((p) => Math.max(0, p - 1))} disabled={!mounted || start === 0}>
          ← Prev
        </button>
        <button
          onClick={() => setPageIndex((p) => Math.min(pageCount - 1, p + 1))}
          disabled={!mounted || start + pageSize >= filtered.length}
        >
          Next →
        </button>
        <span className="pill">
          page <b>{mounted ? pageIndex + 1 : 1}</b> / {pageCount}
        </span>
      </div>
    </section>
  );
}

/** Real navigation timings, read only after mount. */
function LoadTimings() {
  const [t, setT] = useState<{ ttfb: number; dcl: number; load: number } | null>(null);

  useEffect(() => {
    const read = () => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      if (!nav) return;
      setT({
        ttfb: Math.round(nav.responseStart),
        dcl: Math.round(nav.domContentLoadedEventEnd),
        load: Math.round(nav.loadEventEnd),
      });
    };
    if (document.readyState === 'complete') read();
    else {
      window.addEventListener('load', () => setTimeout(read, 50), { once: true });
    }
  }, []);

  return (
    <div className="stat-row">
      <div className="stat">
        <span>TTFB</span>
        <b>{t ? `${t.ttfb} ms` : '—'}</b>
      </div>
      <div className="stat">
        <span>DOM ready</span>
        <b>{t ? `${t.dcl} ms` : '—'}</b>
      </div>
      <div className="stat">
        <span>Fully loaded</span>
        <b>{t ? `${t.load} ms` : '—'}</b>
      </div>
    </div>
  );
}

function HeavyPage({ data, strategy, reason, context }: PageProps) {
  const streaming = strategy === 'STREAMING_SSR';

  return (
    <div>
      <Header title="Heavy Page" strategy={strategy} context={context} />
      <PageNav current="/heavy" />

      <section className="panel">
        <h2>{data.title}</h2>
        <p>{data.body}</p>
        <p className="hint">
          {streaming
            ? 'Streaming SSR: the shell above was flushed first, then the table below arrived as a separate chunk — TTFB stays low even though the payload is large.'
            : 'This strategy buffers the whole document before sending, so TTFB includes rendering every row.'}
        </p>
        <LoadTimings />
      </section>

      <Suspense fallback={<p className="skeleton">Loading large section…</p>}>
        <HeavySection rows={data.rows} />
      </Suspense>

      <StrategyConsole
        route="/heavy"
        strategy={strategy}
        reason={reason}
        context={context}
        note={
          <p className="hint">
            Two rules outrank streaming here: a <b>mobile</b> device hits rule 5 and a{' '}
            <b>slow</b> network hits rule 8, both landing on plain SSR. That is deliberate
            — weak clients should not be asked to hydrate a large payload.
          </p>
        }
      />
    </div>
  );
}

const page: PageModule = {
  route: '/heavy',
  volatility: 'realtime',
  heavy: true,
  title: 'Heavy Page',
  Component: HeavyPage,
  async getData() {
    const rows: Row[] = Array.from({ length: 400 }, (_, i) => ({
      id: i + 1,
      label: `Row ${i + 1}`,
      value: Math.floor(Math.random() * 10000),
    }));
    return {
      title: 'Heavy Interactive Page',
      body: 'Large payload + interactivity → the engine prefers Streaming SSR on decent links.',
      rows,
      generatedAt: new Date().toISOString(),
    };
  },
};

export default page;
