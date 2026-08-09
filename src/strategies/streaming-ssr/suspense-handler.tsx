import React from 'react';
import { PAGE_STYLESHEET } from '../../utils/helpers.js';

/**
 * Full-document wrapper used for Streaming SSR. React streams this tree with
 * renderToPipeableStream; the bootstrap script (globals) and /client.js are
 * injected by React via the stream options, enabling progressive hydration.
 */
export function StreamDocument({
  title,
  strategy,
  reason,
  children,
}: {
  title: string;
  strategy: string;
  reason?: string;
  children?: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <meta name="x-rendering-strategy" content={strategy} />
        {reason && <meta name="x-decision-reason" content={reason} />}
        <link rel="stylesheet" href={PAGE_STYLESHEET} />
      </head>
      <body>
        <div id="are-root">{children}</div>
      </body>
    </html>
  );
}
