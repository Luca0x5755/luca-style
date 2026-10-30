// 由專案主色產生 Penpot 可匯入的強調色 token JSON（ISSUE-028，PR-FILE-19，ADR 0008）。
// 推算只呼叫 deriveAccent（packages/tokens/accent.js，ThemeProvider 用的同一份），中性色取自
// packages/tokens/dist/tokens.json（需先 npm run generate），本腳本不做任何顏色運算。
// 用法：node scripts/design/penpot-accent.mjs --accent '{"light":"#B5179E"}' [--out penpot-accent.tokens.json]
// --accent 是 AccentInput 的 JSON：只有 light 必填，dark、secondary、soft:{light,dark} 有給就用。沒給 --out 則寫到 stdout。
// 輸出是「增量檔」：只含 4 個新 set（Project Accent/<套系>-<明暗>）與 4 個 Suite x Mode theme，不含 Base、Device 與既有 set，
// 使用端在設計檔裡改過的 token 不會被覆蓋；輸出的 tokenSetOrder 只列 Project Accent（意圖：排在 Suite x Mode 之後，同名 token 後者覆蓋前者；匯入後實際順序未驗證）。
// 結束碼：0 成功；1 輸入不合；2 讀寫檔失敗。
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveAccent } from '../../packages/tokens/accent.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SUITES = ['Vibrant', 'Professional'];
const MODES = ['Light', 'Dark'];
// 角色名（CSS 變數名）→ 設計檔 token 名；accent-secondary 在設計檔叫 secondary（與 penpot-tokens.json 一致）。
const TOKEN_NAME = { accent: 'accent', 'accent-secondary': 'secondary', 'accent-soft': 'accent-soft', 'accent-hover': 'accent-hover', 'accent-pressed': 'accent-pressed', 'focus-ring': 'focus-ring' };
const HEX = /^#[0-9A-Fa-f]{6}$/;
const setName = (suite, mode) => `Project Accent/${suite}-${mode}`;

/** 驗證 AccentInput；不合時丟 Error（訊息為繁體中文）。 */
export function validateInput(input) {
  if (!input?.light) throw new Error('--accent 缺少必填的 light（日間主色）');
  const colors = [['light', input.light], ['dark', input.dark], ['secondary', input.secondary], ['soft.light', input.soft?.light], ['soft.dark', input.soft?.dark]];
  for (const [name, value] of colors) if (value !== undefined && !HEX.test(value)) throw new Error(`--accent 的 ${name} 須為 #RRGGBB：${value}`);
}

/**
 * @param {{light:string; dark?:string; secondary?:string; soft?:{light?:string; dark?:string}}} input
 * @param {Record<string, Record<string, Record<string, string>>>} tokenData packages/tokens/dist/tokens.json 的內容（各套系各明暗的中性色）
 */
export function buildAccentTokens(input, tokenData) {
  validateInput(input);
  const out = {};
  const themes = [];
  const order = [];
  for (const suite of SUITES) {
    for (const mode of MODES) {
      const neutrals = tokenData[suite.toLowerCase()]?.[mode.toLowerCase()];
      if (!neutrals) throw new Error(`tokens 的 data 沒有 ${suite} / ${mode} 的中性色`);
      const roles = deriveAccent(input, mode.toLowerCase(), neutrals);
      out[setName(suite, mode)] = Object.fromEntries(Object.entries(TOKEN_NAME).map(([role, name]) => [name, { $value: roles[role].toUpperCase(), $type: 'color' }]));
      order.push(setName(suite, mode));
      themes.push({
        id: `suite-x-mode-${suite.toLowerCase()}-${mode.toLowerCase()}`,
        name: `${suite} / ${mode}`,
        group: 'Suite x Mode',
        selectedTokenSets: { Base: 'enabled', [`Suite x Mode/${suite}-${mode}`]: 'enabled', [setName(suite, mode)]: 'enabled' },
      });
    }
  }
  return { ...out, $themes: themes, $metadata: { tokenSetOrder: order } };
}

// ---------- 命令列 ----------

const fail = (message, code) => {
  console.error(message);
  process.exit(code);
};

function main(args) {
  const arg = (flag) => { const at = args.indexOf(flag); return at < 0 ? undefined : args[at + 1]; };
  const raw = arg('--accent');
  if (!raw) fail('用法：node scripts/design/penpot-accent.mjs --accent \'{"light":"#RRGGBB"}\' [--out 路徑]', 1);
  let input;
  try {
    input = JSON.parse(raw);
  } catch (error) {
    fail(`--accent 不是合法的 JSON：${error.message}`, 1);
  }
  let tokenData;
  try {
    tokenData = JSON.parse(readFileSync(resolve(root, 'packages/tokens/dist/tokens.json'), 'utf8'));
  } catch {
    fail('讀不到 packages/tokens/dist/tokens.json；請先在 luca-style 檢出執行 npm run generate', 2);
  }
  let result;
  try {
    result = buildAccentTokens(input, tokenData);
  } catch (error) {
    fail(error.message, 1);
  }
  const text = JSON.stringify(result, null, 2) + '\n';
  const out = arg('--out');
  if (!out) return process.stdout.write(text);
  try {
    writeFileSync(resolve(out), text);
  } catch (error) {
    fail(`寫不進 ${out}：${error.message}`, 2);
  }
  console.log(`已產生 Penpot 強調色 token：${resolve(out)}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
