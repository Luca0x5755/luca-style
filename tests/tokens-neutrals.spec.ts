import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixtureDir, hexChannels, makeWorkspace, neutralValues, readJson, readText, runGenerator, wcagContrast } from './tokens-helpers';

// PR-STYLE-49、50：中性色兩套系共用，且文字、操作元件邊框對三層表面的對比過門檻。
// 只看產生器輸出的 tokens.json，套系分層日後若覆寫中性色也會被抓到。

type Data = Record<string, Record<'light' | 'dark', Record<string, string>>>;
const suites = ['vibrant', 'professional'] as const;
const modes = ['light', 'dark'] as const;
const surfaces = ['bg', 'surface', 'surface-subtle'] as const;

async function generate(edit?: (source: string) => Promise<void>) {
  const workspace = await makeWorkspace();
  try {
    if (edit) await edit(workspace.source);
    const result = runGenerator(workspace.root);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    return await readJson(join(workspace.out, 'tokens.json')) as Data;
  } finally {
    await workspace.dispose();
  }
}

// 不改原始檔時的輸出，正向案例共用，只產生一次。
let unchanged: Data;
test.beforeAll(async () => { unchanged = await generate(); });

// 每個明暗模式下，兩套系的中性色角色值不同之處。
function suiteDifferences(data: Data) {
  const problems: string[] = [];
  for (const mode of modes) for (const name of Object.keys(neutralValues)) {
    const values = suites.map(suite => data[suite][mode][name]);
    if (new Set(values).size !== 1) problems.push(`${mode} ${name}: ${values.join(' ≠ ')}`);
  }
  return problems;
}

// PR-STYLE-49
test('the eight neutral roles are identical in both suites for each mode', async () => {
  expect(suiteDifferences(unchanged)).toEqual([]);
});

test('a suite layer overriding a neutral role is caught by the comparison', async () => {
  const data = await generate(async source => {
    const file = join(source, 'suite/professional/light.tokens.json');
    const tokens = await readJson(file);
    tokens.bg = { $value: '#FAF7F2', $type: 'color', $description: '測試用：套系覆寫頁面底色' };
    await writeFile(file, JSON.stringify(tokens));
  });
  expect(suiteDifferences(data)).toEqual(['light bg: #F7F8FA ≠ #FAF7F2']);
});

// 兩套系 × 兩模式 × 三層表面，對比不足之處。
function contrastShortfalls(data: Data) {
  const problems: string[] = [];
  for (const suite of suites) for (const mode of modes) {
    const theme = data[suite][mode];
    for (const [role, threshold] of [['text', 4.5], ['muted', 4.5], ['control-border', 3]] as const) {
      for (const layer of surfaces) {
        const ratio = wcagContrast(hexChannels(theme[role]), hexChannels(theme[layer]));
        if (ratio < threshold) problems.push(`${suite}/${mode} ${role} on ${layer}: ${ratio.toFixed(2)} < ${threshold}`);
      }
    }
  }
  return problems;
}

// PR-STYLE-50
test('text and muted reach 4.5:1 and control-border reaches 3:1 on all three surface layers, in both suites and modes', async () => {
  expect(contrastShortfalls(unchanged)).toEqual([]);
});

test('a muted colour too close to the surfaces is caught by the contrast check', async () => {
  const data = await generate(async source => {
    const file = join(source, 'mode/light.tokens.json');
    const tokens = await readJson(file);
    tokens.muted.$value = '#8A8C90';
    await writeFile(file, JSON.stringify(tokens));
  });
  expect(contrastShortfalls(data).filter(problem => problem.includes('light muted on'))).toHaveLength(6);
});

// PR-STYLE-53：升級說明的中性色對照表。舊值讀 0.1.0 快照（兩套系相同，取 vibrant），新值讀 neutralValues。
// 只切出「0.2.0 升級說明」整節，不依賴小節標題；每列依序找日間舊、日間新、暗黑舊、暗黑新，
// 每個值都從前一個命中處之後找，因為 surface 與 accent-ink 的日間新舊值相同。
async function upgradeNotes() {
  const guide = await readText(fileURLToPath(new URL('../docs/consumer-guide.md', import.meta.url)));
  const start = guide.indexOf('\n## 0.2.0 升級說明\n');
  expect(start, '找不到 0.2.0 升級說明').toBeGreaterThanOrEqual(0);
  const next = guide.indexOf('\n## ', start + 1);
  return guide.slice(start, next === -1 ? undefined : next);
}

function neutralRowProblems(notes: string, legacy: Record<'light' | 'dark', Record<string, string>>) {
  const problems: string[] = [];
  const rows = notes.split('\n');
  for (const [role, values] of Object.entries(neutralValues)) {
    const row = rows.find(line => line.startsWith(`| \`${role}\` |`));
    if (!row) { problems.push(`${role}: 沒有對照列`); continue; }
    const expected = [legacy.light[role], values.light, legacy.dark[role], values.dark];
    const upperRow = row.toUpperCase();
    let from = 0;
    for (const value of expected) {
      const at = upperRow.indexOf(value.toUpperCase(), from);
      if (at === -1) { problems.push(`${role}: 缺 ${value} 或順序不對（應為 ${expected.join(' → ')}）`); break; }
      from = at + value.length;
    }
  }
  if (!notes.includes('var(--')) problems.push('沒有說明改用設計變數 var(--…)');
  return problems;
}

const legacyNeutrals = async () => (await readJson(join(fixtureDir, 'tokens.json'))).vibrant;

// PR-STYLE-53
test('consumer-guide 0.2.0 upgrade notes list every neutral role with its 0.1.0 and PR-STYLE-48 values', async () => {
  expect(neutralRowProblems(await upgradeNotes(), await legacyNeutrals())).toEqual([]);
});

test('an upgrade-notes row that repeats one #FFFFFF for both old and new light values is caught', async () => {
  const notes = '| `surface` | `#FFFFFF` | `#1D2420` | `#1A1D22` |\nvar(--surface)';
  expect(neutralRowProblems(notes, await legacyNeutrals())).toContain('surface: 缺 #FFFFFF 或順序不對（應為 #FFFFFF → #FFFFFF → #1D2420 → #1A1D22）');
});
