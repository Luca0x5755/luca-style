// 驗證 `npm run screenshots` 的行為與產出：四個檔案、1280 寬、四角是該組合的頁面底色 bg（PR-STYLE-52）、彼此不同、重跑穩定、總大小，
// 且不會被 `npm test`（Playwright）列入。不屬於 npm test。
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { expectedBg, readPng } from './png-pixel.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('請透過 npm run verify:screenshots 執行');
const names = ['vibrant-light', 'vibrant-dark', 'professional-light', 'professional-dark'];
const limit = 1024 * 1024;

function npm(args) {
  const result = spawnSync(process.execPath, [npmCli, ...args], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, `npm ${args.join(' ')} 失敗\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

// 讀出每張圖的位元組、PNG IHDR 寬度與雜湊，並檢查四角的頁面底色。
async function collect() {
  const files = {};
  for (const name of names) {
    const bytes = await readFile(join(root, 'docs', 'images', `${name}.png`));
    // readPng 在不是 PNG 時丟錯；寬度取自解碼後的 IHDR。
    const image = readPng(bytes, `${name}.png`);
    files[name] = { size: bytes.length, width: image.width, hash: createHash('sha256').update(bytes).digest('hex') };
    // 四個角落都是頁面底色，必須等於該明暗模式的 bg（期望值取自 DTCG 原始檔，兩個套系共用）。
    const bg = expectedBg(name.endsWith('-dark') ? 'dark' : 'light');
    for (const [x, y] of [[0, 0], [image.width - 1, 0], [0, image.height - 1], [image.width - 1, image.height - 1]]) {
      const got = image.pixel(x, y);
      assert.equal(got, bg, `${name} (${x}, ${y}) 為 ${got}，應為頁面底色 ${bg}`);
    }
  }
  return files;
}

// 先清掉舊圖，避免腳本漏寫某檔卻讀到舊檔而通過。
await rm(join(root, 'docs', 'images'), { recursive: true, force: true });
npm(['run', 'screenshots']);
const first = await collect();
for (const name of names) assert.equal(first[name].width, 1280, `${name} 寬度應為 1280`);
assert.equal(new Set(names.map(name => first[name].hash)).size, 4, '四張圖內容應彼此不同');
const total = names.reduce((sum, name) => sum + first[name].size, 0);
assert.ok(total <= limit, `四張圖合計 ${total} 位元組，超過 ${limit}`);

// 再獨立重跑多次（每次皆為全新行程），像素差異曾只在部分次數出現，單次重跑不足以證明穩定。
for (let run = 2; run <= 4; run++) {
  npm(['run', 'screenshots']);
  const again = await collect();
  for (const name of names) assert.equal(again[name].hash, first[name].hash, `${name} 第 ${run} 次重跑結果不穩定`);
}

const listed = npm(['test', '--', '--list']);
// 只看列出的測試檔名：測試標題可以提到 screenshot（例如 README 與截圖基準的設定檢查），但不能有截圖產生器的測試檔。
const screenshotFiles = listed.split('\n').map(line => line.split('›')[1]?.trim() ?? '').filter(file => /screenshot/i.test(file.split(':')[0]));
assert.deepEqual(screenshotFiles, [], 'npm test 不應列入截圖產生器的測試檔');

console.log(names.map(name => `${name}.png ${first[name].size} bytes ${first[name].width}px`).join('\n'));
console.log(`合計 ${total} 位元組；連跑 4 次雜湊相同；npm test 未列入截圖`);
