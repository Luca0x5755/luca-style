// apply-bindings.js 的行為測試：只經由公開邊界（命令列＋環境變數指定的路徑）觀察結束碼與輸出，
// 並用離線唯讀的 openpencil eval 讀回 .fig 暫存副本的綁定、儲存值與 frame 模式。
// 用法：node --test scripts/design/apply-bindings.test.js
// 預期值都是手寫的字面值（來自 variables.json 的具體數值），不用被測程式的邏輯重算。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, copyFileSync, readFileSync, rmSync } from 'node:fs';
import { after } from 'node:test';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const script = resolve(here, 'apply-bindings.js');
const mockup = resolve(here, '../../docs/mockup');
const themes = join(mockup, 'themes');

const FRAMES = {
  vibrant: ['C/Button/Primary', 'Home/Vibrant/Dark/Desktop/Success', 'Home/Vibrant/Light/Tablet/Success', 'Library guide'],
  professional: ['Professional/Light/Component review'],
};

// 從真實 JSON 挑出指定 frame 的條目，組成小型夾具（綁定、解析值逐筆對應）。
const miniData = () => {
  const bindings = JSON.parse(readFileSync(join(themes, 'bindings.json'), 'utf8'));
  const resolved = JSON.parse(readFileSync(join(themes, 'resolved.json'), 'utf8'));
  const wanted = new Set([...FRAMES.vibrant, ...FRAMES.professional]);
  const out = { bindings: { frames: [], masters: [] }, resolved: { frames: [], masters: [] } };
  for (const kind of ['frames', 'masters']) {
    bindings[kind].forEach((g, i) => {
      if (!wanted.has(g.frame)) return;
      out.bindings[kind].push(g);
      out.resolved[kind].push(resolved[kind][i]);
    });
  }
  return out;
};

const tempDirs = [];
after(() => tempDirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

const setup = () => {
  const dir = mkdtempSync(join(tmpdir(), 'apply-bind-'));
  tempDirs.push(dir);
  const data = miniData();
  writeFileSync(join(dir, 'bindings.json'), JSON.stringify(data.bindings));
  writeFileSync(join(dir, 'resolved.json'), JSON.stringify(data.resolved));
  copyFileSync(join(themes, 'variables.json'), join(dir, 'variables.json'));
  copyFileSync(join(themes, 'strokes.json'), join(dir, 'strokes.json'));
  const vibrant = join(dir, 'v.fig');
  const professional = join(dir, 'p.fig');
  copyFileSync(join(mockup, 'components-vibrant.fig'), vibrant);
  copyFileSync(join(mockup, 'components-professional.fig'), professional);
  const env = { ...process.env, APPLY_BINDINGS_DIR: dir, APPLY_BINDINGS_VIBRANT: vibrant, APPLY_BINDINGS_PROFESSIONAL: professional };
  const run = (args = [], extra = {}) => {
    const r = spawnSync('node', [script, ...args], { env: { ...env, ...extra }, encoding: 'utf8' });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  return { dir, vibrant, professional, run };
};

const evalOn = (file, code, extra = []) =>
  execFileSync('openpencil', ['eval', `"${file}"`, '--stdin', '--json', ...extra], { input: code, encoding: 'utf8', shell: true, maxBuffer: 256 * 1024 * 1024 });

// 把副本弄回「尚未綁定」：解除指定節點的綁定並把儲存值改錯，用來製造要修的差異。
const tamper = (file, frameName, path) =>
  evalOn(file, `
const f = figma.root.children.flatMap((p) => p.children).find((x) => x.name === ${JSON.stringify(frameName)})
const at = (f, p) => (p === '-' ? f : p.split('.').reduce((n, i) => n.children[+i], f))
const node = at(f, ${JSON.stringify(path)})
for (const k of Object.keys(figma.graph.getNode(node.id).boundVariables)) figma.unbindVariable(node.id, k)
node.fills = [{ ...node.fills[0], color: { r: 1, g: 0, b: 0, a: 1 } }]
return 1`, ['-w']);

// 讀回：節點的綁定（變數名稱）、填色十六進位、數值欄位與 frame 模式。
const probe = (file, frameName, path) =>
  JSON.parse(evalOn(file, `
const names = Object.fromEntries(figma.getLocalVariables().map((v) => [v.id, v.name]))
const colName = Object.fromEntries(figma.getLocalVariableCollections().map((c) => [c.id, { name: c.name, modes: Object.fromEntries(c.modes.map((m) => [m.modeId, m.name])) }]))
const f = figma.root.children.flatMap((p) => p.children).find((x) => x.name === ${JSON.stringify(frameName)})
const at = (f, p) => (p === '-' ? f : p.split('.').reduce((n, i) => n.children[+i], f))
const node = at(f, ${JSON.stringify(path)})
const g = figma.graph.getNode(node.id)
const hex = (c) => '#' + [c.r, c.g, c.b].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('').toUpperCase()
const fm = figma.graph.getNode(f.id).variableModes || {}
return {
  bound: Object.fromEntries(Object.entries(g.boundVariables).map(([k, v]) => [k, names[v]])),
  fill: node.fills[0] ? hex(node.fills[0].color) : null,
  stroke: node.strokes[0] ? hex(node.strokes[0].color) : null,
  cornerRadius: node.cornerRadius, fontSize: node.fontSize, itemSpacing: node.itemSpacing, paddingLeft: node.paddingLeft,
  weights: g.independentStrokeWeights ? [g.borderTopWeight, g.borderRightWeight, g.borderBottomWeight, g.borderLeftWeight] : g.strokeWeight,
  effectVisible: node.effects[0] ? node.effects[0].visible : null,
  frameModes: Object.fromEntries(Object.entries(fm).map(([c, m]) => [colName[c].name, colName[c].modes[m]])),
}`));

test('頁面 frame 的 Mode 與 Device 依名稱設定，母版與名稱沒寫的軸不設', () => {
  const t = setup();
  const r = t.run();
  assert.equal(r.code, 0, r.out);
  assert.deepEqual(probe(t.vibrant, 'Home/Vibrant/Dark/Desktop/Success', '-').frameModes, { Mode: 'Dark', Device: 'Desktop' });
  assert.deepEqual(probe(t.vibrant, 'Home/Vibrant/Light/Tablet/Success', '-').frameModes, { Mode: 'Light', Device: 'Tablet' });
  assert.deepEqual(probe(t.vibrant, 'Library guide', '-').frameModes, {});
  assert.deepEqual(probe(t.vibrant, 'C/Button/Primary', '-').frameModes, {});
});

test('填色、字型、字級、間距綁到對應變數，儲存值覆蓋為該模式的解析值', () => {
  const t = setup();
  t.run();
  const dark = probe(t.vibrant, 'Home/Vibrant/Dark/Desktop/Success', '-');
  assert.equal(dark.bound['fills/0/color'], 'bg');
  assert.equal(dark.bound.itemSpacing, 'gap-section');
  assert.equal(dark.fill, '#151A18');
  assert.equal(dark.itemSpacing, 32);
  assert.equal(probe(t.vibrant, 'Home/Vibrant/Light/Tablet/Success', '-').fill, '#F7F7F2');
  const title = probe(t.vibrant, 'Home/Vibrant/Light/Tablet/Success', '2.0');
  assert.deepEqual(title.bound, { 'fills/0/color': 'text', fontFamily: 'font-zh', fontSize: 'fs-hero' });
  assert.equal(title.fontSize, 44);
  assert.equal(probe(t.vibrant, 'Home/Vibrant/Dark/Desktop/Success', '2.0').fontSize, 56);
});

test('母版綁定，描邊被補回並綁定顏色，圓角取自該套系的值', () => {
  const t = setup();
  t.run();
  const m = probe(t.vibrant, 'C/Button/Primary', '-');
  assert.deepEqual(m.bound, { 'fills/0/color': 'accent', cornerRadius: 'radius-control', 'strokes/0/color': 'border' });
  assert.equal(m.fill, '#147F82');
  assert.equal(m.stroke, '#DDE5DC');
  assert.equal(m.cornerRadius, 16);
  assert.equal(m.weights, 1);
  const dark = probe(t.vibrant, 'Home/Vibrant/Dark/Desktop/Success', '3.0.0');
  assert.equal(dark.fill, '#64C2BC');
  assert.equal(dark.stroke, '#354139');
});

test('Professional 檔取自己套系的值：圓角 3、左邊粗 3、陰影關閉、內距 20', () => {
  const t = setup();
  t.run();
  const card = probe(t.professional, 'Professional/Light/Component review', '12.0');
  assert.equal(card.cornerRadius, 3);
  assert.equal(card.paddingLeft, 20);
  assert.deepEqual(card.weights, [1, 1, 1, 3]);
  assert.equal(card.effectVisible, false);
  assert.equal(card.bound.borderLeftWeight, 'metric-border-left');
  assert.equal(card.fill, '#FFFFFF');
  // 只綁左邊時，Vibrant 檔的同一個元件是 1（效果仍開啟）。
  const v = probe(t.vibrant, 'Home/Vibrant/Light/Tablet/Success', '3.1.1');
  assert.equal(v.weights, 1);
  assert.equal(v.effectVisible, true);
});

test('重跑不寫檔、不產生重複綁定：第二次輸出已是最新，檔案位元組不變', () => {
  const t = setup();
  t.run();
  const before = readFileSync(t.vibrant);
  const again = t.run();
  assert.equal(again.code, 0, again.out);
  assert.match(again.out, /已是最新/);
  assert.ok(readFileSync(t.vibrant).equals(before));
  const bound = probe(t.vibrant, 'Home/Vibrant/Light/Tablet/Success', '2.0').bound;
  assert.equal(Object.keys(bound).length, 3);
});

test('--check 在已套用時結束碼 0；儲存值被改壞時結束碼 1 並指名節點，重新套用後恢復', () => {
  const t = setup();
  assert.equal(t.run(['--check']).code, 0);
  tamper(t.vibrant, 'Home/Vibrant/Dark/Desktop/Success', '3.0.0');
  const bad = t.run(['--check']);
  assert.equal(bad.code, 1);
  assert.match(bad.out, /Home\/Vibrant\/Dark\/Desktop\/Success 3\.0\.0/);
  assert.equal(t.run().code, 0);
  assert.equal(t.run(['--check']).code, 0);
});

// 節點數 5848：原本的 5832 加上 0e3954f 手工加入的 C/Select/Open 母版 16 個節點。
test('--check 輸出節點數，達到上限時失敗', () => {
  const t = setup();
  t.run();
  assert.match(t.run(['--check']).out, /節點數 5848/);
  const over = t.run(['--check'], { APPLY_BINDINGS_NODE_LIMIT: '100' });
  assert.equal(over.code, 1);
  assert.match(over.out, /節點數 5848 已達上限 100/);
});

test('資料檔缺漏時以結束碼 1 或 2 拒絕，不改檔', () => {
  const t = setup();
  const before = readFileSync(t.vibrant);
  const r = t.run([], { APPLY_BINDINGS_DIR: join(t.dir, 'nowhere') });
  assert.equal(r.code, 2);
  assert.match(r.out, /bindings\.json/);
  assert.ok(readFileSync(t.vibrant).equals(before));
});

// 與腳本邏輯無關的獨立計數：直接讀回兩個真實 .fig，依欄位計數 boundVariables，
// 與 bindings.json 逐類型計數推得的字面數字比對（兩檔相同：各含 22 個母版與其餘 frame），
// 再加上 0e3954f 手工加入、不在 bindings.json 裡的 C/Select/Open 母版的綁定（填色 14、描邊 3、字型 6、圓角 8）。
test('真實設計檔：各欄位的綁定筆數等於 bindings.json 的獨立計數，且沒有懸空綁定', () => {
  const expected = {
    'fills/0/color': 4890 + 14, 'strokes/0/color': 957 + 3, fontFamily: 3092 + 6, fontSize: 254, itemSpacing: 144, cornerRadius: 730 + 8,
    strokeWeight: 229, borderLeftWeight: 43, paddingLeft: 86, paddingRight: 86, paddingTop: 86, paddingBottom: 86,
  };
  for (const name of ['components-vibrant.fig', 'components-professional.fig']) {
    const got = JSON.parse(evalOn(join(mockup, name), `
const ids = new Set(figma.getLocalVariables().map((v) => v.id))
const counts = {}
let dangling = 0
for (const [, n] of figma.graph.nodes) for (const [k, v] of Object.entries(n.boundVariables || {})) { counts[k] = (counts[k] || 0) + 1; if (!ids.has(v)) dangling++ }
return { counts, dangling }`));
    assert.deepEqual(got.counts, expected, name);
    assert.equal(got.dangling, 0, name);
  }
});
