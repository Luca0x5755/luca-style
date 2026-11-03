import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { baselineTrespasses } from '../evals/baseline.mjs';
import { reusedNpmRuns } from '../evals/copy-vs-npm.mjs';
import { buildCopyVsNpmReport, isTrialResult } from '../evals/report.mjs';

// 複製 vs npm 的報告與結論檔（ISSUE-014，PR-EVAL-03）：用暫存目錄裡人造的結果檔，不碰真實結果。
const root = join(import.meta.dirname, '..');
const gateScript = join(root, 'scripts/check-publish-gate.mjs');

type Cell = { scene: 'crud' | 'update'; group: 'copy' | 'npm' };
const grade = (scene: string, colors: number, lost = false) => ({
  hardcodedColors: { count: colors }, axe: { serious: 0, critical: 0 }, overflow: { 1280: 0, 834: 0, 390: 0 }, missingStates: { count: 0 },
  ...(scene === 'update' ? { update: { newVersionInstalled: true, newVersionActive: true, localKept: !lost, pass: !lost } } : {}),
});
const record = (cell: Cell, colors: number, extra: Record<string, unknown> = {}) => ({
  series: 'copy-vs-npm', ...cell, outcome: 'passed', startedAt: '2026-11-03T10:00:00.000Z', claudeVersion: '9.9.9',
  run: { costUsd: 0.3, durationMs: 120000 }, grade: grade(cell.scene, colors, false), ...extra,
});
async function directoryWith(copyColors: number, npmColors: number, { skip = 0 }: { skip?: number } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'cvn-report-'));
  const files: [string, unknown][] = [];
  for (const [index, cell] of ([{ scene: 'crud', group: 'copy' }, { scene: 'update', group: 'copy' }, { scene: 'update', group: 'npm' }] as Cell[]).entries()) {
    for (let n = 0; n < 3; n++) files.push([`2026-11-03-1${index}-0${n}-00-${cell.scene}-${cell.group}-cvn.json`, record(cell, cell.scene === 'crud' ? copyColors : 0)]);
  }
  reusedNpmRuns.forEach(file => files.push([file, { ...record({ scene: 'crud', group: 'npm' }, npmColors), series: 'baseline', group: 'luca', guide: { sha: '64ec331' } }]));
  files.push(['2026-11-03-03-37-00-crud-luca.json', { ...record({ scene: 'crud', group: 'npm' }, 9), series: 'baseline', group: 'luca', guide: { sha: '64ec331' }, outcome: 'harness-error', harnessCause: 'harness-exception' }]);
  // 第四個沿用檔被 03-39-22 取代。
  const superseding = files.find(([file]) => file === reusedNpmRuns[2]);
  if (superseding) (superseding[1] as Record<string, unknown>).supersedes = '2026-11-03-03-37-00-crud-luca.json';
  for (const [file, data] of files.slice(skip)) await writeFile(join(dir, file), JSON.stringify(data));
  return dir;
}

test('the old trial report ignores copy-vs-npm runs and the verdict file that has no series field', () => {
  expect(isTrialResult({ task: 'crud', series: 'copy-vs-npm' } as never)).toBe(false);
  expect(isTrialResult({ task: 'crud', series: 'baseline' } as never)).toBe(false);
  expect(isTrialResult({ complete: true, copyBetter: false } as never)).toBe(false);
  expect(isTrialResult({ task: 'crud' } as never)).toBe(true);
});

test('the report pins the reused files, run dates, guide sha and harness version, and says npm and copy ran at different times', async () => {
  const dir = await directoryWith(0, 10);
  try {
    const { verdict, text } = await buildCopyVsNpmReport(dir);
    expect(verdict.complete).toBe(true);
    expect(verdict.reuse).toMatchObject({ files: [...reusedNpmRuns].sort(), guideSha: '64ec331', claudeVersion: ['9.9.9'] });
    expect(verdict.reuse.startedAt).toHaveLength(3);
    for (const file of reusedNpmRuns) expect(text).toContain(file);
    expect(text).toContain('64ec331');
    expect(text).toContain('不是同一時間跑的');
    expect(verdict.failed.map(entry => entry.file)).toEqual(['2026-11-03-03-37-00-crud-luca.json']);
    expect(verdict.failed[0].superseded).toBe(true);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('a tie report says inconclusive, so npm stays, and never claims copy is better', async () => {
  const dir = await directoryWith(5, 5);
  try {
    const { verdict, text } = await buildCopyVsNpmReport(dir);
    expect(verdict.copyBetter).toBe(false);
    expect(text).toContain('inconclusive, so npm stays');
    expect(text).not.toMatch(/copy is better/i);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('a report with a clear improvement states that copy is better and the route is not changed automatically', async () => {
  const dir = await directoryWith(0, 10);
  try {
    const { verdict, text } = await buildCopyVsNpmReport(dir);
    expect(verdict.copyBetter).toBe(true);
    expect(text).toContain('copy is better');
    expect(text).toContain('不會自動換路線');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('the report discloses the documentation asymmetry and its bias, the llms.txt locations, the update-task asymmetry and the simulated upgrade', async () => {
  const dir = await directoryWith(5, 5);
  try {
    const { text } = await buildCopyVsNpmReport(dir);
    for (const phrase of ['複製組沒有 `docs/consumer-guide.md`', '偏差方向不確定', '偏向 npm 較好', '`llms.txt`、`DESIGN.md` 位置不同', 'node_modules/@luca-style/react/', 'ISSUE-013 協調者的裁定', '更新題結構不對稱', '只模擬真實升級', '樣本小', '只有基礎建設失敗']) {
      expect(text, phrase).toContain(phrase);
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('missing evidence gives complete false and copyBetter null, and the publish gate refuses it', async () => {
  const dir = await directoryWith(0, 10, { skip: 1 });
  try {
    const { verdict, text } = await buildCopyVsNpmReport(dir);
    expect(verdict.complete).toBe(false);
    expect(verdict.copyBetter).toBeNull();
    expect(text).toContain('incomplete');
    const file = join(dir, 'verdict.json');
    await writeFile(file, JSON.stringify(verdict));
    expect(spawnSync(process.execPath, [gateScript, file], { encoding: 'utf8' }).status).not.toBe(0);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('the publish gate accepts a complete verdict whose copyBetter is false and refuses one where copy is better', async () => {
  const dir = await directoryWith(5, 5);
  const better = await directoryWith(0, 10);
  try {
    const tie = (await buildCopyVsNpmReport(dir)).verdict;
    const win = (await buildCopyVsNpmReport(better)).verdict;
    await writeFile(join(dir, 'tie.json'), JSON.stringify(tie));
    await writeFile(join(better, 'win.json'), JSON.stringify(win));
    expect(spawnSync(process.execPath, [gateScript, join(dir, 'tie.json')], { encoding: 'utf8' }).status).toBe(0);
    expect(spawnSync(process.execPath, [gateScript, join(better, 'win.json')], { encoding: 'utf8' }).status).not.toBe(0);
  } finally {
    await rm(dir, { recursive: true, force: true });
    await rm(better, { recursive: true, force: true });
  }
});

test('the same result files always produce the same report text', async () => {
  const dir = await directoryWith(2, 5);
  try {
    expect((await buildCopyVsNpmReport(dir)).text).toBe((await buildCopyVsNpmReport(dir)).text);
    expect(await readFile(join(dir, reusedNpmRuns[0]), 'utf8')).toContain('baseline');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

// 隔離：複製組用 luca 組的越界規則（讀專案內的元件原始碼合法，讀 repo 的原始碼算越界）。
test('copy group may read the copied library source in its project but not the repo source', () => {
  const options = { roots: ['D:\luca-style', 'D:\luca-style-wt\issue-014'], workspace: 'C:/tmp/eval-x/project', group: 'luca' };
  const use = (input: object) => [{ name: 'Read', input }];
  expect(baselineTrespasses(use({ file_path: 'C:/tmp/eval-x/project/src/luca-style/button.tsx' }), options)).toEqual([]);
  expect(baselineTrespasses(use({ command: 'cat DESIGN.md llms.txt' }), options)).toEqual([]);
  expect(baselineTrespasses(use({ file_path: 'D:/luca-style/packages/react/src/button.tsx' }), options)).toHaveLength(1);
  expect(baselineTrespasses(use({ file_path: 'D:/luca-style-wt/issue-014/packages/react/src/button.tsx' }), options)).toHaveLength(1);
  expect(baselineTrespasses(use({ file_path: 'C:/Users/someone/.claude/settings.json' }), options)).toHaveLength(1);
});
