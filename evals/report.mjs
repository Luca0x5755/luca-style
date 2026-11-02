// 評測報告（ISSUE-011）：讀 evals/results/*.json，產生 evals/results/report.md。
// 用法：node evals/report.mjs
// 逐次列出組別、模型、費用、時間與分數，最後寫 18 次基準（PR-EVAL-04）的預估費用。
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// 基準 = 3 個場景 × 2 組 × 3 次（ISSUE-013）。
const scenes = 3;
const repeats = 3;
export const baselineGroups = ['plain', 'luca'];

// 每組的單次費用取該組試跑的平均；預估 = 每組 9 次 × 單次費用的總和。上限 = 18 次 × 每次的費用上限。
// 試跑只有後台與 CRUD，其他兩個場景的題目大小可能不同，所以另列上限。
export function estimateBaseline(runs) {
  const perRunUsd = {};
  for (const group of baselineGroups) {
    const costs = runs.filter(run => run.group === group).map(run => run.costUsd).filter(cost => typeof cost === 'number');
    if (costs.length === 0) throw new Error(`沒有 ${group} 組的試跑費用，不能預估`);
    perRunUsd[group] = costs.reduce((sum, cost) => sum + cost, 0) / costs.length;
  }
  const budgets = runs.map(run => run.budgetUsd);
  if (!budgets.every(budget => typeof budget === 'number')) throw new Error('有試跑結果沒有記錄每次的費用上限，不能算上限');
  const perGroup = scenes * repeats;
  const total = perGroup * baselineGroups.length;
  return {
    perRunUsd,
    estimateUsd: baselineGroups.reduce((sum, group) => sum + perGroup * perRunUsd[group], 0),
    ceilingUsd: total * Math.max(...budgets),
    runs: total,
  };
}

const usd = value => (typeof value === 'number' ? `$${value.toFixed(2)}` : '—');
const minutes = ms => (typeof ms === 'number' ? `${(ms / 60000).toFixed(1)} 分` : '—');
const cell = value => (value === null || value === undefined ? '—' : String(value));

function render(results, estimate) {
  const rows = results.map(({ file, data }) => {
    const grade = data.grade ?? {};
    const overflow = grade.overflow ? `${grade.overflow[1280]} / ${grade.overflow[834]} / ${grade.overflow[390]}` : '—';
    return `| ${file} | ${data.group} | ${cell(data.run?.model)} | ${usd(data.run?.costUsd)} | ${minutes(data.run?.durationMs)} | ${cell(data.run?.turns)} | ${cell(grade.hardcodedColors?.count)} | ${grade.axe ? `${grade.axe.serious} / ${grade.axe.critical}` : '—'} | ${overflow} | ${cell(grade.missingStates?.count)} | ${data.isolation?.ok ? '通過' : '未通過'} |`;
  });
  return [
    '# 評測試跑報告',
    '',
    '由 `node evals/report.mjs` 從 `evals/results/*.json` 產生，不要手改。',
    '',
    `模型固定為 ${[...new Set(results.map(({ data }) => `\`${data.model}\`（effort ${data.effort}，每次上限 $${data.budgetUsd}）`))].join('、')}，所有評測都用它。題目是 \`evals/tasks/${[...new Set(results.map(({ data }) => data.task))].join('、')}.md\`，兩組讀同一個檔。`,
    '',
    '分數：寫死顏色數；axe 的 serious、critical 數（依規則與元素去重，4 狀態 × 3 寬度）；1280、834、390 各有幾個狀態水平溢出；四種狀態缺漏數。評分規則見 `evals/grade.mjs`。',
    '',
    '| 結果檔 | 組別 | 模型 | 費用 | 時間 | 回合 | 寫死顏色 | axe serious / critical | 溢出 1280 / 834 / 390 | 狀態缺漏 | 隔離 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
    '## 隔離',
    '',
    '每次都用 `--safe-mode --setting-sources "" --strict-mcp-config --disable-slash-commands --no-session-persistence --restricted`，工具限定六種，Bash 只允許三種 npm 指令（`dontAsk`），另以 `--settings` 拒絕 repo、`~/.claude` 與全域 npm 的路徑。完整旗標在各結果檔的 `flags`。',
    '',
    '- 記憶依專案路徑存放，每次都是新的暫存目錄，沒有記憶；debug 紀錄的 `project memory is off` 也顯示沒有載入。',
    '- Claude Code 自帶的 plugin（init 裡 `path` 為 `builtin`）是 CLI 本身的一部分，不是使用者安裝的，所以不算載入個人設定（協調者 2026-11-02 裁定）；其他 plugin 一律算隔離失敗。',
    '- init 的 `agents` 列出的是 Claude Code 內建的 agent（claude、Explore、general-purpose、Plan、web-fetch），不是空的；個人 skill、agent、command 的名稱都有比對，出現就算隔離失敗。',
    '- debug 紀錄的「31 bundled skills」是 CLI 自帶的 skill；init 的 `skills` 與 `slash_commands` 是空的，`--disable-slash-commands` 也關掉叫用，`[reduced mode] Skipping skill dir discovery` 表示個人與專案的 skill 目錄沒有被讀。',
    '',
    ...results.map(({ file, data }) => {
      const isolation = data.isolation ?? {};
      const debug = isolation.debugLines ?? [];
      return [
        `### ${file}`,
        '',
        `- 判定：${isolation.ok ? '通過' : `未通過（${(isolation.problems ?? []).join('；')}）`}${isolation.originalProblems ? `；原判定「${isolation.originalProblems.join('；')}」，依上方裁定重判` : ''}`,
        `- 內建 plugin：${(isolation.builtinPlugins ?? []).join('、') || '無'}`,
        `- 使用者層級的 \`~/.claude/CLAUDE.md\`：${isolation.userClaudeMdExists === undefined ? '執行時沒有記錄' : isolation.userClaudeMdExists ? '存在（需另外確認沒有載入）' : '不存在'}`,
        `- init 的 skills、mcp_servers、slash_commands：${['skills', 'mcp_servers', 'slash_commands'].map(field => `${field} ${JSON.stringify(isolation.init?.[field] ?? null)}`).join('，')}；agents ${JSON.stringify(isolation.init?.agents ?? null)}`,
        `- 金絲雀 CLAUDE.md：${isolation.canaryFound ? '被載入' : '沒有出現在任何訊息'}`,
        `- debug 紀錄中和 CLAUDE.md、memory、rules、skill 有關的行（去重，不含權限建議）：${[...new Set(debug.filter(line => !line.includes('Permission suggestions')).map(line => line.replace(/^\S+ \[\w+\] /, '')))].map(line => `\`${line}\``).join('；') || '無'}`,
        `- 工具呼叫 ${isolation.toolUses ?? '—'} 次，越界 ${isolation.trespasses?.length ?? '—'} 次，被拒絕 ${isolation.permissionDenials?.length ?? '—'} 次${isolation.permissionDenials?.length ? `（${isolation.permissionDenials.map(denial => `${denial.tool_name}: ${String(denial.tool_input?.command ?? JSON.stringify(denial.tool_input)).split('\n')[0].slice(0, 80)}`).join('；')}）` : ''}${isolation.trespasses?.length === 0 ? '；本次沒有越界嘗試，路徑的拒絕規則未被實際觸發' : ''}`,
        '',
      ].join('\n');
    }),
    '## 18 次基準的預估費用',
    '',
    `- 每組單次費用（試跑平均）：${baselineGroups.map(group => `${group} ${usd(estimate.perRunUsd[group])}`).join('、')}`,
    `- 預估：${scenes} 個場景 × ${repeats} 次 × 每組單次費用，兩組相加 = **${usd(estimate.estimateUsd)}**（${estimate.runs} 次）`,
    `- 上限：${estimate.runs} 次 × 每次的費用上限 = ${usd(estimate.ceilingUsd)}`,
    `- 預估只根據後台與 CRUD 的試跑（${baselineGroups.map(group => `${group} ${results.filter(({ data }) => data.group === group).length} 次`).join('、')}）；資料儀表板、行銷與定價頁沒有試跑，費用可能不同。`,
    `- ISSUE-014 另跑 9 次（複製組 3 次、更新題兩組各 3 次），它的 Notes 說 ISSUE-013 的同意已包含這 9 次：這些沒有試跑，用兩組中較高的單次費用估，合計 27 次約 ${usd(estimate.estimateUsd + 9 * Math.max(...Object.values(estimate.perRunUsd)))}，上限 ${usd(estimate.ceilingUsd / estimate.runs * 27)}。`,
    '',
  ].join('\n');
}

// 直接執行時才寫檔；被測試匯入時不動檔案。
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const directory = fileURLToPath(new URL('./results/', import.meta.url));
  const files = (await readdir(directory)).filter(name => name.endsWith('.json')).sort();
  const results = await Promise.all(files.map(async file => ({ file, data: JSON.parse(await readFile(join(directory, file), 'utf8')) })));
  const estimate = estimateBaseline(results.map(({ data }) => ({ group: data.group, costUsd: data.run?.costUsd ?? null, budgetUsd: data.budgetUsd })));
  await writeFile(join(directory, 'report.md'), render(results, estimate));
  console.log(`寫入 ${join(directory, 'report.md')}：預估 ${usd(estimate.estimateUsd)}，上限 ${usd(estimate.ceilingUsd)}`);
}
