import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { baselineClassify, markHarnessCaused, rejudgeIsolation, baselineGroups, baselineGuard, baselineScenes, baselineSummary, baselineTrespasses, effectiveRuns, median, renderBaseline, rerunProblem, treatmentUsage, totalRuns, type BaselineData, type BaselineRecord } from '../evals/baseline.mjs';
import { gradeProject } from '../evals/grade.mjs';
import { scrub } from '../evals/onboarding.mjs';
import { buildBaselineReport } from '../evals/report.mjs';

// 基準評測（ISSUE-013，PR-EVAL-04）：題目、兩組的處理差異、評分器對各場景的判定、護欄與補跑規則、彙整與報告、承諾搬家。
const root = join(import.meta.dirname, '..');
const results = join(root, 'evals/results');
const task = (name: string) => readFile(join(root, 'evals/tasks', `${name}.md`), 'utf8');
const lf = (text: string) => text.replace(/\r\n/g, '\n');
const sha256 = (text: string) => createHash('sha256').update(lf(text)).digest('hex');

test('every baseline task states the four-state contract the grader depends on and the shared constraint block', async () => {
  const constraints = ['寬度 1280、834、390 都要能用', '`npm run build` 要成功', '只能使用 `npm install <套件>`、`npm run build`、`npx tsc` 這三種指令'];
  for (const { scene } of baselineScenes) {
    const text = await task(scene);
    for (const state of ['loading', 'empty', 'error', 'success']) expect(text, `${scene} ${state}`).toContain(`/?state=${state}`);
    expect(text, scene).toContain('data-eval-state');
    for (const line of constraints) expect(text, `${scene} ${line}`).toContain(line);
  }
  // 限制區塊與 crud.md 逐字相同。
  const block = (text: string) => lf(text).slice(lf(text).indexOf('## 要求'));
  expect(block(await task('dashboard'))).toBe(block(await task('crud')));
  expect(block(await task('pricing'))).toBe(block(await task('crud')));
});

test('the new scenes give a reason for four states and a single wrapping state container', async () => {
  const dashboard = await task('dashboard');
  const pricing = await task('pricing');
  for (const text of [dashboard, pricing]) {
    expect(text).toContain('假的非同步函式');
    expect(text).toContain('同一時間畫面上只能有一個 `data-eval-state` 容器');
    expect(text).toContain('空狀態與錯誤狀態的文字和操作要明顯不同');
  }
  expect(dashboard).toContain('要包住整個狀態區');
  expect(dashboard).toContain('三個範圍都要有資料');
  expect(pricing).toContain('同時包住方案卡與比較表');
  expect(pricing).toContain('年繳比月繳固定便宜 20%');
});

// 題目定案後不再改（P2 用同一批題目比較）。sha256 是換行統一成 LF 後的內容。
// 這兩份新題目已經過審查者（reviewer-013，2026-11-03，有條件通過並已依三項修改補上）確認，才釘上這個值。
// crud.md 沿用 ISSUE-011 的題目，內容與 ISSUE-011 提交時相同。
const pinned: Record<string, string> = {
  crud: '2a4fe923a46d4fdb4a5814d24fef49c5cae8c4851786e751e5eb94d7d21ad523',
  dashboard: '181456a6a1e61bab22c03df034e9c7db10a4130401abbf47a7829689d3f189a4',
  pricing: 'c0f90e3a4242c418ae1b9048e1696e3e7a2ccbc27b2ed1affc96d7229229666f',
};
test('the three baseline tasks are pinned: changing one is a deliberate act that must also change the pin', async () => {
  for (const { scene } of baselineScenes) expect(sha256(await task(scene)), scene).toBe(pinned[scene]);
});

test('the starter READMEs are neutral and the luca one differs from the plain one only by the Luca paragraph', async () => {
  const plain = lf(await readFile(join(root, 'evals/starters/plain/README.md'), 'utf8')).trimEnd();
  const luca = lf(await readFile(join(root, 'evals/starters/luca/README.md'), 'utf8')).trimEnd();
  // 中性：不綁場景，也不提文件、工具。
  expect(plain).not.toMatch(/訂單|儀表板|定價|luca|docs|文件|指南|DESIGN|llms|tailwind/i);
  expect(luca.startsWith(plain)).toBe(true);
  const extra = luca.slice(plain.length).trim();
  expect(extra).toContain('Luca Style');
  expect(extra).toContain('docs/consumer-guide.md');
  expect(extra.split('\n\n')).toHaveLength(1);
});

type Plan = { prompt: string; command: string[]; settings: unknown; files: string[]; tarballDocs: string[]; guide: { byteEqual: boolean | null } };
const dryRun = (scene: string, group: string): Plan => {
  const result = spawnSync(process.execPath, ['evals/run.mjs', scene, group, '--baseline', '--dry-run'], { cwd: root, encoding: 'utf8' });
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout);
};

test('both groups get the same task bytes, command, flags and settings; only the workspace differs, and the luca documentation advantage is the treatment', async () => {
  test.setTimeout(240_000);
  for (const { scene } of baselineScenes) {
    const plain = dryRun(scene, 'plain');
    const luca = dryRun(scene, 'luca');
    expect(plain.prompt, scene).toBe(await task(scene));
    expect(luca.prompt, scene).toBe(plain.prompt);
    expect(luca.command, scene).toEqual(plain.command);
    expect(luca.settings, scene).toEqual(plain.settings);
    // plain：沒有任何 Luca 或文件。
    expect(plain.files.filter(file => /luca|docs\/|llms|DESIGN/i.test(file)), scene).toEqual([]);
    expect(plain.tarballDocs).toEqual([]);
    // luca：指南與 repo 逐位元組相同；兩個套件的打包檔內附 DESIGN.md 與 llms.txt（處理的一部分）。
    expect(luca.files.filter(file => file !== 'README.md' && file.startsWith('docs/')), scene).toEqual(['docs/consumer-guide.md']);
    expect(luca.guide.byteEqual, scene).toBe(true);
    expect(luca.tarballDocs, scene).toEqual(['luca-style-react:package/DESIGN.md', 'luca-style-react:package/llms.txt']);
    // 兩組的檔案清單只差指南。
    expect(luca.files.filter(file => file !== 'docs/consumer-guide.md'), scene).toEqual(plain.files);
  }
});

// 評分器對各場景的判定：手做的探針專案（不呼叫 claude）。一個容器包住整個狀態區，empty 與 error 各有不同的文字與操作。
const sceneContent: Record<string, { success: string; empty: string; error: string }> = {
  crud: {
    success: '<table><caption>訂單</caption><tr><th scope="col">編號</th><th scope="col">客戶</th></tr><tr><td>A-1</td><td>王小明</td></tr></table>',
    empty: '<p>目前沒有訂單。</p><button type="button">新增訂單</button>',
    error: '<p role="alert">訂單載入失敗。</p><button type="button">重試</button>',
  },
  dashboard: {
    success: '<dl><dt>請求量</dt><dd>12,400</dd><dt>錯誤率</dt><dd>0.4%</dd></dl><table><caption>服務</caption><tr><th scope="col">名稱</th><th scope="col">狀態</th></tr><tr><td>api</td><td>正常</td></tr></table><ul><li>告警：延遲偏高</li></ul>',
    empty: '<h2>還沒有受監控的服務</h2><p>新增第一個服務後，這裡會出現指標與告警。</p><button type="button">新增第一個服務</button>',
    error: '<p role="alert">無法取得監控資料。</p><button type="button">重試</button>',
  },
  pricing: {
    success: '<ul><li>入門 $9／月</li><li>專業 $29／月（推薦）</li><li>企業 $99／月</li></ul><table><caption>方案比較</caption><tr><th scope="col">功能</th><th scope="col">入門</th></tr><tr><td>專案數</td><td>3</td></tr></table>',
    empty: '<h2>目前沒有開放購買的方案</h2><p>請聯絡業務，我們會為你安排。</p><a href="#contact">聯絡業務</a>',
    error: '<p role="alert">方案資料載入失敗。</p><button type="button">重試</button>',
  },
};

async function probeProject(scene: string, content: { success: string; empty: string; error: string }) {
  const directory = await mkdtemp(join(tmpdir(), 'eval-probe-'));
  await mkdir(join(directory, 'src'), { recursive: true });
  await mkdir(join(directory, 'static'), { recursive: true });
  await writeFile(join(directory, 'src', 'App.tsx'), 'export const App = () => null;\n');
  const html = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${scene} 探針</title>
<style>body{margin:0;font:16px/1.5 sans-serif;background:var(--bg,#fff);color:var(--fg,#1a1a1a)}main{padding:16px;box-sizing:border-box;max-width:100%}</style></head>
<body><main><h1>${scene}</h1><div id="region"></div></main>
<script>
const state = new URLSearchParams(location.search).get('state') ?? 'success';
const content = ${JSON.stringify({ loading: '<p role="status">載入中…</p>', ...content })};
setTimeout(() => { const region = document.getElementById('region'); region.dataset.evalState = state; region.innerHTML = content[state]; }, 200);
</script></body></html>`;
  await writeFile(join(directory, 'static', 'index.html'), html);
  return { directory, grade: await gradeProject({ source: directory, dist: join(directory, 'static') }) };
}

for (const { scene } of baselineScenes) {
  test(`${scene}: the grader does not mark a legitimately differentiated empty and error as missing, and still catches an error that repeats empty`, async () => {
    const good = await probeProject(scene, sceneContent[scene]);
    const same = await probeProject(scene, { ...sceneContent[scene], error: sceneContent[scene].empty });
    try {
      expect(good.grade.missingStates).toEqual({ count: 0, states: [] });
      expect(good.grade.axe).toMatchObject({ serious: 0, critical: 0 });
      expect(good.grade.overflow).toEqual({ 1280: 0, 834: 0, 390: 0 });
      expect(same.grade.missingStates).toEqual({ count: 1, states: ['error'] });
    } finally {
      await rm(good.directory, { recursive: true, force: true });
      await rm(same.directory, { recursive: true, force: true });
    }
  });
}

// 合成的結果檔。
let sequence = 0;
const data = (overrides: Partial<BaselineData> = {}, costUsd = 0.5): BaselineData => ({
  series: 'baseline', scene: 'crud', group: 'plain', outcome: 'passed', guide: { sha: 'abc1234', sha256: 'g1' },
  run: { costUsd, durationMs: 60_000 },
  grade: { pass: true, hardcodedColors: { count: 2 }, axe: { serious: 0, critical: 0 }, overflow: { 1280: 0, 834: 0, 390: 0 }, missingStates: { count: 0 } },
  isolation: { ok: true }, ...overrides,
});
const record = (overrides: Partial<BaselineData> = {}, costUsd?: number, file?: string): BaselineRecord => ({ file: file ?? `r${sequence++}.json`, data: data(overrides, costUsd) });
const fullSeries = (): BaselineRecord[] => baselineScenes.flatMap(({ scene }) => baselineGroups.flatMap(({ group }) => [0, 1, 2].map(index => record({ scene, group }, 1 + index, `${scene}-${group}-${index}.json`))));

test('the guard stops when cumulative equivalent cost passes $8, counts superseded files, and only counts the baseline series of the same guide version', () => {
  const spent = (...costs: number[]) => costs.map(cost => data({}, cost));
  expect(baselineGuard(spent(3, 3, 2), 'g1')).toBe(8);
  expect(() => baselineGuard(spent(3, 3, 2.01), 'g1')).toThrow(/超過 \$8/);
  // 被取代的檔也算：兩個檔都進累計。
  const superseded = [data({ outcome: 'harness-error', harnessCause: 'harness-exception' }, 4), data({ supersedes: 'a.json' }, 4.5)];
  expect(() => baselineGuard(superseded, 'g1')).toThrow(/\$8\.50/);
  // 不同指南版本、非 baseline 的試跑不算。
  expect(baselineGuard([...spent(7), data({ guide: { sha: 'x', sha256: 'g2' } }, 5), data({ series: undefined }, 5)], 'g1')).toBe(7);
});

test('only a harness exception can be rerun, once per cell, and the original stays', () => {
  const harness = { file: 'h.json', data: data({ outcome: 'harness-error', harnessCause: 'harness-exception', reason: 'x' }) };
  const isolation = { file: 'i.json', data: data({ group: 'luca', outcome: 'harness-error', harnessCause: 'isolation' }) };
  const timeout = { file: 't.json', data: data({ scene: 'pricing', outcome: 'timeout' }) };
  const passed = { file: 'p.json', data: data() };
  const all = [harness, isolation, timeout, passed];
  expect(rerunProblem(all, { supersedes: 'h.json' })).toBeNull();
  expect(rerunProblem(all, { supersedes: 'i.json' })).toMatch(/不補跑/);
  expect(rerunProblem(all, { supersedes: 't.json' })).toMatch(/不補跑/);
  expect(rerunProblem(all, { supersedes: 'p.json' })).toMatch(/已通過/);
  expect(rerunProblem(all, { supersedes: 'nope.json' })).toMatch(/找不到/);
  // 補跑過一次後，同一個檔與同一格都不能再補跑。
  const rerun = { file: 'h2.json', data: data({ supersedes: 'h.json', outcome: 'harness-error', harnessCause: 'harness-exception' }) };
  expect(rerunProblem([...all, rerun], { supersedes: 'h.json' })).toMatch(/已經補跑過/);
  expect(rerunProblem([...all, rerun], { supersedes: 'h2.json' })).toMatch(/每格最多一次/);
});

test('the baseline path reuses classifyOutcome: isolation, timeout, budget and build failures are all failed runs, and a pass needs none of them', () => {
  const ok = { ok: true };
  const graded = { hardcodedColors: { count: 0 } };
  expect(baselineClassify({ build: ok, graded })).toMatchObject({ outcome: 'passed', grade: { pass: true } });
  expect(baselineClassify({ build: ok, graded, isolationProblems: ['越界'] })).toMatchObject({ outcome: 'harness-error', harnessCause: 'isolation' });
  expect(baselineClassify({ build: ok, graded, timedOut: true })).toMatchObject({ outcome: 'timeout' });
  expect(baselineClassify({ build: ok, graded, result: { subtype: 'error_max_budget_usd' } })).toMatchObject({ outcome: 'budget' });
  const build = baselineClassify({ build: { ok: false, outputTail: 'error TS2304' }, graded });
  expect(build).toMatchObject({ outcome: 'failed-grade', grade: { pass: false, failures: [{ item: 'build' }] } });
  expect(build.reason).toContain('build');
  expect(baselineClassify({ build: ok, graded, harnessError: new Error('npm 壞了') })).toMatchObject({ outcome: 'harness-error', harnessCause: 'harness-exception' });
  expect(baselineClassify({ parsed: false, exitCode: 1 })).toMatchObject({ outcome: 'failed-grade' });
});

test('medians are taken per scene and group over exactly three effective runs', () => {
  expect(median([3, 1, 2])).toBe(2);
  expect(median([4, 1, 3, 2])).toBe(2.5);
  expect(median([null, 5])).toBe(5);
  expect(median([])).toBeNull();
  const summary = baselineSummary(fullSeries());
  expect(summary.complete).toBe(true);
  expect(summary.count).toBe(totalRuns);
  expect(summary.cells).toHaveLength(6);
  for (const cell of summary.cells) expect(cell.medians.costUsd).toBe(2);
});

test('a cell without exactly three effective runs is refused, unless a partial report is asked for', () => {
  const missing = fullSeries().slice(1);
  expect(() => baselineSummary(missing)).toThrow(/crud × plain.*剛好 3 次，目前 2 次/);
  const extra = [...fullSeries(), record({ scene: 'crud', group: 'plain' })];
  expect(() => baselineSummary(extra)).toThrow(/目前 4 次/);
  expect(() => baselineSummary(extra, { allowPartial: true })).toThrow(/目前 4 次/);
  const partial = baselineSummary(missing, { allowPartial: true });
  expect(partial).toMatchObject({ complete: false, count: 17 });
  expect(renderBaseline(missing, partial).split('\n')[0]).toBe('# 基準評測報告（INCOMPLETE 17/18）');
  expect(renderBaseline(fullSeries(), baselineSummary(fullSeries())).split('\n')[0]).toBe('# 基準評測報告（PR-EVAL-04）');
});

test('a harness-caused rerun keeps the original visible as a failure while the effective count stays three', () => {
  const series = fullSeries();
  const original = { file: 'crud-plain-orig.json', data: data({ outcome: 'harness-error', harnessCause: 'harness-exception', reason: 'harness 例外：npm 壞了' }, 0.1) };
  const rerun = { file: 'crud-plain-rerun.json', data: data({ supersedes: 'crud-plain-orig.json' }, 0.7) };
  const records = [original, rerun, ...series.filter(item => !(item.data.scene === 'crud' && item.data.group === 'plain' && item.file.endsWith('-0.json')))];
  const summary = baselineSummary(records);
  expect(effectiveRuns(records)).toHaveLength(18);
  expect(summary.complete).toBe(true);
  expect(summary.failed).toEqual([expect.objectContaining({ file: 'crud-plain-orig.json', superseded: true, supersededBy: 'crud-plain-rerun.json', harnessCause: 'harness-exception' })]);
  const text = renderBaseline(records, summary);
  expect(text).toContain('crud-plain-orig.json');
  expect(text).toContain('harness 造成，已由 crud-plain-rerun.json 補跑取代，原紀錄保留');
  // 取代指向不存在的檔會被拒絕。
  expect(() => baselineSummary([...series, { file: 'x.json', data: data({ supersedes: 'ghost.json' }) }])).toThrow(/ghost/);
});

test('every failed run is listed with its cause, and a failed run still counts toward its cell', () => {
  const series = fullSeries();
  series[0] = { file: 'budget.json', data: data({ outcome: 'budget', reason: '超出 budget 上限', grade: { pass: false } }, 5) };
  series[3] = { file: 'iso.json', data: data({ scene: 'crud', group: 'luca', outcome: 'harness-error', harnessCause: 'isolation', reason: '隔離失敗：x' }) };
  const summary = baselineSummary(series);
  expect(summary.failed.map(item => item.file).sort()).toEqual(['budget.json', 'iso.json']);
  expect(summary.cells.find(cell => cell.scene === 'crud' && cell.group === 'plain')).toMatchObject({ passed: 2 });
  const text = renderBaseline(series, summary);
  expect(text).toContain('budget.json（crud × plain）：budget');
  expect(text).toContain('iso.json（crud × luca）：harness-error／isolation');
  expect(text).toContain('算進該格有效的 3 次');
  expect(text).toContain('狀態缺漏、axe、溢出只在同一個場景內比較');
  for (const risk of ['$3.66 只來自後台與 CRUD', '儀表板題目較大', '撞到單次 $5 上限的執行算失敗', '$8 就停止並回報', '最後一次可能超出至多 $5']) expect(text).toContain(risk);
});

const use = (name: string, input: unknown) => ({ name, input });
const roots = ['D:\\luca-style-wt\\issue-013', 'D:\\luca-style'];
const workspace = 'C:\\Users\\u\\AppData\\Local\\Temp\\eval-1\\project';

test('the luca group may read the installed package files, logged and not a trespass; the repo, examples outside the package and paths outside the workspace still are', () => {
  const allowed = [
    use('Read', { file_path: `${workspace}\\node_modules\\@luca-style\\react\\llms.txt` }),
    use('Read', { file_path: `${workspace}\\node_modules\\@luca-style\\react\\DESIGN.md` }),
    use('Bash', { command: 'cat node_modules/@luca-style/react/llms.txt' }),
    use('Glob', { pattern: 'node_modules/@luca-style/react/dist/*.d.ts' }),
    // 第一批 2 次實跑被舊規則誤判的寫法：cd 進套件目錄後不帶路徑地讀 llms.txt。
    use('Bash', { command: 'cd C:/Users/u/AppData/Local/Temp/eval-1/project/node_modules/@luca-style/react; ls . dist; cat llms.txt | head -150; cat ../../../package.json' }),
    use('Read', { file_path: `${workspace}\\docs\\consumer-guide.md` }),
    use('Write', { file_path: `${workspace}\\src\\App.tsx`, content: 'x' }),
  ];
  expect(baselineTrespasses(allowed, { roots, workspace, group: 'luca' })).toEqual([]);
  const blocked = [
    use('Read', { file_path: 'D:\\luca-style\\README.md' }),
    use('Read', { file_path: 'D:\\luca-style-wt\\issue-013\\packages\\react\\src\\index.ts' }),
    use('Glob', { pattern: 'examples/**/*.tsx' }),
    use('Read', { file_path: 'C:\\Users\\u\\AppData\\Local\\Temp\\eval-1\\CLAUDE.md' }),
    use('Bash', { command: 'ls C:/Users/u/Documents' }),
    use('Bash', { command: 'cat ~/.claude/settings.json' }),
  ];
  expect(baselineTrespasses(blocked, { roots, workspace, group: 'luca' }).map(item => item.tool)).toEqual(['Read', 'Read', 'Glob', 'Read', 'Bash', 'Bash']);
  // 在套件裡的 examples 也只放行套件自己的路徑；套件外的 examples 仍越界。
  expect(baselineTrespasses([use('Glob', { pattern: 'node_modules/@luca-style/react/examples/*' })], { roots, workspace, group: 'luca' })).toEqual([]);
  expect(baselineTrespasses([use('Bash', { command: 'cat node_modules/@luca-style/react/llms.txt && ls examples' })], { roots, workspace, group: 'luca' })).toHaveLength(1);
});

test('the plain group stays strict: any mention of luca is a trespass', () => {
  expect(baselineTrespasses([use('Bash', { command: 'cat node_modules/@luca-style/react/llms.txt' })], { roots, workspace, group: 'plain' })).toHaveLength(1);
  expect(baselineTrespasses([use('Read', { file_path: `${workspace}\\src\\main.tsx` })], { roots, workspace, group: 'plain' })).toEqual([]);
  expect(baselineTrespasses([use('Bash', { command: 'cat llms.txt' })], { roots, workspace, group: 'plain' })).toHaveLength(1);
});

test('an isolation failure caused by the old rule is rejudged from the saved tool calls, keeps the original judgement, and never hides a build failure', () => {
  const bare = use('Bash', { command: 'cd <workspace>/node_modules/@luca-style/react; cat llms.txt' });
  const base = { ...data({ group: 'luca', outcome: 'harness-error', harnessCause: 'isolation', reason: '隔離失敗：有 1 個工具呼叫碰到禁止的路徑' }), exitCode: 0, build: { ok: true }, isolation: { ok: false, problems: ['有 1 個工具呼叫碰到禁止的路徑'], trespasses: [{ tool: 'Bash', input: 'x' }] } };
  const passed = rejudgeIsolation(base, [bare], { roots, workspace: '<workspace>' });
  expect(passed).toMatchObject({ outcome: 'passed', isolation: { ok: true, problems: [], trespasses: [] }, originalJudgement: { outcome: 'harness-error', harnessCause: 'isolation' } });
  expect(passed.harnessCause).toBeUndefined();
  // 真正的越界重判後仍是隔離失敗；建置失敗不會被隔離失敗蓋住。
  const still = rejudgeIsolation(base, [use('Read', { file_path: 'D:\\luca-style\\README.md' })], { roots, workspace: '<workspace>' });
  expect(still).toMatchObject({ outcome: 'harness-error', harnessCause: 'isolation' });
  expect(rejudgeIsolation({ ...base, build: { ok: false } }, [bare], { roots, workspace: '<workspace>' })).toMatchObject({ outcome: 'failed-grade' });
});

test('a failure confirmed afterwards as harness-caused becomes rerunnable and keeps its original judgement; a pass cannot be relabelled', () => {
  const failed = data({ group: 'luca', scene: 'crud', outcome: 'failed-grade', reason: '檢查未通過：build' });
  const marked = markHarnessCaused(failed, 'build 沒有輸出');
  expect(marked).toMatchObject({ outcome: 'harness-error', harnessCause: 'harness-exception', originalJudgement: { outcome: 'failed-grade' } });
  expect(rerunProblem([{ file: 'f.json', data: marked }], { supersedes: 'f.json' })).toBeNull();
  expect(() => markHarnessCaused(data(), 'x')).toThrow(/已通過/);
});

test('scrubbing also covers the slug form of a path that Claude Code uses to name its project folder', () => {
  const paths = { workspace: 'C:\\Users\\someone\\AppData\\Local\\Temp\\eval-AbC123\\project', home: 'C:\\Users\\someone' };
  const text = 'saved to C:\\Users\\someone\\.claude\\projects\\C--Users-someone-AppData-Local-Temp-eval-AbC123-project\\x';
  const scrubbed = scrub(text, paths);
  expect(scrubbed.toLowerCase()).not.toContain('someone');
  expect(scrubbed).toContain('<workspace>');
});

test('treatment usage counts how often the agent touched DESIGN.md, llms.txt, installed package files and the guide', () => {
  const calls = [
    use('Read', { file_path: `${workspace}\\node_modules\\@luca-style\\react\\DESIGN.md` }),
    use('Read', { file_path: `${workspace}\\node_modules\\@luca-style\\react\\llms.txt` }),
    use('Bash', { command: 'ls node_modules/@luca-style/react' }),
    use('Read', { file_path: `${workspace}\\docs\\consumer-guide.md` }),
    use('Read', { file_path: `${workspace}\\src\\App.tsx` }),
  ];
  expect(treatmentUsage(calls)).toEqual({ designMdTouched: 1, llmsTxtTouched: 1, packageFileReads: 3, consumerGuideTouched: 1 });
});

// 已提交的結果與報告。18 次跑完後這幾條才會綠；進行中的報告（INCOMPLETE）不能提交。
test('the committed baseline report is 18 of 18, regenerates byte for byte from the committed results, and leaves the ISSUE-011 pilot out', async () => {
  const { records, summary, text } = await buildBaselineReport(results);
  expect(summary.complete).toBe(true);
  expect(records.filter(item => effectiveRuns(records).includes(item))).toHaveLength(18);
  expect(records.map(item => item.file)).not.toEqual(expect.arrayContaining(['2026-11-02-12-30-crud-plain.json']));
  expect(text.split('\n')[0]).not.toContain('INCOMPLETE');
  expect(lf(await readFile(join(results, 'baseline-report.md'), 'utf8'))).toBe(text);
  // 試跑的報告不受影響：它只列沒有 series 的結果。
  const pilot = lf(await readFile(join(results, 'report.md'), 'utf8'));
  expect(pilot).not.toContain('baseline');
});

test('new baseline result files, their claude output and archived workspaces carry no home directory path or user name', async () => {
  const baselineNames = [];
  for (const name of await readdir(results)) if (name.endsWith('.json') && JSON.parse(await readFile(join(results, name), 'utf8')).series === 'baseline') baselineNames.push(name.replace(/\.json$/, ''));
  expect(baselineNames.length).toBeGreaterThan(0);
  const home = homedir();
  const forms = [home, home.replaceAll('\\', '/'), home.replaceAll('\\', '\\\\'), `/${home[0].toLowerCase()}${home.slice(2).replaceAll('\\', '/')}`].map(form => form.toLowerCase());
  const user = home.split(/[\\/]/).at(-1)!.toLowerCase();
  const files: string[] = [];
  for (const name of baselineNames) {
    files.push(join(results, `${name}.json`));
    for (const entry of await readdir(join(results, name), { recursive: true, withFileTypes: true })) if (entry.isFile()) files.push(join(entry.parentPath, entry.name));
  }
  for (const file of files) {
    const text = (await readFile(file, 'utf8')).toLowerCase();
    for (const form of forms) expect(text.includes(form), `${file} 含 ${form}`).toBe(false);
    expect(text.includes(user), `${file} 含使用者名稱`).toBe(false);
  }
});

test('PR-EVAL-04 lives in the design-system capability and the delivery table; PR-EVAL-01 to 03 stay in the spec for ISSUE-014', async () => {
  const capability = lf(await readFile(join(root, 'docs/capabilities/design-system.md'), 'utf8'));
  const delivery = lf(await readFile(join(root, 'docs/delivery-verification.md'), 'utf8'));
  const spec = lf(await readFile(join(root, 'docs/issues/ISSUE-001-npm-publish-readiness.md'), 'utf8'));
  expect(capability).toMatch(/^PR-EVAL-04 — /m);
  expect(capability).not.toMatch(/^PR-EVAL-0[123] — /m);
  expect(delivery).toMatch(/^\| PR-EVAL-04 \| /m);
  for (const id of ['PR-EVAL-01', 'PR-EVAL-02', 'PR-EVAL-03']) expect(spec).toContain(`\`${id}\``);
  expect(spec).not.toContain('`PR-EVAL-04`');
});
