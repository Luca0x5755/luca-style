import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AccentNeutrals } from '../packages/tokens/accent.js';

// 設計變數產生器與原始檔的位置；測試只透過指令列與輸出檔觀察行為。
export const tokensPackage = fileURLToPath(new URL('../packages/tokens/', import.meta.url));
export const sourceDir = join(tokensPackage, 'src');
export const generator = join(tokensPackage, 'build.mjs');
export const fixtureDir = fileURLToPath(new URL('./fixtures/tokens-0.1.0/', import.meta.url));

// PR-STYLE-48：中性色 8 個角色的日間／暗黑新值（照抄規格，不從原始檔讀）。
// 與 0.1.0 快照比對時，只有這 8 個名稱放行改值，而且必須等於這裡的新值（PR-STYLE-27、PR-FILE-16）。
export const neutralValues = {
  bg: { light: '#F7F8FA', dark: '#111317' },
  surface: { light: '#FFFFFF', dark: '#1A1D22' },
  'surface-subtle': { light: '#F1F3F5', dark: '#23272D' },
  text: { light: '#2C2E31', dark: '#EFF1F5' },
  muted: { light: '#696B6F', dark: '#AEB0B4' },
  border: { light: '#E0E2E6', dark: '#3C3E41' },
  'control-border': { light: '#85878B', dark: '#6F7175' },
  'accent-ink': { light: '#FFFFFF', dark: '#111317' },
} as const satisfies Record<string, { light: string; dark: string }>;
export type NeutralRole = keyof typeof neutralValues;

// 色碼換成瀏覽器計算樣式的 rgb() 寫法，供 toHaveCSS 比對。
export const cssRgb = (hex: string) => `rgb(${hexChannels(hex).join(', ')})`;

// 某變數在某明暗模式應有的值：名稱完全等於中性色角色時取新值，其餘一律沿用 0.1.0 快照值。
// 以全名查表，不做子字串或前綴比對，border-width、metric-border-left 不會被 border 帶走。
export function expectedAgainstSnapshot<T>(name: string, mode: 'light' | 'dark' | undefined, legacy: T): T | string {
  return mode && Object.hasOwn(neutralValues, name) ? neutralValues[name as NeutralRole][mode] : legacy;
}

// 在暫存目錄複製一份原始檔，讓測試可以改動而不碰 repo 內的檔案。
export async function makeWorkspace() {
  const root = await mkdtemp(join(tmpdir(), 'luca-tokens-'));
  const source = join(root, 'src');
  await cp(sourceDir, source, { recursive: true });
  return { root, source, out: join(root, 'out'), dispose: () => rm(root, { recursive: true, force: true }) };
}

// 以相對於 cwd 的路徑呼叫產生器，同時驗證 --source／--out 依 cwd 解析。
export function runGenerator(cwd: string, source = 'src', out = 'out', extra: string[] = []) {
  const result = spawnSync(process.execPath, [generator, '--source', source, '--out', out, ...extra], { cwd, encoding: 'utf8' });
  return { status: result.status, stderr: result.stderr, stdout: result.stdout };
}

// 在暫存工作區改一份分層檔後執行產生器，回傳結果與工作區根目錄的內容（用來確認失敗時沒有寫出 out）。
export async function buildWithout(layer: string, edit: (tokens: Record<string, Record<string, unknown>>) => void) {
  const workspace = await makeWorkspace();
  try {
    const file = join(workspace.source, layer);
    const tokens = await readJson(file);
    edit(tokens);
    await writeFile(file, JSON.stringify(tokens, null, 2));
    const result = runGenerator(workspace.root);
    return { ...result, outputs: await readdir(workspace.root) };
  } finally {
    await workspace.dispose();
  }
}

export const readText = async (path: string) => (await readFile(path, 'utf8')).replace(/\r\n/g, '\n');
export const readJson = async (path: string) => JSON.parse(await readText(path));

// 走訪目錄下所有 JSON 檔，回傳相對路徑。
export async function listJsonFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries.filter(entry => entry.isFile() && entry.name.endsWith('.json'))
    .map(entry => join(entry.parentPath, entry.name).slice(dir.length + 1).replace(/\\/g, '/')).sort();
}

// WCAG 2.x 對比（與 theme.spec 指標卡測試同一條公式）；輸入為 0–255 的 RGB 通道。
// 刻意不用 packages/tokens/accent.js 的版本，測試才不會拿被測程式驗自己。
export function wcagContrast(a: number[], b: number[]) {
  const luminance = (rgb: number[]) => {
    const [r, g, bl] = rgb.map(value => value / 255).map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
    return .2126 * r + .7152 * g + .0722 * bl;
  };
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
export const hexChannels = (hex: string) => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));

// 某明暗模式的中性色，直接讀 DTCG 原始檔的 mode 分層，與建置、ThemeProvider 推算時使用的值同源。
export async function neutralsOf(mode: 'light' | 'dark'): Promise<AccentNeutrals> {
  const tokens = await readJson(join(sourceDir, `mode/${mode}.tokens.json`));
  const value = (name: string) => tokens[name].$value as string;
  return { bg: value('bg'), surface: value('surface'), 'surface-subtle': value('surface-subtle'), text: value('text'), muted: value('muted'), 'accent-ink': value('accent-ink') };
}
