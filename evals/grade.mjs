// 評測的評分工具（ISSUE-011，PR-EVAL-01、04 的基礎）。
// 用法：node evals/grade.mjs <專案目錄> [建置輸出目錄，預設 <專案>/dist] [claude -p 的 JSON 輸出檔]（會開瀏覽器，連接埠 4190）
// 評測流程裡由 npm run eval -- --grade <結果檔> 呼叫 gradeProject。
// 量五項：寫死顏色數、axe 的 serious 與 critical、三種寬度的水平溢出、四種狀態缺漏、費用與時間。
import { readdir, readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { chromium } from '@playwright/test';

export const states = ['loading', 'empty', 'error', 'success'];

const scannedExtensions = /\.(?:[cm]?[jt]sx?|css|html)$/;

// 只掃專案自己的原始碼：根目錄的 index.html 與 src/ 底下的檔案。
async function sourceFiles(source) {
  const files = [];
  if ((await stat(join(source, 'index.html')).catch(() => null))?.isFile()) files.push(join(source, 'index.html'));
  try {
    for (const entry of await readdir(join(source, 'src'), { recursive: true, withFileTypes: true })) {
      if (entry.isFile() && scannedExtensions.test(entry.name)) files.push(join(entry.parentPath, entry.name));
    }
  } catch { /* 沒有 src/ */ }
  return files.sort();
}

// CSS 具名色（CSS Color 4 的 148 個，去掉 transparent、currentColor 這類關鍵字）。
const namedColors = 'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen'.split(' ');

// 吃色彩的 CSS 屬性（CSS 寫法與 JSX style 物件的駝峰寫法都認）。
const colorProperty = String.raw`(?:color|background(?:-color)?|backgroundColor|border(?:-(?:top|right|bottom|left))?(?:-color)?|border(?:Top|Right|Bottom|Left)?Color|outline(?:-color)?|outlineColor|fill|stroke|box-shadow|boxShadow|text-shadow|textShadow|caret-color|caretColor|accent-color|accentColor|text-decoration-color|textDecorationColor)`;

const patterns = [
  // &#123; 是 HTML 實體，不是顏色。
  { kind: 'hex', regex: /(?<![&\w])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g },
  // 第一個參數是數字才算寫死；rgb(var(--x)) 不算。
  { kind: 'function', regex: /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\((?=\s*[\d.])/g },
  { kind: 'named', regex: new RegExp(String.raw`(?<=\b${colorProperty}['"]?\s*:\s*['"]?[^;'"\n}]*?)\b(?:${namedColors.join('|')})\b`, 'g') },
  // Tailwind 內建色盤：色名加數字階，或 white、black；Luca 角色 class（bg-accent 等）不在這個清單。
  { kind: 'palette', regex: /(?<![\w-])(?:bg|text|border(?:-[trblxyse])?|ring(?:-offset)?|outline|fill|stroke|from|via|to|divide|placeholder|caret|accent|decoration|shadow)-(?:(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|[1-9]00|950)|white|black)(?:\/\d+)?(?![\w-])/g },
];

// 把不算的寫法換成等長的空白（保留換行），行號才不會跑掉：
// 自訂屬性的定義（--角色: #hex，CSS 與 JSX style 物件都認）、var() 的備用值。
const blank = text => text.replace(/[^\n]/g, ' ');
function maskExempt(text) {
  return text
    .replace(/var\(\s*--[\w-]+\s*,(?:[^()]|\((?:[^()]|\([^()]*\))*\))*\)/g, blank)
    .replace(/(['"]?)--[\w-]+\1\s*:\s*(?:[^;,}()\n]|\((?:[^()]|\([^()]*\))*\))+/g, blank);
}

export async function countHardcodedColors(source) {
  const items = [];
  for (const file of await sourceFiles(source)) {
    const text = maskExempt(await readFile(file, 'utf8'));
    const lineStarts = [0, ...[...text.matchAll(/\n/g)].map(match => match.index + 1)];
    const lineOf = index => lineStarts.findLastIndex(start => start <= index) + 1;
    for (const { kind, regex } of patterns) for (const match of text.matchAll(regex)) {
      items.push({ file: relative(source, file).split(sep).join('/'), line: lineOf(match.index), kind, text: match[0] });
    }
  }
  return { count: items.length, items };
}

// 靜態伺服器：送出建置輸出，找不到的路徑回 index.html（單頁應用的路由）。
const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' };
async function serve(dist, port) {
  const root = resolve(dist);
  // 被評分的頁面是代理寫的，請求內容不可信：任何錯誤（例如百分號編碼錯誤）都回 404，不讓行程崩掉。
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
      const candidate = resolve(join(root, pathname));
      const inside = candidate === root || candidate.startsWith(root + sep);
      const isFile = inside && (await stat(candidate).catch(() => null))?.isFile();
      // 有副檔名卻找不到的資源回 404；沒有副檔名的路徑交給單頁應用。
      const file = isFile ? candidate : extname(pathname) ? null : join(root, 'index.html');
      if (!file) throw new Error('not found');
      const body = await readFile(file);
      response.writeHead(200, { 'content-type': contentTypes[extname(file)] ?? 'application/octet-stream' });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise((done, fail) => { server.once('error', fail); server.listen(port, '127.0.0.1', done); });
  return server;
}

// 寬度取自 tests/visual-matrix.ts 的 visualWidths；axe 擋下的等級照抄 tests/axe-scan.ts（PR-STYLE-41）。
export const widths = [1280, 834, 390];
const blockingImpacts = new Set(['serious', 'critical']);
// 評分工具自己的連接埠，避開 repo 既有的 4173–4180。
const defaultPort = 4190;
// 狀態標記最多等多久才算沒出現（非同步呈現的狀態要有時間出現）。
const stateTimeout = 5000;

// 開一個狀態、一種寬度：回傳標記是否可見、標記內容、是否水平溢出、axe 的擋下項目。
async function inspect(browser, base, state, width) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
  const errors = [];
  try {
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(`${state}@${width}：${error.message}`));
    await page.goto(`${base}/?state=${state}`, { waitUntil: 'load' });
    const marker = page.locator(`[data-eval-state="${state}"]`).first();
    const present = await marker.waitFor({ state: 'visible', timeout: stateTimeout }).then(() => true, () => false);
    // 標記出現後再等網路靜下來，避免掃到半成品；載入狀態可能一直有請求，所以不強求。
    await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
    const content = present ? await marker.innerHTML() : null;
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    const results = await new AxeBuilder({ page }).analyze();
    const findings = results.violations.filter(violation => blockingImpacts.has(violation.impact ?? ''))
      .flatMap(violation => violation.nodes.map(node => ({ id: violation.id, impact: violation.impact, target: node.target.join(' '), html: node.html, state, width })));
    return { present, content, overflow, findings, errors };
  } finally {
    await context.close();
  }
}

// 缺漏判定：標記沒有在任一寬度出現就缺；success 以外的狀態，內容和 success 或排在前面的狀態相同也算缺（等於沒有真的做這個狀態）。
function missingFrom(observations) {
  const order = ['success', ...states.filter(state => state !== 'success')];
  const seen = [];
  const missing = [];
  for (const state of order) {
    const views = observations.filter(view => view.state === state);
    const content = views[0]?.content;
    if (views.some(view => !view.present) || (state !== 'success' && seen.includes(content))) missing.push(state);
    else seen.push(content);
  }
  return states.filter(state => missing.includes(state));
}

export async function gradeProject({ source, dist, run, port = defaultPort }) {
  const hardcodedColors = await countHardcodedColors(source);
  const summary = readRun(run);
  if (!dist || !(await stat(join(dist, 'index.html')).catch(() => null))) {
    return { hardcodedColors, axe: null, overflow: null, missingStates: { count: states.length, states: [...states] }, pageErrors: [], ...summary };
  }
  const server = await serve(dist, port);
  // 瀏覽器啟動失敗或關閉拋錯時，伺服器也要關，否則連接埠一直被占住，後面的評分全部失敗。
  try {
    const browser = await chromium.launch();
    try {
      return await inspectAll(browser, port, hardcodedColors, summary);
    } finally {
      await browser.close();
    }
  } finally {
    await new Promise(done => server.close(done));
  }
}

// 4 狀態 × 3 寬度依序檢查，再彙整成分數。
async function inspectAll(browser, port, hardcodedColors, summary) {
  const observations = [];
  for (const state of states) for (const width of widths) observations.push({ ...await inspect(browser, `http://127.0.0.1:${port}`, state, width), state, width });
  // 依規則與元素的 HTML 去重：axe 給的選擇器會隨頁面結構改變（同一個元素在不同狀態可能是 .faint 或 p），不能當鍵。
  const unique = new Map();
  for (const finding of observations.flatMap(view => view.findings)) {
    const key = `${finding.id}|${finding.html}`;
    if (!unique.has(key)) unique.set(key, finding);
  }
  const items = [...unique.values()];
  const missing = missingFrom(observations);
  return {
    hardcodedColors,
    axe: { serious: items.filter(item => item.impact === 'serious').length, critical: items.filter(item => item.impact === 'critical').length, items },
    overflow: Object.fromEntries(widths.map(width => [width, observations.filter(view => view.width === width && view.overflow).length])),
    missingStates: { count: missing.length, states: missing },
    pageErrors: [...new Set(observations.flatMap(view => view.errors))],
    ...summary,
  };
}

// 讀 claude -p --output-format json 的輸出：單一結果物件，或 --verbose 時的訊息陣列（取 type 為 result 的那則）。
export function readRun(output) {
  const result = Array.isArray(output) ? output.findLast(message => message?.type === 'result') : output;
  if (!result || typeof result !== 'object') return { costUsd: null, durationMs: null, turns: null, model: null, isError: null };
  const models = Object.keys(result.modelUsage ?? {});
  return {
    costUsd: result.total_cost_usd ?? null,
    durationMs: result.duration_ms ?? null,
    turns: result.num_turns ?? null,
    model: models.length ? models.join(', ') : null,
    isError: result.is_error ?? null,
  };
}

// 直接執行時評一個專案並印出結果；被匯入時不動作。
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const [source, dist, runFile] = process.argv.slice(2);
  if (!source) throw new Error('用法：node evals/grade.mjs <專案目錄> [建置輸出目錄] [claude -p 的 JSON 輸出檔]');
  const run = runFile ? JSON.parse(await readFile(runFile, 'utf8')) : undefined;
  console.log(JSON.stringify(await gradeProject({ source, dist: dist ?? join(source, 'dist'), run }), null, 2));
}
