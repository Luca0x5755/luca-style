import { test, expect } from '@playwright/test';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fixtureDir, makeWorkspace, readJson, readText, runGenerator } from './tokens-helpers';

// PR-STYLE-27：既有變數的名稱、結構和值與 0.1.0 快照相同；新增變數不算違反。

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

// 逐項比對：快照中每個節點在新輸出都存在且型別相同；exactKeysUntil 以上的層級鍵集合必須完全相同。
function compareTree(snapshot: Json, actual: Json, exactKeysUntil: number, path: string[] = [], problems: string[] = []) {
  const where = path.join('.') || '(root)';
  const isObject = (value: Json) => typeof value === 'object' && value !== null && !Array.isArray(value);
  if (!isObject(snapshot)) {
    if (actual !== snapshot) problems.push(`${where}: 預期 ${JSON.stringify(snapshot)}，實得 ${JSON.stringify(actual)}`);
    return problems;
  }
  if (!isObject(actual)) {
    problems.push(`${where}: 預期物件，實得 ${JSON.stringify(actual)}`);
    return problems;
  }
  const expected = snapshot as Record<string, Json>;
  const got = actual as Record<string, Json>;
  if (path.length < exactKeysUntil) {
    const extra = Object.keys(got).filter(key => !(key in expected));
    if (extra.length) problems.push(`${where}: 多出鍵 ${extra.join(', ')}`);
  }
  for (const key of Object.keys(expected)) {
    if (!(key in got)) problems.push(`${[...path, key].join('.')}: 缺少`);
    else compareTree(expected[key], got[key], exactKeysUntil, [...path, key], problems);
  }
  return problems;
}

type CssBlock = { header: string; declarations: Map<string, string> };

// 把 CSS 拆成區塊：巢狀的 @media 以「外層 > 內層」當作區塊名稱。
function parseCss(css: string): CssBlock[] {
  const blocks: CssBlock[] = [];
  const headers: string[] = [];
  let buffer = '';
  let current: CssBlock | undefined;
  for (const char of css) {
    if (char === '{') {
      headers.push(buffer.trim());
      buffer = '';
      current = { header: headers.join(' > '), declarations: new Map() };
      blocks.push(current);
    } else if (char === ';' && current) {
      const [name, ...rest] = buffer.split(':');
      current.declarations.set(name.trim(), rest.join(':').trim());
      buffer = '';
    } else if (char === '}') {
      headers.pop();
      buffer = '';
      current = undefined;
    } else buffer += char;
  }
  // 只有外層 @media 而無宣告的區塊不參與比對。
  return blocks.filter(block => block.declarations.size > 0);
}

let workspace: Awaited<ReturnType<typeof makeWorkspace>>;

test.beforeAll(async () => {
  workspace = await makeWorkspace();
  const result = runGenerator(workspace.root);
  expect(result.stderr).toBe('');
  expect(result.status).toBe(0);
});

test.afterAll(async () => workspace?.dispose());

test('generator writes the three published outputs only into --out', async () => {
  expect((await readdir(workspace.out)).sort()).toEqual(['css.d.ts', 'tokens.css', 'tokens.json', 'typography.json']);
  expect((await readdir(workspace.root)).sort()).toEqual(['out', 'src']);
});

test('tokens.json keeps 0.1.0 suites, modes, names and values', async () => {
  const snapshot = await readJson(join(fixtureDir, 'tokens.json'));
  const actual = await readJson(join(workspace.out, 'tokens.json'));
  // 套系與明暗兩層的鍵必須完全相同；變數層允許新增。
  expect(compareTree(snapshot, actual, 2)).toEqual([]);
});

test('typography.json keeps 0.1.0 roles, fields and value types', async () => {
  const snapshot = await readJson(join(fixtureDir, 'typography.json'));
  const actual = await readJson(join(workspace.out, 'typography.json'));
  // 每個角色的欄位集合必須完全相同（數字仍是數字）；角色層允許新增。
  const problems = compareTree(snapshot, actual, 0);
  for (const role of Object.keys(snapshot)) problems.push(...compareTree(snapshot[role], actual[role] ?? {}, 1, [role]));
  expect([...new Set(problems)]).toEqual([]);
});

test('tokens.css keeps 0.1.0 blocks in order with the same declarations', async () => {
  const snapshot = parseCss(await readText(join(fixtureDir, 'tokens.css')));
  const actual = parseCss(await readText(join(workspace.out, 'tokens.css')));
  const actualHeaders = actual.map(block => block.header);
  const snapshotHeaders = snapshot.map(block => block.header);
  // 快照的區塊在新輸出中依相同順序出現。
  expect(actualHeaders.filter(header => snapshotHeaders.includes(header))).toEqual(snapshotHeaders);
  const problems: string[] = [];
  for (const block of snapshot) {
    const match = actual.find(candidate => candidate.header === block.header)!;
    for (const [name, value] of block.declarations) {
      const got = match.declarations.get(name);
      if (got !== value) problems.push(`${block.header} ${name}: 預期 ${value}，實得 ${got}`);
    }
  }
  expect(problems).toEqual([]);
});
