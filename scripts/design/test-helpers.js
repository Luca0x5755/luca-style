// 驗收腳本測試共用：在暫存區產生「故意改壞的 .fig 副本」，並以環境變數指向副本執行腳本。
// 副本用離線 `openpencil eval 原檔 -o 副本` 產生，不會改到進版控的檔案。
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after } from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));
export const script = (name) => resolve(here, name);
export const mockup = resolve(here, '../../docs/mockup');
export const themes = join(mockup, 'themes');
export const vibrantFig = join(mockup, 'components-vibrant.fig');
export const professionalFig = join(mockup, 'components-professional.fig');

const tempDirs = [];
after(() => tempDirs.forEach((d) => rmSync(d, { recursive: true, force: true })));
export const tempDir = (prefix) => {
  const d = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(d);
  return d;
};

// 把 JS 片段套在 src 上並另存為 dst（片段內可用 figma；回傳值不用）。
export const mutate = (src, dst, code) => {
  execFileSync('openpencil', ['eval', `"${src}"`, '--stdin', '--json', '-o', `"${dst}"`], {
    input: code, encoding: 'utf8', shell: true, stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024,
  });
  return dst;
};

// 片段共用前置：取得頁面、依名稱找 frame、依索引路徑找節點。
export const PRELUDE = `
const page = figma.root.children[0]
const frameOf = (name) => page.children.find((f) => f.name === name)
const at = (f, p) => (p === '-' ? f : p.split('.').reduce((n, i) => n.children[+i], f))
const rgb = (h) => ({ r: parseInt(h.slice(1, 3), 16) / 255, g: parseInt(h.slice(3, 5), 16) / 255, b: parseInt(h.slice(5, 7), 16) / 255, a: 1 })
`;

export const run = (scriptName, env, args = []) => {
  const r = spawnSync('node', [script(scriptName), ...args], { env: { ...process.env, ...env }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
};
