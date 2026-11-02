// 全新代理只靠文件接入實測的判定函式（ISSUE-012，PR-ADOPT-06）：工作區內容、隔離、結果分類、去識別。
// 都是純函式，run.mjs 與 report.mjs 呼叫，tests/eval-onboarding.spec.ts 直接測。

// 工作區裡不能出現的東西：代理只能看到指南與兩個打包檔。
const forbiddenPrefixes = ['examples/', 'packages/', 'node_modules/@luca-style/'];
const forbiddenNames = ['README.md', 'llms.txt', 'DESIGN.md', 'AGENTS.md', 'CLAUDE.md'];

// files：工作區內的相對路徑（正斜線，不含 node_modules 與 .git）。回傳問題清單，空陣列代表乾淨。
export function workspaceProblems(files) {
  const problems = [];
  for (const file of files) {
    const prefix = forbiddenPrefixes.find(item => file.startsWith(item));
    if (prefix) problems.push(`工作區有不該出現的 ${prefix}：${file}`);
    else if (forbiddenNames.includes(file.split('/').at(-1))) problems.push(`工作區有不該出現的 ${file.split('/').at(-1)}：${file}`);
    else if (/\.(md|txt)$/i.test(file) && file !== 'docs/consumer-guide.md') problems.push(`工作區多了文件 ${file}`);
    else if (file.startsWith('docs/') && file !== 'docs/consumer-guide.md') problems.push(`工作區多了文件 ${file}`);
  }
  return problems;
}

// 比對用：統一成小寫、正斜線。
const normalize = text => text.replace(/\\\\/g, '/').replace(/\\/g, '/').toLowerCase();

// 任何工具（Read、Glob、Grep、Bash 都算）的路徑或文字提到 repo 路徑、examples 或 llms.txt，就是越界。
// 拒絕規則只涵蓋 Read、Edit，所以靠這個事後判定。roots：禁止的根目錄（絕對路徑）。
export function findTrespasses(toolUses, roots) {
  const normalizedRoots = roots.map(normalize);
  return toolUses.filter(use => {
    const input = normalize(JSON.stringify(use.input ?? {}));
    return normalizedRoots.some(root => input.includes(root)) || input.includes('examples') || input.includes('llms.txt') || input.includes('/.claude');
  }).map(use => ({ tool: use.name, input: JSON.stringify(use.input).slice(0, 300) }));
}

// 結果分類。逾時、超出預算、輸出不是 JSON 都算評分失敗（需要人介入），並寫明原因。
// 隔離失敗與 harness 例外記成 harness-error 並帶 harnessCause；不排除在 3 次之外，也不自動重跑。
export function classifyOutcome({ timedOut = false, signal = null, exitCode = 0, result = null, parsed = true, grade = null, isolationProblems = [], harnessError = null }) {
  if (harnessError) return { outcome: 'harness-error', reason: `harness 例外：${harnessError.message}`.slice(0, 500), harnessCause: 'harness-exception' };
  if (isolationProblems.length) return { outcome: 'harness-error', reason: `隔離失敗：${isolationProblems.join('；')}`, harnessCause: 'isolation' };
  if (timedOut) return { outcome: 'timeout', reason: '超過 45 分鐘的時間上限，行程被結束' };
  if (/budget/i.test(result?.subtype ?? '')) return { outcome: 'budget', reason: `超出 budget 上限（${result.subtype}）` };
  if (signal) return { outcome: 'killed', reason: `行程被訊號 ${signal} 結束` };
  if (!parsed) return { outcome: 'failed-grade', reason: exitCode === 0 ? 'claude 的輸出不是 JSON，沒有評分資料' : `claude 結束代碼 ${exitCode}，輸出不是 JSON` };
  if (!grade) return { outcome: 'failed-grade', reason: '沒有評分結果' };
  if (!grade.pass) return { outcome: 'failed-grade', reason: `檢查未通過：${[...new Set(grade.failures.map(failure => failure.item))].join('、')}` };
  return { outcome: 'passed', reason: '檢查全部通過' };
}

// 去識別：把路徑換成佔位字串。每個路徑涵蓋反斜線、正斜線、JSON 轉義（雙反斜線）、msys（/c/Users/…）四種寫法，
// 大小寫不分；先換較長的（工作區、暫存目錄），再換家目錄。
const escapeRegex = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function variants(path) {
  const slash = path.replace(/\\/g, '/');
  const msys = slash.replace(/^([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`);
  return [path.replace(/\\/g, '\\\\'), path, slash, msys];
}
export function scrub(text, { workspace, temporary, home }) {
  let result = text;
  for (const [path, placeholder] of [[workspace, '<workspace>'], [temporary, '<temp>'], [home, '<home>']]) {
    if (!path) continue;
    // 雙反斜線寫法要最先換，否則單反斜線的規則會把它拆開。
    for (const form of [...new Set(variants(path))].sort((a, b) => b.length - a.length)) {
      result = result.replace(new RegExp(escapeRegex(form), 'gi'), placeholder);
    }
  }
  return result;
}
