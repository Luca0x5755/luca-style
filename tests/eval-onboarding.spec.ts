import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { classifyOutcome, findTrespasses, scrub, workspaceProblems } from '../evals/onboarding.mjs';
import { onboardingSummary } from '../evals/report.mjs';

// 全新代理只靠文件接入的實測（ISSUE-012，PR-ADOPT-06）：工作區內容、隔離判定、結果判定、去識別與 CLI 結論。
const root = join(import.meta.dirname, '..');
const starter = join(root, 'evals/starters/onboarding');

test('the onboarding starter has no Luca wiring in its dependencies, configs, CSS or source', async () => {
  const files = (await readdir(starter, { recursive: true, withFileTypes: true })).filter(entry => entry.isFile());
  expect(files.map(entry => entry.name)).toEqual(expect.arrayContaining(['package.json', 'tailwind.config.js', 'index.css', 'main.tsx']));
  for (const entry of files) {
    const text = await readFile(join(entry.parentPath, entry.name), 'utf8');
    expect(text, entry.name).not.toMatch(/luca|ThemeProvider/i);
  }
  const config = await readFile(join(starter, 'tailwind.config.js'), 'utf8');
  expect(config).not.toContain('presets');
});

// dry-run 要真的建出工作區並列出檔案，但不呼叫 claude。
test('the dry run builds the workspace and its only docs are the consumer guide and the two packed tarballs', async () => {
  const npmCli = process.env.npm_execpath ?? join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  const run = spawnSync(process.execPath, ['evals/run.mjs', 'onboarding', 'luca-guide', '--dry-run'], { cwd: root, encoding: 'utf8', env: { ...process.env, npm_execpath: npmCli } });
  expect(run.status, run.stderr).toBe(0);
  const plan = JSON.parse(run.stdout) as { files: string[]; prompt: string; command: string[]; guide: { byteEqual: boolean } };
  expect(plan.command[0]).toBe('claude');
  expect(plan.prompt).toContain('docs/consumer-guide.md');
  const docs = plan.files.filter(file => /\.(md|txt|tgz)$/i.test(file));
  expect(docs.filter(file => !file.startsWith('packs/')).sort()).toEqual(['docs/consumer-guide.md']);
  expect(docs.filter(file => file.startsWith('packs/')).map(file => file.replace(/-\d.*$/, '')).sort()).toEqual(['packs/luca-style-react', 'packs/luca-style-tokens']);
  expect(workspaceProblems(plan.files)).toEqual([]);
  // 交給代理的指南與 repo 裡的逐位元組相同。
  expect(plan.guide.byteEqual).toBe(true);
});

test('a workspace with examples, a README, llms.txt or package sources is rejected', () => {
  const ok = ['docs/consumer-guide.md', 'packs/luca-style-react-0.3.0.tgz', 'package.json', 'src/main.tsx'];
  expect(workspaceProblems(ok)).toEqual([]);
  expect(workspaceProblems([...ok, 'examples/consumer/src/main.tsx'])).toEqual([expect.stringContaining('examples/')]);
  expect(workspaceProblems([...ok, 'README.md'])).toEqual([expect.stringContaining('README.md')]);
  expect(workspaceProblems([...ok, 'llms.txt'])).toEqual([expect.stringContaining('llms.txt')]);
  expect(workspaceProblems([...ok, 'packages/react/src/index.ts'])).toEqual([expect.stringContaining('packages/')]);
  expect(workspaceProblems([...ok, 'docs/adoption-prompt.md'])).toEqual([expect.stringContaining('docs/adoption-prompt.md')]);
});

const use = (name: string, input: unknown) => ({ name, input });
const roots = ['d:/luca-style-wt/issue-012', 'd:/luca-style'];

test('a tool call that mentions the repo, examples or llms.txt is a trespass, whatever the tool', () => {
  const calls = [
    use('Read', { file_path: 'C:\\Temp\\eval-1\\project\\docs\\consumer-guide.md' }),
    use('Glob', { pattern: 'examples/**/*.tsx' }),
    use('Grep', { pattern: 'ThemeProvider', path: 'D:\\luca-style-wt\\issue-012\\packages' }),
    use('Bash', { command: 'cat node_modules/@luca-style/react/llms.txt' }),
    use('Read', { file_path: 'D:\\luca-style\\README.md' }),
    use('Write', { file_path: 'C:\\Temp\\eval-1\\project\\src\\main.tsx', content: 'import "./index.css"' }),
  ];
  expect(findTrespasses(calls, roots).map(item => item.tool)).toEqual(['Glob', 'Grep', 'Bash', 'Read']);
});

const finished = { type: 'result', subtype: 'success', is_error: false };

test('an outcome is passed only when the run finished and the grade passed', () => {
  expect(classifyOutcome({ result: finished, parsed: true, grade: { pass: true, failures: [] } })).toMatchObject({ outcome: 'passed' });
});

test('a failed grade names the failing items in the reason', () => {
  const grade = { pass: false, failures: [{ item: 'roles', detail: 'bg|accent' }] };
  expect(classifyOutcome({ result: finished, parsed: true, grade })).toEqual({ outcome: 'failed-grade', reason: expect.stringContaining('roles') });
});

test('a timeout, an exhausted budget and output that is not JSON all count as a failed grade with a reason', () => {
  expect(classifyOutcome({ timedOut: true, parsed: false, grade: null })).toEqual({ outcome: 'timeout', reason: expect.stringContaining('45') });
  expect(classifyOutcome({ result: { type: 'result', subtype: 'error_max_budget_usd', is_error: true }, parsed: true, grade: null })).toEqual({ outcome: 'budget', reason: expect.stringContaining('budget') });
  expect(classifyOutcome({ parsed: false, exitCode: 0, grade: null })).toEqual({ outcome: 'failed-grade', reason: expect.stringContaining('JSON') });
  expect(classifyOutcome({ parsed: false, signal: 'SIGKILL', grade: null })).toMatchObject({ outcome: 'killed' });
});

test('an isolation failure or a harness exception is a harness-error that keeps its cause and is not excluded', () => {
  expect(classifyOutcome({ result: finished, parsed: true, grade: { pass: true, failures: [] }, isolationProblems: ['有 1 個工具呼叫碰到禁止的路徑'] }))
    .toEqual({ outcome: 'harness-error', reason: expect.stringContaining('禁止'), harnessCause: 'isolation' });
  expect(classifyOutcome({ harnessError: new Error('npm pack failed'), parsed: false, grade: null }))
    .toEqual({ outcome: 'harness-error', reason: expect.stringContaining('npm pack failed'), harnessCause: 'harness-exception' });
});

test('scrubbing replaces the workspace and the home directory in every path style and leaves the rest alone', () => {
  const paths = { workspace: 'C:\\Users\\someone\\AppData\\Local\\Temp\\eval-ab\\project', temporary: 'C:\\Users\\someone\\AppData\\Local\\Temp\\eval-ab', home: 'C:\\Users\\someone' };
  const text = [
    'cwd C:\\Users\\someone\\AppData\\Local\\Temp\\eval-ab\\project\\src',
    'json "C:\\\\Users\\\\someone\\\\.claude\\\\skills"',
    'posix C:/Users/someone/.claude and c:/users/someone/x',
    'msys /c/Users/someone/.claude',
    'workspace C:/Users/someone/AppData/Local/Temp/eval-ab/project/dist',
    'keep D:\\luca-style\\x and 1280',
  ].join('\n');
  const scrubbed = scrub(text, paths);
  expect(scrubbed).not.toMatch(/someone/i);
  expect(scrubbed).toContain('<workspace>\\src');
  expect(scrubbed).toContain('"<home>\\\\.claude\\\\skills"');
  expect(scrubbed).toContain('<home>/.claude and <home>/x');
  expect(scrubbed).toContain('<workspace>/dist');
  expect(scrubbed).toContain('keep D:\\luca-style\\x and 1280');
});

// 新結果檔不得帶家目錄路徑；涵蓋結果檔、claude-output.json 與封存的工作區。ISSUE-011 既有的結果不在範圍內。
test('new onboarding result files, their claude output and archived workspace carry no home directory path', async () => {
  const directory = join(root, 'evals/results');
  const names = (await readdir(directory)).filter(name => name.includes('-onboarding-'));
  const home = homedir();
  const forms = [home, home.replaceAll('\\', '/'), home.replaceAll('\\', '\\\\'), `/${home[0].toLowerCase()}${home.slice(2).replaceAll('\\', '/')}`].map(form => form.toLowerCase());
  const user = home.split(/[\\/]/).at(-1)!.toLowerCase();
  const files: string[] = [];
  for (const name of names) {
    if (name.endsWith('.json')) files.push(join(directory, name));
    else for (const entry of await readdir(join(directory, name), { recursive: true, withFileTypes: true })) if (entry.isFile()) files.push(join(entry.parentPath, entry.name));
  }
  for (const file of files) {
    const text = (await readFile(file, 'utf8')).toLowerCase();
    for (const form of forms) expect(text.includes(form), `${file} 含 ${form}`).toBe(false);
    expect(text.includes(user), `${file} 含使用者名稱`).toBe(false);
  }
});

const run = (pass: boolean, extra = {}) => ({ outcome: pass ? 'passed' : 'failed-grade', guide: { sha256: 'aaa', sha: '1234567' }, grade: { pass, failures: pass ? [] : [{ item: 'roles', detail: 'x' }] }, run: { costUsd: 0.5, durationMs: 60000 }, ...extra });

test('one failed run out of three does not need a CLI', () => {
  expect(onboardingSummary([run(true), run(false), run(true)])).toMatchObject({ failCount: 1, cliNeeded: false });
});

test('two failed runs out of three need a CLI', () => {
  expect(onboardingSummary([run(true), run(false), run(false)])).toMatchObject({ failCount: 2, cliNeeded: true });
});

test('a timeout counts as a failed run even though it has no grade', () => {
  const timeout = { outcome: 'timeout', guide: { sha256: 'aaa', sha: '1234567' }, grade: null, run: { costUsd: 1, durationMs: 2700000 } };
  expect(onboardingSummary([run(true), timeout, run(false)])).toMatchObject({ failCount: 2, cliNeeded: true });
});

test('the summary refuses a guide version that does not have exactly three runs', () => {
  expect(() => onboardingSummary([run(true), run(true)])).toThrow(/3/);
  expect(() => onboardingSummary([run(true), run(true), run(true), run(true)])).toThrow(/3/);
});

test('the summary sums cost and only counts the runs of the guide version it is given', () => {
  const older = run(false, { guide: { sha256: 'old', sha: '0000000' } });
  const summary = onboardingSummary([older, run(true), run(true), run(true)], 'aaa');
  expect(summary).toMatchObject({ failCount: 0, cliNeeded: false, costUsd: 1.5 });
});
