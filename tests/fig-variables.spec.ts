import { test, expect } from '@playwright/test';
import { readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeWorkspace, readJson, readText, runGenerator } from './tokens-helpers';

// ISSUE-003／PR-FILE-16：npm run generate 由 DTCG 原始檔另外產生設計檔變數資料，
// 內容是程式變數與原設計檔 48 個變數的聯集；apply-variables.js 讀這份資料寫入元件庫設計檔（含集合與每個變數所在的集合）。

type FigVariable = { name: string; type: string; collection?: string; values: Record<string, unknown> };
type FigCollection = { name: string; axes: string[]; modes: string[] };
type FigData = { $generated?: string; axes: Record<string, string[]>; collections?: FigCollection[]; count: number; variables: FigVariable[] };

// 0.1.0 時設計檔的 48 個變數（由 .pen 擷取的 variables.json 原樣保存）。
const legacyFixture = fileURLToPath(new URL('./fixtures/fig-variables-0.1.0.json', import.meta.url));

async function generateFig(edit?: (source: string) => Promise<void>) {
  const workspace = await makeWorkspace();
  try {
    if (edit) await edit(workspace.source);
    const result = runGenerator(workspace.root, 'src', 'out', ['--fig', 'fig/variables.json']);
    const data = result.status === 0 ? await readJson(join(workspace.root, 'fig/variables.json')) as FigData : undefined;
    return { ...result, data };
  } finally {
    await workspace.dispose();
  }
}

test('generated design-file data keeps the 48 legacy variables with the same type and 12 values each', async () => {
  const legacy = await readJson(legacyFixture) as FigData;
  const { status, stderr, data } = await generateFig();
  expect(stderr).toBe('');
  expect(status).toBe(0);
  expect(data!.axes).toEqual(legacy.axes);
  const byName = new Map(data!.variables.map(variable => [variable.name, variable]));
  const problems: string[] = [];
  for (const { name, type, values } of legacy.variables) {
    const got = byName.get(name);
    if (!got) problems.push(`${name}: 缺少`);
    else if (got.type !== type) problems.push(`${name}: 型別 ${got.type}，應為 ${type}`);
    else for (const [combo, value] of Object.entries(values)) {
      if (got.values[combo] !== value) problems.push(`${name} @ ${combo}: ${JSON.stringify(got.values[combo])}，應為 ${JSON.stringify(value)}`);
    }
  }
  expect(problems).toEqual([]);
});

// 程式變數改用設計檔舊名的對照（ADR 0004：重複者合併為一個名稱，設計檔沿用舊名以保留母版綁定）。
const merged: Record<string, string> = {
  'accent-secondary': 'secondary',
  'metric-background': 'card-highlight',
  'metric-shadow': 'elevation-enabled',
  'type-hero-size': 'fs-hero',
  'type-title-size': 'fs-title',
  'type-section-size': 'fs-section',
  'type-card-size': 'fs-card',
  'type-body-size': 'fs-body',
  'type-secondary-size': 'fs-small',
  'type-helper-size': 'fs-label',
};

test('every published CSS variable is in the design-file data, under its legacy name when merged, with no duplicates', async () => {
  const workspace = await makeWorkspace();
  try {
    expect(runGenerator(workspace.root, 'src', 'out', ['--fig', 'fig.json']).status).toBe(0);
    const css = await readText(join(workspace.out, 'tokens.css'));
    const cssNames = new Set([...css.matchAll(/--([a-z0-9-]+):/g)].map(match => match[1]));
    const data = await readJson(join(workspace.root, 'fig.json')) as FigData;
    const names = data.variables.map(variable => variable.name);
    expect(new Set(names).size).toBe(names.length);
    expect([...cssNames].map(name => merged[name] ?? name).filter(name => !names.includes(name))).toEqual([]);
    expect(names.filter(name => name in merged)).toEqual([]);
    // 48 個舊變數＋24 個程式獨有變數（含 ISSUE-006 建置時推算的 accent-hover、accent-pressed、focus-ring，
    // 與 ISSUE-008 的 table-cell-padding-block、table-cell-padding-inline；等級區塊只覆寫同名變數，不另增變數）。
    expect(data.count).toBe(72);
    expect(names.length).toBe(72);
  } finally {
    await workspace.dispose();
  }
});

test('code-only variables reach the design-file data converted to design-file units', async () => {
  const { data } = await generateFig();
  const value = (name: string, combo = 'Light/Vibrant/Desktop') => data!.variables.find(variable => variable.name === name)?.values[combo];
  expect(value('control-height')).toBe(48);
  expect(value('font-body')).toBe('Inter');
  expect(value('type-hero-weight')).toBe(700);
  expect(value('type-hero-line-height')).toBe(1.2);
  expect(value('type-control-size', 'Dark/Professional/Mobile')).toBe(16);
});

test('a value changed in the DTCG source changes the design-file data for that combination only', async () => {
  const { data } = await generateFig(async source => {
    const file = join(source, 'suite/vibrant/light.tokens.json');
    const tokens = await readJson(file);
    tokens.accent.$value = '#123456';
    await writeFile(file, JSON.stringify(tokens));
  });
  const accent = data!.variables.find(variable => variable.name === 'accent')!;
  expect(accent.values['Light/Vibrant/Tablet']).toBe('#123456');
  expect(accent.values['Dark/Vibrant/Tablet']).toBe('#64C2BC');
  expect(accent.values['Light/Professional/Tablet']).toBe('#625C83');
});

test('design-file-only variables stay out of tokens.css and tokens.json, and nothing is written without --fig', async () => {
  const workspace = await makeWorkspace();
  try {
    expect(runGenerator(workspace.root).status).toBe(0);
    expect((await readdir(workspace.root)).sort()).toEqual(['out', 'src']);
    const css = await readText(join(workspace.out, 'tokens.css'));
    const data = await readText(join(workspace.out, 'tokens.json'));
    for (const name of ['font-zh', 'font-en', 'suite-label', 'loading-tide-light-opacity', 'loading-tide-dark-opacity', 'loading-square-light-opacity', 'loading-square-dark-opacity']) {
      expect(css).not.toContain(`--${name}:`);
      expect(data).not.toContain(`"${name}"`);
    }
  } finally {
    await workspace.dispose();
  }
});

test('a token type with no design-file form fails the build naming the token, and writes nothing', async () => {
  const result = await generateFig(async source => {
    const file = join(source, 'base.tokens.json');
    const tokens = await readJson(file);
    tokens['ease-standard'] = { $value: [0.2, 0, 0, 1], $type: 'cubicBezier', $description: '測試用' };
    await writeFile(file, JSON.stringify(tokens));
  });
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('ease-standard');
  expect(result.data).toBeUndefined();
});

test('a shadow token other than metric-shadow fails the build instead of becoming a boolean', async () => {
  const result = await generateFig(async source => {
    const file = join(source, 'base.tokens.json');
    const tokens = await readJson(file);
    tokens['popup-shadow'] = { $value: '0 4px 16px #00000014', $type: 'shadow', $description: '測試用' };
    await writeFile(file, JSON.stringify(tokens));
  });
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('popup-shadow');
});

test('two tokens claiming the same design-file name fail the build naming both', async () => {
  const result = await generateFig(async source => {
    const file = join(source, 'base.tokens.json');
    const tokens = await readJson(file);
    tokens['space-1'].$extensions = { 'luca-style': { figName: 'space-2' } };
    await writeFile(file, JSON.stringify(tokens));
  });
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('space-1');
  expect(result.stderr).toContain('space-2');
});

test('no design-file variable varies by both mode and device, which apply-variables.js cannot model', async () => {
  const { data } = await generateFig();
  const both = data!.variables.filter(({ values }) => {
    const byMode = data!.axes.suite.some(suite => data!.axes.device.some(device =>
      new Set(data!.axes.mode.map(mode => JSON.stringify(values[`${mode}/${suite}/${device}`]))).size > 1));
    const byDevice = data!.axes.suite.some(suite => data!.axes.mode.some(mode =>
      new Set(data!.axes.device.map(device => JSON.stringify(values[`${mode}/${suite}/${device}`]))).size > 1));
    return byMode && byDevice;
  });
  expect(both.map(variable => variable.name)).toEqual([]);
});

// ISSUE-004：設計檔的集合與模式由產生器決定（Figma 一個節點在每個集合只持有一個模式）。
// 同時依套系與明暗變化的變數，沒有別名可用（匯出不解別名），所以放進 4 個模式的「Suite x Mode」集合。
test('every design-file variable is placed in the collection whose modes cover exactly the axes it varies on', async () => {
  const { data } = await generateFig();
  expect(data!.collections).toEqual([
    { name: 'Base', axes: [], modes: ['Default'] },
    { name: 'Suite', axes: ['suite'], modes: ['Vibrant', 'Professional'] },
    { name: 'Mode', axes: ['mode'], modes: ['Light', 'Dark'] },
    { name: 'Device', axes: ['device'], modes: ['Desktop', 'Tablet', 'Mobile'] },
    { name: 'Suite x Mode', axes: ['suite', 'mode'], modes: ['Vibrant / Light', 'Vibrant / Dark', 'Professional / Light', 'Professional / Dark'] },
  ]);
  const placed = (name: string) => data!.variables.find(variable => variable.name === name)?.collection;
  expect(placed('font-zh')).toBe('Base');
  expect(placed('radius-card')).toBe('Suite');
  expect(placed('bg')).toBe('Mode');
  expect(placed('fs-hero')).toBe('Device');
  for (const name of ['accent', 'accent-hover', 'accent-pressed', 'focus-ring', 'success', 'card-highlight']) expect(placed(name)).toBe('Suite x Mode');
  expect(data!.variables.filter(variable => !variable.collection).map(variable => variable.name)).toEqual([]);
  const counts = Object.fromEntries(data!.collections!.map(({ name }) => [name, data!.variables.filter(variable => variable.collection === name).length]));
  expect(counts).toEqual({ Base: 39, Suite: 8, Mode: 8, Device: 3, 'Suite x Mode': 14 });
});

test('the committed docs/mockup/themes/variables.json is generated output, identical to a fresh npm run generate', async () => {
  const committed = await readText(fileURLToPath(new URL('../docs/mockup/themes/variables.json', import.meta.url)));
  const workspace = await makeWorkspace();
  try {
    expect(runGenerator(workspace.root, 'src', 'out', ['--fig', 'fig.json']).status).toBe(0);
    expect(JSON.parse(committed).$generated).toContain('npm run generate');
    expect(committed).toBe(await readText(join(workspace.root, 'fig.json')));
  } finally {
    await workspace.dispose();
  }
});
