// 建置後產生 GitHub Pages 靜態輸出：每個路由各一份 index.html（回應 200），另產生 404.html 給打錯的網址。
// 用法：node scripts/build-pages.mjs <建置輸出目錄>
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
// 路由清單只維護 route-table.json 一份，與應用的 isKnownRoute 共用。
import routes from '../apps/showcase/src/route-table.json' with { type: 'json' };

const outDir = resolve(process.argv[2] ?? '');
if (!process.argv[2]) throw new Error('用法：node scripts/build-pages.mjs <建置輸出目錄>');

const entry = join(outDir, 'index.html');
for (const route of routes) {
  if (route === '/') continue; // 入口即 index.html 本身
  const target = join(outDir, route, 'index.html');
  await mkdir(dirname(target), { recursive: true });
  await copyFile(entry, target);
}
// 未列於路由表的路徑不產生檔案，由 404.html 載入應用後顯示找不到頁面。
await copyFile(entry, join(outDir, '404.html'));
console.log(`已產生 ${routes.length - 1} 個路由頁面與 404.html：${outDir}`);
