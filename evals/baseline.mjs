// 基準評測的判定函式（ISSUE-013，PR-EVAL-04）：護欄、補跑規則、越界判定、使用記錄、彙整與報告。
// 都是純函式，run.mjs 與 report.mjs 呼叫，tests/eval-baseline.spec.ts 直接測。
import { classifyOutcome } from './onboarding.mjs';

export { classifyOutcome };

// 3 個場景 × 2 組 × 3 次 = 18 次。scene 就是 evals/tasks/<scene>.md 的檔名。
export const baselineScenes = [
  { scene: 'crud', title: '後台與 CRUD' },
  { scene: 'dashboard', title: '資料儀表板與監控' },
  { scene: 'pricing', title: '行銷與定價頁' },
];
export const baselineGroups = [
  { group: 'plain', title: '無工具' },
  { group: 'luca', title: '裝 Luca Style 並附文件' },
];
export const repeats = 3;
export const totalRuns = baselineScenes.length * baselineGroups.length * repeats;

// 累計等價費用的停止線。每次開跑前檢查，所以最後一次可能超出至多單次上限（$5）。
export const guardUsd = 8;

const sameSeries = (record, guideSha256) => record.series === 'baseline' && record.guide?.sha256 === guideSha256;

// 同一個指南版本的 baseline 結果，連被取代的檔也算進累計；超過停止線就丟錯，由呼叫端回報協調者。
export function baselineGuard(records, guideSha256, limitUsd = guardUsd) {
  const spent = records.filter(record => sameSeries(record, guideSha256)).reduce((sum, record) => sum + (record.run?.costUsd ?? 0), 0);
  if (spent > limitUsd) throw new Error(`基準累計等價費用 $${spent.toFixed(2)}，超過 $${limitUsd}，請停下回報協調者`);
  return spent;
}

// 補跑規則。records：[{ file, data }]。只有 harness 例外（工具壞掉）可以補跑一次；
// 隔離失敗與模型造成的失敗（逾時、超出預算、評分未過）永遠不補跑。回傳 null 代表可以，否則是原因。
export function rerunProblem(records, { supersedes }) {
  const original = records.find(record => record.file === supersedes);
  if (!original) return `找不到要取代的結果檔 ${supersedes}`;
  if (original.data.outcome === 'passed') return `${supersedes} 已通過，不能補跑`;
  if (original.data.harnessCause !== 'harness-exception') return `${supersedes} 的失敗不是 harness 例外（${original.data.harnessCause ?? original.data.outcome}），不補跑`;
  if (records.some(record => record.data.supersedes === supersedes)) return `${supersedes} 已經補跑過一次`;
  const cell = records.filter(record => record.data.scene === original.data.scene && record.data.group === original.data.group);
  if (cell.some(record => record.data.supersedes)) return `${original.data.scene} × ${original.data.group} 已經補跑過一次，每格最多一次`;
  return null;
}

// 有效的執行 = 沒被任何結果檔 supersedes 的檔。
export function effectiveRuns(records) {
  const superseded = new Set(records.map(record => record.data.supersedes).filter(Boolean));
  return records.filter(record => !superseded.has(record.file));
}

export function median(values) {
  const numbers = values.filter(value => typeof value === 'number').sort((a, b) => a - b);
  if (numbers.length === 0) return null;
  const middle = numbers.length >> 1;
  return numbers.length % 2 ? numbers[middle] : (numbers[middle - 1] + numbers[middle]) / 2;
}

// 比對用：統一成小寫、正斜線。
const normalize = text => text.replace(/\\\\/g, '/').replace(/\\/g, '/').toLowerCase();
const packageFiles = /node_modules\/@luca-style\/[^\s"'\\]*/g;

// 基準的越界判定（含協調者 2026-11-03 的裁定）。每個工具呼叫的輸入都檢查：
// - 提到 repo、主 repo、~/.claude、全域 npm 的路徑 → 越界；
// - 提到工作區以外的磁碟路徑（含暫存區的其他檔）→ 越界；
// - luca 組讀已安裝套件自己的檔案（node_modules/@luca-style/*，含 DESIGN.md、llms.txt）是處理的一部分，只記錄不算越界；
// - luca 組在套件目錄裡不帶路徑地讀 llms.txt、DESIGN.md 也算套件自己的檔案（第一批 2 次實跑被舊規則誤判，見 rejudgeIsolation）；
// - 其他的 examples（套件外）、plain 組提到 luca 或 llms.txt 都算越界。
export function baselineTrespasses(toolUses, { roots, workspace, group }) {
  const normalizedRoots = roots.map(normalize);
  const inside = normalize(workspace);
  return toolUses.filter(use => {
    let input = normalize(JSON.stringify(use.input ?? {}));
    if (group === 'luca') input = input.replace(packageFiles, ' ');
    if (normalizedRoots.some(root => input.includes(root)) || input.includes('/.claude')) return true;
    // luca 組 cd 進套件目錄後直接 cat llms.txt（沒有路徑）是合法的：工作區裡只有已安裝的套件有這個檔，repo 的 llms.txt 要靠 repo 路徑才碰得到（上一行已擋）。
    if (input.includes('examples') || (group === 'plain' && input.includes('llms.txt'))) return true;
    if (group === 'plain' && input.includes('luca')) return true;
    const drivePaths = input.match(/(?<![a-z0-9])[a-z]:\/[^\s"']*/g) ?? [];
    return drivePaths.some(path => !path.startsWith(inside));
  }).map(use => ({ tool: use.name, input: JSON.stringify(use.input).slice(0, 300) }));
}

// 處理的使用記錄：讀 DESIGN.md、llms.txt、已安裝的套件檔案、指南各幾次（luca 組的文件優勢是被量的處理，記下代理用了多少）。
export function treatmentUsage(toolUses) {
  const count = pattern => toolUses.filter(use => pattern.test(normalize(JSON.stringify(use.input ?? {})))).length;
  return { designMdTouched: count(/design\.md/), llmsTxtTouched: count(/llms\.txt/), packageFileReads: count(/node_modules\/@luca-style\//), consumerGuideTouched: count(/docs\/consumer-guide\.md/) };
}

// 沒通過 = outcome 不是 passed（隔離失敗、逾時、超出預算、輸出不是 JSON、建置失敗、harness 例外）。品質指標是比較用的分數，不是通過與否。
// 建置失敗：grade.pass 為 false，交給 classifyOutcome 記成 failed-grade。
export function baselineClassify({ build, graded, ...state }) {
  const grade = graded && { ...graded, pass: Boolean(build?.ok), failures: build?.ok ? [] : [{ item: 'build', detail: String(build?.outputTail ?? '').slice(-200) }] };
  return { grade, ...classifyOutcome({ ...state, grade }) };
}

const metrics = data => ({
  costUsd: data.run?.costUsd ?? null,
  durationMs: data.run?.durationMs ?? null,
  hardcodedColors: data.grade?.hardcodedColors?.count ?? null,
  axeSerious: data.grade?.axe?.serious ?? null,
  axeCritical: data.grade?.axe?.critical ?? null,
  overflow1280: data.grade?.overflow?.[1280] ?? null,
  overflow834: data.grade?.overflow?.[834] ?? null,
  overflow390: data.grade?.overflow?.[390] ?? null,
  missingStates: data.grade?.missingStates?.count ?? null,
});
const metricKeys = Object.keys(metrics({}));

// 彙整 baseline 結果。records：[{ file, data }]（只放 series 為 baseline 的檔）。
// 每格（場景 × 組）的有效次數必須剛好 3；allowPartial 為真時只擋超過 3，回傳 complete=false 的進行中彙整。
export function baselineSummary(records, { allowPartial = false } = {}) {
  const unknown = records.filter(({ data }) => !baselineScenes.some(item => item.scene === data.scene) || !baselineGroups.some(item => item.group === data.group));
  if (unknown.length) throw new Error(`不認得的場景或組別：${unknown.map(record => record.file).join('、')}`);
  const names = new Set(records.map(record => record.file));
  const dangling = records.filter(record => record.data.supersedes && !names.has(record.data.supersedes));
  if (dangling.length) throw new Error(`supersedes 指向不存在的結果檔：${dangling.map(record => `${record.file} → ${record.data.supersedes}`).join('、')}`);
  const effective = effectiveRuns(records);
  const superseded = new Set(records.map(record => record.data.supersedes).filter(Boolean));
  const cells = [];
  for (const { scene } of baselineScenes) for (const { group } of baselineGroups) {
    const runs = effective.filter(record => record.data.scene === scene && record.data.group === group);
    if (runs.length > repeats || (!allowPartial && runs.length !== repeats)) throw new Error(`${scene} × ${group} 的有效結果要剛好 ${repeats} 次，目前 ${runs.length} 次`);
    const rows = runs.map(record => metrics(record.data));
    cells.push({
      scene, group, runs, passed: runs.filter(record => record.data.outcome === 'passed').length,
      medians: Object.fromEntries(metricKeys.map(key => [key, median(rows.map(row => row[key]))])),
    });
  }
  const failed = records.filter(record => record.data.outcome !== 'passed').map(record => ({
    file: record.file, scene: record.data.scene, group: record.data.group, outcome: record.data.outcome, reason: record.data.reason,
    harnessCause: record.data.harnessCause ?? null, superseded: superseded.has(record.file),
    supersededBy: records.find(item => item.data.supersedes === record.file)?.file ?? null,
  }));
  return {
    count: effective.length, complete: effective.length === totalRuns, cells, failed,
    costUsd: records.reduce((sum, record) => sum + (record.data.run?.costUsd ?? 0), 0),
  };
}

const usd = value => (typeof value === 'number' ? `$${value.toFixed(2)}` : '—');
const minutes = ms => (typeof ms === 'number' ? `${(ms / 60000).toFixed(1)} 分` : '—');
const num = value => (value === null || value === undefined ? '—' : Number.isInteger(value) ? String(value) : value.toFixed(1));
const groupTitle = group => baselineGroups.find(item => item.group === group)?.title ?? group;

// 報告。同樣的結果檔永遠產生同樣的文字（不含時間、路徑）。
export function renderBaseline(records, summary) {
  const guides = [...new Set(records.map(record => record.data.guide?.sha ?? '—'))];
  const crudLuca = summary.cells.find(cell => cell.scene === 'crud' && cell.group === 'luca');
  const lines = [
    summary.complete ? '# 基準評測報告（PR-EVAL-04）' : `# 基準評測報告（INCOMPLETE ${summary.count}/${totalRuns}）`,
    '',
    '由 `node evals/report.mjs` 從 `evals/results/*.json` 中 `series` 為 `baseline` 的檔產生，不要手改。ISSUE-011 的試跑結果（`report.md`）不在這 18 次裡。',
    '',
    `3 個場景（${baselineScenes.map(item => `${item.title}＝\`evals/tasks/${item.scene}.md\``).join('、')}）× 2 組（${baselineGroups.map(item => `${item.group}＝${item.title}`).join('、')}）× 3 次。三份題目定案後不改（P2 重用）；兩組讀同一份題目。模型 \`claude-sonnet-5-5\`、effort medium、每次上限 $5、逾時 45 分鐘，旗標與隔離設定和 ISSUE-011 相同。`,
    '',
    '## 中位數',
    '',
    '每格（場景 × 組）是該格有效的 3 次之中位數；失敗的執行也算在內（評不到的欄位，例如建置失敗時沒有 axe，只取有值的次數）。**狀態缺漏、axe、溢出只在同一個場景內比較**：三個場景的版面與內容不同，缺漏判定又依各狀態內容是否相異，跨場景的絕對數字不能直接比。「遺失本地改動」不適用，那是 ISSUE-014 更新題的指標。',
    '',
  ];
  for (const { scene, title } of baselineScenes) {
    lines.push(`### ${title}（${scene}）`, '', '| 組別 | 有效次數 | 通過 | 費用 | 時間 | 寫死顏色 | axe serious / critical | 溢出 1280 / 834 / 390 | 狀態缺漏 |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const cell of summary.cells.filter(item => item.scene === scene)) {
      const m = cell.medians;
      lines.push(`| ${cell.group}（${groupTitle(cell.group)}） | ${cell.runs.length} | ${cell.passed} / ${cell.runs.length} | ${usd(m.costUsd)} | ${minutes(m.durationMs)} | ${num(m.hardcodedColors)} | ${num(m.axeSerious)} / ${num(m.axeCritical)} | ${num(m.overflow1280)} / ${num(m.overflow834)} / ${num(m.overflow390)} | ${num(m.missingStates)} |`);
    }
    lines.push('');
  }
  lines.push('## 每一次的結果', '', '| 結果檔 | 場景 | 組別 | outcome | 費用 | 時間 | 寫死顏色 | axe s / c | 溢出 | 缺漏 | 隔離 | DESIGN.md / llms.txt / 套件檔 讀取 | 取代 |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const { file, data } of records) {
    const m = metrics(data);
    const usage = data.usage ?? {};
    lines.push(`| ${file} | ${data.scene} | ${data.group} | ${data.outcome} | ${usd(m.costUsd)} | ${minutes(m.durationMs)} | ${num(m.hardcodedColors)} | ${num(m.axeSerious)} / ${num(m.axeCritical)} | ${num(m.overflow1280)} / ${num(m.overflow834)} / ${num(m.overflow390)} | ${num(m.missingStates)} | ${data.isolation?.ok ? '通過' : '未通過'} | ${usage.designMdTouched ?? '—'} / ${usage.llmsTxtTouched ?? '—'} / ${usage.packageFileReads ?? '—'} | ${data.supersedes ?? ''} |`);
  }
  lines.push('', '## 所有失敗的執行', '');
  if (summary.failed.length === 0) lines.push('- 沒有。');
  for (const item of summary.failed) lines.push(`- ${item.file}（${item.scene} × ${item.group}）：${item.outcome}${item.harnessCause ? `／${item.harnessCause}` : ''}；${item.reason}${item.superseded ? `；harness 造成，已由 ${item.supersededBy} 補跑取代，原紀錄保留` : '；算進該格有效的 3 次'}`);
  const rejudged = records.filter(record => record.data.rejudgedAt);
  lines.push('', '## 隔離判定的更正（重判，不重跑）', '');
  if (rejudged.length === 0) lines.push('- 沒有。');
  else {
    lines.push('第一批 crud × luca 的 3 次被舊的越界規則誤判：代理 `cd` 進 `node_modules/@luca-style/react` 後直接 `cat llms.txt`（沒有路徑），舊規則把裸的 `llms.txt` 當越界，與協調者「讀已安裝套件自己的檔案不算越界」的裁定不符。規則更正後（`rejudgeIsolation`），用保存的 claude 輸出重判，不重跑、不花錢；原判定保留在結果檔的 `originalJudgement`，下列各檔都可對照：');
    for (const { file, data } of rejudged) lines.push(`- ${file}：原判定 ${data.originalJudgement.outcome}／${data.originalJudgement.harnessCause ?? '—'}（${data.originalJudgement.reason}），重判後 ${data.outcome}`);
  }
  lines.push(
    '',
    '「失敗」= outcome 不是 `passed`：隔離失敗、逾時、超出預算（含撞到單次 $5 上限）、輸出不是 JSON、建置失敗、harness 例外。失敗的執行不重跑來換掉；只有 harness 例外（工具本身壞掉，`harnessCause: harness-exception`）可以補跑，每格最多一次，新檔用 `supersedes` 指向原檔，原檔保留並列在上方，有效次數維持 3。隔離失敗與模型造成的失敗不補跑。',
    '',
    '## 處理（treatment）與可比性',
    '',
    '- luca 組的文件優勢就是被量的處理：README 指向、`docs/consumer-guide.md`（與 repo 逐位元組相同）、已安裝套件內附的 `DESIGN.md` 與 `llms.txt`。plain 組只有同一份 README 的中性段落。兩組的指令、旗標與 settings 相同，差別只有工作區內容。',
    '- 依協調者裁定，luca 組讀已安裝套件自己的檔案（`node_modules/@luca-style/*`）是處理的一部分，只記錄不算越界；越界仍是提到 repo 路徑、套件外的 `examples/`、工作區以外的路徑、`~/.claude`。plain 組提到 luca 也算越界。上表最後兩欄記錄讀取次數。',
    '- ISSUE-011 試跑的 luca 組只被指向 `DESIGN.md`；這次給的是指南加 DESIGN.md／llms.txt，兩者**不可比**，試跑結果不計入這 18 次。',
    '- 題目裡「表單欄位要有標籤」那行與 `crud.md` 逐字相同，但對儀表板與定價頁只是鬆散相關（這兩題的表單很少）。',
    '',
    '## 執行過程揭露',
    '',
    '- 兩個 driver 腳本同時在跑：停掉第一個 driver 時只結束了外層，它的迴圈繼續開跑，所以約有 4 次執行（crud × luca 補跑與 dashboard × plain 的前幾次）和第二個 driver 重疊。重疊會影響單次耗時、也可能和評分器共用連接埠 4190（所有結果檔的評分都成功，沒有因此失敗）。發現後結束了多出來的 dashboard × plain 第 4 次，那次尚未寫出任何結果檔，其用量沒有記錄（估計不到 $0.3），不在報告的費用合計裡。',
    '- 因此耗時的中位數只作粗略參考。',
    '',
    '## 費用與風險',
    '',
    `- 實際合計（含被取代的檔）${usd(summary.costUsd)}，以 API 價格換算；實際消耗的是擁有者 claude.ai 訂閱額度，不是另外付費。`,
    '- 風險一：預估 $3.66 只來自後台與 CRUD 的各 1 次試跑；儀表板題目較大，費用可能高於預估。',
    '- 風險二：撞到單次 $5 上限的執行算失敗（不重跑）。',
    '- 風險三：累計等價費用超過 $8 就停止並回報；停止會讓報告停在 INCOMPLETE。護欄在每次開跑前檢查，所以最後一次可能超出至多 $5。被取代的檔也算進累計。',
    '',
    '## 給 ISSUE-014',
    '',
    `ISSUE-014 的 npm 組沿用「後台與 CRUD × luca」的有效 3 次：${crudLuca && crudLuca.runs.length ? crudLuca.runs.map(run => `\`${run.file}\``).join('、') : '（尚無）'}。指南版本 ${guides.map(sha => `\`${sha}\``).join('、')}。`,
    '',
  );
  return lines.join('\n');
}

// 隔離規則更正後的重判（不重跑、不花錢）：用保存的 claude 輸出裡的工具呼叫，依現行規則重算越界與 outcome。
// 原判定留在 originalJudgement，更正前後都看得到。toolUses：保存輸出裡的 tool_use 區塊；build、grade：結果檔原樣。
export function rejudgeIsolation(record, toolUses, { roots, workspace }) {
  const trespasses = baselineTrespasses(toolUses, { roots, workspace, group: record.group });
  const others = (record.isolation?.problems ?? []).filter(problem => !problem.includes('工具呼叫碰到禁止的路徑'));
  const problems = [...others, ...(trespasses.length ? [`有 ${trespasses.length} 個工具呼叫碰到禁止的路徑`] : [])];
  const original = record.originalJudgement ?? { outcome: record.outcome, reason: record.reason, harnessCause: record.harnessCause ?? null, isolation: { ok: record.isolation?.ok, problems: record.isolation?.problems, trespasses: record.isolation?.trespasses } };
  const reclassified = baselineClassify({ build: record.build, graded: record.grade, parsed: true, exitCode: record.exitCode, timedOut: false, isolationProblems: problems, result: null });
  const { harnessCause } = reclassified;
  const outcome = { outcome: reclassified.outcome, reason: reclassified.reason };
  const next = { ...record, ...outcome, isolation: { ...record.isolation, ok: problems.length === 0, problems, trespasses }, originalJudgement: original };
  if (harnessCause) next.harnessCause = harnessCause; else delete next.harnessCause;
  return next;
}

// 事後確認某次失敗是 harness 造成（工具壞掉，不是代理的問題）：改記成 harness-exception 讓它可以補跑一次；
// 原判定留在 originalJudgement，原因寫在 reason。不改評分與費用。
export function markHarnessCaused(record, reason) {
  if (record.outcome === 'passed') throw new Error('已通過的執行不能標成 harness 造成');
  const original = record.originalJudgement ?? { outcome: record.outcome, reason: record.reason, harnessCause: record.harnessCause ?? null };
  return { ...record, outcome: 'harness-error', reason: `harness 例外（事後確認）：${reason}`.slice(0, 500), harnessCause: 'harness-exception', originalJudgement: original };
}
