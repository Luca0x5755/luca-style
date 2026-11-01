import { test, expect } from '@playwright/test';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { routeTable } from './route-table';
import { baselineName, notFoundPath, overviewBaselineName, overviewCells, overviewScreen, visualModes, visualPages, visualSuites, visualWidths } from './visual-matrix';
import { expectedBg, readPng } from '../scripts/png-pixel.mjs';

// 截圖基準的靜態檢查（不需 Docker、不連網、不開頁面）。
// 實際比對由 Docker 內的 `visual` 專案執行（`npm run test:visual`），Windows 字型不同，不進預設的 `npm test`。
const file = (path: string) => new URL(`../${path}`, import.meta.url);
const read = (path: string) => readFileSync(file(path), 'utf8').replace(/\r\n/g, '\n');
const playwrightVersion: string = JSON.parse(read('node_modules/@playwright/test/package.json')).version;
const imageTag = `mcr.microsoft.com/playwright:v${playwrightVersion}-noble`;

// 以 --list 列出測試，不啟動伺服器；PW_VISUAL 決定載入哪組專案。
function listed(env: Record<string, string>) {
  const cli = fileURLToPath(file('node_modules/@playwright/test/cli.js'));
  const out = execFileSync(process.execPath, [cli, 'test', '--list'], { cwd: fileURLToPath(file('')), encoding: 'utf8', env: { ...process.env, NO_COLOR: '', FORCE_COLOR: '0', PW_VISUAL: '', ...env } });
  return out.split('\n');
}
const countOf = (lines: string[], pattern: RegExp) => lines.filter((line) => pattern.test(line)).length;

test('screenshot matrix covers every route plus the not-found page, 2 suites, 2 modes and widths 1280/834/390', () => {
  expect(visualPages).toEqual([...routeTable, notFoundPath]);
  expect(routeTable).not.toContain(notFoundPath);
  expect([...visualSuites]).toEqual(['vibrant', 'professional']);
  expect([...visualModes]).toEqual(['light', 'dark']);
  expect([...visualWidths]).toEqual([1280, 834, 390]);
  expect(visualPages.length * visualSuites.length * visualModes.length * visualWidths.length).toBe(72);
});

test('the visual project is listed only inside the Docker run, never by the default npm test', () => {
  expect(listed({}).filter((line) => line.includes('visual.spec'))).toEqual([]);
  const docker = listed({ PW_VISUAL: '1' });
  expect(countOf(docker, /\[visual\] › (tests[\\/])?visual\.spec\.ts:.* › screenshot \//)).toBe(72);
  expect(countOf(docker, /\[visual\] › .* › screenshot overview /)).toBe(48);
  expect(countOf(docker, /\[visual\] › .* › overview screenshot self-test: /)).toBe(2);
  expect(countOf(docker, /\[visual\] › /)).toBe(122);
});

test('npm test runs axe on all 48 overview combinations in the dev project, not on the production preview', () => {
  const lines = listed({});
  expect(countOf(lines, /\[dev\] › .* › axe overview cell /)).toBe(48);
  expect(countOf(lines, /\[(default|subpath|pages)\] › .*axe overview/)).toBe(0);
});

test('committed baselines are exactly the 72 matrix combinations plus the 48 overview combinations, with no platform suffix', () => {
  const pages = visualPages.flatMap((p) => visualSuites.flatMap((s) => visualModes.flatMap((m) => visualWidths.map((w) => `${baselineName(p, s, m, w)}.png`))));
  const overview = overviewCells.map((cell) => `${overviewBaselineName(cell)}.png`);
  expect(pages).toHaveLength(72);
  expect(overview).toHaveLength(48);
  const expected = [...pages, ...overview].sort();
  const actual = existsSync(file('tests/__screenshots__')) ? readdirSync(file('tests/__screenshots__')).sort() : [];
  expect(actual).toEqual(expected);
  expect(new Set(expected).size).toBe(120);
  for (const name of actual) expect(name).not.toMatch(/-(linux|win32|darwin)\.png$/);
});

// 新畫面納入總覽頁時，這裡會失敗，提醒要補上它的基準與 axe（PR-REVIEW-08、09）。
test('the overview matrix covers exactly the screens on the overview', () => {
  const routes = [...read('apps/showcase/src/state-overview-screens.tsx').matchAll(/route:'([^']+)'/g)].map((match) => match[1]);
  expect(routes).toEqual([overviewScreen]);
});

// 從壞頁面產生的基準也會「比對通過」，所以檢查基準本身：參數沒生效時，不同組合會拍出同樣的圖或錯誤的寬度。
test('each of the 48 overview baselines has its own width and differs from every other combination', () => {
  const owners = new Map<string, string[]>();
  const wrong: string[] = [];
  for (const cell of overviewCells) {
    const name = `${overviewBaselineName(cell)}.png`;
    const path = fileURLToPath(file(`tests/__screenshots__/${name}`));
    if (readPng(path).width !== cell.width) wrong.push(`${name}：寬度應為 ${cell.width}`);
    const digest = createHash('sha256').update(readFileSync(path)).digest('hex');
    owners.set(digest, [...(owners.get(digest) ?? []), name]);
  }
  expect(wrong).toEqual([]);
  expect([...owners.values()].filter((names) => names.length > 1)).toEqual([]);
});

test('visual spec stays out of the foundations density and shape switches', () => {
  const spec = read('tests/visual.spec.ts');
  expect(spec).toContain("from './visual-matrix'");
  for (const word of ['資訊密度', '元件外形', 'density', 'shape']) expect(spec, word).not.toContain(word);
  expect(spec).toContain('toHaveScreenshot');
});

// 乾跑：只印出將傳給 docker 的引數（JSON），不執行 Docker。
function dryRun(...args: string[]) {
  const r = spawnSync(process.execPath, [fileURLToPath(file('scripts/visual-docker.mjs')), ...args, '--dry-run'], { encoding: 'utf8' });
  return { code: r.status, args: r.status === 0 ? JSON.parse(r.stdout) as string[] : [], err: r.stderr };
}

test('the Docker script passes none for test, changed for update, and all only for update --all', () => {
  const inner = (args: string[]) => args[args.length - 1];
  const t = dryRun('test');
  expect(t.code).toBe(0);
  expect(inner(t.args)).toContain('--update-snapshots=none');
  const u = dryRun('update');
  expect(u.code).toBe(0);
  expect(inner(u.args)).toContain('--update-snapshots=changed');
  const all = dryRun('update', '--all');
  expect(all.code).toBe(0);
  expect(inner(all.args)).toContain('--update-snapshots=all');
  expect(all.args).toContain(imageTag);
  // npm ci 會清空每個 workspace 的 node_modules，不能讓容器碰到本機的目錄。
  expect(t.args).toContain('luca-style-visual-showcase-node-modules:/work/apps/showcase/node_modules');
});

test('the Docker script rejects --all on test and any unknown argument', () => {
  expect(dryRun('test', '--all').code).not.toBe(0);
  expect(dryRun('update', '--everything').code).not.toBe(0);
  expect(dryRun('compare').code).not.toBe(0);
});

// PR-STYLE-42：預設比對門檻偵測不到中性色這類小幅改值，所以另外確認每張基準的頁面底色（左上角）就是該明暗模式的 bg。
test('every baseline shows the page background of its mode in the top-left pixel', () => {
  const bg = { light: expectedBg('light'), dark: expectedBg('dark') };
  const wrong: string[] = [];
  const baselines = [
    ...visualPages.flatMap((p) => visualSuites.flatMap((s) => visualModes.flatMap((m) => visualWidths.map((w) => ({ name: baselineName(p, s, m, w), mode: m }))))),
    ...overviewCells.map((cell) => ({ name: overviewBaselineName(cell), mode: cell.mode })),
  ];
  expect(baselines).toHaveLength(120);
  for (const { name, mode } of baselines) {
    const got = readPng(fileURLToPath(file(`tests/__screenshots__/${name}.png`))).pixel(0, 0);
    if (got !== bg[mode]) wrong.push(`${name}.png: ${got}，應為 ${bg[mode]}`);
  }
  expect(wrong).toEqual([]);
});

test('the Docker script derives the official Playwright image tag from the installed @playwright/test version', () => {
  const pkg = JSON.parse(read('package.json'));
  expect(pkg.scripts['test:visual']).toContain('visual-docker.mjs');
  expect(pkg.scripts['update:visual']).toContain('visual-docker.mjs');
  const script = read('scripts/visual-docker.mjs');
  expect(script).toContain('mcr.microsoft.com/playwright:v');
  expect(script).toContain('-noble');
  expect(script).toContain('@playwright/test/package.json');
  // 腳本印出將使用的映像，讓測試不必真的跑 Docker 也能核對。
  const printed = execFileSync(process.execPath, [fileURLToPath(file('scripts/visual-docker.mjs')), '--print-image'], { encoding: 'utf8' }).trim();
  expect(printed).toBe(imageTag);
});

test('CI runs the same image in a separate visual job that deploy waits for', () => {
  const yml = read('.github/workflows/pages.yml').split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  const block = yml.match(/^ {2}visual:\n((?:(?: {4}.*)?\n?)*)/m)?.[1] ?? '';
  expect(block, '缺少 visual job').not.toBe('');
  expect(block).toContain(`\n    container: ${imageTag}\n`);
  expect(block).toContain('PW_VISUAL');
  expect(block).toContain('playwright test --project=visual');
  // 不帶這個旗標時，比對不符會改寫基準而不是失敗。
  expect(block).toContain('--update-snapshots=none');
  expect(yml).toMatch(/^ {4}needs:\s*\[\s*verify\s*,\s*visual\s*\]\s*$/m);
});

test('docs explain how to update the baselines through Docker', () => {
  const readme = read('README.md');
  expect(readme).toContain('npm run update:visual');
  expect(readme).toContain('npm run test:visual');
  expect(readme).toContain('Docker');
});
