// penpot-accent.mjs 的測試（ISSUE-028，PR-FILE-19）：只經公開邊界（buildAccentTokens 與命令列）觀察。
// 預期值呼叫同一份 deriveAccent（唯一一份），另加手寫字面值當獨立來源；推算規則本身由 tests/accent-derivation.spec.ts 涵蓋。
// 前置：先 npm run generate（讀 packages/tokens/dist/tokens.json 的中性色）。
// 執行：node --test scripts/design/penpot-accent.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveAccent } from '../../packages/tokens/accent.js';
import { buildAccentTokens } from './penpot-accent.mjs';

const tokenData = JSON.parse(readFileSync(new URL('../../packages/tokens/dist/tokens.json', import.meta.url), 'utf8'));

test('只給日間主色時，日間 set 的 accent 是該主色原值', () => {
  const out = buildAccentTokens({ light: '#B5179E' }, tokenData);
  assert.equal(out['Project Accent/Vibrant-Light'].accent.$value, '#B5179E');
  assert.equal(out['Project Accent/Vibrant-Light'].accent.$type, 'color');
});

const SUITES = ['Vibrant', 'Professional'];
const MODES = ['Light', 'Dark'];
const NAMES = { accent: 'accent', 'accent-secondary': 'secondary', 'accent-soft': 'accent-soft', 'accent-hover': 'accent-hover', 'accent-pressed': 'accent-pressed', 'focus-ring': 'focus-ring' };
const INPUTS = {
  '只給 light': { light: '#B5179E' },
  'light 加 dark': { light: '#B5179E', dark: '#FF7AD9' },
  '加 secondary': { light: '#B5179E', secondary: '#2E7D32' },
  '加 soft.light': { light: '#B5179E', soft: { light: '#FBE9F7' } },
  '加 soft.dark': { light: '#B5179E', soft: { dark: '#3A1030' } },
  '全給': { light: '#B5179E', dark: '#FF7AD9', secondary: '#2E7D32', soft: { light: '#FBE9F7', dark: '#3A1030' } },
};

for (const [label, input] of Object.entries(INPUTS)) {
  test(`${label}：4 個 set 的 6 個 token 逐值等於 deriveAccent`, () => {
    const out = buildAccentTokens(input, tokenData);
    for (const suite of SUITES) for (const mode of MODES) {
      const roles = deriveAccent(input, mode.toLowerCase(), tokenData[suite.toLowerCase()][mode.toLowerCase()]);
      const set = out[`Project Accent/${suite}-${mode}`];
      assert.deepEqual(Object.keys(set).sort(), Object.values(NAMES).sort());
      for (const [role, name] of Object.entries(NAMES)) assert.equal(set[name].$value, roles[role].toUpperCase(), `${suite}-${mode} ${name}`);
    }
  });
}

test('有給的顏色原樣使用：secondary 兩種模式相同，soft 與 dark 取給定值', () => {
  const out = buildAccentTokens(INPUTS['全給'], tokenData);
  assert.equal(out['Project Accent/Professional-Dark'].secondary.$value, '#2E7D32');
  assert.equal(out['Project Accent/Vibrant-Light'].secondary.$value, '#2E7D32');
  assert.equal(out['Project Accent/Vibrant-Dark'].accent.$value, '#FF7AD9');
  assert.equal(out['Project Accent/Vibrant-Light']['accent-soft'].$value, '#FBE9F7');
  assert.equal(out['Project Accent/Professional-Dark']['accent-soft'].$value, '#3A1030');
});

test('沒給 secondary 時沿用該模式的主色', () => {
  const out = buildAccentTokens(INPUTS['light 加 dark'], tokenData);
  assert.equal(out['Project Accent/Vibrant-Dark'].secondary.$value, '#FF7AD9');
  assert.equal(out['Project Accent/Vibrant-Light'].secondary.$value, '#B5179E');
});

test('結構：4 個 Suite x Mode theme 各多啟用對應的 Project Accent set，且排在既有 set 之後', () => {
  const out = buildAccentTokens(INPUTS['只給 light'], tokenData);
  const names = Object.keys(out).filter((k) => !k.startsWith('$'));
  assert.equal(names.length, 4);
  assert.deepEqual(out.$metadata.tokenSetOrder, names);
  assert.equal(out.$themes.length, 4);
  const dark = out.$themes.find((t) => t.name === 'Professional / Dark');
  assert.equal(dark.group, 'Suite x Mode');
  assert.equal(dark.id, 'suite-x-mode-professional-dark');
  assert.deepEqual(dark.selectedTokenSets, { Base: 'enabled', 'Suite x Mode/Professional-Dark': 'enabled', 'Project Accent/Professional-Dark': 'enabled' });
});

// 模擬 Penpot：theme 啟用的 set 依 tokenSetOrder 由前到後合併，同名 token 後者覆蓋前者。
test('與 penpot-tokens.json 依 tokenSetOrder 合併後：6 個 token 是推算值，其餘與原檔相同，語意狀態色不變', () => {
  const base = JSON.parse(readFileSync(new URL('../../docs/mockup/themes/penpot-tokens.json', import.meta.url), 'utf8'));
  const out = buildAccentTokens(INPUTS['全給'], tokenData);
  const order = [...base.$metadata.tokenSetOrder, ...out.$metadata.tokenSetOrder];
  const sets = { ...base, ...out };
  for (const theme of out.$themes) {
    const merged = {};
    for (const name of order) if (theme.selectedTokenSets[name] === 'enabled') Object.assign(merged, sets[name]);
    const [suite, mode] = theme.name.split(' / ');
    const original = {};
    for (const name of base.$metadata.tokenSetOrder) if (base.$themes.find((t) => t.id === theme.id).selectedTokenSets[name] === 'enabled') Object.assign(original, base[name]);
    const roles = deriveAccent(INPUTS['全給'], mode.toLowerCase(), tokenData[suite.toLowerCase()][mode.toLowerCase()]);
    for (const [role, name] of Object.entries(NAMES)) assert.equal(merged[name].$value, roles[role].toUpperCase(), `${theme.name} ${name}`);
    for (const key of Object.keys(original)) if (!Object.values(NAMES).includes(key)) assert.deepEqual(merged[key], original[key], `${theme.name} ${key}`);
    assert.deepEqual(Object.keys(merged).sort(), Object.keys(original).sort());
  }
});

test('壞輸入：缺 light 或非 #RRGGBB 會丟錯', () => {
  assert.throws(() => buildAccentTokens({}, tokenData), /light/);
  assert.throws(() => buildAccentTokens({ light: 'red' }, tokenData), /#RRGGBB/);
  assert.throws(() => buildAccentTokens({ light: '#B5179E', soft: { dark: '#12' } }, tokenData), /soft\.dark/);
});

// ---------- 命令列 ----------

const cli = fileURLToPath(new URL('./penpot-accent.mjs', import.meta.url));
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });

test('命令列：--out 寫出的檔與 stdout 相同，且連跑兩次位元組相同', () => {
  const dir = mkdtempSync(join(tmpdir(), 'penpot-accent-'));
  try {
    const file = join(dir, 'a.json');
    const first = run('--accent', '{"light":"#B5179E"}', '--out', file);
    assert.equal(first.status, 0);
    const bytes = readFileSync(file);
    run('--accent', '{"light":"#B5179E"}', '--out', file);
    assert.ok(bytes.equals(readFileSync(file)));
    const stdout = run('--accent', '{"light":"#B5179E"}');
    assert.equal(stdout.status, 0);
    assert.equal(stdout.stdout, bytes.toString('utf8'));
    assert.deepEqual(JSON.parse(stdout.stdout), buildAccentTokens({ light: '#B5179E' }, tokenData));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('命令列：壞 JSON、缺 light、非 #RRGGBB、缺 --accent 結束碼 1', () => {
  for (const arg of ['{bad', '{}', '{"light":"red"}']) assert.equal(run('--accent', arg).status, 1, arg);
  assert.equal(run().status, 1);
});

test('命令列：--out 寫不進去結束碼 2', () => {
  const dir = mkdtempSync(join(tmpdir(), 'penpot-accent-'));
  try {
    assert.equal(run('--accent', '{"light":"#B5179E"}', '--out', join(dir, 'no-such-dir', 'a.json')).status, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
