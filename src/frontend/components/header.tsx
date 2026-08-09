import React from 'react';

export function Header({ strategy }: { strategy?: string }) {
  return (
    <header style={{ borderBottom: '2px solid #222', paddingBottom: 12, marginBottom: 16 }}>
      <h1 style={{ margin: 0 }}>Adaptive Rendering Engine</h1>
      <p style={{ margin: '4px 0 0', color: '#555' }}>
        Strategy in effect: <strong>{strategy ?? 'unknown'}</strong>
      </p>
    </header>
  );
}
