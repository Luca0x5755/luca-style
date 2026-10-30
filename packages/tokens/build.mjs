import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import StyleDictionary from 'style-dictionary';
import { deriveAccent } from './accent.js';

// 設計變數產生器：讀 DTCG 分層原始檔，經 Style Dictionary 產生與 0.1.0 相同結構的 css、data、typography。
// 路徑以目前工作目錄解析；npm run build 在套件目錄執行，預設即為 src/ 與 dist/。
// --doc <路徑>：另外寫一份給代理讀的設計變數規格文件（Markdown，PR-STYLE-28）；同樣不放進 --out，公開輸出維持三份。
// --penpot <路徑>：另外寫一份 Penpot 可匯入的 token JSON（ISSUE-018）；同樣不放進 --out。
// --variables <路徑>：另外寫一份設計檔變數資料（variables.json；Penpot token JSON 與 npm run check:penpot 都以它為基準）；
//   不放進 --out，因為 dist 會發布到 npm，且公開輸出只有三份。
const { values: args } = parseArgs({ options: {
  source: { type: 'string', default: 'src' }, out: { type: 'string', default: 'dist' }, variables: { type: 'string' }, penpot: { type: 'string' }, doc: { type: 'string' },
} });
const source = resolve(args.source);
const out = resolve(args.out);
const designPath = args.variables && resolve(args.variables);
const docPath = args.doc && resolve(args.doc);
const penpotPath = args.penpot && resolve(args.penpot);

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
// 名稱：$extensions["luca-style"].designName（字體角色字級為群組上的 designSizeName）有給就用設計檔名稱，否則沿用 CSS 變數名。
// 任何無法轉換的值都讓建置失敗並指出變數，不寫任何輸出。
const designAxes = { mode: ['Light', 'Dark'], suite: ['Vibrant', 'Professional'], device: ['Desktop', 'Tablet', 'Mobile'] };
const title = word => word[0].toUpperCase() + word.slice(1);
const designProblems = [];
const firstFamily = stack => stack.split(',')[0].trim().replace(/^['"]|['"]$/g, '');

// 單一值轉成設計檔的型別與值；raw 是同一組合的「CSS 變數名 → 原始值」，用來解析 var(--x)。
function toDesign(token, raw, seen = []) {
  const name = nameOf(token);
  const fail = reason => (designProblems.push(`無法轉成設計檔變數：${name}（${reason}）`), undefined);
  const value = token.$value;
  const reference = typeof value === 'string' && value.match(/^var\(--([a-z0-9-]+)\)$/);
  if (reference) {
    const target = raw.get(reference[1]);
    if (!target || seen.includes(reference[1])) return fail(`參照 ${value} 無法解析`);
    return toDesign(target, raw, [...seen, name]);
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

const designVariables = new Map();
// 每個設計檔名稱只能由一個原始變數佔用；第二個佔用者會默默蓋掉前者的值，所以直接失敗。
const claimedBy = new Map();
const setDesign = (name, combo, converted, origin) => {
  const owner = claimedBy.get(name) ?? origin;
  claimedBy.set(name, owner);
  if (owner !== origin) designProblems.push(`無法轉成設計檔變數：${origin} 與 ${owner} 都對應到設計檔名稱 ${name}`);
  if (!converted || owner !== origin) return;
  const variable = designVariables.get(name) ?? { name, type: converted.type, values: {} };
  if (variable.type !== converted.type) designProblems.push(`無法轉成設計檔變數：${name}（各組合的型別不一致）`);
  variable.values[combo] = converted.value;
  designVariables.set(name, variable);
};
for (const { suite, mode, allTokens } of themes) {
  const raw = new Map(allTokens.map(token => [nameOf(token), token]));
  for (const token of allTokens) {
    const converted = toDesign(token, raw);
    for (const device of designAxes.device) setDesign(ours(token).designName ?? nameOf(token), `${title(mode)}/${title(suite)}/${device}`, converted, nameOf(token));
  }
}
const typographySource = JSON.parse(await readFile(join(source, 'typography.tokens.json'), 'utf8'));
const { allTokens: typographyTokens } = await typographyDictionary.getPlatformTokens('data');
// 字體角色欄位：裝置字級合成一個依裝置變化的變數，字重與行高各為不分裝置的變數。
const devices = { desktop: 'Desktop', tablet: 'Tablet', mobile: 'Mobile' };
const fixedSuffix = { weight: 'weight', lineHeight: 'line-height' };
for (const token of typographyTokens) {
  const [role, field] = token.path;
  const name = devices[field] ? ours(typographySource[role]).designSizeName ?? `type-${role}-size`
    : fixedSuffix[field] && `type-${role}-${fixedSuffix[field]}`;
  if (!name) { designProblems.push(`無法轉成設計檔變數：${role}.${field}（不認得的字體角色欄位）`); continue; }
  const converted = toDesign({ ...token, path: [name] }, new Map());
  for (const mode of designAxes.mode) for (const suite of designAxes.suite) for (const device of designAxes.device) {
    if (!devices[field] || devices[field] === device) setDesign(name, `${mode}/${suite}/${device}`, converted, `${role}.${devices[field] ? 'size' : field}`);
  }
}
// 設計檔的集合與模式：Penpot 的 token theme 在同一個群組內一次只啟用一個，所以一個集合的模式只對應一組軸。
// 變數放進第一個涵蓋它「實際變化的軸」的集合：只依套系、只依明暗或兩者都依的，都放進模式為「套系 / 明暗」
// 四種組合的 Suite x Mode，切換套系與明暗只設這一個集合（ISSUE-015）；不用別名拆集合，因匯出不解別名（ISSUE-004）。
// 其他跨軸組合（例如明暗加裝置）無法建模，直接失敗。
const designKey = (mode, suite, device) => `${mode}/${suite}/${device}`;
// 順序有意義：find 取第一個涵蓋的集合，所以軸少的在前（Base 必須第一個，否則常數會落進別的集合）。
const designCollections = [
  { name: 'Base', axes: [], modes: ['Default'] },
  { name: 'Device', axes: ['device'], modes: designAxes.device },
  { name: 'Suite x Mode', axes: ['suite', 'mode'], modes: designAxes.suite.flatMap(suite => designAxes.mode.map(mode => `${suite} / ${mode}`)) },
];
// 某一軸上是否變化：固定其他兩軸的任一組合，換這一軸的值就得到不同的值。
const variesOn = (variable, axis) => {
  const others = Object.keys(designAxes).filter(other => other !== axis);
  return designAxes[others[0]].some(x => designAxes[others[1]].some(y =>
    new Set(designAxes[axis].map(value => {
      const pick = { [others[0]]: x, [others[1]]: y, [axis]: value };
      return JSON.stringify(variable.values[designKey(pick.mode, pick.suite, pick.device)]);
    })).size > 1));
};
for (const variable of designVariables.values()) {
  const varying = Object.keys(designAxes).filter(axis => variesOn(variable, axis));
  const target = designCollections.find(collection => varying.every(axis => collection.axes.includes(axis)));
  if (!target) designProblems.push(`無法轉成設計檔變數：${variable.name}（同時依 ${varying.join('、')} 變化，沒有對應的集合）`);
  else variable.collection = target.name;
}
if (designProblems.length) {
  console.error([...new Set(designProblems)].join('\n'));
  process.exit(1);
}
const designData = {
  $generated: '由 npm run generate 自 packages/tokens/src 的 DTCG 原始檔產生，勿手改；改值請改原始檔後重跑；Penpot 設計檔以 npm run check:penpot 檢查。',
  axes: designAxes,
  collections: designCollections,
  count: designVariables.size,
  variables: [...designVariables.values()],
};

// 第五之二步：Penpot 可匯入的 token JSON（ISSUE-018、PR-FILE-25）。取自上面已解析的 designVariables，不另算值。
// 結構：Base 一個共用 set；Suite x Mode 群組 4 個 set、Device 群組 3 個 set，各群組每個 theme 只啟用一個 set，
// 兩個群組各啟用一個即可同時切套系明暗與裝置。Penpot 沒有布林與一般字串型別，suite-label 不輸出；elevation-enabled 改以 shadow token metric-shadow 輸出。
const penpotTypeOf = variable => {
  const { name, type } = variable;
  if (type === 'color') return 'color';
  if (type === 'string') return name.startsWith('font-') ? 'fontFamilies' : undefined;
  if (type !== 'number') return undefined;
  if (name.startsWith('radius-')) return 'borderRadius';
  if (name === 'border-width') return 'borderWidth';
  if (name.startsWith('fs-') || /^type-.+-size$/.test(name)) return 'fontSizes';
  if (/^type-.+-weight$/.test(name)) return 'fontWeights';
  if (/^loading-.+-opacity$/.test(name)) return 'opacity';
  if (/^space-/.test(name) || ['card-padding', 'gap-section'].includes(name) || name.startsWith('table-cell-padding-')) return 'spacing';
  return 'number';
};
// 不透明度在設計檔以 0 到 100 的數字存放，Penpot 只收 0 到 1 或帶 % 的值，所以加 %。
const penpotValueOf = (variable, combo) => {
  const value = variable.values[combo];
  if (variable.type === 'color' || variable.type === 'string') return value;
  return penpotTypeOf(variable) === 'opacity' ? `${value}%` : String(value);
};
const penpotSet = (collection, combo) => Object.fromEntries([...designVariables.values()]
  .filter(variable => variable.collection === collection && penpotTypeOf(variable))
  .map(variable => [variable.name, { $value: penpotValueOf(variable, combo), $type: penpotTypeOf(variable) }]));
// 陰影開關：Penpot 沒有布林，elevation-enabled 以 shadow token 表示（ISSUE-024、PR-FILE-33）。
// 開為 DTCG 原陰影值；關（none）為零偏移、零模糊、透明度 0 的陰影。值取自該套系與明暗已解析的 metric-shadow。
const penpotShadowOf = (suite, mode) => {
  const css = themes.find(theme => title(theme.suite) === suite && title(theme.mode) === mode).allTokens.find(token => nameOf(token) === 'metric-shadow').$value;
  if (css === 'none') return { color: '#00000000', offsetX: '0', offsetY: '0', blur: '0', spread: '0', inset: false };
  const match = String(css).match(/^(-?[\d.]+)(?:px)?\s+(-?[\d.]+)(?:px)?\s+(-?[\d.]+)(?:px)?\s+(?:(-?[\d.]+)(?:px)?\s+)?(#[0-9A-Fa-f]{6}(?:[0-9A-Fa-f]{2})?)$/);
  if (!match) { console.error(`無法轉成 Penpot shadow token：metric-shadow（${css} 不是「x y 模糊 [擴散] #色碼」）`); process.exit(1); }
  return { color: match[5].toUpperCase(), offsetX: match[1], offsetY: match[2], blur: match[3], spread: match[4] ?? '0', inset: false };
};
const penpotData = { Base: penpotSet('Base', 'Light/Vibrant/Desktop') };
const penpotThemes = [];
const penpotOrder = ['Base'];
const addPenpotTheme = (group, name, setName, set) => {
  penpotData[setName] = set;
  penpotOrder.push(setName);
  penpotThemes.push({ id: `${group}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, group, selectedTokenSets: { Base: 'enabled', [setName]: 'enabled' } });
};
for (const suite of designAxes.suite) for (const mode of designAxes.mode) {
  addPenpotTheme('Suite x Mode', `${suite} / ${mode}`, `Suite x Mode/${suite}-${mode}`,
    { ...penpotSet('Suite x Mode', `${mode}/${suite}/Desktop`), 'metric-shadow': { $value: penpotShadowOf(suite, mode), $type: 'shadow' } });
}
for (const device of designAxes.device) addPenpotTheme('Device', device, `Device/${device}`, penpotSet('Device', `Light/Vibrant/${device}`));
const penpotFile = { ...penpotData, $themes: penpotThemes, $metadata: { tokenSetOrder: penpotOrder } };

// 第六步：給代理讀的設計變數規格文件。內容全部取自上面已解析（含推算）的 allTokens 與 typography，不另存手寫的值。
// 列的順序固定（依第一個組合的宣告順序），結尾一個換行，重跑產生器才會與已提交的檔案逐字相同。
const escapeCell = value => String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const code = value => `\`${escapeCell(value)}\``;
const table = (headers, rows) => [`| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`, ...rows.map(row => `| ${row.join(' | ')} |`)].join('\n');
const valueMap = allTokens => new Map(published(allTokens).map(token => [nameOf(token), token]));
// 一個軸（密度或外形）的表：變數順序取第一個等級檔，每個等級一欄。
const levelTable = levels => {
  const maps = levels.map(level => valueMap(level.allTokens));
  return table(['變數', '用途', ...levels.map(level => level.label)],
    [...maps[0].values()].map(token => [code(nameOf(token)), escapeCell(token.$description), ...maps.map(map => code(map.get(nameOf(token)).$value))]));
};
const themeMaps = themes.map(theme => valueMap(theme.allTokens));
const defaultsOf = axis => suites.map(suite => `${suite} 為 ${suiteDefaults[suite][axis]}`).join('、');
const docText = [
  '# 設計變數規格',
  '',
  '> 由 `npm run generate` 自 `packages/tokens/src` 的 DTCG 原始檔產生，勿手改；要改值或用途請改原始檔後重跑。',
  '',
  '變數名即 CSS 自訂屬性名（加 `--`），也是 `@luca-style/tokens/data` 的鍵；值與 `@luca-style/tokens/css`、`@luca-style/tokens/data` 相同。滑過、按下與焦點框由主色推算。',
  '',
  '## 設計變數',
  '',
  table(['變數', '用途', ...themes.map(({ suite, mode }) => `${suite} / ${mode}`)],
    [...themeMaps[0].values()].map(token => [code(nameOf(token)), escapeCell(token.$description), ...themeMaps.map(map => code(map.get(nameOf(token)).$value))])),
  '',
  '## 資訊密度',
  '',
  `各風格套系的預設等級：${defaultsOf('density')}。套系區塊已含預設等級的值；專案以 \`density\` 覆寫，覆寫只改下表的變數。`,
  '',
  levelTable(axes[0].levels),
  '',
  '## 元件外形',
  '',
  `各風格套系的預設等級：${defaultsOf('shape')}。專案以 \`shape\` 覆寫，覆寫只改下表的變數。`,
  '',
  levelTable(axes[1].levels),
  '',
  '## 字體角色',
  '',
  '不分風格套系與明暗。CSS 變數為 `--type-<角色>-size`、`--type-<角色>-weight`、`--type-<角色>-line-height`；字級依裝置寬度切換（平板 600px 起、桌面 1024px 起）。',
  '',
  table(['角色', '手機', '平板', '桌面', '字重', '行高'],
    Object.entries(typography).map(([role, fields]) => [code(role), ...['mobile', 'tablet', 'desktop', 'weight', 'lineHeight'].map(field => code(fields[field]))])),
  '',
].join('\n');

await mkdir(out, { recursive: true });
await Promise.all([
  writeFile(join(out, 'css.d.ts'), 'export {};\n'),
  writeFile(join(out, 'typography.json'), JSON.stringify(typography, null, 2) + '\n'),
  writeFile(join(out, 'tokens.json'), JSON.stringify(data, null, 2) + '\n'),
  writeFile(join(out, 'tokens.css'), css.join('\n') + '\n'),
]);
if (docPath) {
  await mkdir(dirname(docPath), { recursive: true });
  await writeFile(docPath, docText);
}
if (designPath) {
  await mkdir(dirname(designPath), { recursive: true });
  await writeFile(designPath, JSON.stringify(designData, null, 1) + '\n');
}
if (penpotPath) {
  await mkdir(dirname(penpotPath), { recursive: true });
  await writeFile(penpotPath, JSON.stringify(penpotFile, null, 1) + '\n');
}
