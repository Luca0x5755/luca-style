import { test, expect } from '@playwright/test';
import { readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';
import { expectedAgainstSnapshot, makeWorkspace, neutralValues, readJson, readText, runGenerator } from './tokens-helpers';

// ISSUE-003／PR-FILE-16：npm run generate 由 DTCG 原始檔另外產生設計檔變數資料（variables.json），
// 內容是程式變數與原設計檔 48 個變數的聯集（含集合與每個變數所在的集合）；
// penpot-tokens.json 與 npm run check:penpot 的解析值比對都以它為基準，所以它與 DTCG 的一致性在這裡守住（ISSUE-029 由舊的設計檔變數規格移植，斷言不變）。

type DesignVariable = { name: string; type: string; collection?: string; values: Record<string, unknown> };
type DesignCollection = { name: string; axes: string[]; modes: string[] };
type DesignData = { $generated?: string; axes: Record<string, string[]>; collections?: DesignCollection[]; count: number; variables: DesignVariable[] };

// 0.1.0 時設計檔的 48 個變數（由舊設計檔擷取的 variables.json 原樣保存）。
const legacyFixture = fileURLToPath(new URL('./fixtures/design-variables-0.1.0.json', import.meta.url));

async function generateDesign(edit?: (source: string) => Promise<void>) {
  const workspace = await makeWorkspace();
  try {
    if (edit) await edit(workspace.source);
    const result = runGenerator(workspace.root, 'src', 'out', ['--variables', 'design/variables.json']);
    const data = result.status === 0 ? await readJson(join(workspace.root, 'design/variables.json')) as DesignData : undefined;
    return { ...result, data };
  } finally {
    await workspace.dispose();
  }
}

// 48 個舊變數在 0.1.0 的值；中性色 8 個角色改比 PR-STYLE-48 新值（與 tokens-snapshot 共用 tokens-helpers 的例外表）。
// card-highlight（程式名 metric-background）在精緻專業是俐落外形的 var(--surface)，解析後等於該組合的 surface，
// 這是推導值而不是放行：精緻專業 6 個值必須等於新 surface，精緻活力照舊比 0.1.0。
function expectedLegacyValue(name: string, combo: string, legacy: unknown) {
  const [mode, suite] = combo.split('/');
  const lowerMode = mode.toLowerCase() as 'light' | 'dark';
  if (name === 'card-highlight' && suite === 'Professional') return neutralValues.surface[lowerMode];
  return expectedAgainstSnapshot(name, lowerMode, legacy);
}

async function legacyProblems(data: DesignData) {
  const legacy = await readJson(legacyFixture) as DesignData;
  const byName = new Map(data.variables.map(variable => [variable.name, variable]));
  const problems: string[] = [];
  if (!isDeepStrictEqual(data.axes, legacy.axes)) problems.push(`axes: ${JSON.stringify(data.axes)}`);
  for (const { name, type, values } of legacy.variables) {
    const got = byName.get(name);
    if (!got) problems.push(`${name}: 缺少`);
    else if (got.type !== type) problems.push(`${name}: 型別 ${got.type}，應為 ${type}`);
    else for (const [combo, value] of Object.entries(values)) {
      const expected = expectedLegacyValue(name, combo, value);
      if (got.values[combo] !== expected) problems.push(`${name} @ ${combo}: ${JSON.stringify(got.values[combo])}，應為 ${JSON.stringify(expected)}`);
    }
  }
  return problems;
}

test('generated design-file data keeps the 48 legacy variables with the same type and 12 values each, neutral roles at the PR-STYLE-48 values', async () => {
  const { status, stderr, data } = await generateDesign();
  expect(stderr).toBe('');
  expect(status).toBe(0);
  expect(await legacyProblems(data!)).toEqual([]);
});

test('pointing the sharp metric-background at another neutral fails the legacy comparison on card-highlight', async () => {
  const { status, data } = await generateDesign(async source => {
    const file = join(source, 'shape/sharp.tokens.json');
    const tokens = await readJson(file);
    tokens['metric-background'].$value = 'var(--surface-subtle)';
    await writeFile(file, JSON.stringify(tokens));
  });
  expect(status).toBe(0);
  const problems = await legacyProblems(data!);
  expect(problems.filter(problem => problem.startsWith('card-highlight @ '))).not.toEqual([]);
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
    expect(runGenerator(workspace.root, 'src', 'out', ['--variables', 'design.json']).status).toBe(0);
    const css = await readText(join(workspace.out, 'tokens.css'));
    const cssNames = new Set([...css.matchAll(/--([a-z0-9-]+):/g)].map(match => match[1]));
    const data = await readJson(join(workspace.root, 'design.json')) as DesignData;
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
  const { data } = await generateDesign();
  const value = (name: string, combo = 'Light/Vibrant/Desktop') => data!.variables.find(variable => variable.name === name)?.values[combo];
  expect(value('control-height')).toBe(48);
  expect(value('font-body')).toBe('Inter');
  expect(value('type-hero-weight')).toBe(700);
  expect(value('type-hero-line-height')).toBe(1.2);
  expect(value('type-control-size', 'Dark/Professional/Mobile')).toBe(16);
});

test('a value changed in the DTCG source changes the design-file data for that combination only', async () => {
  const { data } = await generateDesign(async source => {
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

test('design-file-only variables stay out of tokens.css and tokens.json, and nothing is written without --variables', async () => {
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
  const result = await generateDesign(async source => {
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
  const result = await generateDesign(async source => {
    const file = join(source, 'base.tokens.json');
    const tokens = await readJson(file);
    tokens['popup-shadow'] = { $value: '0 4px 16px #00000014', $type: 'shadow', $description: '測試用' };
    await writeFile(file, JSON.stringify(tokens));
  });
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('popup-shadow');
});

test('two tokens claiming the same design-file name fail the build naming both', async () => {
  const result = await generateDesign(async source => {
    const file = join(source, 'base.tokens.json');
    const tokens = await readJson(file);
    tokens['space-1'].$extensions = { 'luca-style': { designName: 'space-2' } };
    await writeFile(file, JSON.stringify(tokens));
  });
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('space-1');
  expect(result.stderr).toContain('space-2');
});

test('no design-file variable varies by both mode and device, which a Penpot theme group cannot model', async () => {
  const { data } = await generateDesign();
  const both = data!.variables.filter(({ values }) => {
    const byMode = data!.axes.suite.some(suite => data!.axes.device.some(device =>
      new Set(data!.axes.mode.map(mode => JSON.stringify(values[`${mode}/${suite}/${device}`]))).size > 1));
    const byDevice = data!.axes.suite.some(suite => data!.axes.mode.some(mode =>
      new Set(data!.axes.device.map(device => JSON.stringify(values[`${mode}/${suite}/${device}`]))).size > 1));
    return byMode && byDevice;
  });
  expect(both.map(variable => variable.name)).toEqual([]);
});

// ISSUE-004：設計檔的集合與模式由產生器決定（一個節點在每個集合只持有一個模式；Penpot 的 theme 同一群組也只啟用一個組合）。
// ISSUE-015：依套系或明暗變化的變數全放進 4 個模式的「Suite x Mode」集合，切換套系與明暗只設這一個集合。
test('every design-file variable that varies by suite or mode is in Suite x Mode, so one collection switches both', async () => {
  const { data } = await generateDesign();
  expect(data!.collections).toEqual([
    { name: 'Base', axes: [], modes: ['Default'] },
    { name: 'Device', axes: ['device'], modes: ['Desktop', 'Tablet', 'Mobile'] },
    { name: 'Suite x Mode', axes: ['suite', 'mode'], modes: ['Vibrant / Light', 'Vibrant / Dark', 'Professional / Light', 'Professional / Dark'] },
  ]);
  const placed = (name: string) => data!.variables.find(variable => variable.name === name)?.collection;
  expect(placed('font-zh')).toBe('Base');
  expect(placed('fs-hero')).toBe('Device');
  for (const name of ['radius-card', 'bg', 'text', 'accent-ink', 'accent', 'accent-hover', 'accent-pressed', 'focus-ring', 'success', 'card-highlight']) expect(placed(name)).toBe('Suite x Mode');
  expect(data!.variables.filter(variable => !variable.collection).map(variable => variable.name)).toEqual([]);
  const counts = Object.fromEntries(data!.collections!.map(({ name }) => [name, data!.variables.filter(variable => variable.collection === name).length]));
  expect(counts).toEqual({ Base: 39, Device: 3, 'Suite x Mode': 30 });
});

test('the committed docs/mockup/themes/variables.json is generated output, identical to a fresh npm run generate', async () => {
  const committed = await readText(fileURLToPath(new URL('../docs/mockup/themes/variables.json', import.meta.url)));
  const workspace = await makeWorkspace();
  try {
    expect(runGenerator(workspace.root, 'src', 'out', ['--variables', 'design.json']).status).toBe(0);
    expect(JSON.parse(committed).$generated).toContain('npm run generate');
    expect(committed).toBe(await readText(join(workspace.root, 'design.json')));
  } finally {
    await workspace.dispose();
  }
});
