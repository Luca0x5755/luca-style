import { test, expect } from '@playwright/test';
import { readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listJsonFiles, makeWorkspace, readJson, readText, runGenerator, sourceDir } from './tokens-helpers';

// ISSUE-013／PR-STYLE-28：npm run generate 由 DTCG 原始檔另外產生一份給代理讀的設計變數規格文件，
// 列出每個變數在每種「套系 × 明暗」組合下的值與用途（$description）。測試只透過產生器指令與輸出檔觀察。

const combos = [['vibrant', 'light'], ['vibrant', 'dark'], ['professional', 'light'], ['professional', 'dark']] as const;
type Theme = Record<string, Record<string, Record<string, string>>>;

// 解析 Markdown 表格列：`| a | b |` → ['a','b']；儲存格內的 | 以 \| 跳脫。
const cells = (line: string) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(cell => cell.trim().replace(/\\\|/g, '|'));
const unquote = (cell: string) => cell.replace(/^`|`$/g, '');
// 取某個二級標題底下的表格資料列（略過表頭與分隔列）。
function tableUnder(doc: string, heading: string) {
  const section = doc.split(/^## /m).find(part => part.startsWith(heading));
  if (!section) throw new Error(`規格文件缺少章節：${heading}`);
  return section.split('\n').filter(line => line.startsWith('|')).slice(2).map(cells);
}
// 所有分層檔（不含字體）的 名稱 → $description；各層同名變數的說明一致，已另行確認。
async function descriptions() {
  const result = new Map<string, string>();
  for (const file of await listJsonFiles(sourceDir)) {
    if (file.startsWith('typography')) continue;
    for (const [name, node] of Object.entries(await readJson(join(sourceDir, file)))) if (!name.startsWith('$')) result.set(name, (node as { $description: string }).$description);
  }
  return result;
}

async function generateDoc() {
  const workspace = await makeWorkspace();
  try {
    const result = runGenerator(workspace.root, 'src', 'out', ['--doc', 'doc/design-tokens.md']);
    expect(result.stderr).toBe('');
    return { doc: await readText(join(workspace.root, 'doc/design-tokens.md')), data: await readJson(join(workspace.out, 'tokens.json')) as Theme };
  } finally {
    await workspace.dispose();
  }
}

test('spec document lists every published variable with its description and its value in all four suite-and-mode combinations', async () => {
  const { doc, data } = await generateDoc();
  const rows = tableUnder(doc, '設計變數');
  const names = Object.keys(data.vibrant.light);
  expect(rows.map(row => unquote(row[0])).sort()).toEqual([...names].sort());
  const described = await descriptions();
  for (const row of rows) {
    const name = unquote(row[0]);
    expect(row[1], `${name} 的用途`).toBe(described.get(name));
    combos.forEach(([suite, mode], index) => expect(unquote(row[2 + index]), `${name} ${suite}/${mode}`).toBe(data[suite][mode][name]));
  }
});

test('design-file-only variables are absent from the spec document', async () => {
  const { doc } = await generateDoc();
  // 這些變數只存在於設計檔（designFileOnly），不進 css、data，也就不該出現在規格文件。
  for (const name of ['font-zh', 'font-en', 'suite-label', 'loading-tide-light-opacity', 'loading-square-dark-opacity']) expect(doc).not.toContain(`\`${name}\``);
});

// 取 tokens.css 中某個等級區塊的「變數 → 值」。
function cssBlock(css: string, selector: string) {
  const body = css.split('\n}\n').map(block => block.trim()).find(block => block.startsWith(`${selector} {`));
  if (!body) throw new Error(`tokens.css 缺少區塊：${selector}`);
  return Object.fromEntries([...body.matchAll(/^\s+--([a-z0-9-]+): (.*);$/gm)].map(match => [match[1], match[2]]));
}

test('density and shape sections match the level blocks of tokens.css, for every level', async () => {
  const workspace = await makeWorkspace();
  try {
    runGenerator(workspace.root, 'src', 'out', ['--doc', 'doc/design-tokens.md']);
    const doc = await readText(join(workspace.root, 'doc/design-tokens.md'));
    const css = await readText(join(workspace.out, 'tokens.css'));
    const described = await descriptions();
    for (const [heading, levels] of [['資訊密度', ['vibrant', 'professional'].flatMap(suite => ['compact', 'standard', 'comfortable'].map(level => [`${suite}/${level}`, `[data-luca-theme][data-suite="${suite}"][data-density="${level}"]`]))],
      ['元件外形', ['rounded', 'sharp'].map(level => [level, `[data-luca-theme][data-suite][data-shape="${level}"]`])]] as const) {
      const header = doc.split(/^## /m).find(part => part.startsWith(heading))!.split('\n').find(line => line.startsWith('| 變數'))!;
      expect(cells(header).slice(2)).toEqual(levels.map(([label]) => label));
      for (const row of tableUnder(doc, heading)) {
        const name = unquote(row[0]);
        expect(row[1], `${name} 的用途`).toBe(described.get(name));
        levels.forEach(([label, selector], index) => expect(unquote(row[2 + index]), `${name} ${label}`).toBe(cssBlock(css, selector)[name]));
      }
      expect(tableUnder(doc, heading).length).toBeGreaterThan(0);
    }
  } finally {
    await workspace.dispose();
  }
});

test('typography section matches the typography data and the documented default levels follow the source', async () => {
  const workspace = await makeWorkspace();
  try {
    runGenerator(workspace.root, 'src', 'out', ['--doc', 'doc/design-tokens.md']);
    const doc = await readText(join(workspace.root, 'doc/design-tokens.md'));
    const typography = await readJson(join(workspace.out, 'typography.json')) as Record<string, Record<string, string | number>>;
    const rows = tableUnder(doc, '字體角色');
    expect(rows.map(row => unquote(row[0]))).toEqual(Object.keys(typography));
    for (const row of rows) expect(row.slice(1).map(unquote)).toEqual(['mobile', 'tablet', 'desktop', 'weight', 'lineHeight'].map(field => String(typography[unquote(row[0])][field])));
    // 預設等級與詞彙：活力標準＋圓潤、專業標準＋俐落（GLOSSARY、ADR 0005）。
    expect(doc).toContain('vibrant 為 standard、professional 為 standard');
    expect(doc).toContain('vibrant 為 rounded、professional 為 sharp');
  } finally {
    await workspace.dispose();
  }
});

test('spec document follows the DTCG source: changing a value and a description changes the document', async () => {
  const workspace = await makeWorkspace();
  try {
    const file = join(workspace.source, 'suite/vibrant/light.tokens.json');
    const tokens = await readJson(file);
    tokens.error.$value = '#123456';
    tokens.error.$description = '測試用的新用途';
    await writeFile(file, JSON.stringify(tokens));
    expect(runGenerator(workspace.root, 'src', 'out', ['--doc', 'doc/design-tokens.md']).status).toBe(0);
    const row = tableUnder(await readText(join(workspace.root, 'doc/design-tokens.md')), '設計變數').find(cells => unquote(cells[0]) === 'error')!;
    expect(row[1]).toBe('測試用的新用途');
    expect(unquote(row[2])).toBe('#123456');
  } finally {
    await workspace.dispose();
  }
});

test('a failing build writes no spec document, and without --doc nothing extra is written', async () => {
  const workspace = await makeWorkspace();
  try {
    expect(runGenerator(workspace.root).status).toBe(0);
    expect((await readdir(workspace.root)).sort()).toEqual(['out', 'src']);
    const file = join(workspace.source, 'suite/vibrant/dark.tokens.json');
    const tokens = await readJson(file);
    delete tokens.accent;
    await writeFile(file, JSON.stringify(tokens));
    const result = runGenerator(workspace.root, 'src', 'out2', ['--doc', 'doc/design-tokens.md']);
    expect(result.status).not.toBe(0);
    expect(await readdir(workspace.root)).not.toContain('doc');
  } finally {
    await workspace.dispose();
  }
});

test('the committed docs/design-tokens.md equals what npm run generate produces (no drift) and ends with one newline', async () => {
  const { doc } = await generateDoc();
  const committed = await readText(fileURLToPath(new URL('../docs/design-tokens.md', import.meta.url)));
  expect(committed).toBe(doc);
  expect(doc.endsWith('\n') && !doc.endsWith('\n\n')).toBe(true);
});
