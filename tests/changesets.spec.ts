import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// PR-ADOPT-09、PR-RELEASE-04：changesets 讓兩個套件版本一致；0.3.0 已套用，升級說明在 CHANGELOG.md。
// 全部離線；再次套用只在暫存複本跑，不動 repo 本身。
const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path: string) => readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n');
const changesetCli = join(root, 'node_modules/@changesets/cli/bin.js');
const names = ['@luca-style/tokens', '@luca-style/react'];

const config = JSON.parse(read('.changeset/config.json'));

test('config binds both packages into one lockstep version group and publishes publicly', () => {
  expect(config.fixed).toEqual([names]);
  expect(config.access).toBe('public');
  expect(config.baseBranch).toBe('main');
});

const readJson = (path: string) => JSON.parse(read(path));

// 版本已經套用（PR-RELEASE-04）：兩個套件、鎖定檔的工作區條目都是 0.3.0，changeset 已被消耗。
test('both packages and the lockfile workspace entries are at 0.3.0', () => {
  const tokens = readJson('packages/tokens/package.json');
  const react = readJson('packages/react/package.json');
  expect(tokens.version).toBe('0.3.0');
  expect(react.version).toBe('0.3.0');
  expect(react.dependencies['@luca-style/tokens']).toBe('0.3.0');
  const lock = readJson('package-lock.json').packages;
  expect(lock['packages/tokens'].version).toBe('0.3.0');
  expect(lock['packages/react'].version).toBe('0.3.0');
  expect(lock['packages/react'].dependencies['@luca-style/tokens']).toBe('0.3.0');
});

test('no pending changeset is left: .changeset holds only config.json and an optional README', () => {
  expect(readdirSync(join(root, '.changeset')).filter((f) => f !== 'config.json' && f !== 'README.md')).toEqual([]);
});

test('each package has a CHANGELOG.md with a 0.3.0 entry', () => {
  for (const dir of ['tokens', 'react']) {
    const log = read(`packages/${dir}/CHANGELOG.md`);
    expect(log).toMatch(new RegExp(`^# @luca-style/${dir}$`, 'm'));
    expect(log).toMatch(/^## 0\.3\.0$/m);
    expect(log).toMatch(/^### Minor Changes$/m);
  }
});

// 版本已套用後再跑一次：changesets 以 exit 1 回報沒有待處理的 changeset，且不改任何檔案。
// 在已提交的暫存複本上跑，工作樹乾淨就是 publish.yml 的乾淨工作樹檢查看到的狀態。
test('running changeset version again changes nothing and leaves a clean working tree', () => {
  const copy = mkdtempSync(join(tmpdir(), 'luca-changeset-'));
  try {
    cpSync(join(root, '.changeset'), join(copy, '.changeset'), { recursive: true });
    for (const file of ['package.json', 'package-lock.json', 'apps/showcase/package.json', 'packages/tokens/package.json', 'packages/react/package.json', 'packages/tokens/CHANGELOG.md', 'packages/react/CHANGELOG.md']) {
      mkdirSync(dirname(join(copy, file)), { recursive: true });
      cpSync(join(root, file), join(copy, file));
    }
    const git = (...args: string[]) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...args], { cwd: copy, encoding: 'utf8' });
    git('init', '-q');
    git('add', '-A');
    expect(git('commit', '-q', '-m', 'applied').status).toBe(0);
    const result = spawnSync(process.execPath, [changesetCli, 'version'], { cwd: copy, encoding: 'utf8' });
    expect(result.status, result.stdout + result.stderr).toBe(1);
    expect(result.stdout + result.stderr).toMatch(/No unreleased changesets found/);
    expect(git('status', '--porcelain').stdout).toBe('');
  } finally {
    rmSync(copy, { recursive: true, force: true });
  }
});

// 升級說明：每個項目一條錨定在同一行的樣式，避免只靠散落的關鍵字湊數。
// 升級說明現在在各套件的 CHANGELOG.md（changesets 套用時由 first-npm-release.md 產生）。
const notes = read('packages/react/CHANGELOG.md');
const mustHave: Array<[string, RegExp]> = [
  ['control height equals control-height instead of 50px', /^.*Button.*Select.*TextField.*`control-height`.*50px.*$/m],
  ['Select long values wrap instead of ellipsis', /^.*Select.*換行.*省略號.*$/m],
  ['.luca-input is border-box', /^.*`\.luca-input`.*`border-box`.*$/m],
  ['Button no longer shrinks in a flex row', /^.*Button.*flex.*不再收縮.*$/m],
  ['navigation selectors, new specificity and old selectors', /^.*`\.luca-navigation-link`.*`\.luca-brand`.*\(0,1,0\).*$/m],
  ['old navigation selectors named for rewriting', /^.*`\.luca-navigation a`.*`\.luca-navigation \.luca-brand`.*改寫.*$/m],
  ['react peer range widened', /^.*`react`.*`react-dom`.*`\^19\.0\.0`.*`\^18\.0\.0 \|\| \^19\.0\.0`.*$/m],
  ['theme module gets use client', /^.*`theme`.*'use client'.*$/m],
  ['controls module gets use client', /^.*`controls`.*'use client'.*$/m],
  ['button module gets use client', /^.*`button`.*'use client'.*$/m],
  ['data-display module gets use client', /^.*`data-display`.*'use client'.*$/m],
  ['themeInitScript moves to directive-free theme-init', /^.*`themeInitScript`.*`theme-init`.*匯入路徑不變.*$/m],
  ['Vite 8 MODULE_LEVEL_DIRECTIVE warning', /^.*Vite 8.*`MODULE_LEVEL_DIRECTIVE`.*consumer-guide.*$/m],
  ['Navigation renderLink', /^.*`Navigation`.*`renderLink`.*$/m],
  ['Button render (ButtonLinkProps)', /^.*`Button`.*`render`.*`ButtonLinkProps`.*$/m],
  ['StatusMessage label and exported StatusMessageProps', /^.*`StatusMessage`.*`label`.*`StatusMessageProps`.*$/m],
  ['ContentState retryLabel', /^.*`ContentState`.*`retryLabel`.*$/m],
  ['Checkbox hideLabel', /^.*`Checkbox`.*`hideLabel`.*$/m],
  ['new props leave output unchanged when omitted', /^.*不給.*輸出不變.*$/m],
  ['.luca-checkbox gains position:relative', /^.*`\.luca-checkbox`.*`position:relative`.*$/m],
];
for (const [name, pattern] of mustHave) {
  test(`upgrade notes cover: ${name}`, () => {
    expect(notes).toMatch(pattern);
  });
}
