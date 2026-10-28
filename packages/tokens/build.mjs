import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import StyleDictionary from 'style-dictionary';
import { deriveAccent } from './accent.js';

// 設計變數產生器：讀 DTCG 分層原始檔，經 Style Dictionary 產生與 0.1.0 相同結構的 css、data、typography。
// 路徑以目前工作目錄解析；npm run build 在套件目錄執行，預設即為 src/ 與 dist/。
// --fig <路徑>：另外寫一份設計檔變數資料（scripts/design/apply-variables.js 讀它寫入套系設計檔）；
//   不放進 --out，因為 dist 會發布到 npm，且公開輸出只有三份。
const { values: args } = parseArgs({ options: {
  source: { type: 'string', default: 'src' }, out: { type: 'string', default: 'dist' }, fig: { type: 'string' },
} });
const source = resolve(args.source);
const out = resolve(args.out);
const figPath = args.fig && resolve(args.fig);

// 套系與明暗的順序決定 CSS 區塊順序；第一個組合同時是 :root 的預設主題。
const suites = ['vibrant', 'professional'];
const modes = ['light', 'dark'];

// 資訊密度與元件外形的具名等級（ADR 0005）。密度數值依套系各一組，外形數值不分套系。
// 套系只決定預設等級；預設等級檔疊進套系區塊，所以未覆寫時的值只有一份來源（PR-STYLE-29）。
const densityLevels = ['compact', 'standard', 'comfortable'];
const shapeLevels = ['rounded', 'sharp'];
const suiteDefaults = { vibrant: { density: 'standard', shape: 'rounded' }, professional: { density: 'standard', shape: 'sharp' } };
const densityFile = (suite, level) => `density/${suite}/${level}.tokens.json`;
const shapeFile = level => `shape/${level}.tokens.json`;

// 每個組合依序疊加的分層檔；密度與外形放在套系共用層之後、套系明暗層之前。
const layersOf = (suite, mode) => [
  ...['base', `mode/${mode}`, `suite/${suite}/common`].map(layer => `${layer}.tokens.json`),
  densityFile(suite, suiteDefaults[suite].density), shapeFile(suiteDefaults[suite].shape),
  `suite/${suite}/${mode}.tokens.json`,
];

const toGlob = path => path.replace(/\\/g, '/');
const declarations = entries => entries.map(([name, value]) => `  --${name}: ${value};`).join('\n');
const nameOf = token => token.path.join('-');
const ours = node => node.$extensions?.['luca-style'] ?? {};
// 只給設計檔用的變數（designFileOnly）不進 css 與 data，公開輸出維持原形狀（ADR 0004）。
const published = tokens => tokens.filter(token => !ours(token).designFileOnly);

// 自訂 format 一律輸出原始值，不經任何會改寫值的 transform；變數名直接取路徑，
// 不用內建 css/variables、json/flat 與 name transform，以免改寫 0.1.0 的名稱與值。
// 一個 CSS 區塊：選擇器加上公開變數的宣告；extra 是接在變數之後的其他宣告（例如 color-scheme）。
const cssBlock = (selector, allTokens, extra = '') =>
  `${selector} {\n${declarations(published(allTokens).map(token => [nameOf(token), token.$value]))}${extra}\n}`;
const formats = {
  'luca/css-theme': ({ dictionary, options }) => cssBlock(options.selector, dictionary.allTokens, `\n  color-scheme: ${options.mode};`),
  'luca/json-theme': ({ dictionary }) => Object.fromEntries(published(dictionary.allTokens).map(token => [nameOf(token), token.$value])),
  'luca/typography-json': ({ dictionary }) => {
    const roles = {};
    for (const token of dictionary.allTokens) {
      const [role, field] = token.path;
      roles[role] ??= {};
      roles[role][field] = token.$value;
    }
    return roles;
  },
};

const createDictionary = (files, platforms) => new StyleDictionary({
  source: files.map(file => toGlob(join(source, file))),
  usesDtcg: true,
  // 參照斷掉（例如某組合缺 accent）時不在解析階段拋錯，交給下面的完整性檢查指出缺的變數與組合。
  log: { verbosity: 'silent', warnings: 'disabled', errors: { brokenReferences: 'console' } },
  hooks: { formats },
  platforms,
});

const formatOne = async (dictionary, platform) => (await dictionary.formatPlatform(platform))[0].output;

// 收集分層檔中宣告的變數（沒有子群組的節點），不論有沒有 $value。
async function declaredNames(file) {
  let text;
  try {
    text = await readFile(join(source, file), 'utf8');
  } catch (error) {
    // 分層檔整份不見時直接失敗，否則該層所有變數會從每個組合一起消失而查不出缺值。
    if (error.code === 'ENOENT') throw new Error(`缺少設計變數分層檔：${file}`, { cause: error });
    throw error;
  }
  const tree = JSON.parse(text);
  const names = [];
  const walk = (node, path) => {
    const children = Object.keys(node).filter(key => !key.startsWith('$'));
    if (children.length === 0) names.push(path.join('-'));
    for (const key of children) walk(node[key], [...path, key]);
  };
  for (const key of Object.keys(tree).filter(key => !key.startsWith('$'))) walk(tree[key], [key]);
  return names;
}

// 第一步：每個組合解析一次，記下有值的變數；所有組合宣告過的變數聯集是每個組合都必須有值的清單。
const expected = new Set();
const themes = [];
for (const suite of suites) {
  for (const mode of modes) {
    const isDefault = suite === suites[0] && mode === modes[0];
    const selector = `${isDefault ? ':root, ' : ''}[data-luca-theme][data-suite="${suite}"][data-mode="${mode}"]`;
    const dictionary = createDictionary(layersOf(suite, mode), { css: {} });
    const { allTokens } = await dictionary.getPlatformTokens('css');
    for (const file of layersOf(suite, mode)) for (const name of await declaredNames(file)) expected.add(name);
    themes.push({ suite, mode, selector, allTokens, valued: new Set(allTokens.map(nameOf)) });
  }
}

// 第二步：完整性檢查。任一組合缺值就列出變數名與組合並讓建置失敗，不寫任何輸出。
const missing = themes.flatMap(({ suite, mode, valued }) =>
  [...expected].filter(name => !valued.has(name)).map(name => `缺少設計變數的值：${name}（${suite}/${mode}）`));
// 等級完整性：同一軸的每個等級檔都必須對該軸所有變數（各等級檔宣告的聯集）給值，
// 否則覆寫成那個等級時會默默沿用套系預設值，看起來像覆寫沒生效。
const axes = [
  { axis: 'density', levels: suites.flatMap(suite => densityLevels.map(level => ({ label: `${suite}/${level}`, file: densityFile(suite, level), suite, level }))) },
  { axis: 'shape', levels: shapeLevels.map(level => ({ label: level, file: shapeFile(level), level })) },
];
for (const entry of axes) {
  const names = new Set();
  for (const level of entry.levels) {
    const { allTokens } = await createDictionary([level.file], { css: {} }).getPlatformTokens('css');
    level.allTokens = allTokens;
    for (const name of await declaredNames(level.file)) names.add(name);
  }
  entry.names = names;
  for (const level of entry.levels) {
    const valued = new Set(level.allTokens.map(nameOf));
    for (const name of names) if (!valued.has(name)) missing.push(`缺少設計變數的值：${name}（${entry.axis} ${level.label}）`);
  }
}
if (missing.length) {
  console.error(missing.join('\n'));
  process.exit(1);
}

// 第三步：推算角色。標了 derive 的變數（滑過、按下、焦點框）以 accent.js 的 deriveAccent 改寫值，
// 輸入是同一套系兩種明暗的人工主色與該組合的中性色；與 ThemeProvider 推算專案強調色是同一份函式（PR-STYLE-32、45）。
const valueIn = (allTokens, name) => allTokens.find(token => nameOf(token) === name)?.$value;
for (const { suite, mode, allTokens } of themes) {
  const accentOf = other => valueIn(themes.find(theme => theme.suite === suite && theme.mode === other).allTokens, 'accent');
  const neutrals = Object.fromEntries(['bg', 'surface', 'surface-subtle', 'text', 'muted', 'accent-ink'].map(name => [name, valueIn(allTokens, name)]));
  const roles = deriveAccent({ light: accentOf('light'), dark: accentOf('dark') }, mode, neutrals);
  for (const token of allTokens) {
    const role = ours(token).derive;
    if (!role) continue;
    // derive 寫錯時直接失敗，否則 undefined 會被寫進輸出。
    if (!(role in roles)) { console.error(`不認得的推算角色：${nameOf(token)} 的 derive 為 ${role}`); process.exit(1); }
    token.$value = roles[role];
  }
}

// 第四步：輸出。data 以「套系 → 明暗 → 變數」三層索引。format 直接吃已改寫的 allTokens。
const css = [];
const data = {};
for (const { suite, mode, selector, allTokens } of themes) {
  css.push(formats['luca/css-theme']({ dictionary: { allTokens }, options: { mode, selector } }));
  (data[suite] ??= {})[mode] = formats['luca/json-theme']({ dictionary: { allTokens } });
}
// 等級區塊：只含該軸的變數，接在套系區塊之後。屬性與套系屬性在同一元素（target self 為外層 div、document 為 <html>）。
// 特異度須與套系區塊同為 (0,3,0) 才能靠順序勝出，所以外形選擇器也帶 [data-suite]。
// 等級區塊不進 data 與設計檔：data 的套系、明暗兩層鍵固定（0.1.0 快照），設計檔的密度、外形模式不在 ISSUE-008。
for (const { suite, level, allTokens } of axes[0].levels) css.push(cssBlock(`[data-luca-theme][data-suite="${suite}"][data-density="${level}"]`, allTokens));
for (const { level, allTokens } of axes[1].levels) css.push(cssBlock(`[data-luca-theme][data-suite][data-shape="${level}"]`, allTokens));

const typographyDictionary = createDictionary(['typography.tokens.json'], {
  data: { files: [{ destination: 'typography.json', format: 'luca/typography-json' }] },
});
const typography = await formatOne(typographyDictionary, 'data');

// 字體角色變數不分套系與明暗，依裝置寬度切換字級。
const roleVariables = device => Object.entries(typography).flatMap(([name, role]) => [
  [`type-${name}-size`, role[device]], [`type-${name}-weight`, role.weight], [`type-${name}-line-height`, role.lineHeight],
]);
css.push(`:root, [data-luca-theme] {\n${declarations(roleVariables('mobile'))}\n}`);
css.push(`@media(min-width:600px) { :root, [data-luca-theme] {\n${declarations(roleVariables('tablet'))}\n} }`);
css.push(`@media(min-width:1024px) { :root, [data-luca-theme] {\n${declarations(roleVariables('desktop'))}\n} }`);

// 第五步：設計檔變數資料。程式變數與設計檔變數的聯集，以設計檔的軸（mode × suite × device）展開成 12 個組合。
// 名稱：$extensions["luca-style"].figName（字體角色字級為群組上的 figSizeName）有給就用設計檔名稱，否則沿用 CSS 變數名。
// 任何無法轉換的值都讓建置失敗並指出變數，不寫任何輸出。
const figAxes = { mode: ['Light', 'Dark'], suite: ['Vibrant', 'Professional'], device: ['Desktop', 'Tablet', 'Mobile'] };
const title = word => word[0].toUpperCase() + word.slice(1);
const figProblems = [];
const firstFamily = stack => stack.split(',')[0].trim().replace(/^['"]|['"]$/g, '');

// 單一值轉成設計檔的型別與值；raw 是同一組合的「CSS 變數名 → 原始值」，用來解析 var(--x)。
function toFig(token, raw, seen = []) {
  const name = nameOf(token);
  const fail = reason => (figProblems.push(`無法轉成設計檔變數：${name}（${reason}）`), undefined);
  const value = token.$value;
  const reference = typeof value === 'string' && value.match(/^var\(--([a-z0-9-]+)\)$/);
  if (reference) {
    const target = raw.get(reference[1]);
    if (!target || seen.includes(reference[1])) return fail(`參照 ${value} 無法解析`);
    return toFig(target, raw, [...seen, name]);
  }
  switch (token.$type) {
    case 'color':
      return /^#[0-9A-Fa-f]{6}$/.test(value) ? { type: 'color', value: value.toUpperCase() } : fail(`顏色 ${value} 不是 #RRGGBB`);
    case 'dimension': {
      const match = String(value).match(/^(-?\d*\.?\d+)(rem|px)$/);
      return match ? { type: 'number', value: Number(match[1]) * (match[2] === 'rem' ? 16 : 1) } : fail(`尺寸 ${value} 不是 rem 或 px`);
    }
    case 'duration': {
      const match = String(value).match(/^(\d*\.?\d+)ms$/);
      return match ? { type: 'number', value: Number(match[1]) } : fail(`時長 ${value} 不是 ms`);
    }
    case 'number':
    case 'fontWeight':
      return typeof value === 'number' ? { type: 'number', value } : fail(`${value} 不是數字`);
    case 'fontFamily':
      return { type: 'string', value: firstFamily(String(value)) };
    case 'string':
      return { type: 'string', value: String(value) };
    case 'shadow':
      // 設計檔沒有陰影變數；只有 metric-shadow 以「有沒有陰影」的布林表示（elevation-enabled），其他陰影一律失敗。
      return name === 'metric-shadow' ? { type: 'boolean', value: value !== 'none' } : fail('只有 metric-shadow 可轉成布林');
    default:
      return fail(`不支援的 $type ${token.$type}`);
  }
}

const figVariables = new Map();
// 每個設計檔名稱只能由一個原始變數佔用；第二個佔用者會默默蓋掉前者的值，所以直接失敗。
const claimedBy = new Map();
const setFig = (name, combo, converted, origin) => {
  const owner = claimedBy.get(name) ?? origin;
  claimedBy.set(name, owner);
  if (owner !== origin) figProblems.push(`無法轉成設計檔變數：${origin} 與 ${owner} 都對應到設計檔名稱 ${name}`);
  if (!converted || owner !== origin) return;
  const variable = figVariables.get(name) ?? { name, type: converted.type, values: {} };
  if (variable.type !== converted.type) figProblems.push(`無法轉成設計檔變數：${name}（各組合的型別不一致）`);
  variable.values[combo] = converted.value;
  figVariables.set(name, variable);
};
for (const { suite, mode, allTokens } of themes) {
  const raw = new Map(allTokens.map(token => [nameOf(token), token]));
  for (const token of allTokens) {
    const converted = toFig(token, raw);
    for (const device of figAxes.device) setFig(ours(token).figName ?? nameOf(token), `${title(mode)}/${title(suite)}/${device}`, converted, nameOf(token));
  }
}
const typographySource = JSON.parse(await readFile(join(source, 'typography.tokens.json'), 'utf8'));
const { allTokens: typographyTokens } = await typographyDictionary.getPlatformTokens('data');
// 字體角色欄位：裝置字級合成一個依裝置變化的變數，字重與行高各為不分裝置的變數。
const devices = { desktop: 'Desktop', tablet: 'Tablet', mobile: 'Mobile' };
const fixedSuffix = { weight: 'weight', lineHeight: 'line-height' };
for (const token of typographyTokens) {
  const [role, field] = token.path;
  const name = devices[field] ? ours(typographySource[role]).figSizeName ?? `type-${role}-size`
    : fixedSuffix[field] && `type-${role}-${fixedSuffix[field]}`;
  if (!name) { figProblems.push(`無法轉成設計檔變數：${role}.${field}（不認得的字體角色欄位）`); continue; }
  const converted = toFig({ ...token, path: [name] }, new Map());
  for (const mode of figAxes.mode) for (const suite of figAxes.suite) for (const device of figAxes.device) {
    if (!devices[field] || devices[field] === device) setFig(name, `${mode}/${suite}/${device}`, converted, `${role}.${devices[field] ? 'size' : field}`);
  }
}
if (figProblems.length) {
  console.error([...new Set(figProblems)].join('\n'));
  process.exit(1);
}
const figData = {
  $generated: '由 npm run generate 自 packages/tokens/src 的 DTCG 原始檔產生，勿手改；改值請改原始檔後重跑，再執行 node scripts/design/apply-variables.js 寫入設計檔。',
  axes: figAxes,
  count: figVariables.size,
  variables: [...figVariables.values()],
};

await mkdir(out, { recursive: true });
await Promise.all([
  writeFile(join(out, 'css.d.ts'), 'export {};\n'),
  writeFile(join(out, 'typography.json'), JSON.stringify(typography, null, 2) + '\n'),
  writeFile(join(out, 'tokens.json'), JSON.stringify(data, null, 2) + '\n'),
  writeFile(join(out, 'tokens.css'), css.join('\n') + '\n'),
]);
if (figPath) {
  await mkdir(dirname(figPath), { recursive: true });
  await writeFile(figPath, JSON.stringify(figData, null, 1) + '\n');
}
