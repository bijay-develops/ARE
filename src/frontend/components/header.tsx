import React from 'react';
import type { PublicContext } from '../../core/types.js';
import { StrategyBadge } from './strategy-console.js';

export function Header({
  title,
  strategy,
  context,
}: {
  title?: string;
  strategy?: string;
  context?: PublicContext;
}) {
  return (
    <header className="are-header">
      <h1>{title ?? 'Adaptive Rendering Engine'}</h1>
      <p className="sub">
        Every request is analysed, matched against the rule table, and rendered by the
        strategy that wins — this page is the proof.
      </p>
      <div className="are-strategy-row">
        <StrategyBadge name={strategy} />
        {context && (
          <span className="pill">
            {context.networkSpeed} · {context.device} · cache {context.cacheState} · load{' '}
            {context.load}
            {context.isEdge ? ' · edge' : ''}
          </span>
        )}
      </div>
    </header>
  );
}
