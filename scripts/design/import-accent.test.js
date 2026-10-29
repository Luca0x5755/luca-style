// import-accent.js 的行為測試：只經由公開邊界（命令列參數、結束碼、輸出）與它寫出的 .fig 觀察，
// 用離線 `openpencil eval` / `openpencil export` 讀回，不 import 腳本內部函式。
// 用法：node --test scripts/design/import-accent.test.js
// 推算規則本身由 tests/accent-derivation.spec.ts 涵蓋；這裡驗的是「腳本接上了 deriveAccent」，
// 所以預期值直接呼叫同一個 deriveAccent（唯一一份），另加手寫字面值當獨立來源。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deriveAccent } from '../../packages/tokens/accent.js';
import { libraryFig, mutate, run, tempDir } from './test-helpers.js';
import { readPng } from '../png-pixel.mjs';

const tokenData = JSON.parse(readFileSync(new URL('../../packages/tokens/dist/tokens.json', import.meta.url), 'utf8'));
const SCRIPT = 'import-accent.js';
// 角色名（CSS 變數名）→ 設計檔變數名；accent-secondary 在設計檔叫 secondary。
const FIG_NAME = { accent: 'accent', 'accent-secondary': 'secondary', 'accent-soft': 'accent-soft', 'accent-hover': 'accent-hover', 'accent-pressed': 'accent-pressed', 'focus-ring': 'focus-ring' };
const COMBOS = [['Vibrant', 'Light'], ['Vibrant', 'Dark'], ['Professional', 'Light'], ['Professional', 'Dark']];

const openpencil = (file, code, extra = []) => execFileSync('openpencil', ['eval', `"${file}"`, '--stdin', '--json', ...extra], {
  input: code, encoding: 'utf8', shell: true, stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024,
});

// 讀回 Suite x Mode 集合內全部變數在各模式的值（顏色轉 #RRGGBB）。
const readSuiteXMode = (file) => JSON.parse(openpencil(file, `
const col = figma.getLocalVariableCollections().find((c) => c.name === 'Suite x Mode')
const hex = (c) => '#' + [c.r, c.g, c.b].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('').toUpperCase()
const out = {}
for (const v of figma.getLocalVariables().filter((x) => x.collectionId === col.id)) {
  out[v.name] = Object.fromEntries(col.modes.map((m) => { const val = v.valuesByMode[m.modeId]; return [m.name, val && typeof val === 'object' && 'r' in val ? hex(val) : val] }))
}
return out`));

const fresh = () => {
  const copy = join(tempDir('import-accent-'), 'my-design.fig');
  copyFileSync(libraryFig, copy);
  return copy;
};
const expectedRoles = (input, suite, mode) => deriveAccent(input, mode.toLowerCase(), tokenData[suite.toLowerCase()][mode.toLowerCase()]);
const accentArg = (input) => ['--accent', JSON.stringify(input)];
const importInto = (file, input) => run(SCRIPT, {}, [file, ...accentArg(input)]);

test('匯入後 Suite x Mode 的強調色六個變數，四個模式都等於 deriveAccent 的推算', () => {
  const input = { light: '#B5179E' };
  const file = fresh();
  const r = importInto(file, input);
  assert.equal(r.code, 0, r.out);
  const state = readSuiteXMode(file);
  for (const [suite, mode] of COMBOS) {
    const roles = expectedRoles(input, suite, mode);
    for (const [role, figName] of Object.entries(FIG_NAME)) {
      assert.equal(state[figName][`${suite} / ${mode}`], roles[role].toUpperCase(), `${figName} @ ${suite} / ${mode}`);
    }
  }
  // 獨立來源：日間主色原樣落在兩個套系的 Light 模式。
  assert.equal(state.accent['Vibrant / Light'], '#B5179E');
  assert.equal(state.accent['Professional / Light'], '#B5179E');
});

// 之後的測試需要的小工具：回傳 PNG 中出現過的完全不透明顏色集合（解碼共用 scripts/png-pixel.mjs）。
const colorsInPng = (path) => {
  const image = readPng(path);
  const colors = new Set();
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) if (image.alpha(x, y) === 255) colors.add(image.pixel(x, y));
  }
  return colors;
};

// 把檔案內所有母版的 Suite x Mode 模式設成指定組合，另存成副本（套系與明暗只由這一個集合切換，ISSUE-015）。
const withModes = (file, suite, mode) => mutate(file, join(tempDir('import-accent-modes-'), 'modes.fig'), `
const want = { 'Suite x Mode': ${JSON.stringify(`${suite} / ${mode}`)} }
const set = {}
for (const c of figma.getLocalVariableCollections()) { const m = want[c.name] && c.modes.find((x) => x.name === want[c.name]); if (m) set[c.id] = m.modeId }
for (const p of figma.root.children) for (const n of p.children) figma.graph.updateNode(n.id, { variableModes: set })`);

// 一次取得全部母版的節點 id，再逐一匯出 PNG，回傳 { 母版名: 畫面上出現的顏色集合 }。
const renderMasters = (file, names) => {
  const ids = JSON.parse(openpencil(file, 'return Object.fromEntries(figma.root.children.flatMap((p) => p.children).map((n) => [n.name, n.id]))'));
  const dir = tempDir('import-accent-png-');
  return Object.fromEntries(names.map((name, i) => {
    const png = join(dir, `master-${i}.png`);
    execFileSync('openpencil', ['export', `"${file}"`, '--node', ids[name], '-o', `"${png}"`], { encoding: 'utf8', shell: true, stdio: ['pipe', 'pipe', 'pipe'] });
    return [name, colorsInPng(png)];
  }));
};

// 母版 → 該母版畫面上應出現的角色（取自 bindings.json；C/Button/Hover 填 accent-hover，Focus 描邊 focus-ring，Select/Open 選項底 accent-soft）。
const MASTER_ROLES = [['C/Button/Primary', 'accent'], ['C/Button/Hover', 'accent-hover'], ['C/Button/Focus', 'focus-ring'], ['C/Select/Open', 'accent-soft']];

test('匯入後匯出母版，畫面顯示該強調色（滑過、焦點框、柔和底色；四種套系明暗組合）', () => {
  const input = { light: '#B5179E', dark: '#E58AD8', secondary: '#2E7D32', soft: { light: '#F8E1F4', dark: '#4A1D42' } };
  const original = fresh(), imported = fresh();
  assert.equal(importInto(imported, input).code, 0);
  const names = MASTER_ROLES.map(([master]) => master);
  for (const [suite, mode] of COMBOS) {
    const roles = expectedRoles(input, suite, mode);
    const shownAfter = renderMasters(withModes(imported, suite, mode), names);
    const shownBefore = renderMasters(withModes(original, suite, mode), names);
    for (const [master, role] of MASTER_ROLES) {
      assert.ok(shownAfter[master].has(roles[role].toUpperCase()), `${master} @ ${suite}/${mode} 應顯示 ${role} ${roles[role]}`);
      // 反向保險：未匯入的原檔不會顯示這個測試色，差異來自匯入而非巧合。
      assert.ok(!shownBefore[master].has(roles[role].toUpperCase()), `${master} 原檔不應已有 ${roles[role]}`);
    }
  }
});

// accent-pressed 沒有任何母版綁定（沒有按下狀態的母版），匯出畫面無從觀察：這裡只在變數層驗證，
// 不能當成「按下色已顯示在母版上」。
test('accent-pressed 只在變數層驗證：四個模式都等於推算值，且與主色、滑過色不同', () => {
  const input = { light: '#B5179E' };
  const file = fresh();
  assert.equal(importInto(file, input).code, 0);
  const state = readSuiteXMode(file);
  for (const [suite, mode] of COMBOS) {
    const key = `${suite} / ${mode}`;
    assert.equal(state['accent-pressed'][key], expectedRoles(input, suite, mode)['accent-pressed'].toUpperCase());
    assert.notEqual(state['accent-pressed'][key], state.accent[key]);
    assert.notEqual(state['accent-pressed'][key], state['accent-hover'][key]);
  }
});

test('只覆寫六個強調色變數；成功／警告／錯誤色、其他變數與其他集合的值不變', () => {
  const before = readSuiteXMode(libraryFig), file = fresh();
  assert.equal(importInto(file, { light: '#B5179E' }).code, 0);
  const after = readSuiteXMode(file);
  assert.deepEqual(Object.keys(after).sort(), Object.keys(before).sort());
  for (const name of Object.keys(before)) {
    if (Object.values(FIG_NAME).includes(name)) continue;
    assert.deepEqual(after[name], before[name], name);
  }
  // 其他集合：以 apply-variables 的唯讀 --list 比對，扣掉六個變數的行。
  const list = (f) => run('apply-variables.js', { APPLY_VARIABLES_LIBRARY: f }, ['--list']).out.split('\n')
    .filter((l) => !l.startsWith('#') && !Object.values(FIG_NAME).some((n) => l.startsWith(`Suite x Mode | ${n} |`))).join('\n');
  assert.equal(list(file), list(libraryFig));
});

test('同一輸入重跑：回報已是最新（以解析後的值比對，不看檔案位元組）', () => {
  const file = fresh();
  assert.equal(importInto(file, { light: '#B5179E' }).code, 0);
  const second = importInto(file, { light: '#B5179E' });
  assert.equal(second.code, 0, second.out);
  assert.match(second.out, /已是最新/);
  // 換一個主色就要重新寫入。
  assert.match(importInto(file, { light: '#147F82' }).out, /已匯入強調色/);
});

test('壞輸入結束碼非 0 且不寫檔（檔案位元組不變）', () => {
  const file = fresh(), bytes = readFileSync(file);
  const bad = [
    ['缺 light', JSON.stringify({ dark: '#E58AD8' }), /缺少必填的 light/],
    ['非 #RRGGBB', JSON.stringify({ light: 'red' }), /須為 #RRGGBB/],
    ['dark 非 #RRGGBB', JSON.stringify({ light: '#B5179E', dark: '#abc' }), /dark 須為 #RRGGBB/],
    ['不是 JSON', '{light', /不是合法的 JSON/],
  ];
  for (const [label, text, pattern] of bad) {
    const r = run(SCRIPT, {}, [file, '--accent', text]);
    assert.equal(r.code, 1, `${label}：${r.out}`);
    assert.match(r.out, pattern, label);
  }
  assert.deepEqual(readFileSync(file), bytes);
});

test('找不到設計檔、或不是元件庫設計檔 → 結束碼非 0', () => {
  const dir = tempDir('import-accent-bad-');
  assert.equal(importInto(join(dir, 'missing.fig'), { light: '#B5179E' }).code, 2);
  // 刪掉 Suite x Mode 集合的副本不是元件庫。
  const broken = mutate(libraryFig, join(dir, 'broken.fig'), `figma.deleteVariableCollection(figma.getLocalVariableCollections().find((c) => c.name === 'Suite x Mode').id)`);
  const bytes = readFileSync(broken);
  const r = importInto(broken, { light: '#B5179E' });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /不是元件庫設計檔/);
  assert.deepEqual(readFileSync(broken), bytes);
});

test('consumer-guide 的範例指令照字面可執行，且寫明複製匯入與重新匯入兩件事', () => {
  const guide = readFileSync(new URL('../../docs/consumer-guide.md', import.meta.url), 'utf8');
  const section = guide.slice(guide.indexOf('## 複製元件庫設計檔並匯入專案強調色'), guide.indexOf('## 內容載入動畫'));
  assert.ok(section.length > 0, '找不到章節');
  assert.match(section, /### 第一次：複製並匯入強調色/);
  assert.match(section, /### luca-style 更新後：重新匯入設計變數/);
  assert.match(section, /npm run generate/);
  assert.match(section, /不會自動更新/);
  // 抽出範例指令，把示意路徑換成暫存複本後實際跑一次。
  const command = section.match(/node scripts\/design\/import-accent\.js (\S+) --accent '(.+)'/);
  assert.ok(command, '找不到範例指令');
  const file = fresh();
  const r = run(SCRIPT, {}, [file, '--accent', command[2]]);
  assert.equal(r.code, 0, r.out);
  assert.equal(readSuiteXMode(file).accent['Vibrant / Light'], JSON.parse(command[2]).light.toUpperCase());
});
