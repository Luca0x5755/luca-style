import { readFileSync } from 'node:fs';

// 路由清單的唯一來源 route-table.json，供各測試共用。
export const routeTable: string[] = JSON.parse(readFileSync(new URL('../apps/showcase/src/route-table.json', import.meta.url), 'utf8'));
