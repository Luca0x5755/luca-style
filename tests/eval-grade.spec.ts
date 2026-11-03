import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gradeProject, readRun } from '../evals/grade.mjs';
import { estimateBaseline } from '../evals/report.mjs';
import { initProblems } from '../evals/isolation.mjs';

// 評測的評分工具（ISSUE-011，PR-EVAL-01、04 的基礎）：用手寫的靜態範例專案，斷言每一項品質問題都抓得到、數字精確。
// 範例在 tests/fixtures/eval/，src/ 給寫死顏色掃描，static/ 是不用建置的靜態輸出（不叫 dist，因為 .gitignore 會略過 dist/）。
const fixture = (name: string) => join(import.meta.dirname, 'fixtures/eval', name);
const project = (name: string) => ({ source: fixture(name), dist: join(fixture(name), 'static') });

test('hard-coded colors count hex, color functions, named colors and Tailwind palette classes, and skip variables and role classes', async () => {
  // 只看原始碼，不給建置輸出，免得開瀏覽器。
  const { hardcodedColors } = await gradeProject({ source: fixture('broken'), dist: null });
  expect(hardcodedColors.items.map(({ file, line, kind, text }) => `${file}:${line} ${kind} ${text}`).sort()).toEqual([
    'src/App.tsx:2 hex #abc',
    'src/App.tsx:2 hex #ff0000',
    'src/App.tsx:6 palette bg-red-500',
    'src/App.tsx:7 function rgb(',
    'src/app.css:3 hex #00ff00',
    'src/app.css:4 named red',
  ]);
  expect(hardcodedColors.count).toBe(6);
});

test('a project that uses variables and role classes, has all four states and no blocking axe findings scores zero on every quality item', async () => {
  const grade = await gradeProject(project('good'));
  expect(grade.hardcodedColors).toEqual({ count: 0, items: [] });
  expect(grade.axe).toEqual({ serious: 0, critical: 0, items: [] });
  expect(grade.overflow).toEqual({ 1280: 0, 834: 0, 390: 0 });
  expect(grade.missingStates).toEqual({ count: 0, states: [] });
  expect(grade.pageErrors).toEqual([]);
});

test('axe findings are deduplicated by rule and element across states and widths and split into serious and critical', async () => {
  const { axe } = await gradeProject(project('broken'));
  expect({ serious: axe?.serious, critical: axe?.critical }).toEqual({ serious: 1, critical: 1 });
  expect(axe?.items.map(({ id, impact }) => `${id} ${impact}`).sort()).toEqual(['color-contrast serious', 'image-alt critical']);
});

test('horizontal overflow is counted per width as the number of states that scroll sideways', async () => {
  const { overflow } = await gradeProject(project('broken'));
  expect(overflow).toEqual({ 1280: 0, 834: 4, 390: 4 });
});

test('a state is missing when its marker never appears or its content repeats another state', async () => {
  const { missingStates } = await gradeProject(project('broken'));
  expect(missingStates).toEqual({ count: 2, states: ['empty', 'error'] });
});

test('cost, time, turns and model are read from the claude -p JSON output, and are null without one', async () => {
  // 手寫的 --verbose 輸出樣本：訊息陣列，最後一則是 result。
  const output = JSON.parse(await readFile(fixture('claude-output.json'), 'utf8'));
  expect(readRun(output)).toEqual({ costUsd: 1.234, durationMs: 456789, turns: 42, model: 'claude-sonnet-5-5', isError: false });
  expect(readRun(undefined)).toEqual({ costUsd: null, durationMs: null, turns: null, model: null, isError: null });
});

test('the 18-run baseline estimate is nine runs of each group at its trial cost, with the budget cap as the ceiling', () => {
  const runs = [{ group: 'plain', costUsd: 1.2, budgetUsd: 5 }, { group: 'luca', costUsd: 2.0, budgetUsd: 5 }];
  const estimate = estimateBaseline(runs);
  expect(estimate.estimateUsd).toBeCloseTo(28.8, 6);
  expect(estimate.ceilingUsd).toBe(90);
});

test('the baseline estimate refuses to run when a group has no trial cost', () => {
  expect(() => estimateBaseline([{ group: 'plain', costUsd: 1.2, budgetUsd: 5 }])).toThrow(/luca/);
});

test('both groups are given the same task text', () => {
  const dryRun = (group: string) => {
    const result = spawnSync(process.execPath, ['evals/run.mjs', 'crud', group, '--dry-run'], { cwd: join(import.meta.dirname, '..'), encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
    return JSON.parse(result.stdout) as { prompt: string };
  };
  const plain = dryRun('plain');
  expect(plain.prompt.length).toBeGreaterThan(100);
  expect(dryRun('luca').prompt).toBe(plain.prompt);
});

// init 樣本取自第一次真實執行（evals/results/2026-11-02-12-30-crud-plain.json）保存的欄位。
// Claude Code 自帶的 plugin（path 為 builtin）不算載入個人設定；其他 plugin 一律算隔離失敗。
test('the isolation check accepts the plugins built into Claude Code', async () => {
  const init = JSON.parse(await readFile(fixture('init-plain.json'), 'utf8'));
  expect(initProblems(init, [])).toEqual([]);
});

test('the isolation check fails on a plugin that is not built in', async () => {
  const init = JSON.parse(await readFile(fixture('init-plain.json'), 'utf8'));
  init.plugins.push({ name: 'my-plugin', path: 'C:/Users/someone/.claude/plugins/my-plugin', source: 'my-plugin@marketplace' });
  expect(initProblems(init, [])).toEqual([expect.stringContaining('my-plugin')]);
});

test('the isolation check fails when a personal skill shows up in the init message', async () => {
  const init = JSON.parse(await readFile(fixture('init-plain.json'), 'utf8'));
  init.skills = ['implement'];
  expect(initProblems(init, ['implement', 'tdd'])).toEqual([expect.stringContaining('skills'), expect.stringContaining('implement')]);
});

test('without build output the browser items are unknown and all four states count as missing', async () => {
  const grade = await gradeProject({ source: fixture('good'), dist: null });
  expect({ axe: grade.axe, overflow: grade.overflow, missingStates: grade.missingStates }).toEqual({ axe: null, overflow: null, missingStates: { count: 4, states: ['loading', 'empty', 'error', 'success'] } });
});
