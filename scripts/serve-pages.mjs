// 模擬 GitHub Pages 的靜態伺服器：
//   - 檔案存在回 200；
//   - 目錄缺尾斜線回 301 導向帶尾斜線的網址，帶尾斜線則送出該目錄的 index.html（200）；
//   - 其餘（含 base 之外）回 404 並送出 404.html 的內容。
// 用法：node scripts/serve-pages.mjs <目錄> --base /luca-style/ --port 4176
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const root = resolve(args[0] ?? '');
const trimmedBase = option('--base', '/').replace(/^\/+|\/+$/g, '');
const base = trimmedBase ? `/${trimmedBase}` : '';
const port = Number(option('--port', '4176'));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml', '.png': 'image/png' };

// 判斷路徑是檔案、目錄或不存在；只有「不存在」視為 none，其他錯誤（如權限）照實拋出。
async function kind(path) {
  try { return (await stat(path)).isDirectory() ? 'dir' : 'file'; } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return 'none';
    throw error;
  }
}

// 讀檔失敗（例如重建時檔案被刪）不得讓行程崩潰；回 undefined 由呼叫端改回 404／500。
async function tryRead(path) {
  try { return await readFile(path); } catch { return undefined; }
}

async function notFound(response) {
  const body = await tryRead(join(root, '404.html'));
  response.writeHead(404, { 'content-type': types['.html'] });
  response.end(body ?? '404');
}

async function handle(request, response) {
  const url = new URL(request.url ?? '/', 'http://localhost');
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { return notFound(response); }
  // base 本身缺尾斜線時，Pages 同樣導向帶尾斜線的網址。
  if (base && pathname === base) {
    response.writeHead(301, { location: `${base}/${url.search}` });
    return response.end();
  }
  if (base && !pathname.startsWith(`${base}/`)) return notFound(response);
  const relative = pathname.slice(base.length);
  const target = resolve(join(root, relative));
  if (target !== root && !target.startsWith(root + sep)) return notFound(response);
  const found = await kind(target);
  if (found === 'file') {
    const body = await tryRead(target);
    if (!body) return notFound(response);
    response.writeHead(200, { 'content-type': types[extname(target)] ?? 'application/octet-stream' });
    return response.end(body);
  }
  if (found === 'dir' && (await kind(join(target, 'index.html'))) === 'file') {
    if (!pathname.endsWith('/')) {
      response.writeHead(301, { location: `${pathname}/${url.search}` });
      return response.end();
    }
    const body = await tryRead(join(target, 'index.html'));
    if (!body) return notFound(response);
    response.writeHead(200, { 'content-type': types['.html'] });
    return response.end(body);
  }
  return notFound(response);
}

const server = createServer((request, response) => {
  handle(request, response).catch(error => {
    console.error(error);
    if (!response.headersSent) response.writeHead(500);
    response.end();
  });
});
server.on('error', error => { console.error(error); process.exit(1); });
server.listen(port, '127.0.0.1', () => console.log(`模擬 Pages：http://127.0.0.1:${port}${base}/`));
