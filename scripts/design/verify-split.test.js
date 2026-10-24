// verify-split.js 的行為測試：只經由命令列＋環境變數指定的路徑，觀察結束碼與輸出。
// 重點是 ISSUE-010 新增的「同一頁面群組的 Light 與 Dark 顏色分布不得完全相同」，以及填色不再與已丟失主題的基準比。
// 用法：node --test scripts/design/verify-split.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { run, mutate, tempDir, PRELUDE, vibrantFig, professionalFig } from './test-helpers.js';

const exec = (vibrant = vibrantFig, professional = professionalFig) =>
  run('verify-split.js', { VERIFY_SPLIT_VIBRANT: vibrant, VERIFY_SPLIT_PROFESSIONAL: professional });

test('已提交的兩檔通過：Light 與 Dark 的 frame 與丟失主題的基準填色不同，但不再因此失敗', () => {
  const r = exec();
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /明暗成對：150 組/);
  assert.match(r.out, /全部一致/);
});

test('一組 Dark frame 被設回 Light 模式（存檔後顏色與 Light 相同）→ 失敗，指出頁面群組', () => {
  const dir = tempDir('vs-twin-');
  // 離線存檔會把有綁定的值重新解析成該 frame 模式下的變數值，所以模式設回 Light 後，Dark frame 存成 Light 的顏色。
  const copy = mutate(vibrantFig, join(dir, 'v.fig'), `${PRELUDE}
const f = frameOf('Home/Vibrant/Dark/Desktop/Success')
const col = figma.getLocalVariableCollections().find((c) => c.name === 'Mode')
const light = col.modes.find((m) => m.name === 'Light')
figma.graph.updateNode(f.id, { variableModes: { ...figma.graph.getNode(f.id).variableModes, [col.id]: light.modeId } })
return 1`);
  const r = exec(copy);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /\[明暗相同\] Home\/Vibrant\/\*\/Desktop\/Success：vibrant 的 Light 與 Dark 顏色分布完全相同/);
});

test('丟失主題的歷史檔（ISSUE-005 的 vibrant，沒有變數）→ 失敗', (t) => {
  const dir = tempDir('vs-lost-');
  const old = join(dir, 'v-old.fig');
  let bytes;
  try {
    // 5124b60 是加入變數之前的提交，Light 與 Dark 的顏色完全相同。
    bytes = execFileSync('git', ['show', '5124b60:docs/mockup/components-vibrant.fig'], { maxBuffer: 64 * 1024 * 1024 });
  } catch {
    t.skip('找不到 5124b60（歷史被改寫或淺層複製）');
    return;
  }
  writeFileSync(old, bytes);
  const r = exec(old);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /\[明暗相同\]/);
  assert.match(r.out, /\[版面\] vibrant：\d+ 個文字的行高是 NaN/);
});

test('結構性改動（文字被改）仍然失敗', () => {
  const dir = tempDir('vs-text-');
  const copy = mutate(vibrantFig, join(dir, 'v.fig'), `${PRELUDE}
const t = frameOf('Home/Vibrant/Light/Desktop/Success').findAll((n) => n.type === 'TEXT')[0]
t.characters = '被改過的文字'
return 1`);
  const r = exec(copy);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /\[文字\] Home\/Vibrant\/Light\/Desktop\/Success/);
});

test('結構性改動（節點數變）仍然失敗', () => {
  const dir = tempDir('vs-nodes-');
  const copy = mutate(vibrantFig, join(dir, 'v.fig'), `${PRELUDE}
const f = frameOf('Home/Vibrant/Light/Desktop/Success')
f.appendChild(figma.createRectangle())
return 1`);
  const r = exec(copy);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /\[節點數\] Home\/Vibrant\/Light\/Desktop\/Success/);
});
