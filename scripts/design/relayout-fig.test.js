// relayout-fig.js 的行為測試：只經由命令列＋環境變數指定的路徑，觀察結束碼與輸出。
// 壞檔取自 b388372（修正版面之前的提交，行高是 NaN、儲存的版面與實際文字高度不符），複製到暫存區，不改進版控的檔案。
// 用法：node --test scripts/design/relayout-fig.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { run, tempDir, vibrantFig, professionalFig } from './test-helpers.js';

const exec = (vibrant, professional, args = []) =>
  run('relayout-fig.js', { RELAYOUT_VIBRANT: vibrant, RELAYOUT_PROFESSIONAL: professional }, args);

test('已提交的兩檔通過 --check：沒有 NaN 行高、重疊、超出父 frame', () => {
  const r = exec(vibrantFig, professionalFig, ['--check']);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /Vibrant：NaN 行高 0、重疊 0、超出父 frame 0/);
  assert.match(r.out, /Professional：NaN 行高 0、重疊 0、超出父 frame 0/);
});

test('壞版面的歷史檔：--check 失敗且不寫檔；修正後通過；再修正一次不寫檔', (t) => {
  const dir = tempDir('rl-old-');
  const old = {};
  for (const [name, file] of [['vibrant', 'components-vibrant.fig'], ['professional', 'components-professional.fig']]) {
    try {
      writeFileSync(join(dir, `${name}.fig`), execFileSync('git', ['show', `b388372:docs/mockup/${file}`], { maxBuffer: 64 * 1024 * 1024 }));
    } catch {
      t.skip('找不到 b388372（歷史被改寫或淺層複製）');
      return;
    }
    old[name] = join(dir, `${name}.fig`);
  }

  const bad = exec(old.vibrant, old.professional, ['--check']);
  assert.equal(bad.code, 1, bad.out);
  assert.match(bad.out, /Vibrant：NaN 行高 [1-9]/);
  assert.match(bad.out, /重疊 [1-9]/);

  const fix = exec(old.vibrant, old.professional);
  assert.equal(fix.code, 0, fix.out);
  assert.match(fix.out, /Vibrant：已修正/);
  assert.match(fix.out, /Professional：已修正/);

  const after = exec(old.vibrant, old.professional, ['--check']);
  assert.equal(after.code, 0, after.out);

  const again = exec(old.vibrant, old.professional);
  assert.equal(again.code, 0, again.out);
  assert.match(again.out, /Vibrant：已是最新，不寫檔/);
});
