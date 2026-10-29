// 把使用端的專案強調色匯入「複製出來的元件庫設計檔」（PR-FILE-19，ADR 0007）。
// 推算只呼叫 deriveAccent（packages/tokens/accent.js，ThemeProvider 用的同一份），中性色取自 tokens 的 data 輸出
// （packages/tokens/dist/tokens.json，即 @luca-style/tokens/data），本腳本不做任何顏色運算。
// 用法（在 luca-style 檢出內執行；需先 npm run generate 產生 dist/tokens.json）：
//   node scripts/design/import-accent.js <複製出來的 .fig> --accent '{"light":"#B5179E"}'
// --accent 是 AccentInput 的 JSON：只有 light 必填，dark、secondary、soft:{light,dark} 有給就用。
// 只覆寫 Suite x Mode 集合內的 accent、secondary、accent-soft、accent-hover、accent-pressed、focus-ring，
// 兩個套系、兩種明暗共四個模式各以該套系該明暗的中性色推算；不動語意狀態色（ADR 0002）與其他變數。
// 設計變數更新後（luca-style 有新版）重跑即可；已是最新（逐值比對解析後的顏色）就不寫檔。
// 結束碼：0 成功（含已是最新）；1 輸入或設計檔不合；2 讀寫檔失敗。
// Windows 的 openpencil 本機修補事項見 docs/delivery-verification.md〈Windows 上執行 openpencil 的本機修補〉。
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveAccent } from '../../packages/tokens/accent.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const COLLECTION = 'Suite x Mode';
// 角色名（CSS 變數名）→ 設計檔變數名；accent-secondary 在設計檔叫 secondary（見 DTCG 的 figName）。
const FIG_NAME = { accent: 'accent', 'accent-secondary': 'secondary', 'accent-soft': 'accent-soft', 'accent-hover': 'accent-hover', 'accent-pressed': 'accent-pressed', 'focus-ring': 'focus-ring' };
const HEX = /^#[0-9A-Fa-f]{6}$/;

const fail = (message, code) => {
  console.log(message);
  process.exit(code);
};

// ---------- 參數與輸入驗證 ----------

const args = process.argv.slice(2);
const accentAt = args.indexOf('--accent');
const file = args.find((a, i) => !a.startsWith('--') && i !== accentAt + 1);
if (!file || accentAt < 0 || !args[accentAt + 1]) fail('用法：node scripts/design/import-accent.js <.fig 路徑> --accent \'{"light":"#RRGGBB"}\'', 1);
const figPath = resolve(file);
if (!existsSync(figPath)) fail(`找不到設計檔：${figPath}`, 2);

let input;
try {
  input = JSON.parse(args[accentAt + 1]);
} catch (error) {
  fail(`--accent 不是合法的 JSON：${error.message}`, 1);
}
const colors = [['light', input?.light], ['dark', input?.dark], ['secondary', input?.secondary], ['soft.light', input?.soft?.light], ['soft.dark', input?.soft?.dark]];
if (!input?.light) fail('--accent 缺少必填的 light（日間主色）', 1);
for (const [name, value] of colors) if (value !== undefined && !HEX.test(value)) fail(`--accent 的 ${name} 須為 #RRGGBB：${value}`, 1);

let tokenData;
try {
  tokenData = JSON.parse(readFileSync(resolve(root, 'packages/tokens/dist/tokens.json'), 'utf8'));
} catch {
  fail('讀不到 packages/tokens/dist/tokens.json；請先在 luca-style 檢出執行 npm run generate', 2);
}

// ---------- openpencil ----------

// shell: true 是為了在 Windows 上執行 openpencil.cmd；路徑加引號以防空白。
const evalOn = (code, extraArgs = []) => {
  try {
    return execFileSync('openpencil', ['eval', `"${figPath}"`, '--stdin', '--json', ...extraArgs], {
      input: code, encoding: 'utf8', shell: true, stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024,
    });
  } catch (error) {
    fail(`openpencil 執行失敗（${figPath}）：${String(error.stderr || error.stdout || error.message).trim().split('\n')[0]}`, 2);
  }
};

// 讀回目標集合各模式、六個變數的目前值（顏色為 #RRGGBB）。
const state = JSON.parse(evalOn(`
const col = figma.getLocalVariableCollections().find((c) => c.name === ${JSON.stringify(COLLECTION)})
if (!col) return null
const hex = (c) => '#' + [c.r, c.g, c.b].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('').toUpperCase()
const names = ${JSON.stringify(Object.values(FIG_NAME))}
const vars = figma.getLocalVariables().filter((v) => v.collectionId === col.id && names.includes(v.name))
return { modes: col.modes.map((m) => m.name), values: Object.fromEntries(vars.map((v) => [v.name, Object.fromEntries(col.modes.map((m) => { const c = v.valuesByMode[m.modeId]; return [m.name, c && typeof c === 'object' && 'r' in c ? hex(c) : null] }))])) }`));
if (!state) fail(`${figPath} 不是元件庫設計檔：沒有「${COLLECTION}」集合`, 1);
const missing = Object.values(FIG_NAME).filter((name) => !state.values[name]);
if (missing.length > 0) fail(`${figPath} 的「${COLLECTION}」缺少變數：${missing.join('、')}`, 1);

// ---------- 推算與比對 ----------

// 模式名稱是「套系 / 明暗」，如 Vibrant / Light；中性色取該套系該明暗。
const want = {};
for (const modeName of state.modes) {
  const [suite, mode] = modeName.split(' / ').map((x) => x.toLowerCase());
  const neutrals = tokenData[suite]?.[mode];
  if (!neutrals) fail(`tokens 的 data 沒有 ${suite} / ${mode} 的中性色`, 2);
  const roles = deriveAccent(input, mode, neutrals);
  for (const [role, figName] of Object.entries(FIG_NAME)) (want[figName] ??= {})[modeName] = roles[role].toUpperCase();
}
const stale = Object.entries(want).flatMap(([name, byMode]) => Object.entries(byMode).filter(([mode, value]) => state.values[name][mode] !== value).map(([mode]) => `${name}@${mode}`));
if (stale.length === 0) fail('已是最新，不寫檔', 0);

evalOn(`
const want = ${JSON.stringify(want)}
const col = figma.getLocalVariableCollections().find((c) => c.name === ${JSON.stringify(COLLECTION)})
const rgb = (h) => ({ r: parseInt(h.slice(1, 3), 16) / 255, g: parseInt(h.slice(3, 5), 16) / 255, b: parseInt(h.slice(5, 7), 16) / 255, a: 1 })
for (const v of figma.getLocalVariables().filter((x) => x.collectionId === col.id && want[x.name])) {
  for (const m of col.modes) figma.setVariableValue(v.id, m.modeId, rgb(want[v.name][m.name]))
}
return true`, ['-w']);
console.log(`已匯入強調色（更新 ${stale.length} 個值）：${figPath}`);
