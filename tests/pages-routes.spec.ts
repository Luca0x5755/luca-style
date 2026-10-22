import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { routeTable } from './route-table';

// 路由清單只維護 route-table.json 一份；產生 Pages 頁面的腳本讀它，這裡確認它與 main.tsx 實際路由一致。
const main = readFileSync(new URL('../apps/showcase/src/main.tsx', import.meta.url), 'utf8');

test('route table lists exactly the routes main.tsx renders, with the entry as the fallthrough', () => {
  const rendered = [...main.matchAll(/route\s*===\s*['"]([^'"]+)['"]/g)].map(match => match[1]);
  expect(routeTable.filter(route => route !== '/').sort()).toEqual([...new Set(rendered)].sort());
  expect(routeTable).toContain('/');
  expect(routeTable).toHaveLength(5);
});

test('every navigation link in main.tsx points at a route in the table', () => {
  const hrefs = [...main.matchAll(/href\s*:\s*withBase\(\s*['"]([^'"]+)['"]\s*\)/g)].map(match => match[1]);
  expect(hrefs.length).toBeGreaterThan(0);
  for (const href of hrefs) expect(routeTable).toContain(href);
});
