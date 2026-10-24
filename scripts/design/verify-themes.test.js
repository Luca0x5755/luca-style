// verify-themes.js 的行為測試：只經由命令列＋環境變數指定的路徑，觀察結束碼與輸出。
// 副本用離線 openpencil eval 產生（見 test-helpers.js），預期值都是手寫的字面值（來自 variables.json／resolved.json 的具體數值）。
// 用法：node --test scripts/design/verify-themes.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run, mutate, tempDir, PRELUDE, vibrantFig, professionalFig } from './test-helpers.js';

const here = dirname(fileURLToPath(import.meta.url));
const exec = (vibrant = vibrantFig, professional = professionalFig) =>
  run('verify-themes.js', { VERIFY_THEMES_VIBRANT: vibrant, VERIFY_THEMES_PROFESSIONAL: professional });

test('已提交的兩個套系設計檔通過，且七類屬性各有比對筆數', () => {
  const r = exec();
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /全部一致/);
  for (const cls of ['填色', '描邊', '字型', '字級', '間距', '內距', '圓角']) {
    const counts = [...r.out.matchAll(new RegExp(`^  ${cls}：(\\d+)$`, 'gm'))].map((m) => Number(m[1]));
    assert.equal(counts.length, 2, `${cls} 應各檔一行`);
    assert.ok(counts.every((n) => n > 0), `${cls} 比對筆數應大於 0：${counts}`);
  }
  assert.match(r.out, /不比對（strokeWidth\.left[^）]*）：43/);
});

test('Dark frame 被設回 Light 模式 → 失敗，列出 frame、路徑、屬性、期望與實際', () => {
  const dir = tempDir('vt-mode-');
  const copy = mutate(vibrantFig, join(dir, 'v.fig'), `${PRELUDE}
const f = frameOf('Home/Vibrant/Dark/Desktop/Success')
const col = figma.getLocalVariableCollections().find((c) => c.name === 'Mode')
const light = col.modes.find((m) => m.name === 'Light')
figma.graph.updateNode(f.id, { variableModes: { ...figma.graph.getNode(f.id).variableModes, [col.id]: light.modeId } })
return 1`);
  const r = exec(copy);
  assert.equal(r.code, 1, r.out);
  // 根節點底色：Dark 期望 #151A18，模式被改回 Light 後解析為 #F7F7F2。
  assert.match(r.out, /\[差異\] Home\/Vibrant\/Dark\/Desktop\/Success 節點 - fill：期望 #151A18，實際 #F7F7F2/);
});

test('變數值被改掉 → 失敗；差 1/255 內仍通過', () => {
  const dir = tempDir('vt-var-');
  const setBg = (name, hexValue) => mutate(vibrantFig, join(dir, name), `${PRELUDE}
const v = figma.getLocalVariables().find((x) => x.name === 'bg')
const col = figma.getLocalVariableCollections().find((c) => c.name === 'Mode')
figma.setVariableValue(v.id, col.modes.find((m) => m.name === 'Light').modeId, rgb(${JSON.stringify(hexValue)}))
return 1`);
  const bad = exec(setBg('bad.fig', '#F7F7F4'));
  assert.equal(bad.code, 1, bad.out);
  assert.match(bad.out, /\[差異\] Home\/Vibrant\/Light\/Desktop\/Success 節點 - fill：期望 #F7F7F2，實際 #F7F7F4/);
  const near = exec(setBg('near.fig', '#F7F7F3'));
  assert.equal(near.code, 0, near.out);
});

test('綁定被移除（儲存值還在）→ 失敗，指出未綁定', () => {
  const dir = tempDir('vt-bind-');
  const copy = mutate(vibrantFig, join(dir, 'v.fig'), `${PRELUDE}
const n = at(frameOf('Home/Vibrant/Dark/Desktop/Success'), '-')
figma.unbindVariable(n.id, 'fills/0/color')
return 1`);
  const r = exec(copy);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /\[差異\] Home\/Vibrant\/Dark\/Desktop\/Success 節點 - fill：期望 #151A18，實際 未綁定變數（fills\/0\/color）/);
});

test('Professional 檔的母版以 Professional 的值為期望：accent 的 Light 值改回 Vibrant 值 → 失敗', () => {
  const dir = tempDir('vt-master-');
  // C/Button/Primary 本體填色綁 accent，Professional Light 為 #625C83；變數改成 Vibrant 的 #147F82。
  const copy = mutate(professionalFig, join(dir, 'p.fig'), `${PRELUDE}
const v = figma.getLocalVariables().find((x) => x.name === 'accent')
const col = figma.getLocalVariableCollections().find((c) => c.name === 'Mode')
figma.setVariableValue(v.id, col.modes.find((m) => m.name === 'Light').modeId, rgb('#147F82'))
return 1`);
  const r = exec(vibrantFig, copy);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /\[差異\] C\/Button\/Primary 節點 - fill：期望 #625C83，實際 #147F82/);
});

test('文件檢查：每個套系至少 2 列 Dark 與 2 列 Light 的匯出圖、待使用者確認、沒有肯定句的像素比對宣稱', () => {
  const doc = readFileSync(resolve(here, '../../docs/delivery-verification.md'), 'utf8');
  const start = doc.indexOf('## 主題保真驗收（ISSUE-010）');
  assert.ok(start >= 0, '找不到「主題保真驗收（ISSUE-010）」一節');
  const rest = doc.slice(start + 5);
  const next = rest.search(/\n## /);
  const section = next < 0 ? rest : rest.slice(0, next);
  for (const suite of ['Vibrant', 'Professional']) {
    for (const mode of ['Dark', 'Light']) {
      const rows = section.split('\n').filter((l) => l.startsWith(`| ${suite} | ${mode} |`));
      assert.ok(rows.length >= 2, `${suite} ${mode} 應至少 2 列，實得 ${rows.length}`);
    }
  }
  assert.match(section, /待使用者確認/);
  for (const m of section.matchAll(/像素比對/g)) {
    const before = section.slice(Math.max(0, m.index - 4), m.index);
    assert.match(before, /(不聲稱|不做逐?)$/, `像素比對只能出現在否定句：…${section.slice(m.index - 10, m.index + 6)}`);
  }
});
