import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import StyleDictionary from 'style-dictionary';

// 設計變數產生器：讀 DTCG 分層原始檔，經 Style Dictionary 產生與 0.1.0 相同結構的 css、data、typography。
// 路徑以目前工作目錄解析；npm run build 在套件目錄執行，預設即為 src/ 與 dist/。
const { values: args } = parseArgs({ options: { source: { type: 'string', default: 'src' }, out: { type: 'string', default: 'dist' } } });
const source = resolve(args.source);
const out = resolve(args.out);

// 套系與明暗的順序決定 CSS 區塊順序；第一個組合同時是 :root 的預設主題。
const suites = ['vibrant', 'professional'];
const modes = ['light', 'dark'];

// 每個組合依序疊加的分層檔，順序與 0.1.0 的合併順序相同。
const layersOf = (suite, mode) => ['base', `mode/${mode}`, `suite/${suite}/common`, `suite/${suite}/${mode}`]
  .map(layer => `${layer}.tokens.json`);

const toGlob = path => path.replace(/\\/g, '/');
const declarations = entries => entries.map(([name, value]) => `  --${name}: ${value};`).join('\n');
const nameOf = token => token.path.join('-');

// 自訂 format 一律輸出原始值，不經任何會改寫值的 transform；變數名直接取路徑，
// 不用內建 css/variables、json/flat 與 name transform，以免改寫 0.1.0 的名稱與值。
const formats = {
  'luca/css-theme': ({ dictionary, options }) =>
    `${options.selector} {\n${declarations(dictionary.allTokens.map(token => [nameOf(token), token.$value]))}\n  color-scheme: ${options.mode};\n}`,
  'luca/json-theme': ({ dictionary }) => Object.fromEntries(dictionary.allTokens.map(token => [nameOf(token), token.$value])),
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
  log: { verbosity: 'silent', warnings: 'disabled' },
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
    const dictionary = createDictionary(layersOf(suite, mode), {
      css: { files: [{ destination: 'tokens.css', format: 'luca/css-theme', options: {
        mode, selector: `${isDefault ? ':root, ' : ''}[data-luca-theme][data-suite="${suite}"][data-mode="${mode}"]`,
      } }] },
      data: { files: [{ destination: 'tokens.json', format: 'luca/json-theme' }] },
    });
    const { allTokens } = await dictionary.getPlatformTokens('css');
    for (const file of layersOf(suite, mode)) for (const name of await declaredNames(file)) expected.add(name);
    themes.push({ suite, mode, dictionary, valued: new Set(allTokens.map(nameOf)) });
  }
}

// 第二步：完整性檢查。任一組合缺值就列出變數名與組合並讓建置失敗，不寫任何輸出。
const missing = themes.flatMap(({ suite, mode, valued }) =>
  [...expected].filter(name => !valued.has(name)).map(name => `缺少設計變數的值：${name}（${suite}/${mode}）`));
if (missing.length) {
  console.error(missing.join('\n'));
  process.exit(1);
}

// 第三步：輸出。data 以「套系 → 明暗 → 變數」三層索引。
const css = [];
const data = {};
for (const { suite, mode, dictionary } of themes) {
  css.push(await formatOne(dictionary, 'css'));
  (data[suite] ??= {})[mode] = await formatOne(dictionary, 'data');
}

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

await mkdir(out, { recursive: true });
await Promise.all([
  writeFile(join(out, 'css.d.ts'), 'export {};\n'),
  writeFile(join(out, 'typography.json'), JSON.stringify(typography, null, 2) + '\n'),
  writeFile(join(out, 'tokens.json'), JSON.stringify(data, null, 2) + '\n'),
  writeFile(join(out, 'tokens.css'), css.join('\n') + '\n'),
]);
