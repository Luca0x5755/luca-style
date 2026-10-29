import { test, expect } from '@playwright/test';
import { join } from 'node:path';
import { listJsonFiles, readJson, sourceDir } from './tokens-helpers';

// PR-STYLE-25：設計變數原始檔是 DTCG 格式，每個變數都有 $value、$type 與用途說明。

type Node = Record<string, unknown>;
const isGroupChild = (key: string, value: unknown) => !key.startsWith('$') && typeof value === 'object' && value !== null;

// 規則：有子群組的節點是群組，不能同時帶 $value；沒有子群組的節點是變數，必須有 $value、$type、非空 $description。
// 原始值直接掛在非 $ 鍵上（舊格式寫法）或空群組都視為違規，避免任何角色以群組形式漏掉 $value。
function violations(node: Node, path: string[], problems: string[]) {
  const where = path.join('.');
  const keys = Object.keys(node);
  const children = keys.filter(key => !key.startsWith('$'));
  for (const key of children) if (!isGroupChild(key, node[key])) problems.push(`${where}.${key}: 不是 DTCG 節點`);
  const groups = children.filter(key => isGroupChild(key, node[key]));
  if (groups.length) {
    if ('$value' in node) problems.push(`${where}: 群組不能有 $value`);
    for (const key of groups) violations(node[key] as Node, [...path, key], problems);
    return;
  }
  if (!('$value' in node)) problems.push(`${where}: 缺 $value`);
  if (typeof node.$type !== 'string' || !node.$type) problems.push(`${where}: 缺 $type`);
  if (typeof node.$description !== 'string' || !node.$description.trim()) problems.push(`${where}: 缺 $description`);
}

test('every token source file, typography included, is DTCG with $value, $type and $description', async () => {
  const files = await listJsonFiles(sourceDir);
  expect(files).toContain('typography.tokens.json');
  const problems: string[] = [];
  // 空檔案的根節點沒有子群組，會被當成缺 $value 的變數而報錯。
  for (const file of files) violations(await readJson(join(sourceDir, file)) as Node, [file], problems);
  expect(problems).toEqual([]);
});
