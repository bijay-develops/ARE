import React from 'react';

export interface ContentProps {
  title: string;
  body: string;
  items?: string[];
  generatedAt?: string;
}

export function Content({ title, body, items = [], generatedAt }: ContentProps) {
  return (
    <main>
      <h2>{title}</h2>
      <p>{body}</p>
      {items.length > 0 && (
        <ul>
          {items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      )}
      {generatedAt && (
        <footer style={{ marginTop: 24, fontSize: 12, color: '#888' }}>
          Rendered at {generatedAt}
        </footer>
      )}
    </main>
  );
}
