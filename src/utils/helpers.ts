/** Build the page-level globals the client bundle reads on boot. */
export function clientBootScript(route: string, strategy: string, data: unknown | null): string {
  const dataLiteral = data == null ? 'null' : JSON.stringify(data);
  return (
    `window.__ARE_ROUTE__=${JSON.stringify(route)};` +
    `window.__ARE_STRATEGY__=${JSON.stringify(strategy)};` +
    `window.__ARE_DATA__=${dataLiteral};`
  );
}

export interface ShellOptions {
  title: string;
  route: string;
  strategy: string;
  /** Server-rendered inner HTML for #are-root. Empty string for pure CSR. */
  bodyHtml: string;
  /** Data to embed for hydration; pass null for CSR (client fetches it). */
  data: unknown | null;
  /** Whether to include the hydration/CSR client bundle. */
  includeClient: boolean;
}

/** Assemble a complete HTML document for buffered strategies (SSG/SSR/ISR/CSR/Edge-ISR). */
export function htmlShell(opts: ShellOptions): string {
  const clientTag = opts.includeClient ? '<script src="/client.js" defer></script>' : '';
  return (
    `<!doctype html><html lang="en"><head><meta charset="utf-8"/>` +
    `<meta name="viewport" content="width=device-width, initial-scale=1"/>` +
    `<title>${opts.title}</title>` +
    `<meta name="x-rendering-strategy" content="${opts.strategy}"/>` +
    `</head><body>` +
    `<div id="are-root">${opts.bodyHtml}</div>` +
    `<script>${clientBootScript(opts.route, opts.strategy, opts.data)}</script>` +
    clientTag +
    `</body></html>`
  );
}
