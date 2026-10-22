import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// 唯讀檢查 README.md 的結構與連結（不連網、不開頁面）。
// 線上樣張連結是否回 200 需要已部署的站點，不在此檢查，改由手動 curl 驗證。
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const readme = read('README.md').replace(/\r\n/g, '\n');
const liveUrl = 'https://luca0x5755.github.io/luca-style/';

// 去掉程式碼區塊後再找標題與連結，避免把區塊內的 `#` 註解當成標題。
const prose = readme.replace(/```[\s\S]*?```/g, '');
const h2Index = prose.search(/^## /m);
// 取出指定標題的 H2 章節內容；text 預設為含程式碼區塊的完整 README。
const section = (title: string, text = readme) => text.split(/^## /m).find((s) => s.startsWith(title)) ?? '';

test('README opens with English intro, one-line Chinese intro, live link and screenshots before the first H2', () => {
  const head = prose.slice(0, h2Index);
  expect(head).toMatch(/^# Luca Style\n/);
  expect(head).toContain('A reusable React design system with two style suites (vibrant and professional), light/dark modes, shared components, design tokens and page templates. Documentation is in Traditional Chinese. Licensed under MIT.');
  expect(head).toContain('跨專案設計系統');
  expect(head).toContain(liveUrl);
  const imgs = head.match(/!\[[^\]]+\]\(docs\/images\/[\w-]+\.png\)/g) ?? [];
  expect(imgs.length).toBe(4);
  expect(new Set(imgs).size).toBe(4);
  // 順序：英文簡介 < 一句話介紹 < 截圖。
  expect(head.indexOf('A reusable React')).toBeLessThan(head.indexOf('跨專案設計系統'));
  expect(head.indexOf('跨專案設計系統')).toBeLessThan(head.indexOf(imgs[0] ?? ''));
});

test('README H2 sections appear in the promised order', () => {
  const titles = [...prose.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim());
  expect(titles).toEqual(['快速開始', '公開套件與文件導覽', '開發與驗證', '授權']);
});

test('README calls the local server 本機預覽 and never 正式預覽', () => {
  expect(readme).not.toContain('正式預覽');
  expect(readme).toContain('本機預覽');
});

test('quick start has clone, npm ci, npm run dev and links to the consumer guide', () => {
  const full = section('快速開始');
  expect(full).toContain('git clone https://github.com/Luca0x5755/luca-style.git');
  expect(full).toMatch(/^npm ci$/m);
  expect(full).toMatch(/^npm run dev$/m);
  expect(section('快速開始', prose)).toContain('](docs/consumer-guide.md)');
});

test('quick start code snippet is at most 10 lines and copied verbatim from examples/consumer', () => {
  const full = section('快速開始');
  const snippet = full.match(/```tsx\n([\s\S]*?)\n```/)?.[1];
  expect(snippet, '快速開始缺少 tsx 程式碼區塊').toBeTruthy();
  const lines = snippet!.split('\n');
  expect(lines.length).toBeLessThanOrEqual(10);
  // 以省略行切成數組；每組必須逐字、連續地出現在範例原始檔中，組間依序。
  const source = read('examples/consumer/src/main.tsx').replace(/\r\n/g, '\n').split('\n');
  const groups: string[][] = [[]];
  for (const line of lines) {
    if (line.trim() === '// …') groups.push([]);
    else groups[groups.length - 1].push(line);
  }
  let cursor = 0;
  for (const group of groups.filter((g) => g.length)) {
    const found = source.findIndex((_, i) => i >= cursor && group.every((line, k) => source[i + k] === line));
    expect(found, `範例中找不到連續（或順序不符）的片段：${group[0]}`).toBeGreaterThanOrEqual(0);
    cursor = found + group.length;
  }
});

test('README references the four generated screenshots and the files exist', () => {
  const refs = [...readme.matchAll(/!\[[^\]]*\]\((docs\/images\/[\w-]+\.png)\)/g)].map((m) => m[1]).sort();
  expect(refs).toEqual(['vibrant-light', 'vibrant-dark', 'professional-light', 'professional-dark'].map((n) => `docs/images/${n}.png`).sort());
  for (const ref of refs) expect(existsSync(resolve(root, ref)), ref).toBe(true);
});

test('every relative link in README points at an existing file', () => {
  const targets = [...readme.matchAll(/!?\[[^\]]*\]\(([^)\s]+)\)/g)].map((m) => m[1]).filter((t) => !/^(https?:|mailto:|#)/.test(t));
  expect(targets.length).toBeGreaterThan(5);
  // 以 git 追蹤清單比對，連大小寫也要一致（GitHub 在 Linux 上區分大小寫）。
  const tracked = new Set(execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split(/\r?\n/));
  for (const target of targets) {
    const file = target.split('#')[0];
    expect(existsSync(resolve(root, file)), target).toBe(true);
    expect(tracked.has(file), `${target} 未被 git 追蹤或大小寫不符`).toBe(true);
  }
});

test('license section keeps MIT and the font OFL notice', () => {
  const license = section('授權');
  expect(license).toContain('[MIT License](LICENSE)');
  expect(license).toContain('SIL Open Font License 1.1');
  expect(license).toContain('packages/react/fonts/');
});

test('design-system capability and delivery verification both carry PR-STYLE-15 to 24', () => {
  const capability = read('docs/capabilities/design-system.md');
  const delivery = read('docs/delivery-verification.md');
  for (let n = 15; n <= 24; n++) {
    const id = `PR-STYLE-${n}`;
    expect(capability, `design-system.md 缺 ${id}`).toMatch(new RegExp(`^${id} — `, 'm'));
    expect(delivery, `delivery-verification.md 缺 ${id}`).toMatch(new RegExp(`^\\| ${id} \\| .{10,}`, 'm'));
  }
});
