import { test, expect } from '@playwright/test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyLocalChange, applyNewVersion, applyNewVersionDist, copyGroupProblems, copyVsNpmGuard, copyVsNpmVerdict, gradeUpdate, newVersionMarker, reusedNpmRuns, singleRunCapUsd, type CopyVsNpmRecord } from '../evals/copy-vs-npm.mjs';

// 複製 vs npm 評測（ISSUE-014，PR-EVAL-01～03）。第一組：門檻判定（純函式，人造結果）。
type Metrics = { colors?: number; missing?: number; axe?: number; overflow?: number; lost?: boolean; outcome?: string; cost?: number };
type Scene = 'crud' | 'update';
type Group = 'copy' | 'npm';
let counter = 0;
const run = (scene: Scene, group: Group, m: Metrics = {}, extra: Partial<CopyVsNpmRecord['data']> = {}): CopyVsNpmRecord => ({
  file: `f${++counter}-${scene}-${group}.json`,
  data: {
    series: 'copy-vs-npm', scene, group, outcome: m.outcome ?? 'passed',
    run: { costUsd: m.cost ?? 0.3, durationMs: 60000 },
    grade: {
      hardcodedColors: { count: m.colors ?? 0 }, axe: { serious: m.axe ?? 0, critical: 0 },
      overflow: { 1280: 0, 834: m.overflow ?? 0, 390: 0 }, missingStates: { count: m.missing ?? 0 },
      ...(scene === 'update' ? { update: { localKept: !m.lost } } : {}),
    },
    ...extra,
  },
});
// crud × npm 沿用 ISSUE-013 的三個有效結果檔（baseline 系列的 crud × luca），三次指標相同。
const reused = (m: Metrics = {}): CopyVsNpmRecord[] => reusedNpmRuns.map(file => ({
  file,
  data: { ...run('crud', 'npm', m).data, series: 'baseline', group: 'luca', guide: { sha: '64ec331' }, startedAt: '2026-11-03T03:33:47Z', claudeVersion: '9.9.9' },
}));
const group = (scene: Scene, name: Group, metrics: Metrics[]) => metrics.map(m => run(scene, name, m));
const same = (m: Metrics): Metrics[] => [m, m, m];
const all = (copyCrud: Metrics[], npmCrud: Metrics, copyUpdate: Metrics[] = same({}), npmUpdate: Metrics[] = same({})) => [
  ...group('crud', 'copy', copyCrud), ...reused(npmCrud), ...group('update', 'copy', copyUpdate), ...group('update', 'npm', npmUpdate),
];
const item = (verdict: ReturnType<typeof copyVsNpmVerdict>, name: string) => verdict.items.find(entry => entry.item === name);

test('verdict is incomplete and copyBetter is null when a group lacks exactly three effective runs', () => {
  const records = all(same({}), {});
  expect(copyVsNpmVerdict(records).complete).toBe(true);
  const short = copyVsNpmVerdict(records.slice(1));
  expect(short.complete).toBe(false);
  expect(short.copyBetter).toBeNull();
  expect(short.conclusion).toContain('incomplete');
});

test('a fourth effective run in a group makes the data incomplete, not better', () => {
  const verdict = copyVsNpmVerdict([...all(same({ colors: 0 }), { colors: 10 }), run('crud', 'copy')]);
  expect(verdict.complete).toBe(false);
  expect(verdict.copyBetter).toBeNull();
});

test('reusing crud x npm requires the three pinned ISSUE-013 files and guide sha 64ec331', () => {
  expect(reusedNpmRuns).toEqual(['2026-11-03-03-33-47-crud-luca.json', '2026-11-03-03-35-10-crud-luca.json', '2026-11-03-03-39-22-crud-luca.json']);
  const records = all(same({}), {});
  expect(copyVsNpmVerdict(records).reuse.files).toEqual(reusedNpmRuns);
  const wrongSha = records.map(record => (record.data.series === 'baseline' ? { ...record, data: { ...record.data, guide: { sha: 'deadbee' } } } : record));
  expect(copyVsNpmVerdict(wrongSha).complete).toBe(false);
  const otherFile = records.map((record, index) => (index === 3 ? { ...record, file: '2026-11-03-03-37-00-crud-luca.json' } : record));
  expect(copyVsNpmVerdict(otherFile).complete).toBe(false);
});

test('copy is better when no item is worse and one item improves by exactly 20 percent', () => {
  const verdict = copyVsNpmVerdict(all(same({ colors: 8 }), { colors: 10 }));
  expect(verdict.complete).toBe(true);
  expect(verdict.copyBetter).toBe(true);
  expect(verdict.conclusion).toContain('copy is better');
});

test('a 19 percent improvement is not clear: inconclusive, so npm stays', () => {
  const verdict = copyVsNpmVerdict(all(same({ colors: 81 }), { colors: 100 }));
  expect(verdict.copyBetter).toBe(false);
  expect(verdict.conclusion).toContain('inconclusive, so npm stays');
  expect(verdict.conclusion).not.toMatch(/copy is better/i);
});

test('a full tie is inconclusive and npm stays', () => {
  const verdict = copyVsNpmVerdict(all(same({ colors: 3, missing: 1 }), { colors: 3, missing: 1 }));
  expect(verdict.complete).toBe(true);
  expect(verdict.copyBetter).toBe(false);
  expect(verdict.conclusion).toContain('inconclusive, so npm stays');
});

test('any worse item blocks copyBetter even when another item improves clearly', () => {
  const verdict = copyVsNpmVerdict(all(same({ colors: 1, missing: 2 }), { colors: 10, missing: 1 }));
  expect(verdict.copyBetter).toBe(false);
  expect(item(verdict, 'missingStates')?.worse).toBe(true);
  expect(verdict.conclusion).not.toMatch(/copy is better/i);
});

test('npm with zero cannot be improved on by a percentage, and a zero-to-zero item is a tie', () => {
  const verdict = copyVsNpmVerdict(all(same({ colors: 0 }), { colors: 0 }));
  expect(item(verdict, 'hardcodedColors')).toMatchObject({ improved: false, worse: false });
});

test('axe, overflow and lost local changes only improve when npm is non-zero and copy is zero', () => {
  expect(copyVsNpmVerdict(all(same({ axe: 0 }), { axe: 2 })).copyBetter).toBe(true);
  expect(copyVsNpmVerdict(all(same({ axe: 1 }), { axe: 2 })).copyBetter).toBe(false);
  expect(copyVsNpmVerdict(all(same({ overflow: 0 }), { overflow: 1 })).copyBetter).toBe(true);
  expect(copyVsNpmVerdict(all(same({}), {}, same({ lost: false }), same({ lost: true }))).copyBetter).toBe(true);
});

test('a copy group that loses local changes in the update task is worse, not better', () => {
  const verdict = copyVsNpmVerdict(all(same({ colors: 0 }), { colors: 10 }, same({ lost: true }), same({ lost: false })));
  expect(verdict.copyBetter).toBe(false);
  expect(item(verdict, 'lostLocalChanges')?.worse).toBe(true);
});

test('cost and time never change the verdict', () => {
  const verdict = copyVsNpmVerdict(all(same({ colors: 5, cost: 0.01 }), { colors: 5 }, same({ cost: 0.01 }), same({ cost: 9 })));
  expect(verdict.copyBetter).toBe(false);
});

test('failed runs count in the medians and appear in the failure list', () => {
  const records = all([{ colors: 0 }, { colors: 9, outcome: 'timeout' }, { colors: 9 }], { colors: 10 });
  const verdict = copyVsNpmVerdict(records);
  expect(item(verdict, 'hardcodedColors')?.copyMedian).toBe(9);
  expect(verdict.failed).toHaveLength(1);
  expect(verdict.failed[0]).toMatchObject({ group: 'copy', scene: 'crud', outcome: 'timeout', superseded: false });
});

test('a harness rerun supersedes its original: three effective runs remain and the original stays listed', () => {
  const original = run('crud', 'copy', { colors: 1, outcome: 'harness-error' }, { harnessCause: 'harness-exception' });
  const rerun = run('crud', 'copy', { colors: 0 }, { supersedes: original.file });
  const others = all(same({}), {}).filter(record => !(record.data.scene === 'crud' && record.data.group === 'copy'));
  const verdict = copyVsNpmVerdict([original, rerun, ...group('crud', 'copy', same({})).slice(0, 2), ...others]);
  expect(verdict.complete).toBe(true);
  expect(verdict.failed.map(entry => entry.file)).toEqual([original.file]);
  expect(verdict.failed[0].supersededBy).toBe(rerun.file);
});

// 第二組：成本護欄、複製組規則、新版補丁與本地改動。
test('cost guard refuses to start when the ISSUE-013 spend plus this series exceeds ten dollars, and allows exactly ten', () => {
  const spent = (usd: number) => [{ run: { costUsd: usd } }];
  expect(copyVsNpmGuard(spent(4.67), spent(5.33))).toBe(10);
  expect(() => copyVsNpmGuard(spent(4.67), spent(5.34))).toThrow(/\$10/);
  expect(() => copyVsNpmGuard(spent(4.67), [...spent(3), ...spent(2.4)])).toThrow();
  expect(singleRunCapUsd).toBe(5);
});

test('the copy group may not have @luca-style/react installed or declared', () => {
  expect(copyGroupProblems({ packageJson: '{"dependencies":{"@luca-style/tokens":"1"}}', installedReact: false })).toEqual([]);
  expect(copyGroupProblems({ packageJson: '{"dependencies":{"@luca-style/react":"1"}}', installedReact: false })).toHaveLength(1);
  expect(copyGroupProblems({ packageJson: '{}', installedReact: true })).toHaveLength(1);
});

const buttonSource = `<BaseButton {...rest} type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={classNameOf(variant, className)}/>
  return useRender({render:render as useRender.RenderProp, defaultTagName:'a', props:{...props, className:classNameOf(variant, className)}});`;

test('the new version adds aria-disabled for loading buttons and the local change adds data-local-change, each exactly once per place', () => {
  const upgraded = applyNewVersion(buttonSource);
  expect(upgraded).toContain('aria-busy={loading || undefined} aria-disabled={loading || undefined}');
  expect(upgraded.match(/aria-disabled/g)).toHaveLength(1);
  const local = applyLocalChange(buttonSource);
  expect(local.match(/data-local-change="orders"|'data-local-change':'orders'/g)).toHaveLength(2);
  expect(() => applyNewVersion('nothing to patch')).toThrow();
  expect(() => applyLocalChange('nothing to patch')).toThrow();
  expect(() => applyNewVersionDist('nothing to patch')).toThrow();
  expect(applyNewVersionDist('"aria-busy": loading || undefined, className')).toContain('"aria-disabled": loading || undefined');
});

// 第三組：更新題的評分（gradeUpdate）。建置輸出與工作區都在暫存區裡手寫，不需要 claude。
const page = (buttons: string) => `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>訂單操作</title></head><body><main><h1>訂單操作</h1><div>${buttons}</div></main></body></html>`;
const local = 'data-local-change="orders"';
const fullPage = page(`<button ${local}>儲存</button><button ${local} aria-busy="true" aria-disabled="true" disabled>送出中</button>`);
async function updateProject(mode: 'npm' | 'copy', { html = fullPage, installed = true }: { html?: string; installed?: boolean } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'update-grade-'));
  await mkdir(join(dir, 'dist'), { recursive: true });
  await writeFile(join(dir, 'dist/index.html'), html);
  if (mode === 'npm') {
    await mkdir(join(dir, 'node_modules/@luca-style/react/dist'), { recursive: true });
    await writeFile(join(dir, 'node_modules/@luca-style/react/package.json'), JSON.stringify({ name: '@luca-style/react', version: installed ? '0.2.1' : '0.2.0' }));
    await writeFile(join(dir, 'node_modules/@luca-style/react/dist/button.js'), installed ? '"aria-disabled": loading || undefined' : '"aria-busy": loading || undefined');
  } else {
    await mkdir(join(dir, 'src/luca-style'), { recursive: true });
    await writeFile(join(dir, 'src/luca-style/button.tsx'), installed ? `<BaseButton ${newVersionMarker}/>` : '<BaseButton aria-busy={loading || undefined}/>');
  }
  return dir;
}
const gradeUpdateOf = async (mode: 'npm' | 'copy', options?: Parameters<typeof updateProject>[1]) => {
  const dir = await updateProject(mode, options);
  try { return await gradeUpdate({ source: dir, dist: join(dir, 'dist'), mode }); } finally { await rm(dir, { recursive: true, force: true }); }
};

for (const mode of ['npm', 'copy'] as const) {
  test(`${mode} group: a project with the new version installed, active and the local change kept passes every update check`, async () => {
    const grade = await gradeUpdateOf(mode);
    expect(grade.update).toEqual({ newVersionInstalled: true, newVersionActive: true, localKept: true, pass: true });
    expect(grade.axe).toMatchObject({ serious: 0, critical: 0 });
    expect(grade.overflow).toEqual({ 1280: 0, 834: 0, 390: 0 });
  });

  test(`${mode} group: a hard-coded aria-disabled in the page without the new version installed fails the install check`, async () => {
    const grade = await gradeUpdateOf(mode, { installed: false });
    expect(grade.update).toMatchObject({ newVersionInstalled: false, newVersionActive: true, localKept: true, pass: false });
  });
}

test('losing the local change is detected on its own', async () => {
  const grade = await gradeUpdateOf('copy', { html: page(`<button>儲存</button><button aria-busy="true" aria-disabled="true">送出中</button>`) });
  expect(grade.update).toMatchObject({ newVersionInstalled: true, newVersionActive: true, localKept: false, pass: false });
});

test('a new version that is installed but not active in the page is detected on its own', async () => {
  const grade = await gradeUpdateOf('npm', { html: page(`<button ${local}>儲存</button><button ${local} aria-busy="true">送出中</button>`) });
  expect(grade.update).toMatchObject({ newVersionInstalled: true, newVersionActive: false, localKept: true, pass: false });
});

test('a page without buttons keeps neither the new version nor the local change', async () => {
  const grade = await gradeUpdateOf('npm', { html: page('') });
  expect(grade.update).toMatchObject({ newVersionActive: false, localKept: false, pass: false });
});

test('update grading also reports axe findings and horizontal overflow of the page', async () => {
  const wide = page(`<button ${local}>儲存</button><button ${local} aria-busy="true" aria-disabled="true">送出中</button><div style="width:2000px">寬</div><img src="x.png">`);
  const grade = await gradeUpdateOf('npm', { html: wide });
  expect(grade.axe?.critical).toBeGreaterThan(0);
  expect(grade.overflow).toEqual({ 1280: 1, 834: 1, 390: 1 });
});

test('an item with no median at all (a whole group failed to build) blocks copyBetter instead of reading as no change', () => {
  const noLocalResult = group('update', 'copy', same({})).map(entry => ({ ...entry, data: { ...entry.data, outcome: 'failed-grade', grade: { ...entry.data.grade, update: { localKept: null } } } }));
  const records = [...group('crud', 'copy', same({ colors: 0 })), ...reused({ colors: 10 }), ...noLocalResult, ...group('update', 'npm', same({}))];
  const verdict = copyVsNpmVerdict(records);
  expect(verdict.complete).toBe(true);
  expect(item(verdict, 'hardcodedColors')?.improved).toBe(true);
  expect(item(verdict, 'lostLocalChanges')?.comparable).toBe(false);
  expect(verdict.copyBetter).toBe(false);
  expect(verdict.conclusion).toContain('inconclusive, so npm stays');
});
