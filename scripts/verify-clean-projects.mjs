// 乾淨專案驗證：打包兩個套件、從打包檔安裝到 repo 外、建置，再用瀏覽器檢查（PR-ADOPT-03、04、05）。
// 用法：npm run test:clean-projects [-- <專案名>]；要先 npm run build。後續的乾淨專案加進下方的 projects。
// 每個專案除了檢查要過，還要跑反向控制：故意弄壞安裝結果後，對應的檢查必須變紅，否則整支失敗。
import assert from 'node:assert/strict';
import {spawn, spawnSync} from 'node:child_process';
import {cp, mkdtemp, readdir, readFile, rm, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';

const root = fileURLToPath(new URL('../', import.meta.url));
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run through npm run test:clean-projects');
// 不和 repo 既有的 4173–4178 衝突。
const port = 4180;

function npm(args, cwd) {
  const result = spawnSync(process.execPath, [npmCli, ...args], {cwd, encoding: 'utf8'});
  if (result.status !== 0) throw new Error(`npm ${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`);
  return result.stdout.trim();
}

// 走訪 DTCG 原始檔，列舉所有色彩角色。刻意不讀 preset，preset 沒跟上時才抓得到。
async function colorRoles() {
  const source = join(root, 'packages/tokens/src');
  const names = new Set();
  const walk = (node, path) => {
    const children = Object.keys(node).filter(key => !key.startsWith('$'));
    if (children.length === 0) {
      if (node.$type === 'color' && !node.$extensions?.['luca-style']?.designFileOnly) names.add(path.join('-'));
      return;
    }
    for (const key of children) walk(node[key], [...path, key]);
  };
  for (const entry of await readdir(source, {recursive: true, withFileTypes: true})) {
    if (!entry.isFile() || !entry.name.endsWith('.tokens.json') || entry.name.startsWith('typography')) continue;
    const tree = JSON.parse(await readFile(join(entry.parentPath, entry.name), 'utf8'));
    for (const key of Object.keys(tree).filter(key => !key.startsWith('$'))) walk(tree[key], [key]);
  }
  return [...names].sort();
}

// Tailwind v3 所有吃色彩的工具。read 指定在瀏覽器裡讀哪個計算值；不只查規則存在，規則的值無效時才抓得到。
const colorTools = [
  ...[['bg', 'backgroundColor'], ['text', 'color'], ['border', 'borderTopColor'], ['outline', 'outlineColor'], ['caret', 'caretColor'], ['accent', 'accentColor'], ['decoration', 'textDecorationColor'], ['fill', 'fill'], ['stroke', 'stroke']]
    .map(([prefix, property]) => ({prefix, read: {style: property}})),
  {prefix: 'divide', extra: 'divide-y', kind: 'parent', read: {child: 'borderTopColor'}},
  {prefix: 'placeholder', kind: 'input', read: {placeholder: true}},
  {prefix: 'ring', extra: 'ring-2', read: {style: 'boxShadow'}},
  {prefix: 'ring-offset', extra: 'ring-2 ring-offset-2', read: {style: 'boxShadow'}},
  {prefix: 'shadow', extra: 'shadow', read: {style: 'boxShadow'}},
  {prefix: 'from', extra: 'bg-gradient-to-r', read: {style: 'backgroundImage'}},
  {prefix: 'via', extra: 'bg-gradient-to-r from-transparent', read: {style: 'backgroundImage'}},
  {prefix: 'to', extra: 'bg-gradient-to-r from-transparent', read: {style: 'backgroundImage'}},
];

// v4 的漸層改名為 bg-linear-to-*；舊名雖然還能用，但 v4 專案實際會寫新名，所以測新名。
const colorToolsV4 = colorTools.map(tool => tool.extra?.startsWith('bg-gradient-to-r') ? {...tool, extra: tool.extra.replace('bg-gradient-to-r', 'bg-linear-to-r')} : tool);

const roleProbes = (roles, tools) => roles.flatMap(role => tools.flatMap(tool => ['', '/40'].map(alpha => ({
  id: `${tool.prefix}|${role}|${alpha || '1'}`,
  className: [tool.extra, `${tool.prefix}-${role}${alpha}`].filter(Boolean).join(' '),
  kind: tool.kind ?? 'plain',
}))));

// OKLab 轉 sRGB 的 0–255 通道（Björn Ottosson 公布的矩陣）。v4 的透明度寫法是 color-mix(in oklab, …)，Chromium 算成 oklab()。
function oklabToRgb(L, a, b) {
  const [l, m, s] = [L + .3963377774 * a + .2158037573 * b, L - .1055613458 * a - .0638541728 * b, L - .0894841775 * a - 1.291485548 * b].map(value => value ** 3);
  const linear = [4.0767416621 * l - 3.3077115913 * m + .2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s, -.0041960863 * l - .7034186147 * m + 1.707614701 * s];
  const [r, g, bl] = linear.map(value => 255 * (value <= .0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - .055));
  return {r, g, b: bl};
}

// 正規化：Chromium 把 v3 的 color-mix 算成 color(srgb …)、v4 的算成 oklab()，其他顏色是 rgb()、rgba()。都轉成 0–255 的通道與透明度。
// 字串裡可能有多個顏色（box-shadow、漸層），全部取出；認不得的格式得到空陣列，比對時算失敗。
function parseColors(text) {
  const number = '(-?[\\d.]+(?:e-?\\d+)?)';
  const pattern = new RegExp(`color\\(srgb ${number} ${number} ${number}(?: \\/ ${number})?\\)|rgba?\\((\\d+(?:\\.\\d+)?), (\\d+(?:\\.\\d+)?), (\\d+(?:\\.\\d+)?)(?:, ([\\d.]+))?\\)|oklab\\(${number} ${number} ${number}(?: \\/ ${number})?\\)`, 'g');
  return [...String(text).matchAll(pattern)].map(match => match[1] !== undefined
    ? {r: match[1] * 255, g: match[2] * 255, b: match[3] * 255, a: match[4] === undefined ? 1 : Number(match[4])}
    : match[5] !== undefined
      ? {r: Number(match[5]), g: Number(match[6]), b: Number(match[7]), a: match[8] === undefined ? 1 : Number(match[8])}
      : {...oklabToRgb(Number(match[9]), Number(match[10]), Number(match[11])), a: match[12] === undefined ? 1 : Number(match[12])});
}
const hexToColor = (hex, a) => ({r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16), a});
const sameColor = (x, y) => ['r', 'g', 'b'].every(key => Math.abs(x[key] - y[key]) <= 1) && Math.abs(x.a - y.a) <= .01;

// tokens.json 的值可能是 var(--x)（metric-background），先解一層。
function roleValue(theme, role) {
  const value = theme[role];
  if (value === undefined) throw new Error(`tokens.json 沒有角色 ${role}`);
  const reference = value.match(/^var\(--([a-z0-9-]+)\)$/);
  return reference ? theme[reference[1]] : value;
}

// 開一個頁面、等字體載入，把頁面交給 inspect；回傳 inspect 的問題加上頁面錯誤。不論成敗都會關閉。
async function withPage(browser, file, inspect) {
  const context = await browser.newContext({colorScheme: 'light', reducedMotion: 'reduce', viewport: {width: 1280, height: 1000}});
  try {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(`頁面錯誤：${error.message}`));
    await page.goto(`http://127.0.0.1:${port}/${file}`);
    await page.locator('[data-luca-theme]').first().waitFor();
    // fonts.ready 在載入失敗時仍會成立，所以逐一確認狀態。
    const fontsLoaded = await page.evaluate(async () => {
      const faces = await Promise.all(['16px Inter', '16px "Noto Sans TC"', '16px "IBM Plex Mono"'].map(font => document.fonts.load(font)));
      return faces.every(group => group.length > 0 && group.every(face => face.status === 'loaded'));
    });
    if (!fontsLoaded) errors.push(`${file}：字體沒有載入`);
    return [...await inspect(page), ...errors];
  } finally {
    await context.close();
  }
}

// 2a：每個角色 × 每個色彩工具 × 實色與 /40 × 四種主題，比對計算值與 tokens.json。
// reads 覆寫個別工具的讀法（v4 的 divide 改畫在前一個子元素的下邊框）。
function checkRoles(browser, tokens, roles, toolList, reads = {}) {
  const probes = roleProbes(roles, toolList);
  const tools = Object.fromEntries(toolList.map(tool => [tool.prefix, reads[tool.prefix] ?? tool.read]));
  return withPage(browser, 'probes.html', async page => {
    const problems = [];
    for (const [suite, modes] of Object.entries(tokens)) for (const [mode, theme] of Object.entries(modes)) {
      const values = await page.evaluate(({suite, mode, tools}) => {
        const container = document.getElementById('role-probes');
        container.dataset.suite = suite;
        container.dataset.mode = mode;
        return Object.fromEntries([...container.querySelectorAll('[data-probe]')].map(element => {
          const read = tools[element.dataset.probe.split('|')[0]];
          const style = read.child ? getComputedStyle(read.first ? element.firstElementChild : element.lastElementChild) : getComputedStyle(element, read.placeholder ? '::placeholder' : undefined);
          return [element.dataset.probe, style[read.child ?? read.style ?? 'color']];
        }));
      }, {suite, mode, tools});
      for (const {id} of probes) {
        const [, role, alpha] = id.split('|');
        const expected = hexToColor(roleValue(theme, role), alpha === '1' ? 1 : .4);
        const actual = values[id];
        if (actual === undefined) problems.push(`${suite}/${mode} ${id}：頁面上沒有探針`);
        else if (!parseColors(actual).some(parsed => sameColor(parsed, expected))) problems.push(`${suite}/${mode} ${id}：計算值是 ${actual}，期望 ${JSON.stringify(expected)}`);
      }
    }
    return problems;
  });
}

// 2b：傳給元件的 class 在一般、互動與資料狀態都要生效。state 是比對前要進入的狀態。
const roleColor = (role, alpha = 1) => ({role, alpha});
// outlineRemovers：專案拿掉外框的寫法。v3 是 outline-none；v4 的 outline-none 只設 outline-style，v3 的意思改叫 outline-hidden，兩個都測。
const passedClasses = outlineRemovers => [
  {id: 'button-merged', property: 'backgroundColor', expected: roleColor('success', .4)},
  {id: 'button-secondary-base', property: 'backgroundColor', expected: roleColor('success', .4)},
  {id: 'button-hover', state: 'hover', property: 'backgroundColor', expected: roleColor('warning', .4)},
  {id: 'button-active', state: 'active', property: 'backgroundColor', expected: roleColor('error', .4)},
  {id: 'button-secondary-hover', state: 'hover', property: 'color', expected: roleColor('warning')},
  {id: 'button-secondary-active', state: 'active', property: 'color', expected: roleColor('error')},
  {id: 'button-disabled', state: 'disabled', property: 'opacity', expected: '1'},
  {id: 'button-secondary-disabled', state: 'disabled', property: 'opacity', expected: '1'},
  // 不帶狀態的 class 也會在該狀態生效（consumer-guide 的升級說明）。
  {id: 'button-plain-hover', state: 'hover', property: 'backgroundColor', expected: roleColor('success', .4)},
  {id: 'button-plain-disabled', state: 'disabled', property: 'opacity', expected: '1'},
  {id: 'input-plain-invalid', property: 'borderTopColor', expected: roleColor('success')},
  {id: 'input-base', property: 'backgroundColor', expected: roleColor('success', .4)},
  {id: 'input-invalid', property: 'borderTopColor', expected: roleColor('warning')},
  {id: 'input-disabled', state: 'disabled', property: 'opacity', expected: '1'},
  {id: 'select-base', property: 'backgroundColor', expected: roleColor('success', .4)},
  {id: 'select-invalid', property: 'borderTopColor', expected: roleColor('warning')},
  {id: 'select-disabled', state: 'disabled', property: 'opacity', expected: '1'},
  // :where() 之後，.luca-select-trigger 不能蓋掉停用的游標。
  {id: 'select-disabled', state: 'disabled', property: 'cursor', expected: 'not-allowed'},
  {id: 'checkbox-base', property: 'backgroundColor', expected: roleColor('success', .4)},
  {id: 'checkbox-checked', property: 'backgroundColor', expected: roleColor('warning', .4)},
  {id: 'checkbox-plain-checked', property: 'backgroundColor', expected: roleColor('success', .4)},
  {id: 'checkbox-indeterminate', property: 'backgroundColor', expected: roleColor('error', .4)},
  {id: 'checkbox-invalid', property: 'borderTopColor', expected: roleColor('warning')},
  {id: 'checkbox-disabled', state: 'disabled', property: 'opacity', expected: '1'},
  // Button 渲染成連結、導覽經 renderLink 接專案連結時，專案的 class 也要生效（PR-STYLE-57、58）。
  {id: 'button-link', property: 'backgroundColor', expected: roleColor('success', .4)},
  ...['nav-link-plain', 'nav-link-current', 'nav-link-brand'].map(id => ({id, property: 'color', expected: roleColor('success')})),
  // focus-visible: 前綴要能生效。
  ...['button', 'input', 'select', 'checkbox'].map(name => ({id: `${name}-focus`, state: 'focus', property: 'outlineColor', expected: roleColor('warning')})),
  // 例外：不帶狀態的拿掉外框 class 不會拿掉焦點框（PR-STYLE-46）。
  ...['button', 'input', 'select', 'checkbox'].flatMap(name => outlineRemovers.flatMap(remover => [
    {id: `${name}-${remover}`, state: 'focus', property: 'outlineColor', expected: roleColor('focus-ring')},
    {id: `${name}-${remover}`, state: 'focus', property: 'outlineStyle', expected: 'solid'},
    {id: `${name}-${remover}`, state: 'focus', property: 'outlineWidth', expected: '2px'},
  ])),
  // preset 的顏色要跟著 ThemeProvider 的專案強調色（探針傳入 accent.light，值照抄 probes.tsx）。
  {id: 'accent-override', property: 'backgroundColor', expected: {hex: '#9A4C32', alpha: .4}},
];

function checkPassedClasses(browser, tokens, expectations) {
  const theme = tokens.vibrant.light;
  return withPage(browser, 'probes.html', async page => {
    const problems = [];
    const mergedClass = await page.locator('#button-merged').getAttribute('class');
    if (mergedClass?.split(' ').includes('bg-accent')) problems.push(`button-merged：tailwind-merge 沒有拿掉衝突的 class（${mergedClass}）`);
    for (const {id, state, property, expected} of expectations) {
      // Checkbox 的 id 在隱藏的 input 上，className 在 role=checkbox 的方框上。
      const target = id.startsWith('checkbox-') ? page.locator(`label:has(#${id}) [role=checkbox]`) : page.locator(`#${id}`);
      await page.mouse.up();
      await page.mouse.move(0, 0);
      await page.evaluate(() => document.activeElement?.blur?.());
      if (state === 'hover' || state === 'active') await target.hover();
      if (state === 'active') await page.mouse.down();
      if (state === 'disabled' && !await target.evaluate(element => element.matches(':disabled, [data-disabled]'))) { problems.push(`${id}：沒有進入停用狀態`); continue; }
      if (state === 'focus') {
        // 先按鍵，瀏覽器才把接下來的程式聚焦算成 :focus-visible。
        await page.keyboard.press('Shift');
        await target.focus();
        if (!await target.evaluate(element => element.matches(':focus-visible'))) { problems.push(`${id}：沒有進入 :focus-visible`); continue; }
      }
      const actual = await target.evaluate((element, property) => getComputedStyle(element)[property], property);
      const wanted = typeof expected === 'string' ? undefined : hexToColor(expected.hex ?? roleValue(theme, expected.role), expected.alpha);
      const passed = wanted ? parseColors(actual).some(parsed => sameColor(parsed, wanted)) : actual === expected;
      if (!passed) problems.push(`${id}${state ? `（${state}）` : ''}：${property} 是 ${actual}，期望 ${JSON.stringify(expected)}`);
    }
    await page.mouse.up();
    return problems;
  });
}

// 2d：ThemeProvider 在執行期改專案強調色、切到暗黑，每一步後比對實色與 /40。
// 角色檢查只切容器屬性；這項才抓得到設定檔把值寫死，utility 沒跟著執行期的變數改變。強調色照抄 probes.tsx 的 runtimeAccent。
function checkRuntime(browser, tokens) {
  const {light, dark} = tokens.vibrant;
  const steps = [
    {name: '初始', expected: {accent: roleValue(light, 'accent'), surface: roleValue(light, 'surface')}},
    {name: '改強調色', click: '#runtime-set-accent', expected: {accent: '#9A4C32', surface: roleValue(light, 'surface')}},
    {name: '切到暗黑', click: '#runtime-set-dark', expected: {accent: '#D9876B', surface: roleValue(dark, 'surface')}},
  ];
  return withPage(browser, 'probes.html', async page => {
    const problems = [];
    for (const step of steps) {
      if (step.click) await page.locator(step.click).click();
      for (const role of ['accent', 'surface']) for (const alpha of [1, .4]) {
        const className = alpha === 1 ? `bg-${role}` : `bg-${role}/40`;
        const actual = await page.locator(`[data-runtime="${className}"]`).evaluate(element => getComputedStyle(element).backgroundColor);
        const wanted = hexToColor(step.expected[role], alpha);
        if (!parseColors(actual).some(parsed => sameColor(parsed, wanted))) problems.push(`runtime ${step.name} ${className}：計算值是 ${actual}，期望 ${JSON.stringify(wanted)}`);
      }
    }
    return problems;
  });
}

// 2c：同一組元件，基準頁（Luca CSS 加專案的頁面基礎）與依文件載入 Tailwind 的頁面，逐元素比對位置大小與計算樣式。
const comparedProperties = ['display', 'color', 'backgroundColor', 'backgroundImage', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'textAlign', 'textDecorationLine', 'textTransform', 'listStyleType', 'verticalAlign', 'whiteSpace', 'opacity', 'cursor', 'boxShadow', 'outlineStyle', 'overflowX', 'overflowY', 'fill', 'stroke',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius'];

// 不帶 .luca-input 的 input 是 Base UI 隱藏的表單欄位，畫面上看不到，不比。
const snapshot = (page, properties) => page.evaluate(properties => [...document.querySelectorAll('[data-luca-theme], [data-luca-theme] *:not(input:not(.luca-input))')].map(element => {
  const style = getComputedStyle(element);
  const box = element.getBoundingClientRect();
  const values = {x: box.x.toFixed(1), y: box.y.toFixed(1), width: box.width.toFixed(1), height: box.height.toFixed(1)};
  for (const property of properties) values[property] = style[property];
  // preflight 把 svg 設成 vertical-align: middle；Luca 的 svg 都是 flex 子項，這個屬性沒有作用，位置已由上面的 x、y 比對。
  if (element.tagName === 'svg') delete values.verticalAlign;
  // 邊框寬度為 0 時，樣式和顏色畫不出來，不比。
  for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
    values[`border${side}Width`] = style[`border${side}Width`];
    if (style[`border${side}Width`] !== '0px') { values[`border${side}Style`] = style[`border${side}Style`]; values[`border${side}Color`] = style[`border${side}Color`]; }
  }
  return {name: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}.${String(element.getAttribute('class') ?? '').split(' ')[0]}`, values};
}), properties);

function compareSnapshots(stage, baseline, tailwind) {
  if (baseline.length !== tailwind.length) return [`${stage}：元素數量不同（基準 ${baseline.length}，Tailwind ${tailwind.length}）`];
  return baseline.flatMap((element, index) => Object.keys({...element.values, ...tailwind[index].values})
    .filter(key => element.values[key] !== tailwind[index].values[key])
    .map(key => `${stage} ${element.name}（第 ${index} 個元素）：${key} 基準 ${element.values[key]}，Tailwind ${tailwind[index].values[key]}`));
}

function checkPreflight(browser) {
  const stages = [
    ['靜態', async () => {}],
    ['滑過主要按鈕', page => page.locator('#hover-primary').hover()],
    ['滑過次要按鈕', page => page.locator('#hover-secondary').hover()],
    ['開啟選單', async page => {
      await page.mouse.move(0, 0);
      await page.locator('#open-select').click();
      await page.getByRole('listbox').waitFor();
    }],
  ];
  return withPage(browser, 'baseline.html', baselinePage => withPage(browser, 'index.html', async tailwindPage => {
    const problems = [];
    for (const [stage, enter] of stages) {
      const [baseline, tailwind] = await Promise.all([baselinePage, tailwindPage].map(async page => { await enter(page); return snapshot(page, comparedProperties); }));
      problems.push(...compareSnapshots(stage, baseline, tailwind));
    }
    return problems;
  }));
}

const failOnProblems = (name, problems) => {
  if (problems.length === 0) return;
  throw new Error(`${name} 失敗（${problems.length} 項）：\n${problems.slice(0, 40).join('\n')}`);
};

// 兩個版本共用：先跑每項檢查，再跑反向控制（改壞一處後重建，指定的檢查必須變紅，而且紅的原因要提到 mention；改完還原）。
async function runChecks({check, roles, toolList, tokens, expectations, controls, build}) {
  failOnProblems('角色 class', await check.roles());
  console.log(`PASS 角色 class：${roles.length} 個角色 × ${toolList.length} 個工具 × 實色與 /40 × ${Object.values(tokens).flatMap(Object.keys).length} 種主題`);
  failOnProblems('傳入 class', await check.classes());
  console.log(`PASS 傳入 class：${expectations.length} 項`);
  if (check.runtime) {
    failOnProblems('執行期切換', await check.runtime());
    console.log('PASS 執行期切換：改強調色、切到暗黑後，實色與 /40 都跟著變');
  }
  failOnProblems('preflight', await check.preflight());
  console.log('PASS preflight：基準頁與 Tailwind 頁逐元素一致');
  for (const control of controls) {
    const original = await readFile(control.file, 'utf8');
    await writeFile(control.file, control.content);
    try {
      build();
      const problems = await check[control.check]();
      const mentions = [control.mention].flat();
      assert.ok(mentions.every(mention => problems.some(problem => problem.includes(mention))), `反向控制「${control.name}」沒有讓 ${control.check} 變紅（問題：${problems.slice(0, 3).join('；') || '無'}）`);
      console.log(`PASS 反向控制：${control.name} → ${control.check} 變紅（${problems.length} 項），例如 ${problems.filter(problem => mentions.some(mention => problem.includes(mention))).slice(0, 4).join('；')}`);
    } finally {
      await writeFile(control.file, original);
    }
  }
}

// 反向控制要改的 :where() 規則；文字不存在時直接失敗，免得控制改不到東西卻誤判成功。
const whereHover = '.luca-button-primary:where(:not(:disabled):hover)';
async function whereControl(project) {
  const stylesPath = join(project, 'node_modules/@luca-style/react/dist/styles.css');
  const styles = await readFile(stylesPath, 'utf8');
  assert.ok(styles.includes(whereHover), `styles.css 沒有 ${whereHover}，反向控制要改的文字不存在`);
  return {name: '按鈕滑過的 :where() 還原', file: stylesPath, content: styles.replace(whereHover, '.luca-button-primary:not(:disabled):hover'), check: 'classes', mention: 'button-hover'};
}

// 導覽連結的選擇器改回 .luca-navigation a（特異度 0,1,1）時，專案經 renderLink 傳的 class 要贏不了而變紅（PR-STYLE-57）。
async function navigationControl(project) {
  const stylesPath = join(project, 'node_modules/@luca-style/react/dist/styles.css');
  const styles = await readFile(stylesPath, 'utf8');
  const navigationLink = '.luca-navigation-link {';
  assert.ok(styles.includes(navigationLink), `styles.css 沒有 ${navigationLink}，反向控制要改的文字不存在`);
  return {name: '導覽連結改回 .luca-navigation a', file: stylesPath, content: styles.replace(navigationLink, '.luca-navigation a {'), check: 'classes', mention: 'nav-link-plain'};
}

async function verifyTailwindV3({project, browser, roles, tokens, build}) {
  const expectations = passedClasses(['outline-none']);
  const check = {
    roles: () => checkRoles(browser, tokens, roles, colorTools),
    classes: () => checkPassedClasses(browser, tokens, expectations),
    preflight: () => checkPreflight(browser),
  };

  const presetPath = join(project, 'node_modules/@luca-style/tokens/dist/tailwind-preset.cjs');
  const entryPath = join(project, 'src/index.css');
  const preset = createRequire(import.meta.url)(presetPath);
  const entryLines = (await readFile(entryPath, 'utf8')).replace(/\r\n/g, '\n').trim().split('\n');
  const luca = entryLines.filter(line => line.includes('@luca-style'));
  const others = entryLines.filter(line => !line.includes('@luca-style'));
  assert.equal(luca.length, 3, 'CSS 入口應有三行 Luca CSS');
  const lastRole = roles.at(-1);
  const presetWith = edit => { const copy = structuredClone(preset); edit(copy.theme.extend.colors); return `module.exports = ${JSON.stringify(copy)};\n`; };
  const missing = 'color-mix(in srgb, var(--luca-missing) calc(<alpha-value> * 100%), transparent)';
  await runChecks({check, roles, toolList: colorTools, tokens, expectations, build, controls: [
    {name: `preset 少了 ${lastRole}`, file: presetPath, content: presetWith(colors => { delete colors[lastRole]; }), check: 'roles', mention: lastRole},
    {name: `preset 的 ${lastRole} 值無效`, file: presetPath, content: presetWith(colors => { colors[lastRole] = missing; }), check: 'roles', mention: lastRole},
    {name: 'Luca 排在 tailwindcss/base 之前', file: entryPath, content: `${[...luca, ...others].join('\n')}\n`, check: 'preflight', mention: 'luca-button'},
    {name: 'Luca 排在 tailwindcss/utilities 之後', file: entryPath, content: `${[...others, ...luca].join('\n')}\n`, check: 'classes', mention: 'button-merged'},
    await whereControl(project),
    await navigationControl(project),
  ]});
}

async function verifyTailwindV4({project, browser, roles, tokens, build}) {
  const expectations = passedClasses(['outline-none', 'outline-hidden']);
  const check = {
    // v4 的 divide 給「不是最後一個」的子元素下邊框，v3 是「不是第一個」的上邊框。
    roles: () => checkRoles(browser, tokens, roles, colorToolsV4, {divide: {child: 'borderBottomColor', first: true}}),
    classes: () => checkPassedClasses(browser, tokens, expectations),
    runtime: () => checkRuntime(browser, tokens),
    preflight: () => checkPreflight(browser),
  };
  const themePath = join(project, 'node_modules/@luca-style/tokens/dist/tailwind-theme.css');
  const theme = await readFile(themePath, 'utf8');
  const lastRole = roles.at(-1);
  // 改設定檔裡某個角色的那一行；找不到就失敗，免得控制改不到東西。
  const themeWith = (role, replace, css = theme) => {
    const line = new RegExp(`^\\s*--color-${role}: var\\(--${role}\\);\\r?\\n`, 'm');
    assert.match(css, line, `tailwind-theme.css 沒有 ${role} 這一行`);
    return css.replace(line, match => replace(match));
  };
  const fixed = ['accent', 'surface'].reduce((css, role) => themeWith(role, line => line.replace(`var(--${role})`, roleValue(tokens.vibrant.light, role)), css), theme);
  // CSS 入口的接錯寫法：Luca 的三行 CSS（不含設定檔）放進圖層、排到 utilities 之後、整包 @import 'tailwindcss'。
  const entryPath = join(project, 'src/index.css');
  const entryLines = (await readFile(entryPath, 'utf8')).replace(/\r\n/g, '\n').trim().split('\n');
  const isLuca = line => line.includes('@luca-style') && !line.includes('tailwind.css');
  const luca = entryLines.filter(isLuca);
  const preflight = "@import 'tailwindcss/preflight.css' layer(base);";
  const utilities = "@import 'tailwindcss/utilities.css';";
  assert.equal(luca.length, 3, 'CSS 入口應有三行 Luca CSS');
  assert.ok(entryLines.includes(preflight) && entryLines.includes(utilities), 'CSS 入口沒有預期的 preflight 與 utilities 兩行');
  const entry = lines => `${lines.join('\n')}\n`;
  const withoutLuca = entryLines.filter(line => !isLuca(line));
  await runChecks({check, roles, toolList: colorToolsV4, tokens, expectations, build, controls: [
    {name: `設定檔少了 ${lastRole}`, file: themePath, content: themeWith(lastRole, () => ''), check: 'roles', mention: lastRole},
    {name: `設定檔的 ${lastRole} 值無效`, file: themePath, content: themeWith(lastRole, line => line.replace(`var(--${lastRole})`, 'var(--luca-missing)')), check: 'roles', mention: lastRole},
    {name: '設定檔把 accent、surface 寫成固定值', file: themePath, content: fixed, check: 'runtime', mention: 'runtime'},
    {name: 'Luca 在 @import 時放進 components 圖層（決策紀錄原本的做法）', file: entryPath, content: entry(entryLines.map(line => isLuca(line) ? line.replace(/;$/, ' layer(components);') : line)), check: 'classes', mention: ['outline-none', 'outline-hidden']},
    {name: 'Luca 排在 tailwindcss/utilities.css 之後', file: entryPath, content: entry([...withoutLuca, ...luca]), check: 'classes', mention: 'button-merged'},
    {name: "整包 @import 'tailwindcss'", file: entryPath, content: entry(["@import 'tailwindcss';", ...entryLines.filter(line => line !== preflight && line !== utilities && !line.startsWith("@import 'tailwindcss/theme.css'"))]), check: 'classes', mention: 'button-merged'},
    // preflight 不分層也蓋不掉 Luca（它的選擇器特異度比 Luca 的 class 低），所以用排在 preflight 之前的圖層證明 preflight 檢查會紅。
    {name: 'Luca 放進排在 preflight 之前的 theme 圖層', file: entryPath, content: entry(entryLines.map(line => isLuca(line) ? line.replace(/;$/, ' layer(theme);') : line)), check: 'preflight', mention: 'luca-button'},
    await whereControl(project),
    await navigationControl(project),
  ]});
}

// 只換掉 fixture 裡的空陣列，型別留在 fixture 一份。
const fillRoleProbes = toolList => async (project, roles) => {
  const file = join(project, 'src/role-probes.ts');
  const stub = await readFile(file, 'utf8');
  assert.ok(stub.includes('= [];'), 'role-probes.ts 沒有可替換的空陣列');
  await writeFile(file, stub.replace('= [];', `= ${JSON.stringify(roleProbes(roles, toolList), null, 1)};`));
};

const projects = {
  'tailwind-v3': {fixture: 'examples/tailwind-v3', prepare: fillRoleProbes(colorTools), verify: verifyTailwindV3},
  'tailwind-v4': {fixture: 'examples/tailwind-v4', prepare: fillRoleProbes(colorToolsV4), verify: verifyTailwindV4},
};

const selected = process.argv[2] ? [process.argv[2]] : Object.keys(projects);
for (const name of selected) if (!projects[name]) throw new Error(`不認得的專案：${name}（可用：${Object.keys(projects).join('、')}）`);

const temporary = await mkdtemp(join(tmpdir(), 'luca-clean-'));
let browser;
try {
  for (const name of ['tokens', 'react']) npm(['pack', '--pack-destination', temporary], join(root, 'packages', name));
  const tarballs = (await readdir(temporary)).filter(name => name.endsWith('.tgz')).map(name => join(temporary, name));
  const roles = await colorRoles();
  assert.ok(roles.length > 0, '原始檔裡沒有色彩角色');
  browser = await chromium.launch();
  for (const name of selected) {
    const {fixture, prepare, verify} = projects[name];
    const project = join(temporary, name);
    await cp(join(root, fixture), project, {recursive: true, filter: source => !['node_modules', 'dist'].includes(source.split(sep).at(-1))});
    await prepare(project, roles);
    npm(['install', '--no-audit', '--no-fund', ...tarballs.map(tarball => relative(project, tarball))], project);
    npm(['run', 'build'], project);
    // 反向控制只改 CSS 與 preset，不需要再跑一次型別檢查。
    const build = () => npm(['exec', '--no', '--', 'vite', 'build'], project);
    const server = spawn(process.execPath, [join(project, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {cwd: project, stdio: 'pipe'});
    let serverErrors = '';
    server.stderr.on('data', chunk => { serverErrors += chunk; });
    try {
      await new Promise((done, reject) => {
        const timer = setTimeout(() => reject(new Error('預覽伺服器逾時')), 15000);
        server.once('exit', code => { clearTimeout(timer); reject(new Error(`預覽伺服器結束，代碼 ${code}\n${serverErrors}`)); });
        server.stdout.on('data', chunk => { if (chunk.toString().includes(String(port))) { clearTimeout(timer); done(); } });
      });
      const tokens = createRequire(join(project, 'package.json'))('@luca-style/tokens/data');
      await verify({project, browser, roles, tokens, build});
      console.log(`PASS ${name}`);
    } finally {
      // 被訊號結束時 exitCode 仍是 null，exit 事件也已發生過，要一起判斷，否則會永遠等不到。
      if (server.exitCode === null && server.signalCode === null) { const closed = new Promise(done => server.once('exit', done)); server.kill(); await closed; }
    }
  }
} finally {
  try {
    if (browser) await browser.close();
  } finally {
    const path = resolve(temporary);
    assert.ok(path.startsWith(resolve(tmpdir()) + sep) && path.split(sep).at(-1).startsWith('luca-clean-'));
    await rm(path, {recursive: true, force: true, maxRetries: 5, retryDelay: 500});
  }
}
