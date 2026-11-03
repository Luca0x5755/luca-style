// 評測報告（ISSUE-011）：讀 evals/results/*.json，產生 evals/results/report.md。
// 用法：node evals/report.mjs
// 逐次列出組別、模型、費用、時間與分數，最後寫 18 次基準（PR-EVAL-04）的預估費用。
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { baselineSummary, renderBaseline } from './baseline.mjs';
import { copyVsNpmVerdict, renderCopyVsNpm, series as copyVsNpmSeries } from './copy-vs-npm.mjs';

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

// PR-ADOPT-06 的 CLI 結論（ISSUE-012）：指南某個版本（內容 sha256）剛好要有 3 次；3 次中 2 次以上沒通過就需要補 CLI。
// 逾時、超出預算、輸出不是 JSON、隔離失敗都沒有通過的評分，所以算失敗（保守）。version 沒給時取最後一次的版本。
export const cliThreshold = 2;
export function onboardingSummary(runs, version) {
  const target = version ?? runs.at(-1)?.guide?.sha256;
  const selected = runs.filter(run => run.guide?.sha256 === target);
  if (selected.length !== 3) throw new Error(`指南版本 ${String(target).slice(0, 12)} 的結果要剛好 3 次，目前 ${selected.length} 次`);
  const failCount = selected.filter(run => !run.grade?.pass).length;
  return {
    version: target, guideSha: selected[0].guide.sha, runs: selected, failCount, cliNeeded: failCount >= cliThreshold,
    costUsd: selected.reduce((sum, run) => sum + (run.run?.costUsd ?? 0), 0),
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

// 接入實測報告（ISSUE-012）。manual 是人讀完逐字紀錄後補在結果檔的人工歸納：{stuckAt, guideChange}，沒有通過的每一次都要有。
export function renderOnboarding(files, summary, limits) {
  const failedWithoutNote = summary.runs.map((run, index) => ({ run, file: files[index] })).filter(({ run }) => run.outcome !== 'passed' && !run.manual?.guideChange);
  if (failedWithoutNote.length) throw new Error(`沒通過的結果檔還沒有人工歸納（manual.stuckAt、manual.guideChange）：${failedWithoutNote.map(item => item.file).join('、')}`);
  const rows = summary.runs.map((run, index) => `| ${files[index]} | ${run.grade?.pass ? '通過' : '沒通過'} | ${run.outcome} | ${cell(run.manual?.stuckAt ?? (run.grade?.pass ? '沒卡住' : null))} | ${usd(run.run?.costUsd)} | ${minutes(run.run?.durationMs)} | ${run.guide.sha} |`);
  const failures = summary.runs.flatMap((run, index) => (run.grade?.pass ? [] : [`- ${files[index]}：${run.reason}；檢查失敗項目 ${(run.grade?.failures ?? []).map(failure => `${failure.item}（${String(failure.detail).slice(0, 120)}）`).join('；') || '無'}`]));
  const changes = summary.runs.flatMap((run, index) => (run.manual?.guideChange ? [`- ${files[index]}：${run.manual.guideChange}`] : []));
  return [
    '# 全新代理只靠文件接入實測（PR-ADOPT-06）',
    '',
    '由 `node evals/report.mjs` 從 `evals/results/*-onboarding-*.json` 產生，不要手改；「卡在哪裡」與「指南修改」是人讀紀錄後的人工歸納（結果檔的 `manual`），其餘欄位由程式從結果檔機械產生。',
    '',
    `指南版本：\`${summary.guideSha}\`（內容 sha256 \`${summary.version.slice(0, 12)}\`）。這 3 次都用這個版本；之後修過指南，這些結果照舊保留，不重跑。`,
    '',
    '題目是 `evals/tasks/onboarding.md`，起始專案是 `evals/starters/onboarding`（乾淨的 Tailwind v3 專案）。代理只看得到 `docs/consumer-guide.md` 與 `packs/` 的兩個打包檔；題目只說明 npm 安裝指令改用打包檔，沒有其他提示。模型、effort、隔離旗標與 ISSUE-011 相同。',
    '',
    '| 結果檔 | 檢查 | outcome | 卡在哪裡（人工歸納） | 費用 | 時間 | 指南 sha |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
    '## 結論',
    '',
    `- 沒通過 ${summary.failCount} / 3 次（failCount = runs.filter(r => !r.grade?.pass).length；逾時、超出預算、輸出不是 JSON、隔離失敗都算沒通過）。`,
    `- 門檻：3 次中 ${limits.threshold} 次以上沒通過就補 CLI。**CLI needed = ${summary.cliNeeded}**`,
    summary.cliNeeded ? '- 需要補 CLI。依協調者裁定，不在這個分支加議題檔（CI 的 issues-check 會因新增議題檔失敗），結論由協調者轉給擁有者。' : '- 不需要補 CLI（決策紀錄：P1 不做 CLI，除非代理在實測中常接錯）。',
    '',
    '「需要人介入」的定義：代理結束後，ISSUE-002 的乾淨專案檢查沒有通過（`claude -p` 執行時沒有人在場）。',
    '',
    '## 通過代表什麼',
    '',
    '通過證明：代理接的線（Tailwind preset、CSS 入口順序、字體、套件安裝、專案裡有用 ThemeProvider）在評分者的探針頁上有效。不證明：代理自己的頁面能用（探針頁由評分者蓋進專案，頁面與 ThemeProvider 的用法是評分者的）；也只涵蓋 Tailwind v3，不涵蓋 v4、Next、React 18 的接入。',
    '',
    '## 沒通過的原因',
    '',
    ...(failures.length ? failures : ['- 沒有。']),
    '',
    '## 失敗原因對應的指南修改',
    '',
    ...(changes.length ? changes : ['- 3 次都通過，沒有發現指南的問題。']),
    '',
    '## 費用',
    '',
    `- 實際合計 ${usd(summary.costUsd)}（預期約 $2）。`,
    `- 硬上限：3 次 × $${limits.budgetUsd} = $${3 * limits.budgetUsd}（每次 \`--max-budget-usd ${limits.budgetUsd}\`，逾時 ${limits.timeoutMinutes} 分鐘）。`,
    '- 停止條件：任何一次撞到預算就中止整個系列；累計超過 $6 就停下回報協調者（程式在開下一次前檢查）。',
    '',
    '## 揭露',
    '',
    '- 隔離沿用 ISSUE-011 的旗標；路徑拒絕規則只涵蓋 Read、Edit 且從未被實際觸發。Glob、Grep、Bash 不在其內，所以改為事後判定：任何工具呼叫提到 repo 路徑、examples、llms.txt 都算隔離失敗（outcome `harness-error`、`harnessCause: isolation`），仍算進 3 次且算沒通過，不自動重跑。',
    '- 打包的 `@luca-style/react` 隨套件附 DESIGN.md 與 llms.txt（發佈後的使用者也有）；工作區本身沒有，代理若去讀 llms.txt 會被判隔離失敗，讀 DESIGN.md 只記次數（`designMdTouched`）。',
    '- 新結果檔已把工作區路徑換成 <workspace>、家目錄換成 <home>（反斜線、正斜線、JSON 轉義與 msys 寫法）；ISSUE-011 既有的結果沒有去識別，照舊保留。',
    '- 樣本只有 3 次、一個題目（Tailwind v3），結論是門檻判斷，不是統計。',
    '',
  ].join('\n');
}

// 基準評測（ISSUE-013，PR-EVAL-04）：讀目錄裡 series 為 baseline 的結果檔，回傳報告文字與彙整。
// allowPartial：進行中時輸出標題為 INCOMPLETE n/18 的報告；已提交的報告必須是完整的 18/18（tests/eval-baseline.spec.ts）。
export async function buildBaselineReport(directory, { allowPartial = false } = {}) {
  const names = (await readdir(directory)).filter(name => name.endsWith('.json')).sort();
  const all = await Promise.all(names.map(async file => ({ file, data: JSON.parse(await readFile(join(directory, file), 'utf8')) })));
  const records = all.filter(({ data }) => data.series === 'baseline');
  const summary = baselineSummary(records, { allowPartial });
  return { records, summary, text: renderBaseline(records, summary) };
}

// 複製 vs npm（ISSUE-014，PR-EVAL-01～03）：讀 series 為 copy-vs-npm 的結果檔，加上 ISSUE-013 的 crud × luca（對應 crud × npm），
// 回傳結論（evals/results/copy-vs-npm.json 的內容）與報告文字。資料不完整時 complete=false、copyBetter=null。
export async function buildCopyVsNpmReport(directory) {
  const names = (await readdir(directory)).filter(name => name.endsWith('.json')).sort();
  const all = await Promise.all(names.map(async file => ({ file, data: JSON.parse(await readFile(join(directory, file), 'utf8')) })));
  const records = all.filter(({ data }) => data.series === copyVsNpmSeries || (data.series === 'baseline' && data.scene === 'crud' && data.group === 'luca'));
  const verdict = copyVsNpmVerdict(records);
  return { records, verdict, text: renderCopyVsNpm(records, verdict) };
}

// 舊報告（試跑）只收沒有 series 的試跑結果：baseline 與 copy-vs-npm 系列的檔、以及沒有 series 的結論檔（有 copyBetter 欄位）都不收。
export const isTrialResult = data => data.task !== 'onboarding' && data.series !== 'baseline' && data.series !== copyVsNpmSeries && !('copyBetter' in data);

// 直接執行時才寫檔；被測試匯入時不動檔案。
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const directory = fileURLToPath(new URL('./results/', import.meta.url));
  const files = (await readdir(directory)).filter(name => name.endsWith('.json')).sort();
  const all = await Promise.all(files.map(async file => ({ file, data: JSON.parse(await readFile(join(directory, file), 'utf8')) })));
  // 接入實測（ISSUE-012）的結果另出報告，不混進評測試跑的表。
  const results = all.filter(({ data }) => isTrialResult(data));
  const onboarding = all.filter(({ data }) => data.task === 'onboarding');
  const estimate = estimateBaseline(results.map(({ data }) => ({ group: data.group, costUsd: data.run?.costUsd ?? null, budgetUsd: data.budgetUsd })));
  await writeFile(join(directory, 'report.md'), render(results, estimate));
  console.log(`寫入 ${join(directory, 'report.md')}：預估 ${usd(estimate.estimateUsd)}，上限 ${usd(estimate.ceilingUsd)}`);
  if (all.some(({ data }) => data.series === 'baseline')) {
    const baseline = await buildBaselineReport(directory, { allowPartial: true });
    await writeFile(join(directory, 'baseline-report.md'), baseline.text);
    console.log(`寫入 ${join(directory, 'baseline-report.md')}：${baseline.summary.count}/18${baseline.summary.complete ? '' : '（INCOMPLETE）'}，費用 ${baseline.summary.costUsd.toFixed(2)}`);
  }
  if (all.some(({ data }) => data.series === copyVsNpmSeries)) {
    const cvn = await buildCopyVsNpmReport(directory);
    await writeFile(join(directory, 'copy-vs-npm.json'), `${JSON.stringify(cvn.verdict, null, 2)}
`);
    await writeFile(join(directory, 'copy-vs-npm-report.md'), cvn.text);
    console.log(`寫入 ${join(directory, 'copy-vs-npm.json')}：complete ${cvn.verdict.complete}，copyBetter ${cvn.verdict.copyBetter}；費用 ${cvn.verdict.costUsd.toFixed(2)}`);
  }
  if (onboarding.length) {
    const summary = onboardingSummary(onboarding.map(({ data }) => data));
    const selected = onboarding.filter(({ data }) => data.guide.sha256 === summary.version);
    const limits = { threshold: cliThreshold, budgetUsd: selected[0].data.budgetUsd, timeoutMinutes: selected[0].data.timeoutMs / 60000 };
    await writeFile(join(directory, 'onboarding-report.md'), renderOnboarding(selected.map(({ file }) => file), summary, limits));
    console.log(`寫入 ${join(directory, 'onboarding-report.md')}：沒通過 ${summary.failCount} / 3，CLI needed = ${summary.cliNeeded}，費用 ${usd(summary.costUsd)}`);
  }
}
