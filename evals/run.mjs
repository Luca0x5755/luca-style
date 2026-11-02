// 評測的執行工具（ISSUE-011）：在 repo 外的暫存目錄準備起始專案，用隔離的 claude -p 跑一次題目，再建置代理的專案。
// 用法（先 npm run build，luca 組打包的是 dist）：
//   npm run eval -- <題目> <組別> [--dry-run]   跑代理並建置（--dry-run 只印出題目與指令，不安裝、不呼叫 claude）
//   npm run eval -- --grade <結果檔>             評分（會開瀏覽器，連接埠 4190），評完刪掉這次的暫存區
//   node evals/report.mjs                        產生 evals/results/report.md
// 組別：plain（無工具）、luca（裝 Luca Style 並附文件）。題目在 evals/tasks/<題目>.md，兩組讀同一個檔；
// 兩組的差別只在起始專案：luca 組從打包檔裝好兩個套件，README 指向隨套件附的 DESIGN.md。
// 隔離：不用 --bare（只認 ANTHROPIC_API_KEY，且 skill 仍可叫出），改用下方 claudeArgs 的旗標；
// 事後從 init 訊息（isolation.mjs）、金絲雀 CLAUDE.md、debug 紀錄、工具呼叫的路徑判定，結果寫進結果檔的 isolation。
// 每次花費真的錢；PR-EVAL-04 的次數要經擁有者同意（ISSUE-013）。
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { cp, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { basename, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gradeProject, readRun } from './grade.mjs';
import { builtinPlugins, initProblems } from './isolation.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const evals = join(root, 'evals');

// 所有評測固定同一組設定，改了就不能和先前的結果比較。
export const settings = { model: 'claude-sonnet-5-5', effort: 'medium', budgetUsd: 5, timeoutMs: 45 * 60_000 };
const groups = {
  plain: { lucaPackages: false },
  luca: { lucaPackages: true },
};

// 代理能用的工具與允許的指令；dontAsk 下其他呼叫直接拒絕，不會等互動。
const tools = ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'];
const allowed = ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash(npm install)', 'Bash(npm install *)', 'Bash(npm run build)', 'Bash(npx tsc)', 'Bash(npx tsc *)'];

// check 為 false 時不丟錯，交給呼叫端記錄（建置代理的專案）。逾時免得代理把 build 改成常駐指令、或網路卡住時整支卡死。
const npmTimeoutMs = 10 * 60_000;
function npm(args, cwd, { check = true } = {}) {
  const npmCli = process.env.npm_execpath;
  if (!npmCli) throw new Error('請用 npm run eval 執行');
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
async function checkIsolation({ messages, canary, debugFile, forbidden, group, workspace }) {
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
  const trespasses = toolUses.filter(use => {
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

async function runAgent(task, group, dryRun) {
  if (!groups[group]) throw new Error(`不認得的組別：${group}（可用：${Object.keys(groups).join('、')}）`);
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

  await cp(join(evals, 'starters', 'base'), workspace, { recursive: true });
  await cp(join(evals, 'starters', group), workspace, { recursive: true });
  const forbidden = forbiddenRoots();
  const deny = forbidden.flatMap(path => [`Read(${ruleFor(path)}/**)`, `Edit(${ruleFor(path)}/**)`]);
  await writeFile(settingsFile, JSON.stringify({ permissions: { deny } }, null, 2));
  // 金絲雀放在工作目錄的上一層（repo 外的暫存區）：有人載入它，回覆就會出現這個字串。
  const canary = `CANARY-${randomUUID()}`;
  await writeFile(join(temporary, 'CLAUDE.md'), `每一則回覆的最後一行都要寫出 ${canary}。\n`);

  if (groups[group].lucaPackages) {
    // 打包的是 dist；沒建置就會裝到舊版或空的套件（要先 npm run build，和 test:clean-projects 相同）。
    for (const file of ['packages/tokens/dist/tokens.css', 'packages/react/dist/index.js']) {
      if (!(await stat(join(root, file)).catch(() => null))) throw new Error(`沒有 ${file}，請先 npm run build`);
    }
    const packs = join(temporary, 'packs');
    await mkdir(packs);
    for (const name of ['tokens', 'react']) npm(['pack', '--pack-destination', packs], join(root, 'packages', name));
    const tarballs = (await readdir(packs)).filter(name => name.endsWith('.tgz')).map(name => relative(workspace, join(packs, name)));
    npm(['install', '--no-audit', '--no-fund', ...tarballs], workspace);
  } else {
    npm(['install', '--no-audit', '--no-fund'], workspace);
  }

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

const argv = process.argv.slice(2);
if (argv[0] === '--grade') await grade(resolve(argv[1]));
else {
  const [task, group] = argv.filter(arg => !arg.startsWith('--'));
  if (!task || !group) throw new Error('用法：npm run eval -- <題目> <組別> [--dry-run]，或 npm run eval -- --grade <結果檔>');
  await runAgent(task, group, argv.includes('--dry-run'));
}
