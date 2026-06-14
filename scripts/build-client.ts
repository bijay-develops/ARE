import { build } from 'esbuild';
import path from 'node:path';

/** Bundle the React client entry into public/client.js (CSR + hydration). */
async function main() {
  await build({
    entryPoints: [path.resolve('src/frontend/client/entry-client.tsx')],
    bundle: true,
    minify: true,
    sourcemap: true,
    format: 'iife',
    target: ['es2020'],
    jsx: 'automatic',
    outfile: path.resolve('public/client.js'),
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'info',
  });
  console.log('[build:client] wrote public/client.js');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
