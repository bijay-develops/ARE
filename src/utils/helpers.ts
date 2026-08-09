import type { PublicContext } from '../core/types.js';

/** Stylesheet shared by every engine-rendered page (/static, /dynamic, /heavy). */
export const PAGE_STYLESHEET = '/are-page.css';

/** Escape a string for safe interpolation into an HTML attribute. */
function attr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Serialise a value for embedding inside a <script> tag. `</script>` and HTML
 * comment openers inside the JSON would otherwise terminate the script early.
 */
function jsonForScript(value: unknown): string {
  return JSON.stringify(value ?? null)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export interface BootMeta {
  reason?: string;
  context?: PublicContext;
}

/** Build the page-level globals the client bundle reads on boot. */
export function clientBootScript(
  route: string,
  strategy: string,
  data: unknown | null,
  meta: BootMeta = {},
): string {
  return (
    `window.__ARE_ROUTE__=${jsonForScript(route)};` +
    `window.__ARE_STRATEGY__=${jsonForScript(strategy)};` +
    `window.__ARE_DATA__=${data == null ? 'null' : jsonForScript(data)};` +
    `window.__ARE_REASON__=${jsonForScript(meta.reason ?? null)};` +
    `window.__ARE_CONTEXT__=${jsonForScript(meta.context ?? null)};`
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
  /** The rule that fired, surfaced in <meta> so it is visible without JS. */
  reason?: string;
  /** What the engine observed, embedded for the in-page console. */
  context?: PublicContext;
}

/** Assemble a complete HTML document for buffered strategies (SSG/SSR/ISR/CSR/Edge-ISR). */
export function htmlShell(opts: ShellOptions): string {
  const clientTag = opts.includeClient ? '<script src="/client.js" defer></script>' : '';
  const reasonTag = opts.reason
    ? `<meta name="x-decision-reason" content="${attr(opts.reason)}"/>`
    : '';
  return (
    `<!doctype html><html lang="en"><head><meta charset="utf-8"/>` +
    `<meta name="viewport" content="width=device-width, initial-scale=1"/>` +
    `<title>${opts.title}</title>` +
    `<meta name="x-rendering-strategy" content="${attr(opts.strategy)}"/>` +
    reasonTag +
    `<link rel="stylesheet" href="${PAGE_STYLESHEET}"/>` +
    `</head><body>` +
    `<div id="are-root">${opts.bodyHtml}</div>` +
    `<script>${clientBootScript(opts.route, opts.strategy, opts.data, {
      reason: opts.reason,
      context: opts.context,
    })}</script>` +
    clientTag +
    `</body></html>`
  );
}
