import { test, expect } from '@playwright/test';
import { join } from 'node:path';
import { buildWithout, makeWorkspace, readText, runGenerator } from './tokens-helpers';

// PR-STYLE-29～31：資訊密度與元件外形的等級區塊。期望值抄自前端規格 §5.4.1、§5.4.2 的表（px），不由原始檔推算。

const px = (value: string) => {
  const match = value.match(/^(-?\d*\.?\d+)(rem|px)$/);
  return match ? `${Number(match[1]) * (match[2] === 'rem' ? 16 : 1)}px` : value;
};

// §5.4.1：控制項高度、容器內距、區塊間距、表格儲存格內距（上下／左右）。
const densityTable = {
  vibrant: { compact: [40, 16, 24, 8, 8], standard: [48, 24, 32, 12, 8], comfortable: [56, 32, 48, 16, 12] },
  professional: { compact: [40, 12, 16, 6, 8], standard: [48, 20, 24, 12, 8], comfortable: [52, 24, 32, 14, 10] },
} as const;
const densityNames = ['control-height', 'card-padding', 'gap-section', 'table-cell-padding-block', 'table-cell-padding-inline'];

// §5.4.2（指標卡左邊界顏色依 2026-10-28 決定維持邊界色，不是變數）。
const shapeTable = {
  rounded: { 'radius-card': '20px', 'radius-control': '16px', 'border-width': '1px', 'metric-border-left': '1px', 'metric-background': 'var(--accent-soft)', 'metric-shadow': '0 4px 16px #00000008' },
  sharp: { 'radius-card': '3px', 'radius-control': '3px', 'border-width': '1.5px', 'metric-border-left': '3px', 'metric-background': 'var(--surface)', 'metric-shadow': 'none' },
} as const;
const shapeNames = Object.keys(shapeTable.rounded);
const suiteDefaults = { vibrant: { density: 'standard', shape: 'rounded' }, professional: { density: 'standard', shape: 'sharp' } } as const;

// 取出 tokens.css 中選擇器完全相同的區塊，回傳「變數名 → 值」。
function block(css: string, selector: string) {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) return undefined;
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  return Object.fromEntries([...body.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)].map(match => [match[1], match[2].trim()]));
}
const themeSelector = (suite: string, mode: string) =>
  `${suite === 'vibrant' && mode === 'light' ? ':root, ' : ''}[data-luca-theme][data-suite="${suite}"][data-mode="${mode}"]`;
const densitySelector = (suite: string, level: string) => `[data-luca-theme][data-suite="${suite}"][data-density="${level}"]`;
const shapeSelector = (level: string) => `[data-luca-theme][data-suite][data-shape="${level}"]`;

let css: string;
test.beforeAll(async () => {
  const workspace = await makeWorkspace();
  try {
    const result = runGenerator(workspace.root);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    css = await readText(join(workspace.out, 'tokens.css'));
  } finally {
    await workspace.dispose();
  }
});

test('each suite has a density block per level holding only density variables with the §5.4.1 values', () => {
  for (const [suite, levels] of Object.entries(densityTable)) {
    for (const [level, values] of Object.entries(levels)) {
      const found = block(css, densitySelector(suite, level));
      expect(found, `${suite}/${level}`).toBeDefined();
      expect(Object.keys(found!).sort(), `${suite}/${level}`).toEqual([...densityNames].sort());
      expect(densityNames.map(name => px(found![name])), `${suite}/${level}`).toEqual((values as readonly number[]).map(value => `${value}px`));
    }
  }
});

test('each shape level has one block for both suites holding only shape variables with the §5.4.2 values', () => {
  for (const [level, values] of Object.entries(shapeTable)) {
    const found = block(css, shapeSelector(level));
    expect(found, level).toBeDefined();
    expect(Object.keys(found!).sort(), level).toEqual([...shapeNames].sort());
    expect(Object.fromEntries(Object.entries(found!).map(([name, value]) => [name, px(value)])), level).toEqual(values);
  }
});

test('density and shape own disjoint variables and level blocks come after every suite block', () => {
  expect(densityNames.filter(name => shapeNames.includes(name))).toEqual([]);
  const lastTheme = Math.max(...['vibrant', 'professional'].flatMap(suite => ['light', 'dark'].map(mode => css.indexOf(`${themeSelector(suite, mode)} {`))));
  for (const selector of [...Object.keys(densityTable).flatMap(suite => Object.keys(densityTable.vibrant).map(level => densitySelector(suite, level))), ...Object.keys(shapeTable).map(shapeSelector)]) {
    expect(css.indexOf(`${selector} {`), selector).toBeGreaterThan(lastTheme);
  }
});

test('without an override each suite block carries its default density and shape levels', () => {
  for (const [suite, defaults] of Object.entries(suiteDefaults)) {
    for (const mode of ['light', 'dark']) {
      const theme = block(css, themeSelector(suite, mode))!;
      const pick = (names: string[]) => Object.fromEntries(names.map(name => [name, theme[name]]));
      expect(pick(densityNames), `${suite}/${mode}`).toEqual(block(css, densitySelector(suite, defaults.density)));
      expect(pick(shapeNames), `${suite}/${mode}`).toEqual(block(css, shapeSelector(defaults.shape)));
    }
  }
});

// 非預設等級檔不在任何套系組合的疊層裡，只有等級完整性檢查會抓到；外形兩個等級都是某套系的預設，故只測密度。
for (const [file, name, label] of [
  ['density/professional/comfortable.tokens.json', 'table-cell-padding-inline', 'density professional/comfortable'],
  ['density/vibrant/compact.tokens.json', 'gap-section', 'density vibrant/compact'],
] as const) {
  test(`a variable missing from the non-default level ${label} fails the build naming it`, async () => {
    const result = await buildWithout(file, tokens => { delete tokens[name]; });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(`${name}（${label}）`);
    expect(result.outputs).not.toContain('out');
  });
}
