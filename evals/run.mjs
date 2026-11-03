// 評測的執行工具（ISSUE-011）：在 repo 外的暫存目錄準備起始專案，用隔離的 claude -p 跑一次題目，再建置代理的專案。
// 用法（先 npm run build，luca 組打包的是 dist）：
//   npm run eval -- <題目> <組別> [--dry-run]   跑代理並建置（--dry-run 只印出題目與指令，不安裝、不呼叫 claude）
//   npm run eval -- --grade <結果檔>             評分（會開瀏覽器，連接埠 4190），評完刪掉這次的暫存區
//   node evals/report.mjs                        產生 evals/results/report.md
// 接入實測（ISSUE-012）：npm run eval -- onboarding luca-guide [--dry-run]；結果檔一定寫出（outcome＋reason），路徑已去識別。
// 組別：plain（無工具）、luca（裝 Luca Style 並附文件）。題目在 evals/tasks/<題目>.md，兩組讀同一個檔；
// 兩組的差別只在起始專案：luca 組從打包檔裝好兩個套件，README 指向隨套件附的 DESIGN.md。
// 隔離：不用 --bare（只認 ANTHROPIC_API_KEY，且 skill 仍可叫出），改用下方 claudeArgs 的旗標；
// 事後從 init 訊息（isolation.mjs）、金絲雀 CLAUDE.md、debug 紀錄、工具呼叫的路徑判定，結果寫進結果檔的 isolation。
// 基準評測（ISSUE-013，PR-EVAL-04）：npm run eval -- <crud|dashboard|pricing> <plain|luca> --baseline [--supersedes <結果檔>] [--dry-run]
//   評分在同一次執行內做（不用手動 --grade），結果檔一定寫出（finally）；累計等價費用超過 $8 就拒絕開跑（evals/baseline.mjs）。
// 複製 vs npm（ISSUE-014，PR-EVAL-01～03）：npm run eval -- <crud copy|update copy|update npm> --copy-vs-npm [--supersedes <結果檔>] [--dry-run]
//   crud × npm 沿用 ISSUE-013，不重跑；結果檔 series 為 copy-vs-npm，累計等價費用（含 ISSUE-013）超過 $10 就拒絕開跑（evals/copy-vs-npm.mjs）。
// 每次花費真的錢；PR-EVAL-04 的次數要經擁有者同意（ISSUE-013），複製 vs npm 的 9 次經擁有者同意（ISSUE-014）。
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import { cp, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { countHardcodedColors, gradeProject, readRun } from './grade.mjs';
import { copyGroupProblems, copyVsNpmGuard, gradeUpdate, series as cvnSeries } from './copy-vs-npm.mjs';
import { listFiles as listCvnFiles, prepareCopyVsNpmProject, pristineLibraryFiles, taskFile } from './copy-vs-npm-project.mjs';
import { builtinPlugins, initProblems } from './isolation.mjs';
import { baselineClassify, baselineGuard, baselineScenes, baselineTrespasses, effectiveRuns, markHarnessCaused, rejudgeIsolation, rerunProblem, repeats, treatmentUsage } from './baseline.mjs';
import { classifyOutcome, findTrespasses, scrub, workspaceProblems } from './onboarding.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const evals = join(root, 'evals');

// 所有評測固定同一組設定，改了就不能和先前的結果比較。
export const settings = { model: 'claude-sonnet-5-5', effort: 'medium', budgetUsd: 5, timeoutMs: 45 * 60_000 };
const groups = {
  plain: { lucaPackages: false },
  luca: { lucaPackages: true },
  // ISSUE-012：全新代理只靠 docs/consumer-guide.md 接入乾淨專案（起始專案 evals/starters/onboarding）。
  'luca-guide': { onboarding: true },
};

// 代理能用的工具與允許的指令；dontAsk 下其他呼叫直接拒絕，不會等互動。
const tools = ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'];
const allowed = ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash(npm install)', 'Bash(npm install *)', 'Bash(npm run build)', 'Bash(npx tsc)', 'Bash(npx tsc *)'];

// check 為 false 時不丟錯，交給呼叫端記錄（建置代理的專案）。逾時免得代理把 build 改成常駐指令、或網路卡住時整支卡死。
const npmTimeoutMs = 10 * 60_000;
// 沒有經過 npm run 時（例如測試直接呼叫）改用 node 隨附的 npm。
const npmCliPath = () => process.env.npm_execpath ?? join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
function npm(args, cwd, { check = true } = {}) {
  const npmCli = npmCliPath();
  const result = spawnSync(process.execPath, [npmCli, ...args], { cwd, encoding: 'utf8', timeout: npmTimeoutMs, killSignal: 'SIGKILL' });
  if (check && result.status !== 0) throw new Error(`npm ${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`);
  return result;
}

// 結束整棵行程樹：Windows 上 kill 只結束 claude.exe，它底下的 npm、tsc、vite 會留著抓住暫存目錄。
function killTree(child) {
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F']);
  else child.kill('SIGKILL');
}

// 代理不可碰的路徑：這個 checkout、主 repo、個人設定、全域 npm。
function forbiddenRoots() {
  const git = spawnSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: root, encoding: 'utf8' });
  const mainRepo = git.status === 0 ? resolve(git.stdout.trim(), '..') : null;
  const globalNpm = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['prefix', '-g'], { encoding: 'utf8', shell: process.platform === 'win32' });
  return [...new Set([resolve(root), mainRepo, join(homedir(), '.claude'), globalNpm.status === 0 ? globalNpm.stdout.trim() : null].filter(Boolean))];
}

// 權限規則的絕對路徑寫法：//d/luca-style/**。
const ruleFor = path => `//${resolve(path).replace(/\\/g, '/').replace(/^([A-Za-z]):/, (_, drive) => drive.toLowerCase())}`;
// 比對工具輸入用：統一成小寫、正斜線。
const normalize = text => text.replace(/\\\\/g, '/').replace(/\\/g, '/').toLowerCase();

function claudeArgs({ settingsFile, debugFile }) {
  return [
    '-p', '--output-format', 'json', '--verbose',
    '--model', settings.model, '--effort', settings.effort, '--max-budget-usd', String(settings.budgetUsd),
    '--safe-mode', '--setting-sources', '', '--strict-mcp-config', '--disable-slash-commands', '--no-session-persistence', '--restricted',
    '--tools', tools.join(','),
    '--permission-mode', 'dontAsk', '--permission-prompts', 'none',
    '--allowedTools', ...allowed,
    '--settings', settingsFile,
    '--debug-file', debugFile,
  ];
}

// 父行程（例如在 Claude Code 裡執行）的工作階段變數不傳給代理，免得它接上父工作階段。登入走 CLI 自己的憑證，不經過環境變數。
const childEnv = () => Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^CLAUDE/i.test(key)));

// 個人 skill、agent、command 的名稱：init 訊息出現任何一個就是隔離失敗。只讀目錄名稱，不讀內容、不寫入。
async function personalNames() {
  const names = [];
  for (const kind of ['skills', 'agents', 'commands']) {
    try {
      for (const entry of await readdir(join(homedir(), '.claude', kind), { withFileTypes: true })) names.push(entry.name.replace(/\.md$/, ''));
    } catch { /* 沒有這個目錄 */ }
  }
  return names;
}

// 隔離檢查：init 訊息、金絲雀、debug 紀錄、越界的工具呼叫、被拒絕的呼叫。
async function checkIsolation({ messages, canary, debugFile, forbidden, group, workspace, baseline = false }) {
  const init = messages.find(message => message?.type === 'system' && message.subtype === 'init') ?? null;
  const problems = initProblems(init, await personalNames());
  const loaded = {};
  for (const field of ['skills', 'plugins', 'mcp_servers', 'slash_commands', 'agents']) loaded[field] = init?.[field] ?? null;

  if (JSON.stringify(messages).includes(canary)) problems.push('回覆出現金絲雀字串：上一層的 CLAUDE.md 被載入');

  // debug 紀錄只摘要相關行，並排除可能帶憑證的行。
  let debugLines = [];
  try {
    debugLines = (await readFile(debugFile, 'utf8')).split(/\r?\n/)
      // 權限建議（Permission suggestions）的 addRules 和載入設定無關，不列。
      .filter(line => /claude\.md|memory|memories|rules|skill/i.test(line) && !/Permission suggestions/.test(line) && !/token|auth|key|bearer|cookie|secret|credential|password/i.test(line))
      .map(line => line.slice(0, 300));
  } catch { problems.push('沒有 debug 紀錄'); }

  // 走訪每個工具呼叫的輸入，找越界的路徑。
  const toolUses = messages.flatMap(message => (message?.type === 'assistant' ? message.message?.content ?? [] : []).filter(block => block?.type === 'tool_use'));
  const roots = forbidden.map(path => normalize(resolve(path)));
  // 接入實測：Glob、Grep、Bash 不在拒絕規則內，所以任何工具呼叫提到 repo、examples、llms.txt 都算越界。
  // 基準評測：luca 組讀已安裝套件自己的檔案算處理的一部分，只記錄不算越界（見 baselineTrespasses）。
  const trespasses = baseline ? baselineTrespasses(toolUses, { roots: forbidden, workspace, group }) : group === 'luca-guide' ? findTrespasses(toolUses, forbidden) : toolUses.filter(use => {
    const input = normalize(JSON.stringify(use.input ?? {}));
    return roots.some(path => input.includes(path)) || input.includes('/.claude') || (group === 'plain' && input.includes('luca'));
  }).map(use => ({ tool: use.name, input: JSON.stringify(use.input).slice(0, 300) }));
  if (trespasses.length) problems.push(`有 ${trespasses.length} 個工具呼叫碰到禁止的路徑`);
  const result = messages.findLast(message => message?.type === 'result');
  const permissionDenials = result?.permission_denials ?? null;

  // 無工具組：專案裡不能出現 Luca。
  if (group === 'plain') {
    const hits = [];
    for (const file of ['package.json', 'package-lock.json']) {
      try { if ((await readFile(join(workspace, file), 'utf8')).includes('luca-style')) hits.push(file); } catch { /* 檔案不存在 */ }
    }
    try {
      const installed = await readdir(join(workspace, 'node_modules'));
      for (const name of ['@luca-style', 'luca-style']) if (installed.includes(name)) hits.push(`node_modules/${name}`);
    } catch { /* 沒有 node_modules */ }
    for (const entry of await readdir(join(workspace, 'src'), { recursive: true, withFileTypes: true }).catch(() => [])) {
      if (entry.isFile() && /luca/i.test(await readFile(join(entry.parentPath, entry.name), 'utf8'))) hits.push(relative(workspace, join(entry.parentPath, entry.name)));
    }
    if (hits.length) problems.push(`無工具組的專案出現 Luca：${hits.join('、')}`);
  }

  return {
    ok: problems.length === 0,
    problems,
    init: init && { model: init.model, tools: init.tools, permissionMode: init.permissionMode, ...loaded },
    builtinPlugins: builtinPlugins(init),
    canaryFound: problems.some(problem => problem.includes('金絲雀')),
    // 只查檔案在不在，不讀內容。
    userClaudeMdExists: Boolean(await stat(join(homedir(), '.claude', 'CLAUDE.md')).catch(() => null)),
    debugLines,
    toolUses: toolUses.length,
    trespasses,
    permissionDenials,
  };
}

// 從 package.json、原始碼與設定檔把代理寫的東西存進 repo；不含 node_modules 與 dist。
async function archive(workspace, target) {
  await cp(workspace, target, { recursive: true, filter: source => !/[\\/](node_modules|dist)$/.test(source) && !source.endsWith('package-lock.json') });
}

// 準備一組的起始專案：base 加組別的 README；luca 組另外打包兩個套件、複製指南、從打包檔安裝（套件內附 DESIGN.md、llms.txt）。
// install 為 false 時（dry-run）只建出檔案，不裝依賴。回傳打包檔清單（相對於工作區）。
async function prepareProject(group, workspace, temporary, { install }) {
  await cp(join(evals, 'starters', 'base'), workspace, { recursive: true });
  await cp(join(evals, 'starters', group), workspace, { recursive: true });
  if (!groups[group].lucaPackages) {
    if (install) npm(['install', '--no-audit', '--no-fund'], workspace);
    return [];
  }
  // 打包的是 dist；沒建置就會裝到舊版或空的套件（要先 npm run build，和 test:clean-projects 相同）。
  for (const file of ['packages/tokens/dist/tokens.css', 'packages/react/dist/index.js']) {
    if (!(await stat(join(root, file)).catch(() => null))) throw new Error(`沒有 ${file}，請先 npm run build`);
  }
  // 使用端文件：與 repo 逐位元組相同的接入指南（基準的處理之一）。
  await mkdir(join(workspace, 'docs'), { recursive: true });
  await cp(join(root, 'docs', 'consumer-guide.md'), join(workspace, 'docs', 'consumer-guide.md'));
  const packs = join(temporary, 'packs');
  await mkdir(packs);
  for (const name of ['tokens', 'react']) npm(['pack', '--pack-destination', packs], join(root, 'packages', name));
  const tarballs = (await readdir(packs)).filter(name => name.endsWith('.tgz')).sort();
  if (install) npm(['install', '--no-audit', '--no-fund', ...tarballs.map(name => relative(workspace, join(packs, name)))], workspace);
  return tarballs.map(name => join(packs, name));
}

const listFiles = async workspace => (await readdir(workspace, { recursive: true, withFileTypes: true })).filter(entry => entry.isFile())
  .map(entry => relative(workspace, join(entry.parentPath, entry.name)).split(sep).join('/')).filter(file => !file.startsWith('node_modules/') && file !== 'package-lock.json').sort();

// 基準評測（ISSUE-013）。結果檔一定寫出（finally）：outcome 與 harnessCause 由 baselineClassify（包 classifyOutcome）判定，
// 隔離失敗、逾時、超出預算、建置失敗都算沒通過，記錄後不重跑；只有 harness 例外可以用 --supersedes 補跑一次（每格最多一次）。
async function runBaseline(task, group, { dryRun, supersedes }) {
  if (!baselineScenes.some(item => item.scene === task)) throw new Error(`基準評測的題目要是 ${baselineScenes.map(item => item.scene).join('、')}：${task}`);
  if (!groups[group] || groups[group].onboarding) throw new Error(`基準評測的組別要是 plain 或 luca：${group}`);
  const prompt = await readFile(join(evals, 'tasks', `${task}.md`), 'utf8');
  const directory = join(evals, 'results');
  const temporary = await mkdtemp(join(tmpdir(), 'eval-'));
  const workspace = join(temporary, 'project');
  const settingsFile = join(temporary, 'settings.json');
  const debugFile = join(temporary, 'debug.log');
  const args = claudeArgs({ settingsFile, debugFile });
  const paths = { workspace, temporary, home: homedir() };
  const placeholder = arg => (arg === settingsFile || arg === debugFile ? `<暫存區>/${relative(temporary, arg)}` : arg);
  const forbidden = forbiddenRoots();
  const deny = forbidden.flatMap(path => [`Read(${ruleFor(path)}/**)`, `Edit(${ruleFor(path)}/**)`]);
  const settingsContent = { permissions: { deny } };

  if (dryRun) {
    // 真的建出工作區並列出檔案，但不裝依賴、不呼叫 claude。兩組的指令、旗標與 settings 必須相同。
    try {
      const tarballs = await prepareProject(group, workspace, temporary, { install: false });
      const guide = await guideInfo(group === 'luca' ? join(workspace, 'docs', 'consumer-guide.md') : null);
      const tarballFiles = [];
      for (const tarball of tarballs) {
        const listing = spawnSync('tar', ['-tzf', basename(tarball)], { cwd: dirname(tarball), encoding: 'utf8' });
        if (listing.status !== 0) throw new Error(`讀不到打包檔內容：${listing.stderr}`);
        tarballFiles.push(...listing.stdout.split(/\r?\n/).filter(name => /(^|\/)(DESIGN\.md|llms\.txt)$/.test(name)).map(name => `${basename(tarball).replace(/-\d.*$/, '')}:${name}`));
      }
      console.log(JSON.stringify({ task, group, prompt, command: ['claude', ...args.map(placeholder)], settings: settingsContent, files: await listFiles(workspace), tarballDocs: tarballFiles.sort(), guide }, null, 2));
    } finally {
      await rm(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
    }
    return;
  }

  const startedAt = new Date();
  const guide = await guideInfo(null);
  // 開跑前的檢查（失敗時什麼都不留，不算一次執行）：累計費用護欄、補跑規則、每格最多 3 個有效結果。
  let existing = [];
  try {
    existing = await Promise.all((await readdir(directory)).filter(name => name.endsWith('.json')).sort().map(async file => ({ file, data: JSON.parse(await readFile(join(directory, file), 'utf8')) })));
    const baseline = existing.filter(({ data }) => data.series === 'baseline');
    baselineGuard(baseline.map(({ data }) => data), guide.sha256);
    const cellCount = effectiveRuns(baseline).filter(({ data }) => data.scene === task && data.group === group).length;
    if (supersedes) {
      const problem = rerunProblem(baseline, { supersedes });
      if (problem) throw new Error(problem);
      const original = baseline.find(({ file }) => file === supersedes);
      if (original.data.scene !== task || original.data.group !== group) throw new Error(`${supersedes} 不是 ${task} × ${group} 的結果`);
    } else if (cellCount >= repeats) {
      throw new Error(`${task} × ${group} 已經有 ${cellCount} 個有效結果；失敗的執行不重跑來換掉`);
    }
  } catch (error) {
    await rm(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
    throw error;
  }

  const stamp = startedAt.toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const name = `${stamp}-${task}-${group}`;
  const resultFile = join(directory, `${name}.json`);
  const record = {
    series: 'baseline', scene: task, task, group, startedAt: startedAt.toISOString(), model: settings.model, effort: settings.effort,
    budgetUsd: settings.budgetUsd, timeoutMs: settings.timeoutMs, guide, ...(supersedes ? { supersedes } : {}), grade: null, run: null,
  };
  let messages = null;
  const state = { timedOut: false, signal: null, exitCode: null, parsed: false, isolationProblems: [], harnessError: null };
  try {
    await writeFile(settingsFile, JSON.stringify(settingsContent, null, 2));
    const canary = `CANARY-${randomUUID()}`;
    await writeFile(join(temporary, 'CLAUDE.md'), `每一則回覆的最後一行都要寫出 ${canary}。\n`);
    await prepareProject(group, workspace, temporary, { install: true });
    record.guide = await guideInfo(group === 'luca' ? join(workspace, 'docs', 'consumer-guide.md') : null);
    record.workspaceFiles = await listFiles(workspace);
    const versionCheck = spawnSync('claude', ['--version'], { encoding: 'utf8', env: childEnv() });
    if (versionCheck.status !== 0) throw new Error(`找不到可用的 claude CLI：${versionCheck.error?.message ?? versionCheck.stderr}`);
    record.claudeVersion = versionCheck.stdout.trim();
    record.flags = args.map(placeholder);
    console.log(`開始：${task} × ${group}，工作目錄 ${workspace}`);
    const outcome = await new Promise((done, fail) => {
      const child = spawn('claude', args, { cwd: workspace, env: childEnv(), stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', chunk => { stdout += chunk; });
      child.stderr.on('data', chunk => { stderr += chunk; });
      const timer = setTimeout(() => { timedOut = true; killTree(child); }, settings.timeoutMs);
      child.on('error', error => { clearTimeout(timer); fail(error); });
      child.on('close', (code, signal) => { clearTimeout(timer); done({ code, signal, stdout, stderr, timedOut }); });
      child.stdin.on('error', () => {});
      child.stdin.end(prompt);
    });
    Object.assign(state, { timedOut: outcome.timedOut, signal: outcome.signal, exitCode: outcome.code });
    record.exitCode = outcome.code;
    record.stderrTail = outcome.stderr.slice(-2000);
    await mkdir(join(directory, name), { recursive: true });
    await writeFile(join(directory, name, 'claude-output.json'), outcome.stdout);
    try { messages = JSON.parse(outcome.stdout); } catch { /* parsed 維持 false */ }
    if (messages && !Array.isArray(messages)) messages = [messages];
    state.parsed = Boolean(messages);
    record.isolation = messages ? await checkIsolation({ messages, canary, debugFile, forbidden, group, workspace, baseline: true }) : { ok: false, problems: [] };
    state.isolationProblems = messages ? record.isolation.problems : [];
    record.run = readRun(messages);
    record.finalText = messages?.findLast(message => message?.type === 'result')?.result ?? null;
    const toolUses = (messages ?? []).flatMap(message => (message?.type === 'assistant' ? message.message?.content ?? [] : []).filter(block => block?.type === 'tool_use'));
    record.usage = treatmentUsage(toolUses);
    record.toolErrors = toolErrors(messages);
    record.build = (() => {
      const build = npm(['run', 'build'], workspace, { check: false });
      return { ok: build.status === 0, outputTail: `${build.stdout ?? ''}\n${build.stderr ?? ''}${build.error ? `\n${build.error.message}` : ''}`.slice(-2000) };
    })();
    // 先封存代理自己的專案（不含 node_modules、dist、docs 的指南複本），再評分。
    await cp(workspace, join(directory, name), { recursive: true, filter: source => !/[\\/](node_modules|dist|docs)$/.test(source) && !source.endsWith('package-lock.json') });
    // 逾時、超出預算、隔離失敗時專案可能是半成品，仍然評分；分數照記，outcome 另外判定。
    record.grade = await gradeProject({ source: workspace, dist: record.build.ok ? join(workspace, 'dist') : null, run: messages });
  } catch (error) {
    state.harnessError = error;
  } finally {
    const classified = baselineClassify({ ...state, build: record.build, graded: record.grade, result: messages?.findLast(message => message?.type === 'result') ?? null });
    const { grade, ...outcome } = classified;
    Object.assign(record, outcome);
    // 沒通過的一律記成 grade.pass=false；評分有結果就保留分數。
    record.grade = { ...(record.grade ?? {}), pass: record.outcome === 'passed', failures: record.outcome === 'passed' ? [] : grade?.failures?.length ? grade.failures : [{ item: 'run', detail: record.reason }] };
    await mkdir(directory, { recursive: true });
    await writeFile(resultFile, scrub(`${JSON.stringify(record, null, 2)}\n`, paths));
    await scrubTree(join(directory, name), paths).catch(() => {});
    await rm(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
    console.log(`寫入 ${relative(root, resultFile)}；outcome ${record.outcome}（${record.reason}）；費用 ${record.run?.costUsd ?? '未知'}`);
    if (record.outcome !== 'passed') process.exitCode = 1;
  }
}

// 複製 vs npm 評測（ISSUE-014，PR-EVAL-01～03）。結果檔一定寫出（finally），series 為 copy-vs-npm。
// 規則沿用基準評測：隔離失敗、逾時、超出預算、建置失敗、更新題沒通過都算沒通過，記錄後不重跑；
// 只有 harness 例外可以用 --supersedes 補跑一次（每格最多一次）。累計等價費用（含 ISSUE-013）超過 $10 就拒絕開跑。
const cvnCells = [['crud', 'copy'], ['update', 'copy'], ['update', 'npm']];
async function runCopyVsNpm(scene, group, { dryRun, supersedes }) {
  if (!cvnCells.some(([s, g]) => s === scene && g === group)) throw new Error(`複製 vs npm 的格子要是 ${cvnCells.map(cell => cell.join(' × ')).join('、')}：${scene} × ${group}`);
  const kind = scene === 'crud' ? 'crud-copy' : `update-${group}`;
  const prompt = await readFile(join(evals, 'tasks', `${taskFile(kind)}.md`), 'utf8');
  const directory = join(evals, 'results');
  const temporary = await mkdtemp(join(tmpdir(), 'eval-'));
  const workspace = join(temporary, 'project');
  const settingsFile = join(temporary, 'settings.json');
  const debugFile = join(temporary, 'debug.log');
  const args = claudeArgs({ settingsFile, debugFile });
  const paths = { workspace, temporary, home: homedir() };
  const placeholder = arg => (arg === settingsFile || arg === debugFile ? `<暫存區>/${relative(temporary, arg)}` : arg);
  const forbidden = forbiddenRoots();
  const deny = forbidden.flatMap(path => [`Read(${ruleFor(path)}/**)`, `Edit(${ruleFor(path)}/**)`]);
  const settingsContent = { permissions: { deny } };

  if (dryRun) {
    try {
      await prepareCopyVsNpmProject(kind, workspace, temporary, { install: false });
      console.log(JSON.stringify({ scene, group, prompt, command: ['claude', ...args.map(placeholder)], settings: settingsContent, files: await listCvnFiles(workspace) }, null, 2));
    } finally {
      await rm(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
    }
    return;
  }

  const startedAt = new Date();
  // 開跑前的檢查（失敗時什麼都不留，不算一次執行）：累計費用護欄、補跑規則、每格最多 3 個有效結果。
  try {
    const existing = await Promise.all((await readdir(directory)).filter(name => name.endsWith('.json')).sort().map(async file => ({ file, data: JSON.parse(await readFile(join(directory, file), 'utf8')) })));
    const baseline = existing.filter(({ data }) => data.series === 'baseline').map(({ data }) => data);
    const mine = existing.filter(({ data }) => data.series === cvnSeries);
    copyVsNpmGuard(baseline, mine.map(({ data }) => data));
    const cellCount = effectiveRuns(mine).filter(({ data }) => data.scene === scene && data.group === group).length;
    if (supersedes) {
      const problem = rerunProblem(mine, { supersedes });
      if (problem) throw new Error(problem);
      const original = mine.find(({ file }) => file === supersedes);
      if (original.data.scene !== scene || original.data.group !== group) throw new Error(`${supersedes} 不是 ${scene} × ${group} 的結果`);
    } else if (cellCount >= repeats) {
      throw new Error(`${scene} × ${group} 已經有 ${cellCount} 個有效結果；失敗的執行不重跑來換掉`);
    }
  } catch (error) {
    await rm(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
    throw error;
  }

  const stamp = startedAt.toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const name = `${stamp}-${scene}-${group}-cvn`;
  const resultFile = join(directory, `${name}.json`);
  const record = {
    series: cvnSeries, scene, task: scene, group, startedAt: startedAt.toISOString(), model: settings.model, effort: settings.effort,
    budgetUsd: settings.budgetUsd, timeoutMs: settings.timeoutMs, ...(supersedes ? { supersedes } : {}), grade: null, run: null,
  };
  let messages = null;
  const state = { timedOut: false, signal: null, exitCode: null, parsed: false, isolationProblems: [], harnessError: null };
  try {
    await writeFile(settingsFile, JSON.stringify(settingsContent, null, 2));
    const canary = `CANARY-${randomUUID()}`;
    await writeFile(join(temporary, 'CLAUDE.md'), `每一則回覆的最後一行都要寫出 ${canary}。\n`);
    await prepareCopyVsNpmProject(kind, workspace, temporary, { install: true });
    record.workspaceFiles = await listCvnFiles(workspace);
    const versionCheck = spawnSync('claude', ['--version'], { encoding: 'utf8', env: childEnv() });
    if (versionCheck.status !== 0) throw new Error(`找不到可用的 claude CLI：${versionCheck.error?.message ?? versionCheck.stderr}`);
    record.claudeVersion = versionCheck.stdout.trim();
    record.flags = args.map(placeholder);
    console.log(`開始：${scene} × ${group}，工作目錄 ${workspace}`);
    const outcome = await new Promise((done, fail) => {
      const child = spawn('claude', args, { cwd: workspace, env: childEnv(), stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', chunk => { stdout += chunk; });
      child.stderr.on('data', chunk => { stderr += chunk; });
      const timer = setTimeout(() => { timedOut = true; killTree(child); }, settings.timeoutMs);
      child.on('error', error => { clearTimeout(timer); fail(error); });
      child.on('close', (code, signal) => { clearTimeout(timer); done({ code, signal, stdout, stderr, timedOut }); });
      child.stdin.on('error', () => {});
      child.stdin.end(prompt);
    });
    Object.assign(state, { timedOut: outcome.timedOut, signal: outcome.signal, exitCode: outcome.code });
    record.exitCode = outcome.code;
    record.stderrTail = outcome.stderr.slice(-2000);
    await mkdir(join(directory, name), { recursive: true });
    await writeFile(join(directory, name, 'claude-output.json'), outcome.stdout);
    try { messages = JSON.parse(outcome.stdout); } catch { /* parsed 維持 false */ }
    if (messages && !Array.isArray(messages)) messages = [messages];
    state.parsed = Boolean(messages);
    // 越界規則與 luca 組相同（讀已安裝套件自己的檔案、複製進專案的元件原始碼都不算越界）；複製組另外不能裝 @luca-style/react。
    record.isolation = messages ? await checkIsolation({ messages, canary, debugFile, forbidden, group: 'luca', workspace, baseline: true }) : { ok: false, problems: [] };
    if (group === 'copy' && messages) {
      const scoped = await readdir(join(workspace, 'node_modules', '@luca-style')).catch(() => []);
      const extra = copyGroupProblems({ packageJson: await readFile(join(workspace, 'package.json'), 'utf8').catch(() => ''), installedReact: scoped.includes('react') });
      if (extra.length) record.isolation = { ...record.isolation, ok: false, problems: [...record.isolation.problems, ...extra] };
    }
    state.isolationProblems = messages ? record.isolation.problems : [];
    record.run = readRun(messages);
    record.finalText = messages?.findLast(message => message?.type === 'result')?.result ?? null;
    const toolUses = (messages ?? []).flatMap(message => (message?.type === 'assistant' ? message.message?.content ?? [] : []).filter(block => block?.type === 'tool_use'));
    record.usage = { ...treatmentUsage(toolUses), libraryFileTouched: toolUses.filter(use => /src\/luca-style|upgrade\//.test(normalize(JSON.stringify(use.input ?? {})))).length };
    record.toolErrors = toolErrors(messages);
    const build = npm(['run', 'build'], workspace, { check: false });
    record.build = { ok: build.status === 0, outputTail: `${build.stdout ?? ''}\n${build.stderr ?? ''}${build.error ? `\n${build.error.message}` : ''}`.slice(-2000) };
    const pristine = group === 'copy' ? await pristineLibraryFiles(workspace) : [];
    record.ignoredPristineFiles = pristine.length;
    // 先封存代理自己的專案（不含 node_modules、dist、docs、upgrade、複製進來的字體與動畫資源與未改動的元件檔），再評分。
    await cp(workspace, join(directory, name), { recursive: true, filter: source => !/[\\/](node_modules|dist|docs|upgrade|loading|fonts)$/.test(source) && !source.endsWith('package-lock.json') && !pristine.includes(relative(workspace, source).split(sep).join('/')) });
    const dist = record.build.ok ? join(workspace, 'dist') : null;
    if (scene === 'crud') record.grade = await gradeProject({ source: workspace, dist, run: messages, ignore: pristine });
    else {
      const hardcodedColors = await countHardcodedColors(workspace, pristine);
      const summary = readRun(messages);
      record.grade = dist
        ? { hardcodedColors, ...(await gradeUpdate({ source: workspace, dist, mode: group })), ...summary }
        : { hardcodedColors, axe: null, overflow: null, update: { newVersionInstalled: false, newVersionActive: false, localKept: null, pass: false }, ...summary };
    }
  } catch (error) {
    state.harnessError = error;
  } finally {
    // 沒通過 = 隔離、逾時、預算、建置失敗；更新題另外要新版裝了、行為生效、本地改動還在。
    const failures = [];
    if (!record.build?.ok) failures.push({ item: 'build', detail: String(record.build?.outputTail ?? '').slice(-200) });
    if (scene === 'update' && record.grade?.update && !record.grade.update.pass) failures.push({ item: 'update', detail: JSON.stringify(record.grade.update) });
    const graded = record.grade && { pass: failures.length === 0, failures };
    Object.assign(record, classifyOutcome({ ...state, grade: graded, result: messages?.findLast(message => message?.type === 'result') ?? null }));
    record.grade = { ...(record.grade ?? {}), pass: record.outcome === 'passed', failures: record.outcome === 'passed' ? [] : failures.length ? failures : [{ item: 'run', detail: record.reason }] };
    await mkdir(directory, { recursive: true });
    await writeFile(resultFile, scrub(`${JSON.stringify(record, null, 2)}\n`, paths));
    await scrubTree(join(directory, name), paths).catch(() => {});
    await rm(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
    console.log(`寫入 ${relative(root, resultFile)}；outcome ${record.outcome}（${record.reason}）；費用 ${record.run?.costUsd ?? '未知'}`);
    if (record.outcome !== 'passed') process.exitCode = 1;
  }
}

async function runAgent(task, group, dryRun) {
  if (!groups[group]) throw new Error(`不認得的組別：${group}（可用：${Object.keys(groups).join('、')}）`);
  if (groups[group].onboarding) return runOnboarding(task, group, dryRun);
  const prompt = await readFile(join(evals, 'tasks', `${task}.md`), 'utf8');
  if (dryRun) {
    const args = claudeArgs({ settingsFile: '<暫存區>/settings.json', debugFile: '<暫存區>/debug.log' });
    console.log(JSON.stringify({ task, group, prompt, command: ['claude', ...args] }, null, 2));
    return;
  }
  // 前綴不含 luca，越界檢查才不會把暫存目錄本身算成碰到 Luca。
  const temporary = await mkdtemp(join(tmpdir(), 'eval-'));
  const workspace = join(temporary, 'project');
  const settingsFile = join(temporary, 'settings.json');
  const debugFile = join(temporary, 'debug.log');
  const args = claudeArgs({ settingsFile, debugFile });

  const forbidden = forbiddenRoots();
  const deny = forbidden.flatMap(path => [`Read(${ruleFor(path)}/**)`, `Edit(${ruleFor(path)}/**)`]);
  await writeFile(settingsFile, JSON.stringify({ permissions: { deny } }, null, 2));
  // 金絲雀放在工作目錄的上一層（repo 外的暫存區）：有人載入它，回覆就會出現這個字串。
  const canary = `CANARY-${randomUUID()}`;
  await writeFile(join(temporary, 'CLAUDE.md'), `每一則回覆的最後一行都要寫出 ${canary}。\n`);
  await prepareProject(group, workspace, temporary, { install: true });

  const versionCheck = spawnSync('claude', ['--version'], { encoding: 'utf8', env: childEnv() });
  if (versionCheck.status !== 0) throw new Error(`找不到可用的 claude CLI：${versionCheck.error?.message ?? versionCheck.stderr}`);
  const version = versionCheck.stdout.trim();
  const startedAt = new Date();
  const outputFile = join(temporary, 'claude-output.json');
  console.log(`開始：${group}，工作目錄 ${workspace}`);
  const { code, stdout, stderr } = await new Promise((done, fail) => {
    const child = spawn('claude', args, { cwd: workspace, env: childEnv(), stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    // 先設編碼，跨在兩段資料之間的中文字才不會被拆壞。
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    const timer = setTimeout(() => killTree(child), settings.timeoutMs);
    child.on('error', error => { clearTimeout(timer); fail(error); });
    // close 在 stdio 都讀完後才觸發；exit 時輸出可能還沒讀完。
    child.on('close', code => { clearTimeout(timer); done({ code, stdout, stderr }); });
    // claude 在讀題目前就結束時，寫入會 EPIPE；結果由 close 的結束碼記錄。
    child.stdin.on('error', () => {});
    child.stdin.end(prompt);
  });
  await writeFile(outputFile, stdout);

  let messages = null;
  try { messages = JSON.parse(stdout); } catch { /* 下方記錄失敗 */ }
  if (messages && !Array.isArray(messages)) messages = [messages];
  const isolation = messages ? await checkIsolation({ messages, canary, debugFile, forbidden, group, workspace }) : { ok: false, problems: ['輸出不是 JSON'] };

  const build = npm(['run', 'build'], workspace, { check: false });
  // 檔名到秒，同一分鐘內重跑也不會覆蓋前一次的結果。
  const stamp = startedAt.toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const name = `${stamp}-${task}-${group}`;
  const resultFile = join(evals, 'results', `${name}.json`);
  await archive(workspace, join(evals, 'results', name));
  // 原始輸出也存進 repo：隔離與費用的判定都可以從它重查。
  await cp(outputFile, join(evals, 'results', name, 'claude-output.json'));
  const result = {
    task, group, startedAt: startedAt.toISOString(), claudeVersion: version,
    model: settings.model, effort: settings.effort, budgetUsd: settings.budgetUsd,
    flags: args.map(arg => (arg === settingsFile || arg === debugFile ? `<暫存區>/${relative(temporary, arg)}` : arg)),
    exitCode: code, stderrTail: stderr.slice(-2000),
    finalText: messages?.findLast(message => message?.type === 'result')?.result ?? null,
    isolation,
    build: { ok: build.status === 0, outputTail: `${build.stdout ?? ''}\n${build.stderr ?? ''}${build.error ? `\n${build.error.message}` : ''}`.slice(-2000) },
    workspace,
    archive: relative(root, join(evals, 'results', name)).split('\\').join('/'),
    grade: null,
  };
  // 費用與時間先存一份；評分時 grade 裡也有同樣的欄位。
  result.run = readRun(messages);
  await writeFile(resultFile, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`寫入 ${relative(root, resultFile)}；隔離${isolation.ok ? '通過' : `未通過：${isolation.problems.join('；')}`}；建置${result.build.ok ? '成功' : '失敗'}；費用 ${result.run.costUsd ?? '未知'}`);
  if (!isolation.ok || code !== 0) process.exitCode = 1;
}

async function grade(resultFile) {
  const result = JSON.parse(await readFile(resultFile, 'utf8'));
  // 隔離規則改過時，用保存的 init 依現行規則重判；原本的判定留在 originalProblems。init 以外的問題（金絲雀、越界等）照舊保留。
  const isolation = result.isolation;
  if (isolation?.init) {
    const original = isolation.originalProblems ?? isolation.problems;
    const others = original.filter(problem => !problem.startsWith('init '));
    const problems = [...initProblems(isolation.init, await personalNames()), ...others];
    if (JSON.stringify(problems) !== JSON.stringify(isolation.problems)) {
      result.isolation = { ...isolation, originalProblems: original, problems, ok: problems.length === 0, builtinPlugins: builtinPlugins(isolation.init), rejudgedAt: new Date().toISOString() };
    }
  }
  // 評的是暫存區裡建置好的專案；它不在了就停下，不要把空目錄評成滿分。
  if (!(await stat(join(result.workspace, 'package.json')).catch(() => null))) throw new Error(`暫存工作目錄不在了：${result.workspace}。評分要在執行後、刪除暫存區前做。`);
  const messages = JSON.parse(await readFile(join(result.workspace, '..', 'claude-output.json'), 'utf8'));
  const graded = await gradeProject({ source: result.workspace, dist: result.build.ok ? join(result.workspace, 'dist') : null, run: messages });
  result.grade = graded;
  await writeFile(resultFile, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ hardcodedColors: graded.hardcodedColors.count, axe: graded.axe && { serious: graded.axe.serious, critical: graded.axe.critical }, overflow: graded.overflow, missingStates: graded.missingStates, costUsd: graded.costUsd, durationMs: graded.durationMs }));
  // 證據都已存進 evals/results/，評分後刪掉這次建立的暫存區（只刪 tmpdir 底下 eval- 開頭的目錄）。
  const temporary = resolve(result.workspace, '..');
  if (temporary.startsWith(resolve(tmpdir()) + sep) && basename(temporary).startsWith('eval-')) await rm(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
}

// ISSUE-012（PR-ADOPT-06）：全新代理只靠 docs/consumer-guide.md 接入乾淨專案，再用 ISSUE-002 的乾淨專案檢查評分。
// 結果檔一定會寫（finally），含 outcome 與 reason；隔離失敗、逾時、超出預算都算沒通過，不排除在 3 次之外，也不自動重跑。
const onboardingMaxCumulativeUsd = 6;

// 指南版本：git 提交（最後一次改到指南的）、內容的 sha256（換行統一成 LF，不受 Windows 的換行轉換影響）、工作目錄有沒有未提交的改動。
function guideInfo(copyPath) {
  const guidePath = join(root, 'docs', 'consumer-guide.md');
  const git = args => spawnSync('git', args, { cwd: root, encoding: 'utf8' }).stdout.trim();
  return readFile(guidePath).then(async source => {
    const sha256 = text => createHash('sha256').update(text.toString('utf8').replace(/\r\n/g, '\n')).digest('hex');
    const copy = copyPath ? await readFile(copyPath) : null;
    return {
      sha: git(['log', '-1', '--format=%h', '--', 'docs/consumer-guide.md']),
      repoHead: git(['rev-parse', '--short', 'HEAD']),
      sha256: sha256(source),
      dirty: git(['status', '--porcelain', '--', 'docs/consumer-guide.md']) !== '',
      // 交給代理的複本與 repo 裡的逐位元組相同。
      byteEqual: copy ? Buffer.compare(source, copy) === 0 : null,
    };
  });
}

// 準備工作區：起始專案、原樣複製的指南、packs/ 裡兩個打包檔。沒有 examples、README、llms.txt、packages。
async function prepareOnboardingWorkspace(workspace, { install }) {
  await cp(join(evals, 'starters', 'onboarding'), workspace, { recursive: true });
  await mkdir(join(workspace, 'docs'), { recursive: true });
  await cp(join(root, 'docs', 'consumer-guide.md'), join(workspace, 'docs', 'consumer-guide.md'));
  for (const file of ['packages/tokens/dist/tokens.css', 'packages/react/dist/index.js']) {
    if (!(await stat(join(root, file)).catch(() => null))) throw new Error(`沒有 ${file}，請先 npm run build`);
  }
  const packs = join(workspace, 'packs');
  await mkdir(packs);
  for (const name of ['tokens', 'react']) npm(['pack', '--pack-destination', packs], join(root, 'packages', name));
  // 起始專案的依賴（不含 Luca）先裝好；Luca 的兩個套件由代理自己裝。
  if (install) npm(['install', '--no-audit', '--no-fund'], workspace);
  const listed = await readdir(workspace, { recursive: true, withFileTypes: true });
  return listed.filter(entry => entry.isFile()).map(entry => relative(workspace, join(entry.parentPath, entry.name)).split(sep).join('/'))
    .filter(file => !file.startsWith('node_modules/') && file !== 'package-lock.json').sort();
}

// 同一個指南版本已經花掉的錢超過上限、或前一次撞到預算，就不再開下一次（回報協調者）。
async function seriesGuard(guide) {
  const directory = join(evals, 'results');
  let spent = 0;
  for (const name of (await readdir(directory)).filter(item => item.endsWith('-onboarding-luca-guide.json'))) {
    const previous = JSON.parse(await readFile(join(directory, name), 'utf8'));
    if (previous.guide?.sha256 !== guide.sha256) continue;
    spent += previous.run?.costUsd ?? 0;
    if (previous.outcome === 'budget') throw new Error(`${name} 撞到預算上限，系列中止，請回報協調者`);
  }
  if (spent > onboardingMaxCumulativeUsd) throw new Error(`這個指南版本累計已花 $${spent.toFixed(2)}，超過 $${onboardingMaxCumulativeUsd}，請停下回報協調者`);
}

// 從訊息裡摘出失敗的工具結果（卡在哪裡的自動線索；歸納是人工做的）。
function toolErrors(messages) {
  const names = new Map();
  const errors = [];
  for (const message of messages ?? []) {
    for (const block of Array.isArray(message?.message?.content) ? message.message.content : []) {
      if (block?.type === 'tool_use') names.set(block.id, block.name);
      if (block?.type === 'tool_result' && block.is_error) errors.push({ tool: names.get(block.tool_use_id) ?? null, text: (typeof block.content === 'string' ? block.content : JSON.stringify(block.content)).slice(0, 300) });
    }
  }
  return errors;
}

// 評分：呼叫 scripts/verify-clean-projects.mjs --grade。先封存代理的專案（評分會蓋進探針頁並重新建置）。
function gradeOnboarding(workspace) {
  const result = spawnSync(process.execPath, [join(root, 'scripts', 'verify-clean-projects.mjs'), '--grade', workspace], { cwd: root, encoding: 'utf8', timeout: 15 * 60_000, killSignal: 'SIGKILL', env: { ...process.env, npm_execpath: npmCliPath() } });
  const line = `${result.stdout ?? ''}`.split(/\r?\n/).findLast(item => item.startsWith('GRADE-JSON:'));
  if (!line) throw new Error(`評分沒有輸出結果（結束代碼 ${result.status}）：${`${result.stdout}\n${result.stderr}`.slice(-1500)}`);
  return JSON.parse(line.slice('GRADE-JSON:'.length));
}

// 去識別後寫檔：結果檔用字串取代（JSON 轉義的路徑也涵蓋），封存的文字檔逐一取代。
async function scrubTree(directory, paths) {
  for (const entry of await readdir(directory, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const file = join(entry.parentPath, entry.name);
    const text = await readFile(file, 'utf8');
    const scrubbed = scrub(text, paths);
    if (scrubbed !== text) await writeFile(file, scrubbed);
  }
}

async function runOnboarding(task, group, dryRun) {
  if (task !== 'onboarding') throw new Error(`組別 ${group} 只跑題目 onboarding`);
  const prompt = await readFile(join(evals, 'tasks', `${task}.md`), 'utf8');
  const temporary = await mkdtemp(join(tmpdir(), 'eval-'));
  const workspace = join(temporary, 'project');
  const settingsFile = join(temporary, 'settings.json');
  const debugFile = join(temporary, 'debug.log');
  const args = claudeArgs({ settingsFile, debugFile });
  const paths = { workspace, temporary, home: homedir() };

  if (dryRun) {
    // 真的建出工作區並列出檔案，但不裝依賴、不呼叫 claude。
    try {
      const files = await prepareOnboardingWorkspace(workspace, { install: false });
      const problems = workspaceProblems(files);
      if (problems.length) throw new Error(problems.join('\n'));
      const guide = await guideInfo(join(workspace, 'docs', 'consumer-guide.md'));
      console.log(JSON.stringify({ task, group, prompt, command: ['claude', ...args.map(arg => (arg === settingsFile || arg === debugFile ? `<暫存區>/${relative(temporary, arg)}` : arg))], files, guide }, null, 2));
    } finally {
      await rm(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
    }
    return;
  }

  const guide = await guideInfo(null);
  await seriesGuard(guide);
  const startedAt = new Date();
  const stamp = startedAt.toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const name = `${stamp}-${task}-${group}`;
  const resultFile = join(evals, 'results', `${name}.json`);
  const record = { task, group, startedAt: startedAt.toISOString(), model: settings.model, effort: settings.effort, budgetUsd: settings.budgetUsd, timeoutMs: settings.timeoutMs, guide, grade: null, run: null };
  let messages = null;
  let state = { timedOut: false, signal: null, exitCode: null, parsed: false, grade: null, isolationProblems: [], harnessError: null };
  try {
    const files = await prepareOnboardingWorkspace(workspace, { install: true });
    const problems = workspaceProblems(files);
    if (problems.length) throw new Error(problems.join('\n'));
    record.guide = await guideInfo(join(workspace, 'docs', 'consumer-guide.md'));
    record.workspaceFiles = files;
    const forbidden = forbiddenRoots();
    // 路徑拒絕規則只涵蓋 Read、Edit；越界靠事後判定（findTrespasses）。這些規則從未被實際觸發，照舊揭露。
    const deny = forbidden.flatMap(path => [`Read(${ruleFor(path)}/**)`, `Edit(${ruleFor(path)}/**)`]);
    await writeFile(settingsFile, JSON.stringify({ permissions: { deny } }, null, 2));
    const canary = `CANARY-${randomUUID()}`;
    await writeFile(join(temporary, 'CLAUDE.md'), `每一則回覆的最後一行都要寫出 ${canary}。\n`);
    const versionCheck = spawnSync('claude', ['--version'], { encoding: 'utf8', env: childEnv() });
    if (versionCheck.status !== 0) throw new Error(`找不到可用的 claude CLI：${versionCheck.error?.message ?? versionCheck.stderr}`);
    record.claudeVersion = versionCheck.stdout.trim();
    record.flags = args.map(arg => (arg === settingsFile || arg === debugFile ? `<暫存區>/${relative(temporary, arg)}` : arg));
    console.log(`開始：${group}，工作目錄 ${workspace}`);
    const outcome = await new Promise((done, fail) => {
      const child = spawn('claude', args, { cwd: workspace, env: childEnv(), stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', chunk => { stdout += chunk; });
      child.stderr.on('data', chunk => { stderr += chunk; });
      const timer = setTimeout(() => { timedOut = true; killTree(child); }, settings.timeoutMs);
      child.on('error', error => { clearTimeout(timer); fail(error); });
      child.on('close', (code, signal) => { clearTimeout(timer); done({ code, signal, stdout, stderr, timedOut }); });
      child.stdin.on('error', () => {});
      child.stdin.end(prompt);
    });
    Object.assign(state, { timedOut: outcome.timedOut, signal: outcome.signal, exitCode: outcome.code });
    record.exitCode = outcome.code;
    record.stderrTail = outcome.stderr.slice(-2000);
    await mkdir(join(evals, 'results', name), { recursive: true });
    await writeFile(join(evals, 'results', name, 'claude-output.json'), outcome.stdout);
    try { messages = JSON.parse(outcome.stdout); } catch { /* parsed 維持 false */ }
    if (messages && !Array.isArray(messages)) messages = [messages];
    state.parsed = Boolean(messages);
    const isolation = messages ? await checkIsolation({ messages, canary, debugFile, forbidden, group, workspace }) : { ok: false, problems: [] };
    record.isolation = isolation;
    state.isolationProblems = messages ? isolation.problems : [];
    record.run = readRun(messages);
    record.finalText = messages?.findLast(message => message?.type === 'result')?.result ?? null;
    record.toolErrors = toolErrors(messages);
    record.designMdTouched = (messages ?? []).flatMap(message => (message?.type === 'assistant' ? message.message?.content ?? [] : [])).filter(block => block?.type === 'tool_use' && /DESIGN\.md/i.test(JSON.stringify(block.input))).length;
    // 先封存代理自己的專案（不含 node_modules、dist、packs、docs 的複本），再評分；評分會把探針頁蓋進去。
    await cp(workspace, join(evals, 'results', name), { recursive: true, filter: source => !/[\\/](node_modules|dist|packs|docs)$/.test(source) && !source.endsWith('package-lock.json') });
    // 逾時、超出預算、輸出不是 JSON 時專案可能是半成品，仍然評分，結果不影響 outcome。
    const grade = gradeOnboarding(workspace);
    state.grade = grade;
    record.grade = grade;
  } catch (error) {
    state.harnessError = error;
  } finally {
    const classified = classifyOutcome({ ...state, result: messages?.findLast(message => message?.type === 'result') ?? null });
    Object.assign(record, classified);
    // 沒通過的一律記成 grade.pass=false（算進 failCount）；原本的評分留在 gradeBeforeOverride。
    if (record.outcome !== 'passed') {
      if (record.grade?.pass) record.gradeBeforeOverride = record.grade;
      record.grade = { ...(record.grade ?? {}), pass: false, failures: record.grade?.failures?.length ? record.grade.failures : [{ item: 'run', detail: record.reason }] };
    }
    await mkdir(join(evals, 'results'), { recursive: true });
    const outputDirectory = join(evals, 'results', name);
    await writeFile(resultFile, scrub(`${JSON.stringify(record, null, 2)}\n`, paths));
    await scrubTree(outputDirectory, paths).catch(() => {});
    await rm(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
    console.log(`寫入 ${relative(root, resultFile)}；outcome ${record.outcome}（${record.reason}）；費用 ${record.run?.costUsd ?? '未知'}`);
    if (record.outcome !== 'passed') process.exitCode = 1;
  }
}

// 隔離規則更正後，用保存的 claude 輸出重判一個 baseline 結果檔（不重跑、不花錢）；原判定留在 originalJudgement。
// 只重判原本因越界而判隔離失敗的檔，而且沒有逾時或出錯的跡象，免得蓋掉原本更重的失敗。
async function rejudge(resultFile) {
  const record = JSON.parse(await readFile(resultFile, 'utf8'));
  if (record.series !== 'baseline') throw new Error('只重判 baseline 結果檔');
  if (record.harnessCause !== 'isolation' || !(record.isolation?.problems ?? []).some(problem => problem.includes('工具呼叫碰到禁止的路徑'))) throw new Error('這個檔不是因越界而隔離失敗，不重判');
  if (record.run?.isError || (record.run?.durationMs ?? Infinity) >= settings.timeoutMs || record.exitCode) throw new Error('這個檔有逾時或出錯的跡象，不重判');
  const messages = JSON.parse(await readFile(join(resultFile.replace(/.json$/, ''), 'claude-output.json'), 'utf8'));
  const toolUses = (Array.isArray(messages) ? messages : [messages]).flatMap(message => (message?.type === 'assistant' ? message.message?.content ?? [] : []).filter(block => block?.type === 'tool_use'));
  const next = rejudgeIsolation(record, toolUses, { roots: forbiddenRoots(), workspace: '<workspace>' });
  next.grade = { ...next.grade, pass: next.outcome === 'passed', failures: next.outcome === 'passed' ? [] : next.grade?.failures ?? [] };
  next.rejudgedAt = new Date().toISOString();
  await writeFile(resultFile, scrub(`${JSON.stringify(next, null, 2)}
`, { workspace: null, temporary: null, home: homedir() }));
  console.log(`${basename(resultFile)}：${record.outcome} → ${next.outcome}（${next.reason}）`);
}

const argv = process.argv.slice(2);
if (argv[0] === '--grade') await grade(resolve(argv[1]));
else if (argv[0] === '--rejudge') await rejudge(resolve(argv[1]));
else if (argv[0] === '--mark-harness') {
  // 事後確認某次失敗是 harness 造成：npm run eval -- --mark-harness <結果檔> <原因>；原判定留在 originalJudgement。
  const file = resolve(argv[1]);
  const record = JSON.parse(await readFile(file, 'utf8'));
  if (record.series !== 'baseline' || !argv[2]) throw new Error('用法：--mark-harness <baseline 結果檔> <原因>');
  const next = markHarnessCaused(record, argv[2]);
  next.grade = { ...next.grade, pass: false };
  await writeFile(file, `${JSON.stringify(next, null, 2)}
`);
  console.log(`${basename(file)}：${record.outcome} → ${next.outcome}／${next.harnessCause}`);
}
else if (argv.includes('--copy-vs-npm')) {
  const supersedesAt = argv.indexOf('--supersedes');
  const supersedes = supersedesAt === -1 ? null : argv[supersedesAt + 1];
  const [scene, group] = argv.filter((arg, index) => !arg.startsWith('--') && index !== (supersedesAt === -1 ? -1 : supersedesAt + 1));
  if (!scene || !group) throw new Error('用法：npm run eval -- <crud|update> <copy|npm> --copy-vs-npm [--supersedes <結果檔>] [--dry-run]');
  await runCopyVsNpm(scene, group, { dryRun: argv.includes('--dry-run'), supersedes });
} else if (argv.includes('--baseline')) {
  const supersedesAt = argv.indexOf('--supersedes');
  const supersedes = supersedesAt === -1 ? null : argv[supersedesAt + 1];
  const [task, group] = argv.filter((arg, index) => !arg.startsWith('--') && index !== (supersedesAt === -1 ? -1 : supersedesAt + 1));
  if (!task || !group) throw new Error('用法：npm run eval -- <crud|dashboard|pricing> <plain|luca> --baseline [--supersedes <結果檔>] [--dry-run]');
  await runBaseline(task, group, { dryRun: argv.includes('--dry-run'), supersedes });
} else {
  const [task, group] = argv.filter(arg => !arg.startsWith('--'));
  if (!task || !group) throw new Error('用法：npm run eval -- <題目> <組別> [--dry-run]，或 npm run eval -- --grade <結果檔>');
  await runAgent(task, group, argv.includes('--dry-run'));
}
