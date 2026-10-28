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
// loading-opacity 依明暗且為 0–100 原值；elevation 為布林。
const miniVariables = (overrides = {}) => ({
  axes: { mode: MODES, suite: SUITES, device: DEVICES },
  count: 6,
  variables: [
    { name: 'bg', type: 'color', values: expand((m) => (m === 'Light' ? '#F7F7F2' : '#151A18')) },
    { name: 'fs-hero', type: 'number', values: expand((m, s, d) => ({ Desktop: 56, Tablet: 44, Mobile: 32 })[d]) },
    { name: 'radius-card', type: 'number', values: expand((m, s) => (s === 'Vibrant' ? 20 : 3)) },
    { name: 'font-zh', type: 'string', values: expand(() => 'Noto Sans TC') },
    { name: 'loading-opacity', type: 'number', values: expand((m) => (m === 'Light' ? 100 : 0)) },
    { name: 'elevation', type: 'boolean', values: expand((m, s) => s === 'Vibrant') },
  ].map((v) => ({ ...v, ...(overrides[v.name] || {}) })),
});

const setup = (variables = miniVariables()) => {
  const dir = mkdtempSync(join(tmpdir(), 'apply-vars-'));
  const vibrant = join(dir, 'v.fig');
  const professional = join(dir, 'p.fig');
  copyFileSync(join(mockup, 'components-vibrant.fig'), vibrant);
  copyFileSync(join(mockup, 'components-professional.fig'), professional);
  const json = join(dir, 'variables.json');
  writeFileSync(json, JSON.stringify(variables));
  const env = {
    ...process.env,
    APPLY_VARIABLES_JSON: json,
    APPLY_VARIABLES_VIBRANT: vibrant,
    APPLY_VARIABLES_PROFESSIONAL: professional,
  };
  const run = (args = [], extra = {}) => {
    const r = spawnSync('node', [script, ...args], { env: { ...env, ...extra }, encoding: 'utf8' });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  return { dir, vibrant, professional, json, run, env };
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

test('套用後兩個檔案各有 Mode、Device、Base 三個集合與正確的模式', () => {
  const t = setup();
  const r = t.run();
  assert.equal(r.code, 0, r.out);
  for (const file of [t.vibrant, t.professional]) {
    const got = readBack(file);
    assert.deepEqual(Object.keys(got).sort(), ['Base', 'Device', 'Mode']);
    assert.deepEqual(got.Mode.modes, ['Light', 'Dark']);
    assert.deepEqual(got.Device.modes, ['Desktop', 'Tablet', 'Mobile']);
    assert.deepEqual(got.Base.modes, ['Default']);
  }
});

test('變數依變化軸放進對應集合，suite 不建模式，只依套系的變數落在 Base', () => {
  const t = setup();
  t.run();
  const got = readBack(t.vibrant);
  assert.deepEqual(Object.keys(got.Mode.vars).sort(), ['bg', 'loading-opacity']);
  assert.deepEqual(Object.keys(got.Device.vars), ['fs-hero']);
  assert.deepEqual(Object.keys(got.Base.vars).sort(), ['elevation', 'font-zh', 'radius-card']);
  for (const c of Object.values(got)) {
    assert.ok(!c.modes.includes('Vibrant') && !c.modes.includes('Professional'));
  }
});

test('每個檔案只取自己套系的值，型別與各模式的值逐筆一致', () => {
  const t = setup();
  t.run();
  const v = readBack(t.vibrant);
  const p = readBack(t.professional);
  assert.equal(v.Mode.vars.bg.type, 'COLOR');
  assert.equal(hex(v.Mode.vars.bg.values.Light), '#F7F7F2');
  assert.equal(hex(v.Mode.vars.bg.values.Dark), '#151A18');
  assert.equal(v.Mode.vars.bg.values.Light.a, 1);
  assert.deepEqual(v.Device.vars['fs-hero'].values, { Desktop: 56, Tablet: 44, Mobile: 32 });
  assert.equal(v.Device.vars['fs-hero'].type, 'FLOAT');
  assert.equal(v.Base.vars['radius-card'].values.Default, 20);
  assert.equal(p.Base.vars['radius-card'].values.Default, 3);
  assert.equal(v.Base.vars['font-zh'].type, 'STRING');
  assert.equal(v.Base.vars['font-zh'].values.Default, 'Noto Sans TC');
  assert.equal(v.Base.vars.elevation.type, 'BOOLEAN');
  assert.equal(v.Base.vars.elevation.values.Default, true);
  assert.equal(p.Base.vars.elevation.values.Default, false);
  // opacity 維持 0–100 原值
  assert.deepEqual(v.Mode.vars['loading-opacity'].values, { Light: 100, Dark: 0 });
});

test('重跑不產生重複的集合或變數，且第二次不寫檔', () => {
  const t = setup();
  t.run();
  const first = readBack(t.vibrant);
  const again = t.run();
  assert.equal(again.code, 0, again.out);
  assert.match(again.out, /已是最新/);
  const second = readBack(t.vibrant);
  assert.deepEqual(second, first);
  assert.equal(Object.keys(second).length, 3);
  assert.equal(Object.keys(second.Mode.vars).length + Object.keys(second.Device.vars).length + Object.keys(second.Base.vars).length, 6);
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
  const got = readBack(t.vibrant);
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
  assert.deepEqual(Object.keys(readBack(t.vibrant).Base.vars).sort(), ['elevation', 'radius-card']);
});

test('同一變數同時依 mode 與 device 變化時拒絕，並指出變數名稱', () => {
  const t = setup(miniVariables({ bg: { type: 'number', values: expand((m, s, d) => (m === 'Light' ? 10 : 20) + DEVICES.indexOf(d)) } }));
  const r = t.run();
  assert.equal(r.code, 1);
  assert.match(r.out, /bg/);
  assert.match(r.out, /mode.*device|device.*mode/);
});

test('--check 輸出節點數，達到上限時失敗', () => {
  const t = setup();
  t.run();
  // 含存放變數的空白 Internal Only Canvas 頁；原本的 5832 加上 0e3954f 手工加入的 C/Select/Open 母版 16 個節點。
  const ok = t.run(['--check']);
  assert.match(ok.out, /節點數 5848/);
  const over = t.run(['--check'], { APPLY_VARIABLES_NODE_LIMIT: '100' });
  assert.equal(over.code, 1);
  assert.match(over.out, /節點數/);
});

test('--list 逐變數逐模式列出一行', () => {
  const t = setup();
  t.run();
  const r = t.run(['--list']);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /components-vibrant\.fig|v\.fig/);
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

// PR-FILE-16：進版控的兩份套系設計檔，變數值與 npm run generate 產生的 variables.json 逐筆一致
// （每檔 2 明暗 × 3 裝置，兩檔合起來涵蓋每種「套系 × 明暗」組合）。與其他測試一樣直接呼叫 openpencil，不略過。
test('真實的兩份套系設計檔與產生的 variables.json 逐筆一致', () => {
  const env = { ...process.env };
  for (const key of ['APPLY_VARIABLES_JSON', 'APPLY_VARIABLES_VIBRANT', 'APPLY_VARIABLES_PROFESSIONAL', 'APPLY_VARIABLES_NODE_LIMIT']) delete env[key];
  const r = spawnSync('node', [script, '--check'], { env, encoding: 'utf8' });
  const out = (r.stdout || '') + (r.stderr || '');
  assert.equal(r.status, 0, `設計檔變數與 docs/mockup/themes/variables.json 不一致；請先 npm run generate，再執行 node scripts/design/apply-variables.js 重新寫入兩份設計檔。\n${out}`);
  assert.match(out, /Vibrant.*逐筆一致/);
  assert.match(out, /Professional.*逐筆一致/);
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
