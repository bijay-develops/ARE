import type { PageModule } from '../core/types.js';
import staticPage from '../frontend/pages/static.js';
import dynamicPage from '../frontend/pages/dynamic.js';
import heavyPage from '../frontend/pages/heavy.js';

/** Route table: URL path → PageModule. */
const routes: Record<string, PageModule> = {
  '/': staticPage,
  '/static': staticPage,
  '/dynamic': dynamicPage,
  '/heavy': heavyPage,
};

export function resolvePage(pathname: string): PageModule | undefined {
  return routes[pathname];
}

export function allPages(): PageModule[] {
  return [staticPage, dynamicPage, heavyPage];
}
