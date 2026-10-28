import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// 讀取 Pages 部署工作流程（不連網）。專案未安裝 YAML 解析套件，
// 故以固定縮排的文字結構切出頂層區塊與 job，工作流程維持兩格縮排的單純格式。
const yml = readFileSync(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8')
  .split(/\r?\n/)
  .filter((line) => !/^\s*#/.test(line))
  .join('\n');

// 取出頂層鍵（如 on、permissions、jobs）底下的縮排內容。
const topBlock = (key: string) => yml.match(new RegExp(`^${key}:[^\\n]*\\n((?:(?: .*)?\\n?)*)`, 'm'))?.[1] ?? '';
// 取出 jobs 底下指定 job 的內容。
const job = (name: string) => topBlock('jobs').match(new RegExp(`^  ${name}:\\n((?:(?:    .*)?\\n?)*)`, 'm'))?.[1] ?? '';
const jobNames = () => [...topBlock('jobs').matchAll(/^ {2}([\w-]+):\s*$/gm)].map((m) => m[1]);
const runs = (block: string) => [...block.matchAll(/^\s*(?:- )?run:\s*(.+)$/gm)].map((m) => m[1].trim());

test('workflow runs only on push to main', () => {
  const on = topBlock('on');
  expect(on).toMatch(/push:\s*\n\s+branches:\s*\[\s*main\s*\]/);
  expect(on).not.toContain('pull_request');
});

test('deploy job needs both the verify and the visual jobs', () => {
  expect(jobNames()).toEqual(['verify', 'visual', 'deploy']);
  expect(job('deploy')).toMatch(/^\s+needs:\s*\[\s*verify\s*,\s*visual\s*\]\s*$/m);
});

test('verify job runs build, typecheck, lint and Playwright in order', () => {
  const steps = runs(job('verify'));
  const index = (cmd: string) => steps.indexOf(cmd);
  expect(steps).toContain('npx playwright install --with-deps chromium');
  const order = ['npm run build', 'npm run typecheck', 'npm run lint', 'npm test'].map(index);
  expect(order.every((i) => i >= 0), `缺少步驟：${steps.join(' | ')}`).toBe(true);
  expect([...order].sort((a, b) => a - b)).toEqual(order);
  expect(index('npx playwright install --with-deps chromium')).toBeLessThan(index('npm test'));
});

test('no step may swallow a failure', () => {
  expect(yml).not.toContain('continue-on-error');
});

test('every action is pinned to a full commit SHA', () => {
  const uses = [...yml.matchAll(/^\s*(?:- )?uses:\s*(\S+)/gm)].map((m) => m[1]);
  expect(uses.length).toBeGreaterThan(0);
  for (const ref of uses) expect(ref, ref).toMatch(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/);
});

test('permissions only grant what deployment needs, and writes are confined to the deploy job', () => {
  const grants = (text: string) => [...text.matchAll(/^\s+([\w-]+):\s*(read|write|none)\s*$/gm)].map((m) => `${m[1]}: ${m[2]}`).sort();
  expect(grants(topBlock('permissions'))).toEqual(['contents: read']);
  expect(grants(job('deploy'))).toEqual(['id-token: write', 'pages: write']);
  expect(job('verify')).not.toContain('permissions:');
  expect(yml).not.toMatch(/write-all|read-all/);
});

test('deployed artifact is the build:pages output served under /luca-style/', () => {
  const pkg = JSON.parse(readFileSync(new URL('../apps/showcase/package.json', import.meta.url), 'utf8'));
  const script: string = pkg.scripts['build:pages'];
  expect(script).toContain('--base=/luca-style/');
  const outDir = script.match(/--outDir (\S+)/)?.[1];
  expect(outDir).toBeTruthy();
  const verify = job('verify');
  expect(runs(verify)).toContain('npm run build:pages');
  expect(verify).toMatch(new RegExp(`^\\s+path:\\s*apps/showcase/${outDir}\\s*$`, 'm'));
});

test('architecture section 3.1 documents the Pages deployment', () => {
  const doc = readFileSync(new URL('../docs/03_architecture_design.md', import.meta.url), 'utf8');
  const section = doc.split(/^## /m).find((s) => s.startsWith('3.1')) ?? '';
  for (const word of ['GitHub Pages', 'pages.yml', 'main', 'dist-pages', '/luca-style/']) expect(section, word).toContain(word);
});
