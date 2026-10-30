import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { deriveAccent } from '../packages/tokens/accent.js';
import { makeWorkspace, readJson, readText, runGenerator } from './tokens-helpers';

// PR-STYLE-32、45：套系預設色的滑過、按下與焦點框在建置時以同一份 deriveAccent 算好，寫進 css、data 與設計檔資料；
// 套系的主色、點綴色、柔和底色仍是人工設計值（由 tokens-snapshot.spec 鎖住）。

type Theme = Record<string, string>;
type Data = Record<string, Record<string, Theme>>;
type FigData = { variables: { name: string; values: Record<string, unknown> }[] };
const derivedNames = ['accent-hover', 'accent-pressed', 'focus-ring'] as const;
const title = (word: string) => word[0].toUpperCase() + word.slice(1);

async function generate(edit?: (source: string) => Promise<void>) {
  const workspace = await makeWorkspace();
  try {
    if (edit) await edit(workspace.source);
    const result = runGenerator(workspace.root, 'src', 'out', ['--variables', 'fig.json']);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    return {
      data: await readJson(join(workspace.out, 'tokens.json')) as Data,
      css: await readText(join(workspace.out, 'tokens.css')),
      fig: await readJson(join(workspace.root, 'fig.json')) as FigData,
    };
  } finally {
    await workspace.dispose();
  }
}

// 以該組合自己的主色與中性色呼叫推算函式，得到建置應寫入的值。
function expectedFor(data: Data, suite: string, mode: 'light' | 'dark') {
  const theme = data[suite][mode];
  const neutrals = { bg: theme.bg, surface: theme.surface, 'surface-subtle': theme['surface-subtle'], text: theme.text, muted: theme.muted, 'accent-ink': theme['accent-ink'] };
  return deriveAccent({ light: data[suite].light.accent, dark: data[suite].dark.accent }, mode, neutrals);
}

test('every suite and mode gets accent-hover, accent-pressed and focus-ring derived from its own accent', async () => {
  const { data, css, fig } = await generate();
  const problems: string[] = [];
  for (const suite of ['vibrant', 'professional']) for (const mode of ['light', 'dark'] as const) {
    const expected = expectedFor(data, suite, mode);
    const block = css.split('}').find(part => part.includes(`[data-suite="${suite}"][data-mode="${mode}"]`)) ?? '';
    for (const name of derivedNames) {
      if (data[suite][mode][name] !== expected[name]) problems.push(`data ${suite}/${mode} ${name}: ${data[suite][mode][name]}，應為 ${expected[name]}`);
      if (!block.includes(`--${name}: ${expected[name]};`)) problems.push(`css ${suite}/${mode} ${name} 不是 ${expected[name]}`);
      const variable = fig.variables.find(candidate => candidate.name === name);
      for (const device of ['Desktop', 'Tablet', 'Mobile']) {
        const value = variable?.values[`${title(mode)}/${title(suite)}/${device}`];
        if (value !== expected[name]) problems.push(`fig ${name} ${mode}/${suite}/${device}: ${value}，應為 ${expected[name]}`);
      }
    }
  }
  expect(problems).toEqual([]);
  // 推算值真的與主色不同（不是把 {accent} 參照原樣輸出）。
  expect(data.vibrant.light['accent-hover']).not.toBe(data.vibrant.light.accent);
});

test('changing a suite accent in the source changes its derived roles in that combination only', async () => {
  const before = await generate();
  const after = await generate(async source => {
    const file = join(source, 'suite/vibrant/light.tokens.json');
    const tokens = await readJson(file);
    tokens.accent.$value = '#9A4C32';
    await writeFile(file, JSON.stringify(tokens));
  });
  expect(after.data.vibrant.light['accent-hover']).not.toBe(before.data.vibrant.light['accent-hover']);
  expect(after.data.vibrant.light['accent-hover']).toBe(expectedFor(after.data, 'vibrant', 'light')['accent-hover']);
  for (const [suite, mode] of [['vibrant', 'dark'], ['professional', 'light'], ['professional', 'dark']]) {
    for (const name of derivedNames) expect(after.data[suite][mode][name]).toBe(before.data[suite][mode][name]);
  }
});
