import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// ISSUE-027／PR-FILE-27：元件庫設計檔（Penpot 匯出）的離線檢查納入 `npm test`，CI 的 verify job 因此會跑。
// 兩條命令各自獨立成一個測試，其一失敗不會讓另一條不執行；node --test 逐檔列出，不靠 shell 展開 glob。
// 只跑 *.test.mjs，逐檔列出；舊設計工具的腳本與測試已隨 ISSUE-029 刪除。

const root = fileURLToPath(new URL('../', import.meta.url));

test('the committed Penpot library export matches bindings.json and variables.json, and the committed dump matches the export', () => {
  const result = spawnSync(process.execPath, [process.env.npm_execpath!, 'run', 'check:penpot'], { cwd: root, encoding: 'utf8' });
  expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
});

test('the Penpot export scripts pass their own node tests', () => {
  const dir = fileURLToPath(new URL('../scripts/design/', import.meta.url));
  const files = readdirSync(dir).filter(name => name.endsWith('.test.mjs')).map(name => `scripts/design/${name}`);
  expect(files.length).toBeGreaterThanOrEqual(4);
  const result = spawnSync(process.execPath, ['--test', ...files], { cwd: root, encoding: 'utf8' });
  expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
});
