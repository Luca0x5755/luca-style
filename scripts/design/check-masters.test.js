// check-masters.js 的行為測試：只經由命令列＋環境變數指定的路徑，觀察結束碼與輸出。
// 目的：證明單檔檢查沒有被放寬成永遠通過——母版被真正改動、綁定被拿掉或換掉、解析值與 variables.json 不符時仍然失敗。
// 用法：node --test scripts/design/check-masters.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { run, mutate, tempDir, PRELUDE, libraryFig, themes } from './test-helpers.js';

const exec = (library, extra = {}) => run('check-masters.js', { CHECK_MASTERS_LIBRARY: library, ...extra });
// 改一份副本再檢查，原檔不動。
const broken = (code) => exec(mutate(libraryFig, join(tempDir('cm-'), 'lib.fig'), `${PRELUDE}\n${code}\nreturn 1`));
// 改 themes 資料夾的副本（bindings.json 與 variables.json），設計檔用原檔。
const withThemes = (edit) => {
  const dir = tempDir('cm-themes-');
  for (const name of ['bindings.json', 'variables.json']) copyFileSync(join(themes, name), join(dir, name));
  edit(dir);
  return exec(libraryFig, { CHECK_MASTERS_THEMES: dir });
};

test('已提交的元件庫通過：23 個母版、綁定齊全，四種套系與明暗組合的解析值都等於 variables.json', () => {
  const r = exec(libraryFig);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /全部通過/);
  assert.match(r.out, /母版：23（預期 23）/);
  assert.match(r.out, /組合 4 種（Vibrant\/Light、Vibrant\/Dark、Professional\/Light、Professional\/Dark）/);
});

test('結構：Select/Open 的焦點框、hover 填色與指標卡邊框綁的是 ISSUE-004 指定的變數', () => {
  const masters = JSON.parse(readFileSync(join(themes, 'bindings.json'), 'utf8')).masters;
  const bind = (frame, path) => masters.find((m) => m.frame === frame).nodes.find((n) => n.path === path).bind;
  assert.equal(bind('C/Button/Hover', '-').fill, 'accent-hover');
  assert.equal(bind('C/Button/Focus', '-').stroke, 'focus-ring');
  assert.equal(bind('C/Field/Focus', '1').stroke, 'focus-ring');
  assert.equal(bind('C/Select/Open', '1.2').stroke, 'focus-ring');
  assert.equal(bind('C/Card/Metric', '-').stroke, 'border');
  assert.equal(masters.length, 23);
});

test('多出一個頁面 frame → 失敗', () => {
  const r = broken(`const f = figma.createFrame(); f.name = 'Home/Vibrant/Light/Desktop/Success'; figma.root.children[0].appendChild(f)`);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /\[母版名單\] 頂層節點應恰為 23 個，實際 24 個/);
  assert.match(r.out, /Home\/Vibrant\/Light\/Desktop\/Success：頂層節點必須是 COMPONENT/);
});

test('母版被刪掉或改名 → 失敗', () => {
  const r = broken(`frameOf('C/Checkbox').name = 'C/Checkbox2'`);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /\[母版名單\] C\/Checkbox：沒有這個母版/);
  assert.match(r.out, /\[母版名單\] C\/Checkbox2：多出名單以外的母版/);
});

test('有內容的畫布頁不只一個 → 失敗；存放變數的空頁不算', () => {
  const r = broken(`const p = figma.createPage(); p.name = 'Home'; const f = figma.createFrame(); p.appendChild(f)`);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /\[頁面\] 有內容的畫布頁應恰好 1 個，實際 2 個/);
});

test('綁定被移除 → 失敗並指出母版、節點與欄位', () => {
  const r = broken(`figma.unbindVariable(frameOf('C/Button/Primary').id, 'cornerRadius')`);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /\[綁定\] C\/Button\/Primary - cornerRadius：沒有綁定，應綁 radius-control/);
});

test('綁到別的變數 → 失敗', () => {
  const r = broken(`
const n = frameOf('C/Button/Hover')
figma.bindVariable(n.id, 'fills/0/color', figma.getLocalVariables().find((x) => x.name === 'accent').id)`);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /\[綁定\] C\/Button\/Hover - fills\/0\/color：綁的是 accent，應為 accent-hover/);
});

test('母版沒有任何綁定的填色 → 失敗', () => {
  const r = broken(`
const m = frameOf('C/Nav/Mobile')
const walk = (n) => { const b = figma.graph.getNode(n.id).boundVariables; if (b['fills/0/color']) figma.unbindVariable(n.id, 'fills/0/color'); (n.children || []).forEach(walk) }
walk(m)`);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /\[綁定\] C\/Nav\/Mobile：沒有任何綁定的填色/);
});

test('變數被刪（綁定懸空）→ 失敗', () => {
  const r = broken(`figma.deleteVariable(figma.getLocalVariables().find((x) => x.name === 'accent-hover').id)`);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /\[懸空綁定\]|\[綁定\] C\/Button\/Hover/);
});

test('某個組合的變數值被改壞 → 解析值不符而失敗，指出變數與組合', () => {
  // 只改 Professional / Dark 的 accent；Vibrant 的組合仍然正確，所以只有該組合失敗。
  const r = broken(`
const v = figma.getLocalVariables().find((x) => x.name === 'accent')
const c = figma.getLocalVariableCollections().find((x) => x.id === v.collectionId)
const mode = c.modes.find((m) => m.name === 'Professional / Dark')
figma.setVariableValue(v.id, mode.modeId, { r: 1, g: 0, b: 0, a: 1 })`);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /\[解析值\] C\/Button\/Primary - fills\/0\/color（accent）@ Professional \/ Dark：解析為 #FF0000/);
  assert.ok(!/@ Vibrant/.test(r.out), r.out);
});

test('變數被放進沒有涵蓋其變化軸的集合（把 accent 移到只依裝置的 Device）→ 解析值不符而失敗', () => {
  // 以 variables.json 為準：accent 在 Suite x Mode；若設計檔把它放進 Device，各組合都只解出同一個值，Professional 對不上。
  const r = broken(`
const v = figma.getLocalVariables().find((x) => x.name === 'accent')
const device = figma.getLocalVariableCollections().find((x) => x.name === 'Device')
figma.deleteVariable(v.id)
const nv = figma.createVariable('accent', 'COLOR', device.id, { r: 0.08, g: 0.5, b: 0.51, a: 1 })
for (const m of device.modes) figma.setVariableValue(nv.id, m.modeId, { r: 0.08, g: 0.5, b: 0.51, a: 1 })`);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /@ Professional/);
});

test('bindings.json 缺少母版或 variables.json 沒有被綁的變數 → 失敗', () => {
  const r = withThemes((dir) => {
    const path = join(dir, 'bindings.json');
    const data = JSON.parse(readFileSync(path, 'utf8'));
    data.masters = data.masters.filter((m) => m.frame !== 'C/Select/Open');
    writeFileSync(path, JSON.stringify(data));
  });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /\[資料\] bindings\.json 缺少母版 C\/Select\/Open/);
});
