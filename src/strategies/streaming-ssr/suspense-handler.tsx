import React from 'react';

/**
 * Full-document wrapper used for Streaming SSR. React streams this tree with
 * renderToPipeableStream; the bootstrap script (globals) and /client.js are
 * injected by React via the stream options, enabling progressive hydration.
 */
export function StreamDocument({
  title,
  strategy,
  children,
}: {
  title: string;
  strategy: string;
  children?: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <meta name="x-rendering-strategy" content={strategy} />
      </head>
      <body>
        <div id="are-root">{children}</div>
      </body>
    </html>
  );
}
