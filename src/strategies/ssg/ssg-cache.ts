import path from 'node:path';
import { readFileSafe, writeFile } from '../../utils/file-utils.js';

/**
 * SSG output store. Pre-built pages live under public/ssg/<route>.html.
 * scripts/build-ssg.ts writes them; the strategy reads them at request time.
 */
const SSG_DIR = path.resolve('public', 'ssg');

function fileFor(route: string): string {
  const name = route === '/' ? 'index' : route.replace(/^\//, '').replace(/\//g, '_');
  return path.join(SSG_DIR, `${name}.html`);
}

export async function readSSG(route: string): Promise<string | null> {
  return readFileSafe(fileFor(route));
}

export async function writeSSG(route: string, html: string): Promise<void> {
  await writeFile(fileFor(route), html);
}
