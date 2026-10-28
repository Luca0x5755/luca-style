// apply-bindings.js 的行為測試：只經由公開邊界（命令列＋環境變數指定的路徑）觀察結束碼與輸出，
// 並用離線唯讀的 openpencil eval 讀回 .fig 暫存副本的綁定與儲存值。
// 用法：node --test scripts/design/apply-bindings.test.js
// 預期值都是手寫的字面值（來自 variables.json 的具體數值），不用被測程式的邏輯重算。
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, copyFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const script = resolve(here, 'apply-bindings.js');
const mockup = resolve(here, '../../docs/mockup');
const themes = join(mockup, 'themes');
const library = join(mockup, 'luca-style-library.fig');

const tempDirs = [];
after(() => tempDirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

// 在暫存區放一份設計檔與資料夾（bindings.json、variables.json）；bindings 可換成小型夾具。
const setup = (bindings = readFileSync(join(themes, 'bindings.json'), 'utf8')) => {
  const dir = mkdtempSync(join(tmpdir(), 'apply-bind-'));
  tempDirs.push(dir);
  writeFileSync(join(dir, 'bindings.json'), bindings);
  copyFileSync(join(themes, 'variables.json'), join(dir, 'variables.json'));
  const fig = join(dir, 'lib.fig');
  copyFileSync(library, fig);
  const env = { ...process.env, APPLY_BINDINGS_DIR: dir, APPLY_BINDINGS_LIBRARY: fig };
  const run = (args = [], extra = {}) => {
    const r = spawnSync('node', [script, ...args], { env: { ...env, ...extra }, encoding: 'utf8' });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  return { dir, fig, run };
};

const evalOn = (file, code, extra = []) =>
  execFileSync('openpencil', ['eval', `"${file}"`, '--stdin', '--json', ...extra], { input: code, encoding: 'utf8', shell: true, maxBuffer: 256 * 1024 * 1024 });

// 弄壞一個母版節點：解除所有綁定並把填色改成紅色，用來製造要修的差異。
const tamper = (file, masterName, path) =>
  evalOn(file, `
const m = figma.root.children.flatMap((p) => p.children).find((x) => x.name === ${JSON.stringify(masterName)})
const at = (f, p) => (p === '-' ? f : p.split('.').reduce((n, i) => n.children[+i], f))
const node = at(m, ${JSON.stringify(path)})
for (const k of Object.keys(figma.graph.getNode(node.id).boundVariables)) figma.unbindVariable(node.id, k)
node.fills = [{ ...node.fills[0], color: { r: 1, g: 0, b: 0, a: 1 } }]
return 1`, ['-w']);

// 讀回：節點的綁定（變數名稱）、填色十六進位、數值欄位。
const probe = (file, masterName, path) =>
  JSON.parse(evalOn(file, `
const names = Object.fromEntries(figma.getLocalVariables().map((v) => [v.id, v.name]))
const m = figma.root.children.flatMap((p) => p.children).find((x) => x.name === ${JSON.stringify(masterName)})
const at = (f, p) => (p === '-' ? f : p.split('.').reduce((n, i) => n.children[+i], f))
const node = at(m, ${JSON.stringify(path)})
const g = figma.graph.getNode(node.id)
const hex = (c) => '#' + [c.r, c.g, c.b].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('').toUpperCase()
return {
  bound: Object.fromEntries(Object.entries(g.boundVariables).map(([k, v]) => [k, names[v]])),
  fill: node.fills[0] ? hex(node.fills[0].color) : null,
  stroke: node.strokes[0] ? hex(node.strokes[0].color) : null,
  cornerRadius: node.cornerRadius, paddingLeft: node.paddingLeft,
  weights: g.independentStrokeWeights ? [g.borderTopWeight, g.borderRightWeight, g.borderBottomWeight, g.borderLeftWeight] : g.strokeWeight,
}`));

test('已提交的設計檔：--check 結束碼 0，23 個母版的綁定與儲存值一致', () => {
  const t = setup();
  const r = t.run(['--check']);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /23 個母版/);
  assert.match(r.out, /綁定與儲存值全部一致/);
});

test('hover、焦點框與指標卡邊框綁到 ISSUE-004 指定的變數，儲存值是預設模式（Vibrant／Light）的值', () => {
  const t = setup();
  assert.equal(t.run().code, 0);
  assert.equal(probe(t.fig, 'C/Button/Hover', '-').bound['fills/0/color'], 'accent-hover');
  assert.equal(probe(t.fig, 'C/Button/Hover', '-').fill, '#007072');
  assert.equal(probe(t.fig, 'C/Button/Focus', '-').bound['strokes/0/color'], 'focus-ring');
  assert.equal(probe(t.fig, 'C/Select/Open', '1.2').bound['strokes/0/color'], 'focus-ring');
  const metric = probe(t.fig, 'C/Card/Metric', '-');
  assert.equal(metric.bound['strokes/0/color'], 'border');
  assert.equal(metric.stroke, '#DDE5DC');
  assert.equal(metric.bound.borderLeftWeight, 'metric-border-left');
  assert.equal(metric.cornerRadius, 20);
  assert.equal(metric.paddingLeft, 24);
});

test('重跑不寫檔、不產生重複綁定：第二次輸出已是最新，檔案位元組不變', () => {
  const t = setup();
  t.run();
  const before = readFileSync(t.fig);
  const again = t.run();
  assert.equal(again.code, 0, again.out);
  assert.match(again.out, /已是最新/);
  assert.ok(readFileSync(t.fig).equals(before));
  assert.equal(Object.keys(probe(t.fig, 'C/Button/Primary', '-').bound).length, 3);
});

test('--check 在綁定與儲存值被改壞時結束碼 1 並指名母版與節點，重新套用後恢復', () => {
  const t = setup();
  assert.equal(t.run(['--check']).code, 0);
  tamper(t.fig, 'C/Status/Success', '0');
  const bad = t.run(['--check']);
  assert.equal(bad.code, 1);
  assert.match(bad.out, /C\/Status\/Success 0/);
  assert.equal(t.run().code, 0);
  assert.equal(t.run(['--check']).code, 0);
  assert.equal(probe(t.fig, 'C/Status/Success', '0').fill, '#237354');
});

test('--check 輸出節點數，達到上限時失敗', () => {
  const t = setup();
  assert.match(t.run(['--check']).out, /節點數 110/);
  const over = t.run(['--check'], { APPLY_BINDINGS_NODE_LIMIT: '100' });
  assert.equal(over.code, 1);
  assert.match(over.out, /節點數 110 已達上限 100/);
});

test('bindings.json 指名的變數不在 variables.json 時以結束碼 1 拒絕，不改檔', () => {
  const bindings = JSON.parse(readFileSync(join(themes, 'bindings.json'), 'utf8'));
  bindings.masters[0].nodes[0].bind.fill = 'no-such-variable';
  const t = setup(JSON.stringify(bindings));
  const before = readFileSync(t.fig);
  const r = t.run();
  assert.equal(r.code, 1);
  assert.match(r.out, /no-such-variable/);
  assert.ok(readFileSync(t.fig).equals(before));
});

test('資料檔缺漏時以結束碼 2 拒絕，不改檔', () => {
  const t = setup();
  const before = readFileSync(t.fig);
  const r = t.run([], { APPLY_BINDINGS_DIR: join(t.dir, 'nowhere') });
  assert.equal(r.code, 2);
  assert.match(r.out, /bindings\.json/);
  assert.ok(readFileSync(t.fig).equals(before));
});

// 與腳本邏輯無關的獨立計數：直接讀回真實 .fig，依欄位計數 boundVariables，
// 與 bindings.json 的 23 個母版逐類型計數推得的字面數字比對。
test('真實設計檔：各欄位的綁定筆數等於 bindings.json 的獨立計數，且沒有懸空綁定', () => {
  const expected = {
    'fills/0/color': 102, 'strokes/0/color': 35, fontFamily: 56, cornerRadius: 34,
    strokeWeight: 7, borderLeftWeight: 1, paddingLeft: 2, paddingRight: 2, paddingTop: 2, paddingBottom: 2,
  };
  const got = JSON.parse(evalOn(library, `
const ids = new Set(figma.getLocalVariables().map((v) => v.id))
const counts = {}
let dangling = 0
for (const [, n] of figma.graph.nodes) for (const [k, v] of Object.entries(n.boundVariables || {})) { counts[k] = (counts[k] || 0) + 1; if (!ids.has(v)) dangling++ }
return { counts, dangling }`));
  assert.deepEqual(got.counts, expected);
  assert.equal(got.dangling, 0);
});
