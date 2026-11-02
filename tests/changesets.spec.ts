import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// PR-ADOPT-09：changesets 讓兩個套件版本一致，且第一個 changeset 把版本帶到 0.3.0 並附升級說明。
// 全部離線；版本帶動只在暫存複本跑，不動 repo 本身。
const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path: string) => readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n');
const changesetCli = join(root, 'node_modules/@changesets/cli/bin.js');
const names = ['@luca-style/tokens', '@luca-style/react'];

const config = JSON.parse(read('.changeset/config.json'));
const files = readdirSync(join(root, '.changeset')).filter((f) => f.endsWith('.md') && f !== 'README.md');

test('config binds both packages into one lockstep version group and publishes publicly', () => {
  expect(config.fixed).toEqual([names]);
  expect(config.access).toBe('public');
  expect(config.baseBranch).toBe('main');
});

// 這組檢查描述「首次發佈 0.3.0 之前」的狀態；0.3.0 版本套用、changeset 被消耗後，由發佈的下一份規格改寫或移除。
test('exactly one pending changeset raises both packages by minor', () => {
  expect(files).toHaveLength(1);
  const front = read(`.changeset/${files[0]}`).match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? '';
  const entries = front.split('\n').map((line) => line.match(/^"([^"]+)":\s*(\w+)$/)).map((m) => (m ? [m[1], m[2]] : null));
  expect(entries).toEqual(names.map((n) => [n, 'minor']));
});

test('applying the changeset on a temporary copy gives exactly 0.3.0 for both packages', () => {
  const copy = mkdtempSync(join(tmpdir(), 'luca-changeset-'));
  try {
    cpSync(join(root, '.changeset'), join(copy, '.changeset'), { recursive: true });
    for (const file of ['package.json']) cpSync(join(root, file), join(copy, file));
    for (const dir of ['tokens', 'react']) {
      mkdirSync(join(copy, 'packages', dir), { recursive: true });
      cpSync(join(root, 'packages', dir, 'package.json'), join(copy, 'packages', dir, 'package.json'));
    }
    mkdirSync(join(copy, 'apps/showcase'), { recursive: true });
    cpSync(join(root, 'apps/showcase/package.json'), join(copy, 'apps/showcase/package.json'));
    // changesets 靠鎖定檔判斷套件管理員才找得到工作區套件；空鎖定檔即可。
    writeFileSync(join(copy, 'package-lock.json'), '{}');
    spawnSync('git', ['init', '-q'], { cwd: copy });
    const result = spawnSync(process.execPath, [changesetCli, 'version'], { cwd: copy, encoding: 'utf8' });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const tokens = JSON.parse(readFileSync(join(copy, 'packages/tokens/package.json'), 'utf8'));
    const react = JSON.parse(readFileSync(join(copy, 'packages/react/package.json'), 'utf8'));
    expect(tokens.version).toBe('0.3.0');
    expect(react.version).toBe('0.3.0');
    expect(react.dependencies['@luca-style/tokens']).toBe('0.3.0');
  } finally {
    rmSync(copy, { recursive: true, force: true });
  }
});

// 升級說明：每個項目一條錨定在同一行的樣式，避免只靠散落的關鍵字湊數。
const notes = read(`.changeset/${files[0]}`);
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
