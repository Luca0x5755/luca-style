// 發佈閘門（PR-ADOPT-11）：只有 PR-EVAL-03 的結論檔存在，且 copyBetter 恰為布林 false，才以 0 結束。
// 其餘情況一律失敗（檔案不存在、JSON 壞掉、欄位缺少或不是布林、copyBetter 為 true），寧可擋下也不放行。
import { readFileSync } from 'node:fs';

const path = process.argv[2];

function fail(reason) {
  console.error(`發佈閘門未通過：${reason}`);
  process.exit(1);
}

if (!path) fail('沒有指定結論檔路徑（預期 evals/results/copy-vs-npm.json）');

let verdict;
try {
  verdict = JSON.parse(readFileSync(path, 'utf8'));
} catch (error) {
  fail(`讀不到或無法解析結論檔 ${path}（${error.code ?? error.name}）`);
}

if (verdict === null || typeof verdict !== 'object' || Array.isArray(verdict)) fail(`結論檔 ${path} 不是 JSON 物件`);
if (verdict.copyBetter !== false) fail(`${path} 的 copyBetter 不是 false（目前為 ${JSON.stringify(verdict.copyBetter)}）`);

console.log(`發佈閘門通過：${path} 的 copyBetter 為 false`);
