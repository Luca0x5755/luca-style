import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, relative } from 'node:path';
import { adrStatusFor, reusedNpmRuns } from '../evals/copy-vs-npm.mjs';
import { buildCopyVsNpmReport } from '../evals/report.mjs';

// 複製 vs npm 的實測結果與文件（ISSUE-014，PR-EVAL-01～03）：repo 內提交的結果檔、結論檔、報告、ADR 與承諾互相一致。
const root = join(import.meta.dirname, '..');
const results = join(root, 'evals/results');
const read = (path: string) => readFile(join(root, path), 'utf8');
const lf = (text: string) => text.replace(/\r\n/g, '\n');

test('the committed verdict file and report are exactly what the committed result files produce', async () => {
  const { verdict, text } = await buildCopyVsNpmReport(results);
  expect(JSON.parse(await read('evals/results/copy-vs-npm.json'))).toEqual(verdict);
  expect(lf(await read('evals/results/copy-vs-npm-report.md'))).toBe(lf(text));
});

test('the committed data is complete: three effective runs in each of the three new groups and the pinned ISSUE-013 files for crud x npm', async () => {
  const { verdict } = await buildCopyVsNpmReport(results);
  expect(verdict.complete).toBe(true);
  expect(verdict.problems).toEqual([]);
  for (const key of ['crud-copy', 'update-copy', 'update-npm']) expect(verdict.cells[key].files).toHaveLength(3);
  expect(verdict.cells['crud-npm'].files).toEqual([...reusedNpmRuns].sort());
  expect(verdict.reuse.guideSha).toBe('64ec331');
  expect(typeof verdict.copyBetter).toBe('boolean');
});

test('the publish gate accepts the committed verdict exactly when copyBetter is false', async () => {
  const verdict = JSON.parse(await read('evals/results/copy-vs-npm.json'));
  const gate = spawnSync(process.execPath, [join(root, 'scripts/check-publish-gate.mjs'), join(results, 'copy-vs-npm.json')], { encoding: 'utf8' });
  expect(gate.status === 0).toBe(verdict.complete === true && verdict.copyBetter === false);
});

test('ADR 0010 is Accepted if and only if the committed verdict is complete and copyBetter is false', async () => {
  const verdict = JSON.parse(await read('evals/results/copy-vs-npm.json'));
  const status = (await read('docs/adr/0010-ship-components-through-npm-and-copy-page-templates.md')).split(/\r?\n/)[0];
  expect(status).toBe(`Status: ${adrStatusFor(verdict)}`);
});

test('the promises PR-EVAL-01 to 03 live in the capability spec, whose line endings are not mixed, and delivery verification has a row for each', async () => {
  const spec = await read('docs/capabilities/design-system.md');
  const delivery = await read('docs/delivery-verification.md');
  for (const id of ['PR-EVAL-01', 'PR-EVAL-02', 'PR-EVAL-03']) {
    expect(spec, id).toMatch(new RegExp(`^${id} — `, 'm'));
    expect(delivery, id).toContain(`| ${id} |`);
  }
  // 簽出時的換行依平台而異（Windows 為 CRLF、CI 的 Linux 為 LF），所以只要求同一個檔案不混用。
  const mixed = (text: string) => /\r\n/.test(text) && /(?<!\r)\n/.test(text);
  expect(mixed(spec), 'design-system.md').toBe(false);
  expect(mixed(delivery), 'delivery-verification.md').toBe(false);
});

test('result files and archives hold no workspace path, home path or Claude project-folder slug of the user name', async () => {
  const home = homedir();
  const forms = [home, home.replace(/\\/g, '/'), home.replace(/\\/g, '\\\\'), home.replace(/[^A-Za-z0-9]/g, '-')].map(form => form.toLowerCase());
  const files = (await readdir(results, { recursive: true, withFileTypes: true })).filter(entry => entry.isFile() && relative(results, join(entry.parentPath, entry.name)).includes("-cvn"));
  expect(files.length).toBeGreaterThan(9);
  for (const entry of files) {
    if (!/\.(json|md|tsx?|css|html|txt)$/.test(entry.name)) continue;
    const text = (await readFile(join(entry.parentPath, entry.name), 'utf8')).toLowerCase();
    for (const form of forms) expect(text.includes(form), `${entry.name} contains ${form}`).toBe(false);
  }
});

test('the two update tasks share everything except the paragraph saying where the new version is', async () => {
  const copy = lf(await read('evals/tasks/update-copy.md'));
  const npm = lf(await read('evals/tasks/update-npm.md'));
  const strip = (text: string) => text.replace(/## 新版在哪裡\n\n[^\n]*\n/, '');
  expect(strip(copy)).toBe(strip(npm));
  expect(copy).not.toBe(npm);
  expect(copy).toContain('upgrade/react-src/');
  expect(npm).toContain('upgrade/');
});

test('the copy group runs use the same task text as the npm group', async () => {
  // 複製組與 npm 組讀同一份 crud.md：沒有另外的複製版題目。
  const files = await readdir(join(root, 'evals/tasks'));
  expect(files.filter(name => /crud/.test(name))).toEqual(['crud.md']);
});

test('the ADR stays Proposed when the data is incomplete or copy is better, and flips only on a complete verdict where copy is not better', () => {
  expect(adrStatusFor({ complete: false, copyBetter: null })).toBe('Proposed');
  expect(adrStatusFor({ complete: false, copyBetter: false })).toBe('Proposed');
  expect(adrStatusFor({ complete: true, copyBetter: true })).toBe('Proposed');
  expect(adrStatusFor({ complete: true, copyBetter: false })).toBe('Accepted');
});
