// apply-variables.js 的行為測試：只經由公開邊界（命令列＋環境變數指定的路徑）觀察結束碼、輸出，
// 並用離線唯讀的 openpencil eval 讀回暫存副本的集合、模式與變數值。
// 用法：node --test scripts/design/apply-variables.test.js
// 預期值都是手寫的字面值，不用被測程式的邏輯重算。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const script = resolve(here, 'apply-variables.js');
const mockup = resolve(here, '../../docs/mockup');

const MODES = ['Light', 'Dark'];
const SUITES = ['Vibrant', 'Professional'];
const DEVICES = ['Desktop', 'Tablet', 'Mobile'];

// 依 (mode, suite, device) 產生 12 個組合鍵的值。
const expand = (fn) => {
  const values = {};
  for (const m of MODES) for (const s of SUITES) for (const d of DEVICES) values[`${m}/${s}/${d}`] = fn(m, s, d);
  return values;
};

// 迷你變數檔：bg 依明暗；fs-hero 依裝置；radius-card 只依套系；font-zh 為常數；
// accent 同時依套系與明暗；loading-opacity 依明暗且為 0–100 原值；elevation 為布林（依套系）。
// 集合與每個變數所在的集合由產生器決定，這裡手寫同樣的結構。
const COLLECTIONS = [
  { name: 'Base', axes: [], modes: ['Default'] },
  { name: 'Suite', axes: ['suite'], modes: SUITES },
  { name: 'Mode', axes: ['mode'], modes: MODES },
  { name: 'Device', axes: ['device'], modes: DEVICES },
  { name: 'Suite x Mode', axes: ['suite', 'mode'], modes: ['Vibrant / Light', 'Vibrant / Dark', 'Professional / Light', 'Professional / Dark'] },
];
const miniVariables = (overrides = {}) => ({
  axes: { mode: MODES, suite: SUITES, device: DEVICES },
  collections: COLLECTIONS,
  count: 7,
  variables: [
    { name: 'bg', type: 'color', collection: 'Mode', values: expand((m) => (m === 'Light' ? '#F7F7F2' : '#151A18')) },
    { name: 'fs-hero', type: 'number', collection: 'Device', values: expand((m, s, d) => ({ Desktop: 56, Tablet: 44, Mobile: 32 })[d]) },
    { name: 'radius-card', type: 'number', collection: 'Suite', values: expand((m, s) => (s === 'Vibrant' ? 20 : 3)) },
    { name: 'font-zh', type: 'string', collection: 'Base', values: expand(() => 'Noto Sans TC') },
    { name: 'loading-opacity', type: 'number', collection: 'Mode', values: expand((m) => (m === 'Light' ? 100 : 0)) },
    { name: 'elevation', type: 'boolean', collection: 'Suite', values: expand((m, s) => s === 'Vibrant') },
    { name: 'accent', type: 'color', collection: 'Suite x Mode', values: expand((m, s) => ({ 'Light/Vibrant': '#147F82', 'Dark/Vibrant': '#64C2BC', 'Light/Professional': '#625C83', 'Dark/Professional': '#ABA4D7' })[`${m}/${s}`]) },
  ].map((v) => ({ ...v, ...(overrides[v.name] || {}) })),
});

const setup = (variables = miniVariables()) => {
  const dir = mkdtempSync(join(tmpdir(), 'apply-vars-'));
  const library = join(dir, 'lib.fig');
  copyFileSync(join(mockup, 'luca-style-library.fig'), library);
  const json = join(dir, 'variables.json');
  writeFileSync(json, JSON.stringify(variables));
  const env = { ...process.env, APPLY_VARIABLES_JSON: json, APPLY_VARIABLES_LIBRARY: library };
  const run = (args = [], extra = {}) => {
    const r = spawnSync('node', [script, ...args], { env: { ...env, ...extra }, encoding: 'utf8' });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  return { dir, library, json, run, env };
};

// 用 openpencil eval 讀回集合與變數，轉成 { 集合名: { modes: [...], vars: { 變數名: { type, 模式名: 值 } } } }。
const readBack = (file) => {
  const code = `
const cols = figma.getLocalVariableCollections()
const vars = figma.getLocalVariables()
return cols.map((c) => ({
  name: c.name,
  modes: c.modes.map((m) => m.name),
  vars: vars.filter((v) => v.collectionId === c.id).map((v) => ({
    name: v.name, type: v.type,
    values: Object.fromEntries(c.modes.map((m) => [m.name, v.valuesByMode[m.modeId]])),
  })),
}))`;
  const out = execFileSync('openpencil', ['eval', file, '--stdin', '--json'], { input: code, encoding: 'utf8', shell: true });
  const list = JSON.parse(out);
  return Object.fromEntries(list.map((c) => [c.name, { modes: c.modes, vars: Object.fromEntries(c.vars.map((v) => [v.name, v])) }]));
};

const hex = (c) => '#' + [c.r, c.g, c.b].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('').toUpperCase();

test('套用後設計檔有 Base、Suite、Mode、Device、Suite x Mode 五個集合與正確的模式', () => {
  const t = setup();
  const r = t.run();
  assert.equal(r.code, 0, r.out);
  const got = readBack(t.library);
  assert.deepEqual(Object.keys(got).sort(), ['Base', 'Device', 'Mode', 'Suite', 'Suite x Mode']);
  assert.deepEqual(got.Suite.modes, ['Vibrant', 'Professional']);
  assert.deepEqual(got.Mode.modes, ['Light', 'Dark']);
  assert.deepEqual(got.Device.modes, ['Desktop', 'Tablet', 'Mobile']);
  assert.deepEqual(got.Base.modes, ['Default']);
  assert.deepEqual(got['Suite x Mode'].modes, ['Vibrant / Light', 'Vibrant / Dark', 'Professional / Light', 'Professional / Dark']);
});

test('變數依變化的軸放進對應集合；同時依套系與明暗的變數放進 Suite x Mode', () => {
  const t = setup();
  t.run();
  const got = readBack(t.library);
  assert.deepEqual(Object.keys(got.Mode.vars).sort(), ['bg', 'loading-opacity']);
  assert.deepEqual(Object.keys(got.Device.vars), ['fs-hero']);
  assert.deepEqual(Object.keys(got.Suite.vars).sort(), ['elevation', 'radius-card']);
  assert.deepEqual(Object.keys(got.Base.vars), ['font-zh']);
  assert.deepEqual(Object.keys(got['Suite x Mode'].vars), ['accent']);
});

test('每個模式的值依該集合的軸取自 variables.json，型別與值逐筆一致', () => {
  const t = setup();
  t.run();
  const got = readBack(t.library);
  assert.equal(got.Mode.vars.bg.type, 'COLOR');
  assert.equal(hex(got.Mode.vars.bg.values.Light), '#F7F7F2');
  assert.equal(hex(got.Mode.vars.bg.values.Dark), '#151A18');
  assert.equal(got.Mode.vars.bg.values.Light.a, 1);
  assert.deepEqual(got.Device.vars['fs-hero'].values, { Desktop: 56, Tablet: 44, Mobile: 32 });
  assert.equal(got.Device.vars['fs-hero'].type, 'FLOAT');
  assert.deepEqual(got.Suite.vars['radius-card'].values, { Vibrant: 20, Professional: 3 });
  assert.equal(got.Base.vars['font-zh'].type, 'STRING');
  assert.equal(got.Base.vars['font-zh'].values.Default, 'Noto Sans TC');
  assert.equal(got.Suite.vars.elevation.type, 'BOOLEAN');
  assert.deepEqual(got.Suite.vars.elevation.values, { Vibrant: true, Professional: false });
  // opacity 維持 0–100 原值
  assert.deepEqual(got.Mode.vars['loading-opacity'].values, { Light: 100, Dark: 0 });
  // 四個「套系 / 明暗」模式各取自己那一組的值
  const accent = got['Suite x Mode'].vars.accent.values;
  assert.deepEqual(Object.fromEntries(Object.entries(accent).map(([m, c]) => [m, hex(c)])), {
    'Vibrant / Light': '#147F82', 'Vibrant / Dark': '#64C2BC', 'Professional / Light': '#625C83', 'Professional / Dark': '#ABA4D7',
  });
});

test('重跑不產生重複的集合或變數，且第二次不寫檔', () => {
  const t = setup();
  t.run();
  const first = readBack(t.library);
  const again = t.run();
  assert.equal(again.code, 0, again.out);
  assert.match(again.out, /已是最新/);
  const second = readBack(t.library);
  assert.deepEqual(second, first);
  assert.equal(Object.keys(second).length, 5);
  assert.equal(Object.values(second).reduce((n, c) => n + Object.keys(c.vars).length, 0), 7);
});

test('--check 在檔案已套用時結束碼 0，尚未套用或值被改壞時結束碼 1 並列出變數名稱', () => {
  const t = setup();
  const before = t.run(['--check']);
  assert.equal(before.code, 1);
  t.run();
  assert.equal(t.run(['--check']).code, 0);
  // 改 JSON 的期望值：檔案裡的值就與 JSON 不一致
  writeFileSync(t.json, JSON.stringify(miniVariables({ 'fs-hero': { values: expand((m, s, d) => ({ Desktop: 57, Tablet: 44, Mobile: 32 })[d]) } })));
  const bad = t.run(['--check']);
  assert.equal(bad.code, 1);
  assert.match(bad.out, /fs-hero/);
});

test('JSON 的值改變後重新套用會更新原變數，不新增重複', () => {
  const t = setup();
  t.run();
  writeFileSync(t.json, JSON.stringify(miniVariables({ 'fs-hero': { values: expand((m, s, d) => ({ Desktop: 60, Tablet: 44, Mobile: 32 })[d]) } })));
  const r = t.run();
  assert.equal(r.code, 0, r.out);
  const got = readBack(t.library);
  assert.equal(got.Device.vars['fs-hero'].values.Desktop, 60);
  assert.equal(Object.keys(got.Device.vars).length, 1);
});

test('JSON 少了一個變數時，重新套用會移除檔內多餘的變數', () => {
  const t = setup();
  t.run();
  const fewer = miniVariables();
  fewer.variables = fewer.variables.filter((v) => v.name !== 'font-zh');
  writeFileSync(t.json, JSON.stringify(fewer));
  assert.equal(t.run().code, 0);
  assert.deepEqual(Object.keys(readBack(t.library).Base.vars), []);
});

test('變數放在沒有涵蓋其變化軸的集合時拒絕，並指出變數與集合', () => {
  // bg 依明暗變化，卻放在只有 Default 一個模式的 Base：切換明暗時值會被吃掉。
  const t = setup(miniVariables({ bg: { collection: 'Base' } }));
  const r = t.run();
  assert.equal(r.code, 1);
  assert.match(r.out, /bg/);
  assert.match(r.out, /Base/);
  assert.match(r.out, /mode/);
  // 同時依套系與明暗的 accent 放進 Mode，也一樣拒絕。
  const r2 = setup(miniVariables({ accent: { collection: 'Mode' } })).run();
  assert.equal(r2.code, 1);
  assert.match(r2.out, /accent/);
});

test('--check 輸出節點數，達到上限時失敗', () => {
  const t = setup();
  t.run();
  // 23 個母版共 110 個節點，加上畫布頁與存放變數的空白 Internal Only Canvas 頁。
  const ok = t.run(['--check']);
  assert.match(ok.out, /節點數 112/);
  const over = t.run(['--check'], { APPLY_VARIABLES_NODE_LIMIT: '100' });
  assert.equal(over.code, 1);
  assert.match(over.out, /節點數/);
});

test('--list 逐變數逐模式列出一行', () => {
  const t = setup();
  t.run();
  const r = t.run(['--list']);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /lib\.fig/);
  assert.match(r.out, /Mode\s*\|\s*bg\s*\|\s*COLOR\s*\|\s*Dark\s*\|\s*#151A18/);
  assert.match(r.out, /Device\s*\|\s*fs-hero\s*\|\s*FLOAT\s*\|\s*Mobile\s*\|\s*32/);
});

// .fig 的 FLOAT 變數以 32 位元浮點數儲存，1.2 讀回是 1.2000000476837158；比對須以同精度判斷，否則套用後永遠有差異。
test('非二進位整分的小數（如行高 1.2）套用後 --check 一致，重跑不再寫檔', () => {
  const t = setup(miniVariables({ 'fs-hero': { values: expand((m, s, d) => ({ Desktop: 1.2, Tablet: 1.3, Mobile: 1.6 })[d]) } }));
  assert.equal(t.run().code, 0);
  const check = t.run(['--check']);
  assert.equal(check.code, 0, check.out);
  assert.match(t.run().out, /已是最新/);
  // 精度內真的不同的值仍要報差異。
  writeFileSync(t.json, JSON.stringify(miniVariables({ 'fs-hero': { values: expand((m, s, d) => ({ Desktop: 1.25, Tablet: 1.3, Mobile: 1.6 })[d]) } })));
  const bad = t.run(['--check']);
  assert.equal(bad.code, 1);
  assert.match(bad.out, /fs-hero/);
});

// PR-FILE-16：進版控的元件庫設計檔，變數值與 npm run generate 產生的 variables.json 逐筆一致
// （五個集合，涵蓋每種「套系 × 明暗 × 裝置」組合）。與其他測試一樣直接呼叫 openpencil，不略過。
test('真實的 luca-style-library.fig 與產生的 variables.json 逐筆一致', () => {
  const env = { ...process.env };
  for (const key of ['APPLY_VARIABLES_JSON', 'APPLY_VARIABLES_LIBRARY', 'APPLY_VARIABLES_NODE_LIMIT']) delete env[key];
  const r = spawnSync('node', [script, '--check'], { env, encoding: 'utf8' });
  const out = (r.stdout || '') + (r.stderr || '');
  assert.equal(r.status, 0, `設計檔變數與 docs/mockup/themes/variables.json 不一致；請先 npm run generate，再執行 node scripts/design/apply-variables.js 重新寫入設計檔。
${out}`);
  assert.match(out, /luca-style-library\.fig/);
  assert.match(out, /逐筆一致/);
});

test('variables.json 的顏色不是 #RRGGBB 或缺少組合的值時，以結束碼 1 拒絕並指出變數名稱', () => {
  const badHex = setup(miniVariables({ bg: { values: expand(() => '#FFF') } }));
  const r1 = badHex.run();
  assert.equal(r1.code, 1);
  assert.match(r1.out, /bg/);
  const vars = miniVariables();
  delete vars.variables[1].values['Light/Vibrant/Tablet'];
  const missing = setup(vars);
  const r2 = missing.run();
  assert.equal(r2.code, 1);
  assert.match(r2.out, /fs-hero/);
});
