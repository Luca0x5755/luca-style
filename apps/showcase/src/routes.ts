import routeTable from './route-table.json';

// 部署 base path（本機為 `/`，GitHub Pages 為 `/luca-style/`），由建置時的 --base 決定。
const base = import.meta.env.BASE_URL.replace(/\/$/, '');

// 將內部路由（如 `/foundations`、`/`）轉成含 base 的實際網址。
export function withBase(route: string): string {
  return `${base}${route}`;
}

// 將瀏覽器 pathname 去掉 base，讓程式內部仍以 `/foundations` 這類路由比對。
// GitHub Pages 會把 `foundations/index.html` 導向帶尾斜線的網址，故尾斜線視為同一路由。
export function stripBase(pathname: string): string {
  if (pathname === base) return '/';
  const route = pathname.startsWith(`${base}/`) ? pathname.slice(base.length) : pathname;
  return route.length > 1 && route.endsWith('/') ? route.slice(0, -1) : route;
}

// 前端規格 §5.2 列出的路由，與建置後產生頁面的腳本共用同一份 route-table.json；不在此表內的路徑顯示找不到頁面。
const knownRoutes = new Set<string>(routeTable);

export function isKnownRoute(route: string): boolean {
  return knownRoutes.has(route);
}

// 狀態總覽頁不屬於樣張網站，不列入路由表；正式建置一律回 false，開啟時顯示找不到頁面（§5.2）。
export function isStateOverviewRoute(route: string): boolean {
  return import.meta.env.DEV && route === '/dev/state-overview';
}
