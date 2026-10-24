// check-masters.js 的行為測試：只經由命令列＋環境變數指定的路徑，觀察結束碼與輸出。
// 目的：證明改成「套系專屬值由變數解釋」之後，檢查沒有被放寬成永遠通過——母版被真正改動時仍然失敗。
// 用法：node --test scripts/design/check-masters.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { run, mutate, tempDir, PRELUDE, vibrantFig, professionalFig } from './test-helpers.js';

const exec = (professional) => run('check-masters.js', { CHECK_MASTERS_VIBRANT: vibrantFig, CHECK_MASTERS_PROFESSIONAL: professional });
// 只改 Professional 檔的母版，Vibrant 維持原檔。
const broken = (code) => exec(mutate(professionalFig, join(tempDir('cm-'), 'p.fig'), `${PRELUDE}\n${code}\nreturn 1`));

test('已提交的兩檔通過：母版結構相同，套系專屬值由各自的變數解釋', () => {
  const r = exec(professionalFig);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /全部相同/);
  assert.match(r.out, /母版：vibrant 22、professional 22/);
});

test('母版的文字內容被改 → 失敗', () => {
  const r = broken(`const t = at(frameOf('C/Button/Primary'), '0'); t.characters = '改過的文字'`);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /\[差異\] C\/Button\/Primary：節點 \/0（[^）]*）的 characters 不同/);
});

test('母版多一個子節點 → 失敗', () => {
  const r = broken(`const n = frameOf('C/Checkbox'); n.appendChild(figma.createRectangle())`);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /\[差異\] C\/Checkbox：/);
});

test('母版被改名 → 失敗', () => {
  const r = broken(`frameOf('C/Button/Primary').name = 'C/Button/Primary2'`);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /\[母版名單\] C\/Button\/Primary2|\[母版名單\] C\/Button\/Primary：professional 沒有這個單元/);
});

test('沒有綁定的屬性被改（透明度）→ 失敗', () => {
  const r = broken(`frameOf('C/Button/Primary').opacity = 0.5`);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /\[差異\] C\/Button\/Primary：本身（C\/Button\/Primary）的 opacity 不同/);
});

test('綁定被移除（儲存值還在）→ 失敗', () => {
  const r = broken(`const n = frameOf('C/Button/Primary'); figma.unbindVariable(n.id, 'cornerRadius')`);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /\[差異\] C\/Button\/Primary：本身（C\/Button\/Primary）的 bound 不同/);
});

test('綁到別的變數 → 失敗', () => {
  const r = broken(`
const n = frameOf('C/Button/Primary')
const v = figma.getLocalVariables().find((x) => x.name === 'text')
figma.bindVariable(n.id, 'fills/0/color', v.id)`);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /\[差異\] C\/Button\/Primary：本身（C\/Button\/Primary）的 bound 不同/);
});

test('只存值的 fill[i].opacity 與該套系期望不符 → 失敗', () => {
  // Professional 的 C/State/Loading 第 3 個填色（索引 2）期望不透明度 1，改成 0。
  const r = broken(`const n = at(frameOf('C/State/Loading'), '0'); n.fills = n.fills.map((f, i) => (i === 2 ? { ...f, opacity: 0 } : f))`);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /\[值與變數不符\] C\/State\/Loading：節點 \/0（[^）]*）professional 的 fill\[2\]\.opacity/);
});
