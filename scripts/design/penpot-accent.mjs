// 由專案主色產生 Penpot 可匯入的強調色 token JSON（ISSUE-028，PR-FILE-19，ADR 0008）。
// 推算只呼叫 deriveAccent（packages/tokens/accent.js，ThemeProvider 用的同一份），中性色取自
// packages/tokens/dist/tokens.json（需先 npm run generate），本腳本不做任何顏色運算。
// 用法：node scripts/design/penpot-accent.mjs --accent '{"light":"#B5179E"}' [--out penpot-accent.tokens.json]
// --accent 是 AccentInput 的 JSON：只有 light 必填，dark、secondary、soft:{light,dark} 有給就用。沒給 --out 則寫到 stdout。
// 輸出是「完整檔」：docs/mockup/themes/penpot-tokens.json 全部內容，加上 4 個 Project Accent/<套系>-<明暗> set，並讓 4 個 Suite x Mode theme 各多啟用對應的 set。
// 原因：Penpot 的 Tokens 面板「工具 > 匯入」會取代整個 token 庫（實測，2026-10-30），只含新 set 的增量檔會把設計變數蓋掉。
// Project Accent set 排在 tokenSetOrder 最後，同名 token 後者覆蓋前者，所以排在 Suite x Mode 各 set 之後（匯入後實際順序仍請在 Penpot 內確認）。
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
 * 只產生 4 個 Project Accent set 與對應的 theme 片段（不含 penpot-tokens.json 的內容）。
 * @param {{light:string; dark?:string; secondary?:string; soft?:{light?:string; dark?:string}}} input
 * @param {Record<string, Record<string, Record<string, string>>>} tokenData packages/tokens/dist/tokens.json 的內容（各套系各明暗的中性色）
 */
export function buildAccentSets(input, tokenData) {
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

/**
 * 完整的可匯入檔：base（penpot-tokens.json）原樣保留，再接上 Project Accent set。
 * @param {object} base docs/mockup/themes/penpot-tokens.json 的內容
 */
export function buildAccentTokens(input, tokenData, base) {
  const accent = buildAccentSets(input, tokenData);
  const accentSets = Object.keys(accent).filter((key) => !key.startsWith('$'));
  const missing = accent.$themes.find((theme) => !base.$themes.some((t) => t.id === theme.id));
  if (missing) throw new Error(`penpot-tokens.json 沒有 theme ${missing.id}；請先 npm run generate`);
  const themes = base.$themes.map((theme) => {
    const extra = accent.$themes.find((t) => t.id === theme.id);
    if (!extra) return theme;
    const added = Object.keys(extra.selectedTokenSets).filter((name) => name.startsWith('Project Accent/'));
    return { ...theme, selectedTokenSets: { ...theme.selectedTokenSets, ...Object.fromEntries(added.map((name) => [name, 'enabled'])) } };
  });
  const { $metadata } = base;
  const baseSets = Object.fromEntries(Object.entries(base).filter(([key]) => key !== '$themes' && key !== '$metadata'));
  const kept = $metadata.tokenSetOrder.filter((name) => !accentSets.includes(name));
  return { ...baseSets, ...Object.fromEntries(accentSets.map((name) => [name, accent[name]])), $themes: themes, $metadata: { ...$metadata, tokenSetOrder: [...kept, ...accentSets] } };
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
  let base;
  try {
    base = JSON.parse(readFileSync(resolve(root, 'docs/mockup/themes/penpot-tokens.json'), 'utf8'));
  } catch {
    fail('讀不到 docs/mockup/themes/penpot-tokens.json；請先在 luca-style 檢出執行 npm run generate', 2);
  }
  let result;
  try {
    result = buildAccentTokens(input, tokenData, base);
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
  console.log(`已產生 Penpot 完整 token 檔（含強調色）：${resolve(out)}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
