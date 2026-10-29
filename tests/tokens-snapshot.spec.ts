import { test, expect } from '@playwright/test';
import { readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expectedAgainstSnapshot, fixtureDir, makeWorkspace, readJson, readText, runGenerator } from './tokens-helpers';

// PR-STYLE-27：既有變數的名稱、結構和值與 0.1.0 快照相同；新增變數不算違反。
// 例外是中性色 8 個角色，值必須等於 PR-STYLE-48 的新值（例外表見 tokens-helpers 的 neutralValues）。

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

// 區塊名稱帶 data-mode 時才是明暗模式的區塊；其他區塊（字級、等級）沒有中性色。
const modeOf = (header: string) => header.match(/data-mode="(light|dark)"/)?.[1] as 'light' | 'dark' | undefined;

// 0.1.0 快照換上中性色新值後，就是 tokens.json 應有的內容。
async function expectedData() {
  const snapshot = await readJson(join(fixtureDir, 'tokens.json')) as Record<string, Record<string, Record<string, Json>>>;
  for (const modes of Object.values(snapshot)) for (const [mode, theme] of Object.entries(modes)) {
    for (const [name, value] of Object.entries(theme)) theme[name] = expectedAgainstSnapshot(name, mode as 'light' | 'dark', value);
  }
  return snapshot;
}

async function dataProblems(out: string) {
  // 套系與明暗兩層的鍵必須完全相同；變數層允許新增。
  return compareTree(await expectedData(), await readJson(join(out, 'tokens.json')), 2);
}

async function cssProblems(out: string) {
  const snapshot = parseCss(await readText(join(fixtureDir, 'tokens.css')));
  const actual = parseCss(await readText(join(out, 'tokens.css')));
  const snapshotHeaders = snapshot.map(block => block.header);
  const problems: string[] = [];
  // 快照的區塊在新輸出中依相同順序出現。
  const order = actual.map(block => block.header).filter(header => snapshotHeaders.includes(header));
  if (JSON.stringify(order) !== JSON.stringify(snapshotHeaders)) problems.push(`區塊順序：${order.join(' | ')}`);
  for (const block of snapshot) {
    const match = actual.find(candidate => candidate.header === block.header);
    if (!match) continue;
    for (const [name, legacy] of block.declarations) {
      const value = expectedAgainstSnapshot(name.replace(/^--/, ''), modeOf(block.header), legacy);
      const got = match.declarations.get(name);
      if (got !== value) problems.push(`${block.header} ${name}: 預期 ${value}，實得 ${got}`);
    }
  }
  return problems;
}

// 在暫存工作區改一個原始檔的變數值後產生輸出，回傳兩種輸出的比對問題。
async function problemsAfter(layer: string, name: string, value: string) {
  const edited = await makeWorkspace();
  try {
    const file = join(edited.source, layer);
    const tokens = await readJson(file);
    tokens[name].$value = value;
    await writeFile(file, JSON.stringify(tokens));
    expect(runGenerator(edited.root).status).toBe(0);
    return { data: await dataProblems(edited.out), css: await cssProblems(edited.out) };
  } finally {
    await edited.dispose();
  }
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

test('tokens.json keeps 0.1.0 suites, modes, names and values, except the neutral roles which carry the PR-STYLE-48 values', async () => {
  expect(await dataProblems(workspace.out)).toEqual([]);
});

test('typography.json keeps 0.1.0 roles, fields and value types', async () => {
  const snapshot = await readJson(join(fixtureDir, 'typography.json'));
  const actual = await readJson(join(workspace.out, 'typography.json'));
  // 每個角色的欄位集合必須完全相同（數字仍是數字）；角色層允許新增。
  const problems = compareTree(snapshot, actual, 0);
  for (const role of Object.keys(snapshot)) problems.push(...compareTree(snapshot[role], actual[role] ?? {}, 1, [role]));
  expect([...new Set(problems)]).toEqual([]);
});

test('tokens.css keeps 0.1.0 blocks in order with the same declarations, except the neutral roles which carry the PR-STYLE-48 values', async () => {
  expect(await cssProblems(workspace.out)).toEqual([]);
});

// 反向案例：例外只放行中性色的全名，而且只放行 PR-STYLE-48 的值。
for (const [label, layer, name, value] of [
  ['a non-neutral colour', 'suite/vibrant/light.tokens.json', 'accent', '#123456'],
  ['border-width, whose name starts with border', 'shape/rounded.tokens.json', 'border-width', '2px'],
  ['metric-border-left, whose name contains border', 'shape/rounded.tokens.json', 'metric-border-left', '2px'],
  ['a neutral role set to a value other than PR-STYLE-48', 'mode/light.tokens.json', 'bg', '#000000'],
] as const) {
  test(`changing ${label} still fails the snapshot comparison in both tokens.json and tokens.css`, async () => {
    const { data, css } = await problemsAfter(layer, name, value);
    // 以完整名稱判斷是哪個變數出錯，accent 不會被 accent-ink 的問題誤算。
    expect(data.filter(problem => problem.includes(`.${name}: `))).not.toEqual([]);
    expect(css.filter(problem => problem.includes(` --${name}: `))).not.toEqual([]);
  });
}
