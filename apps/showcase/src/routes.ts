// 部署 base path（本機為 `/`，GitHub Pages 為 `/luca-style/`），由建置時的 --base 決定。
const base = import.meta.env.BASE_URL.replace(/\/$/, '');

// 將內部路由（如 `/foundations`、`/`）轉成含 base 的實際網址。
export function withBase(route: string): string {
  return `${base}${route}`;
}

// 將瀏覽器 pathname 去掉 base，讓程式內部仍以 `/foundations` 這類路由比對。
export function stripBase(pathname: string): string {
  if (pathname === base) return '/';
  return pathname.startsWith(`${base}/`) ? pathname.slice(base.length) : pathname;
}
