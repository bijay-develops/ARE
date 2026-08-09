/**
 * CSR hydration notes:
 *
 * For Client-Side Rendering the server sends an (almost) empty shell and the
 * data is intentionally withheld from the initial HTML. The client bundle
 * (entry-client.tsx) detects the absent window.__ARE_DATA__, fetches it from
 * /api/data, and renders into #are-root with createRoot.
 *
 * This module is a placeholder for future partial-hydration islands config.
 */
export const CSR_DATA_ENDPOINT = '/api/data';
