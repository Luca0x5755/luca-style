// paginate-fig.js 的行為測試：只經由命令列＋環境變數指定的路徑，觀察結束碼與輸出。
// 未分頁的檔取自 510a247（所有 frame 擠在 Library guide 一頁），複製到暫存區，不改進版控的檔案。
// 用法：node --test scripts/design/paginate-fig.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { run, tempDir } from './test-helpers.js';

const exec = (vibrant, professional, args = []) =>
  run('paginate-fig.js', { PAGINATE_VIBRANT: vibrant, PAGINATE_PROFESSIONAL: professional }, args);

// 取出單頁的歷史檔；找不到提交（淺層複製）就略過整個測試。
const singlePageCopies = (t, prefix) => {
  const dir = tempDir(prefix);
  const copies = {};
  for (const [name, file] of [['vibrant', 'components-vibrant.fig'], ['professional', 'components-professional.fig']]) {
    try {
      writeFileSync(join(dir, `${name}.fig`), execFileSync('git', ['show', `510a247:docs/mockup/${file}`], { maxBuffer: 64 * 1024 * 1024 }));
    } catch {
      t.skip('找不到 510a247（歷史被改寫或淺層複製）');
      return null;
    }
    copies[name] = join(dir, `${name}.fig`);
  }
  return copies;
};

test('所有 frame 擠在一個畫布頁的歷史檔：--check 失敗並指出要搬的 frame 數', (t) => {
  const old = singlePageCopies(t, 'pg-old-');
  if (!old) return;
  const r = exec(old.vibrant, old.professional, ['--check']);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /Vibrant：.*位置不對 144/);
});

test('歷史檔分頁後：各畫布頁的 frame 與節點數如實、實例全部連得到母版；再分頁一次不寫檔', (t) => {
  const old = singlePageCopies(t, 'pg-fix-');
  if (!old) return;
  const fix = exec(old.vibrant, old.professional);
  assert.equal(fix.code, 0, fix.out);
  assert.match(fix.out, /Vibrant：已分頁（搬移 144、新增畫布頁 6）/);
  assert.match(fix.out, /Professional：已分頁（搬移 144、新增畫布頁 6）/);

  const after = exec(old.vibrant, old.professional, ['--check']);
  assert.equal(after.code, 0, after.out);
  // 數字取自分頁前直接統計的結果：總節點 5,824＝482＋674＋1,114＋1,406＋926＋740＋482，實例 711。
  assert.match(after.out, /Vibrant：位置不對 0、連不到母版的實例 0（實例共 711）/);
  assert.match(after.out, /Library guide 32\/482、Home 24\/674、Foundations 24\/1114、Components 24\/1406、Product 24\/926、Intro 24\/740、NotFound 24\/482/);

  const again = exec(old.vibrant, old.professional);
  assert.equal(again.code, 0, again.out);
  assert.match(again.out, /Vibrant：已是最新，不寫檔/);
});
