// 修正兩個套系設計檔的版面：.pen 轉 .fig 時，文字行高是 NaN、儲存的版面是用壞值算的，
// 所以標題高度只有 1–2px，其餘區塊疊在一起。本腳本重算自動排版並把結果明確寫入檔案。
//   docs/mockup/components-vibrant.fig
//   docs/mockup/components-professional.fig
// 用法：
//   node scripts/design/relayout-fig.js           修正（已無問題就不寫檔；可重跑）
//   node scripts/design/relayout-fig.js --check   唯讀檢查：NaN 行高、相鄰節點重疊、超出父 frame
// 結束碼：0 沒有問題；1 有問題（逐行列出）；2 讀檔或 openpencil 執行失敗。
//
// 已知取捨：
//   - 行高改為 AUTO（.pen 的原值取不到），行距可能與原稿略有差異，需人眼確認。
//   - 含換行的文字（標題等）改為固定高度，之後改字數不會自動長高。
//   - 一次只處理一個檔案；執行前請先在 OpenPencil App 關閉這兩個檔案（unsaved: discard），避免 App 回寫。
//
// 全程以離線 `openpencil eval` 讀寫檔案。Windows 的 openpencil 本機修補事項見 docs/delivery-verification.md〈Windows 上執行 openpencil 的本機修補〉。
// 測試用環境變數：RELAYOUT_VIBRANT、RELAYOUT_PROFESSIONAL。
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHECK_SNIPPET, FIX_SNIPPET } from './layout-snippets.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const files = [
  { suite: 'Vibrant', path: resolve(process.env.RELAYOUT_VIBRANT || join(root, 'docs/mockup/components-vibrant.fig')) },
  { suite: 'Professional', path: resolve(process.env.RELAYOUT_PROFESSIONAL || join(root, 'docs/mockup/components-professional.fig')) },
];

// shell: true 是為了在 Windows 上執行 openpencil.cmd；路徑加引號以防空白。
const evalOn = (file, code, extraArgs = []) => {
  try {
    const out = execFileSync('openpencil', ['eval', `"${file}"`, '--stdin', '--json', ...extraArgs], {
      input: code, encoding: 'utf8', shell: true, stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024,
    });
    return JSON.parse(out.replace(/\x1b\[[0-9;]*m/g, '').trim());
  } catch (error) {
    console.log(`openpencil 執行失敗（${file}）：${String(error.stderr || error.stdout || error.message).trim().split('\n')[0]}`);
    process.exit(2);
  }
};

const problems = (r) => r.nan + r.overlaps + r.outOfBounds;
const describe = (suite, r) => {
  const lines = [`${suite}：NaN 行高 ${r.nan}、重疊 ${r.overlaps}、超出父 frame ${r.outOfBounds}`];
  for (const e of r.examples) lines.push(`  ${e}`);
  return lines.join('\n');
};

const apply = !process.argv.includes('--check');
let exit = 0;
for (const file of files) {
  let result = evalOn(file.path, CHECK_SNIPPET);
  if (apply && problems(result) > 0) {
    const fixed = evalOn(file.path, FIX_SNIPPET, ['-w']);
    console.log(`${file.suite}：已修正（行高 ${fixed.lineHeights}、多行文字 ${fixed.multiline}、節點 ${fixed.nodes}）`);
    result = evalOn(file.path, CHECK_SNIPPET);
  } else if (apply) {
    console.log(`${file.suite}：已是最新，不寫檔`);
  }
  console.log(describe(file.suite, result));
  if (problems(result) > 0) exit = 1;
}
process.exit(exit);
