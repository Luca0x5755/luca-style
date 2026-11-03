import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { makeWorkspace, readJson, readText, runGenerator, tokensPackage } from './tokens-helpers';

type Preset = { theme: { extend: { colors: Record<string, string> } } };
const load = createRequire(import.meta.url);
const text = (path: string) => readText(join(tokensPackage, '../..', path));

// 在暫存工作區改一份分層檔、跑產生器，再交給 read 讀輸出（工作區在 read 之後才刪）。
async function generateAfter<T>(edit: (tokens: Record<string, Record<string, unknown>>) => void, read: (out: string) => T | Promise<T>) {
  const workspace = await makeWorkspace();
  try {
    // base 分層進入每個組合，新角色才不會被完整性檢查擋下。
    const file = join(workspace.source, 'base.tokens.json');
    const tokens = await readJson(file);
    edit(tokens);
    await writeFile(file, JSON.stringify(tokens, null, 2));
    const result = runGenerator(workspace.root);
    expect(result.stderr).toBe('');
    return await read(workspace.out);
  } finally {
    await workspace.dispose();
  }
}

// 以 require 載入 preset（與 tailwind.config 使用的方式相同）。
const presetAfter = (edit: (tokens: Record<string, Record<string, unknown>>) => void) =>
  generateAfter(edit, out => load(join(out, 'tailwind-preset.cjs')) as Preset);

// v4 的 CSS 設定檔：取出 @theme 區塊裡的 --color-* 宣告，名稱對應到值。
const v4ThemeAfter = (edit: (tokens: Record<string, Record<string, unknown>>) => void) => generateAfter(edit, async out => {
  const css = await readText(join(out, 'tailwind-theme.css'));
  const block = css.match(/@theme inline \{([^}]*)\}/)?.[1];
  expect(block, 'v4 設定檔沒有 @theme inline 區塊').toBeDefined();
  return Object.fromEntries([...block!.matchAll(/--color-([a-z0-9-]+):\s*([^;]+);/g)].map(match => [match[1], match[2].trim()]));
});

test('the preset maps a color role to its variable through <alpha-value>, so opacity modifiers keep working', async () => {
  const { colors } = (await presetAfter(() => {})).theme.extend;
  expect(colors.success).toBe('color-mix(in srgb, var(--success) calc(<alpha-value> * 100%), transparent)');
  expect(colors['surface-subtle']).toBe('color-mix(in srgb, var(--surface-subtle) calc(<alpha-value> * 100%), transparent)');
});

test('a new color role in the DTCG source reaches the preset', async () => {
  const { colors } = (await presetAfter(tokens => {
    tokens['new-role'] = { $value: '#123456', $type: 'color', $description: '測試用的新角色' };
  })).theme.extend;
  expect(colors['new-role']).toBe('color-mix(in srgb, var(--new-role) calc(<alpha-value> * 100%), transparent)');
});

test('the preset leaves out tokens that are not color roles and tokens only the design file uses', async () => {
  const { colors } = (await presetAfter(tokens => {
    tokens['design-only'] = { $value: '#123456', $type: 'color', $description: '只給設計檔', $extensions: { 'luca-style': { designFileOnly: true } } };
  })).theme.extend;
  for (const name of ['space-1', 'control-height', 'font-body', 'design-only']) expect(Object.keys(colors)).not.toContain(name);
});

// v4 用 @theme inline：utility 直接引用 Luca 的變數，才會跟著套系、明暗與專案強調色改變；透明度由 Tailwind 自己的 color-mix 處理。
test('the Tailwind v4 theme maps each color role to its variable inline', async () => {
  const colors = await v4ThemeAfter(() => {});
  expect(colors.success).toBe('var(--success)');
  expect(colors['surface-subtle']).toBe('var(--surface-subtle)');
});

test('a new color role in the DTCG source reaches the Tailwind v4 theme', async () => {
  const colors = await v4ThemeAfter(tokens => {
    tokens['new-role'] = { $value: '#123456', $type: 'color', $description: '測試用的新角色' };
  });
  expect(colors['new-role']).toBe('var(--new-role)');
});

test('the Tailwind v4 theme leaves out tokens that are not color roles and tokens only the design file uses', async () => {
  const colors = await v4ThemeAfter(tokens => {
    tokens['design-only'] = { $value: '#123456', $type: 'color', $description: '只給設計檔', $extensions: { 'luca-style': { designFileOnly: true } } };
  });
  for (const name of ['space-1', 'control-height', 'font-body', 'design-only']) expect(Object.keys(colors)).not.toContain(name);
});

// 「依文件」要測到文件寫的內容：乾淨專案的設定檔必須逐字出現在接入文件裡。
test('the consumer guide quotes the clean project CSS entry and config files verbatim', async () => {
  const guide = await text('docs/consumer-guide.md');
  for (const file of ['src/index.css', 'tailwind.config.js', 'postcss.config.js']) expect(guide, `接入文件沒有逐字引用 ${file}`).toContain((await text(`examples/tailwind-v3/${file}`)).trim());
});

test('the clean project adds only the preset and writes no color mapping', async () => {
  const config = await text('examples/tailwind-v3/tailwind.config.js');
  expect(config).toContain('presets: [lucaPreset]');
  expect(config).not.toMatch(/colors|theme/);
});

// Vite 設定檔另有乾淨專案自己的多頁入口，只要求接 Tailwind 的那兩行逐字出現。
test('the consumer guide quotes the Tailwind v4 clean project CSS entry and Vite plugin lines verbatim', async () => {
  const guide = await text('docs/consumer-guide.md');
  expect(guide, '接入文件沒有逐字引用 v4 的 src/index.css').toContain((await text('examples/tailwind-v4/src/index.css')).trim());
  const pluginLines = (await text('examples/tailwind-v4/vite.config.js')).split(/\r?\n/).filter(line => line.includes('tailwindcss')).map(line => line.trim());
  expect(pluginLines).toEqual(["import tailwindcss from '@tailwindcss/vite';", 'plugins: [tailwindcss()],']);
  for (const line of pluginLines) expect(guide, `接入文件沒有 ${line}`).toContain(line);
});

test('the Tailwind v4 clean project imports only Luca CSS and writes no color mapping', async () => {
  const entry = await text('examples/tailwind-v4/src/index.css');
  expect(entry).toContain("@import '@luca-style/tokens/tailwind.css';");
  expect(entry).not.toMatch(/@theme|--color-/);
});

test('the consumer guide states the :focus-visible exception and the focus-visible: prefix', async () => {
  const guide = await text('docs/consumer-guide.md');
  expect(guide).toContain('`:focus-visible` 是例外');
  expect(guide).toContain('`focus-visible:` 前綴');
});

test('the design-system capability carries the adoption promises before the state overview promises', async () => {
  const capability = await text('docs/capabilities/design-system.md');
  const adoption = capability.indexOf('### 接入與發佈承諾');
  expect(adoption, '缺少接入與發佈承諾小節').toBeGreaterThan(-1);
  expect(adoption).toBeLessThan(capability.indexOf('### 狀態總覽頁承諾'));
  const promise = (id: string) => capability.slice(adoption).match(new RegExp(`^${id} — .*$`, 'm'))?.[0] ?? '';
  expect(promise('PR-ADOPT-03')).toContain('border-success/40');
  expect(promise('PR-ADOPT-04')).toContain('Tailwind v4');
  expect(promise('PR-ADOPT-04')).toContain('border-success/40');
  expect(promise('PR-ADOPT-05')).toContain('`:focus-visible`');
  expect(promise('PR-ADOPT-05')).toContain('`focus-visible:` 前綴');
  // v4 的部分已驗證，承諾涵蓋兩個版本，不再寫成待驗證。
  expect(promise('PR-ADOPT-05')).toContain('Tailwind v3 與 v4');
  expect(promise('PR-ADOPT-05')).not.toContain('ISSUE-003');
});
