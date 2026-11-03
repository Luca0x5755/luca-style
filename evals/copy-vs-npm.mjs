// 複製原始碼 vs npm 套件的評測判定函式（ISSUE-014，PR-EVAL-01～03）。
// 都是純函式（檔案與瀏覽器的部分在檔案後段），run.mjs 與 report.mjs 呼叫，tests/eval-copy-vs-npm.spec.ts 直接測。
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { chromium } from '@playwright/test';
import { effectiveRuns, median } from './baseline.mjs';
import { serve, widths } from './grade.mjs';

export const series = 'copy-vs-npm';
// 這個系列的格子：後台與 CRUD 題的複製組、更新題的兩組。後台與 CRUD 題的 npm 組沿用 ISSUE-013。
export const cells = [
  { scene: 'crud', group: 'copy' },
  { scene: 'update', group: 'copy' },
  { scene: 'update', group: 'npm' },
];
export const repeats = 3;

// 沿用 ISSUE-013「裝 Luca Style 並附文件」（crud × luca）的三個有效結果檔；第四個（03-37-00）是 harness 例外，已被 03-39-22 取代。
export const reusedNpmRuns = [
  '2026-11-03-03-33-47-crud-luca.json',
  '2026-11-03-03-35-10-crud-luca.json',
  '2026-11-03-03-39-22-crud-luca.json',
];
export const reusedGuideSha = '64ec331';

// 累計等價費用的停止線（含 ISSUE-013 的 $4.67）。
export const guardUsd = 10;

const sum = values => values.reduce((total, value) => total + value, 0);

// 每個結果檔的比較指標。評不到的欄位是 null（建置失敗時沒有 axe 與溢出），中位數只取有值的次數。
export function runMetrics(data) {
  const grade = data.grade ?? {};
  const localKept = grade.update?.localKept;
  return {
    hardcodedColors: grade.hardcodedColors?.count ?? null,
    missingStates: grade.missingStates?.count ?? null,
    axe: grade.axe ? (grade.axe.serious ?? 0) + (grade.axe.critical ?? 0) : null,
    overflow: grade.overflow ? sum(Object.values(grade.overflow)) : null,
    lostLocalChanges: localKept === true ? 0 : localKept === false ? 1 : null,
    costUsd: data.run?.costUsd ?? null,
    durationMs: data.run?.durationMs ?? null,
  };
}

// 門檻（docs/decision-log.md 2026-11-03 的規格決策）：
// - percent：中位數較好，且改善至少 20%（npm 中位數為 0 時不可能改善）；
// - zero：npm 中位數非零，且複製組中位數為零。
export const items = [
  { item: 'hardcodedColors', scene: 'crud', metric: 'hardcodedColors', rule: 'percent' },
  { item: 'missingStates', scene: 'crud', metric: 'missingStates', rule: 'percent' },
  { item: 'axe', scene: 'crud', metric: 'axe', rule: 'zero' },
  { item: 'overflow', scene: 'crud', metric: 'overflow', rule: 'zero' },
  { item: 'lostLocalChanges', scene: 'update', metric: 'lostLocalChanges', rule: 'zero' },
];
export const improvementThreshold = 0.2;

function judge({ rule }, npmMedian, copyMedian) {
  if (npmMedian === null || copyMedian === null) return { worse: false, improved: false, comparable: false };
  const worse = copyMedian > npmMedian;
  const improved = rule === 'percent'
    ? npmMedian > 0 && copyMedian < npmMedian && (npmMedian - copyMedian) / npmMedian >= improvementThreshold - 1e-9
    : npmMedian > 0 && copyMedian === 0;
  return { worse, improved, comparable: true };
}

// records：[{ file, data }]。series 為 copy-vs-npm 的檔（crud × copy、update × copy、update × npm），
// 加上 ISSUE-013 的 baseline 結果檔（crud × luca 對應這裡的 crud × npm）。其他檔不看。
// complete：四格各剛好 3 個有效結果，且 crud × npm 剛好是釘住的三個檔、指南 sha 為 64ec331。不完整時 copyBetter 是 null：缺證據不等於 npm 較好。
export function copyVsNpmVerdict(records) {
  const cellOf = ({ data }) => {
    if (data.series === series && ['crud', 'update'].includes(data.scene) && ['copy', 'npm'].includes(data.group)) return `${data.scene}-${data.group}`;
    if (data.series === 'baseline' && data.scene === 'crud' && data.group === 'luca') return 'crud-npm';
    return null;
  };
  const relevant = records.filter(record => cellOf(record));
  const byFile = new Set(relevant.map(record => record.file));
  const dangling = relevant.filter(record => record.data.supersedes && !byFile.has(record.data.supersedes));
  const superseded = new Set(relevant.map(record => record.data.supersedes).filter(Boolean));
  const effective = effectiveRuns(relevant);
  const cellRuns = Object.fromEntries(['crud-copy', 'crud-npm', 'update-copy', 'update-npm'].map(key => [key, effective.filter(record => cellOf(record) === key)]));

  const problems = [];
  for (const [key, runs] of Object.entries(cellRuns)) if (runs.length !== repeats) problems.push(`${key} 的有效結果是 ${runs.length} 個，要剛好 ${repeats} 個`);
  const reusedFiles = cellRuns['crud-npm'].map(record => record.file).sort();
  if (JSON.stringify(reusedFiles) !== JSON.stringify([...reusedNpmRuns].sort())) problems.push('crud × npm 沿用的不是釘住的三個 ISSUE-013 結果檔');
  if (cellRuns['crud-npm'].some(record => record.data.guide?.sha !== reusedGuideSha)) problems.push(`crud × npm 的指南版本不是 ${reusedGuideSha}`);
  if (dangling.length) problems.push('有 supersedes 指向不存在的檔');
  const complete = problems.length === 0;

  const medianOf = (key, metric) => median(cellRuns[key].map(record => runMetrics(record.data)[metric]));
  const judged = items.map(definition => {
    const npmMedian = medianOf(`${definition.scene}-npm`, definition.metric);
    const copyMedian = medianOf(`${definition.scene}-copy`, definition.metric);
    return { item: definition.item, scene: definition.scene, rule: definition.rule, npmMedian, copyMedian, ...judge(definition, npmMedian, copyMedian) };
  });
  const worseItems = judged.filter(entry => entry.worse).map(entry => entry.item);
  const improvedItems = judged.filter(entry => entry.improved).map(entry => entry.item);
  // 有項目評不到（例如整格建置失敗）時不能說複製組較好：缺證據不等於變好。
  const unjudged = judged.filter(entry => !entry.comparable).map(entry => entry.item);
  const copyBetter = complete ? worseItems.length === 0 && unjudged.length === 0 && improvedItems.length > 0 : null;

  let conclusion;
  if (!complete) conclusion = `incomplete: 資料不完整，不下結論（${problems.join('；')}）。發佈閘門不會放行。`;
  else if (copyBetter) conclusion = `copy is better: 沒有任何一項變差，且 ${improvedItems.join('、')} 達到明顯變好的門檻。依 ADR 0010 重新討論路線並停止首次發佈；樣本小，不自動換路線。`;
  else if (worseItems.length) conclusion = `npm stays: 複製組在 ${worseItems.join('、')} 的中位數較差。`;
  else if (unjudged.length) conclusion = `inconclusive, so npm stays: ${unjudged.join('、')} 評不到中位數（整格沒有可比的值），不能說複製組較好。`;
  else conclusion = 'inconclusive, so npm stays: 沒有任何一項達到明顯變好的門檻（平手或改善不足），npm 是預設路線。';

  const failed = relevant.filter(record => record.data.outcome !== 'passed').map(record => ({
    file: record.file, scene: record.data.scene, group: cellOf(record).split('-')[1], outcome: record.data.outcome, reason: record.data.reason ?? null,
    harnessCause: record.data.harnessCause ?? null, superseded: superseded.has(record.file),
    supersededBy: relevant.find(other => other.data.supersedes === record.file)?.file ?? null,
  }));

  const reusedRecords = cellRuns['crud-npm'];
  return {
    complete, copyBetter, conclusion, problems, items: judged, failed,
    cells: Object.fromEntries(Object.entries(cellRuns).map(([key, runs]) => [key, {
      files: runs.map(record => record.file), passed: runs.filter(record => record.data.outcome === 'passed').length,
      medians: Object.fromEntries(Object.keys(runMetrics({})).map(metric => [metric, median(runs.map(record => runMetrics(record.data)[metric]))])),
    }])),
    reuse: {
      files: reusedRecords.map(record => record.file).sort(), guideSha: reusedGuideSha,
      startedAt: reusedRecords.map(record => record.data.startedAt ?? null), claudeVersion: [...new Set(reusedRecords.map(record => record.data.claudeVersion ?? null))],
      note: 'npm 組沿用 ISSUE-013 的結果，與複製組、更新題不是同一批時間跑的；模型、旗標與 claude 版本以各結果檔記錄為準。',
    },
    costUsd: sum(relevant.filter(record => record.data.series === series).map(record => record.data.run?.costUsd ?? 0)),
  };
}

// 單次執行的上限（與 run.mjs 的 settings.budgetUsd 相同）。
export const singleRunCapUsd = 5;

// 費用護欄：ISSUE-013 的 baseline 結果加本系列（含被取代的檔）累計超過停止線就丟錯，由呼叫端停下回報協調者。
// 剛好等於停止線可以開跑；最後一次可能超出至多單次上限。
export function copyVsNpmGuard(baselineRecords, seriesRecords, limitUsd = guardUsd) {
  const spent = [...baselineRecords, ...seriesRecords].reduce((total, record) => total + (record.run?.costUsd ?? 0), 0);
  if (spent > limitUsd + 1e-9) throw new Error(`累計等價費用 $${spent.toFixed(2)}（含 ISSUE-013），超過 $${limitUsd}，請停下回報協調者`);
  return Math.round(spent * 100) / 100;
}

// 複製組的專案不能宣告或裝 @luca-style/react（只裝 @luca-style/tokens 與 Base UI）。
export function copyGroupProblems({ packageJson, installedReact }) {
  const problems = [];
  if (/@luca-style\/react/.test(packageJson ?? '')) problems.push('複製組的 package.json 出現 @luca-style/react');
  if (installedReact) problems.push('複製組的 node_modules 裝了 @luca-style/react');
  return problems;
}

// 更新題的「新版」與「本地改動」：都是對 Button 原始碼的字串補丁，套不上就丟錯（不會悄悄略過）。
export const newVersion = '0.2.1';
export const localChangeAttribute = 'data-local-change';
export const localChangeValue = 'orders';
export const newVersionMarker = 'aria-disabled={loading || undefined}';

function replaceOnce(text, from, to, what) {
  if (text.split(from).length !== 2) throw new Error(`補丁套不上（${what}）：要剛好出現一次 ${from}`);
  return text.replace(from, () => to);
}
// 新版：loading 時按鈕額外有 aria-disabled="true"（原始碼與建置輸出各一個版本）。
export const applyNewVersion = text => replaceOnce(text, 'aria-busy={loading || undefined}', `aria-busy={loading || undefined} ${newVersionMarker}`, '新版原始碼');
export const applyNewVersionDist = text => replaceOnce(text, '"aria-busy": loading || undefined', '"aria-busy": loading || undefined, "aria-disabled": loading || undefined', '新版建置輸出');
// 本地改動：每個 Button 都帶 data-local-change="orders"（按鈕與連結兩條路徑）。
export function applyLocalChange(text) {
  const withButton = replaceOnce(text, '<BaseButton {...rest} type={type}', `<BaseButton {...rest} ${localChangeAttribute}="${localChangeValue}" type={type}`, '本地改動的按鈕');
  return replaceOnce(withButton, 'props:{...props, className:classNameOf(variant, className)}', `props:{...props, '${localChangeAttribute}':'${localChangeValue}', className:classNameOf(variant, className)}`, '本地改動的連結');
}

// 更新題的評分。dist：建置輸出；source：工作區（檢查新版真的裝了）；mode：npm 或 copy。
// 三個旗標各自獨立：新版真的裝了（不只是頁面上有屬性）、新版的行為在頁面上生效、本地改動還在。pass 要三個都成立。
const updatePort = 4191;
const blockingImpacts = new Set(['serious', 'critical']);

async function newVersionInstalled(source, mode) {
  try {
    if (mode === 'npm') {
      const directory = join(source, 'node_modules', '@luca-style', 'react');
      const { version } = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
      return version === newVersion && (await readFile(join(directory, 'dist', 'button.js'), 'utf8')).includes('"aria-disabled": loading || undefined');
    }
    return (await readFile(join(source, 'src', 'luca-style', 'button.tsx'), 'utf8')).includes(newVersionMarker);
  } catch { return false; }
}

export async function gradeUpdate({ source, dist, mode, port = updatePort }) {
  const installed = await newVersionInstalled(source, mode);
  const server = await serve(dist, port);
  try {
    const browser = await chromium.launch();
    try {
      let active = false;
      let kept = false;
      const overflow = {};
      const found = new Map();
      for (const width of widths) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
        try {
          const page = await context.newPage();
          await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
          if (width === widths[0]) {
            const buttons = await page.locator('button').evaluateAll(list => list.map(button => ({
              local: button.hasAttribute('data-local-change'), busy: button.getAttribute('aria-busy') === 'true', disabled: button.getAttribute('aria-disabled'),
            })));
            const busy = buttons.filter(button => button.busy);
            active = busy.length > 0 && busy.every(button => button.disabled === 'true');
            kept = buttons.length > 0 && buttons.every(button => button.local);
          }
          overflow[width] = (await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)) ? 1 : 0;
          for (const violation of (await new AxeBuilder({ page }).analyze()).violations.filter(item => blockingImpacts.has(item.impact ?? ''))) {
            for (const node of violation.nodes) found.set(`${violation.id}|${node.html}`, { id: violation.id, impact: violation.impact, html: node.html, width });
          }
        } finally { await context.close(); }
      }
      const axeItems = [...found.values()];
      return {
        update: { newVersionInstalled: installed, newVersionActive: active, localKept: kept, pass: installed && active && kept },
        axe: { serious: axeItems.filter(item => item.impact === 'serious').length, critical: axeItems.filter(item => item.impact === 'critical').length, items: axeItems },
        overflow,
      };
    } finally { await browser.close(); }
  } finally { await new Promise(done => server.close(done)); }
}

const usd = value => (typeof value === 'number' ? `$${value.toFixed(2)}` : '—');
const minutes = ms => (typeof ms === 'number' ? `${(ms / 60000).toFixed(1)} 分` : '—');
const num = value => (value === null || value === undefined ? '—' : Number.isInteger(value) ? String(value) : value.toFixed(1));
const flag = value => (value === true ? '是' : value === false ? '否' : '—');
const cellTitles = { 'crud-copy': '後台與 CRUD × 複製原始碼', 'crud-npm': '後台與 CRUD × npm（沿用 ISSUE-013）', 'update-copy': '更新到新版 × 複製原始碼', 'update-npm': '更新到新版 × npm' };

// 報告。同樣的結果永遠產生同樣的文字（不含時間、路徑）。records 同 copyVsNpmVerdict。
export function renderCopyVsNpm(records, verdict) {
  const lines = [
    '# 複製原始碼 vs npm 套件評測報告（PR-EVAL-01、02、03）',
    '',
    '由 `node evals/report.mjs` 從 `evals/results/*.json` 產生，不要手改。結論檔：`evals/results/copy-vs-npm.json`。',
    '',
    '## 結論',
    '',
    `- complete：${verdict.complete}；copyBetter：${verdict.copyBetter}`,
    `- ${verdict.conclusion}`,
    '- 樣本小：每格只有 3 次。這個結論只決定要不要重新討論 ADR 0010，不會自動換路線，也不是統計檢定。',
    '- 判定規則（docs/decision-log.md 2026-11-03 的規格決策）：寫死顏色數、狀態缺漏，中位數較好且改善至少 20%；axe 違規、水平溢出、更新時遺失本地改動，要從非零（npm）變成零（複製）；費用與時間只記錄，不算品質項目。複製組較好要同時：沒有任何一項變差，且至少一項達到門檻；平手或證據不足一律維持 npm（預設路線）。',
    '',
    '## 逐項判定',
    '',
    '| 項目 | 題目 | 規則 | npm 中位數 | 複製中位數 | 變差 | 達到門檻 |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const entry of verdict.items) lines.push(`| ${entry.item} | ${entry.scene} | ${entry.rule === 'percent' ? '改善至少 20%' : 'npm 非零且複製為零'} | ${num(entry.npmMedian)} | ${num(entry.copyMedian)} | ${flag(entry.worse)} | ${flag(entry.improved)} |`);
  lines.push('', '## 每一格的中位數', '', '失敗的執行也算在內（評不到的欄位，例如建置失敗時沒有 axe，只取有值的次數）。', '',
    '| 格子 | 檔案 | 通過 | 費用 | 時間 | 寫死顏色 | axe | 溢出（三種寬度合計） | 狀態缺漏 | 遺失本地改動 |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const [key, cell] of Object.entries(verdict.cells)) {
    const m = cell.medians;
    lines.push(`| ${cellTitles[key]} | ${cell.files.length} | ${cell.passed} / ${cell.files.length} | ${usd(m.costUsd)} | ${minutes(m.durationMs)} | ${num(m.hardcodedColors)} | ${num(m.axe)} | ${num(m.overflow)} | ${num(m.missingStates)} | ${num(m.lostLocalChanges)} |`);
  }
  lines.push('', '更新題（update）只有「遺失本地改動」進判定；它的寫死顏色、axe、溢出另記錄，不進判定（頁面只有三顆按鈕，沒有可比的版面）。狀態缺漏只在後台與 CRUD 題比較。', '', '## 每一次的結果', '',
    '| 結果檔 | 題目 | 組別 | outcome | 費用 | 時間 | 寫死顏色 | axe | 溢出 | 缺漏 | 新版裝了 / 生效 / 本地改動還在 | 取代 |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const { file, data } of records) {
    const m = runMetrics(data);
    const update = data.grade?.update;
    lines.push(`| ${file} | ${data.scene} | ${data.series === 'baseline' ? 'npm' : data.group} | ${data.outcome} | ${usd(m.costUsd)} | ${minutes(m.durationMs)} | ${num(m.hardcodedColors)} | ${num(m.axe)} | ${num(m.overflow)} | ${num(m.missingStates)} | ${update ? `${flag(update.newVersionInstalled)} / ${flag(update.newVersionActive)} / ${flag(update.localKept)}` : '—'} | ${data.supersedes ?? ''} |`);
  }
  lines.push('', '## 所有失敗的執行', '');
  if (verdict.failed.length === 0) lines.push('- 沒有。');
  for (const entry of verdict.failed) lines.push(`- ${entry.file}（${entry.scene} × ${entry.group}）：${entry.outcome}${entry.harnessCause ? `／${entry.harnessCause}` : ''}；${entry.reason ?? ''}${entry.superseded ? `；harness 造成，已由 ${entry.supersededBy} 補跑取代，原紀錄保留` : '；算進該格有效的 3 次'}`);
  lines.push('',
    '「失敗」= outcome 不是 `passed`：隔離失敗、逾時、超出預算、輸出不是 JSON、建置失敗、更新題沒有裝上新版或沒有保留本地改動、harness 例外。失敗的執行不重跑來換掉；只有基礎建設失敗（harness 例外，工具本身壞掉）可以補跑一次，每格最多一次，新檔用 `supersedes` 指向原檔，原檔保留並列在上方，有效次數維持 3。',
    '',
    '## 沿用的 npm 組（後台與 CRUD）', '',
    `- 三個檔：${verdict.reuse.files.map(file => `\`${file}\``).join('、')}；指南版本 \`${verdict.reuse.guideSha}\`。`,
    `- 執行時間：${verdict.reuse.startedAt.join('、')}；claude 版本：${verdict.reuse.claudeVersion.join('、')}。`,
    '- 沿用的第四個檔 `2026-11-03-03-37-00-crud-luca.json` 是 harness 例外，已由 `2026-11-03-03-39-22-crud-luca.json` 取代，原檔保留。',
    `- ${verdict.reuse.note}`,
    '',
    '## 揭露（可比性與偏差）', '',
    '- **文件不對稱（偏差方向不確定）。** 複製組沒有 `docs/consumer-guide.md`，npm 組有（指南的內容是 npm 安裝與匯入步驟，給複製組會誤導）。可能的偏差：文件少的複製組品質分數偏差，會讓結論偏向 npm 較好；反方向是複製組可以直接讀到元件原始碼，有助於把元件用對。兩個方向的大小沒有量過，無法修正。',
    '- **`llms.txt`、`DESIGN.md` 位置不同。** npm 組在 `node_modules/@luca-style/react/`，複製組放在專案根目錄；複製組另外有 `src/luca-style/` 底下的元件原始碼、字體與動畫資源。',
    '- **越界規則（沿用 ISSUE-013 協調者的裁定）。** npm 組讀已安裝套件自己的檔案（`node_modules/@luca-style/*`）是處理的一部分，只記錄不算越界；複製組讀專案內的 `src/luca-style/` 是專案自己的檔案，同樣不算越界。兩組一律算越界的是：repo 與主 repo 的路徑、套件外的 `examples/`、工作區以外的路徑、`~/.claude`。複製組另外不能宣告或安裝 `@luca-style/react`，否則算隔離失敗。',
    '- **寫死顏色的掃描。** 複製組複製進來、沒被改過的元件原始碼不掃（元件庫自己的寫法不算代理寫的）；被改過或新增的檔照掃。',
    '- **更新題結構不對稱。** npm 組的包裝層（`src/local-button.tsx`）只用公開 API，`npm install` 不會動它，所以只有複製組的升級會覆蓋 `button.tsx` 而可能丟掉本地改動。「遺失本地改動」因此只說明「複製組在這個題目上會不會丟」，不是對稱的比較。',
    '- **更新題的新版是自己打包的**，只改了 `Button` 的一個行為（`loading` 時加 `aria-disabled`），這只模擬真實升級：真實升級有多個檔案、型別與行為一起變動，也有 changelog。更新題兩組都沒有指南；題目只有「新版在哪裡」一段不同。',
    '- **更新題的評分** 除了頁面上的行為，還檢查新版真的裝了（npm 組：套件版本 0.2.1 且建置輸出有補丁；複製組：`src/luca-style/button.tsx` 有補丁），所以只在頁面寫死屬性的作法不會通過。這仍然擋不住所有作弊。',
    '- **兩批結果不是同一時間跑的。** npm 組是 ISSUE-013 的結果，複製組與更新題是這張票跑的；模型版本與 harness 版本以各結果檔記錄為準。',
    '- 評測的 `claude -p` 沿用擁有者 claude.ai 訂閱額度，費用是以 API 價格換算的等價費用，不是另外付費。',
    '',
    '## 費用', '',
    `- 本系列實際合計（含被取代的檔，不含沿用的 npm 組）${usd(verdict.costUsd)}。`,
    '',
  );
  return lines.join('\n');
}

// ADR 0010 的狀態：只有資料完整且複製組沒有較好時才是 Accepted；較好或資料不完整都維持 Proposed（不改狀態，回報擁有者）。
export const adrStatusFor = verdict => (verdict.complete === true && verdict.copyBetter === false ? 'Accepted' : 'Proposed');
