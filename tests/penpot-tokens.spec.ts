import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeWorkspace, readJson, readText, runGenerator } from './tokens-helpers';

// ISSUE-018／PR-FILE-25：建置另外輸出 Penpot 可匯入的 token JSON，涵蓋 4 個 Suite x Mode 與 3 個 Device；
// 期望值取自獨立的 DTCG 解析結果（tokens.json、typography.json），不從輸出檔自己推。

type Token = { $value: string; $type: string };
type Theme = { id: string; name: string; group: string; selectedTokenSets: Record<string, string> };
type PenpotFile = { $themes: Theme[]; $metadata: { tokenSetOrder: string[] } } & Record<string, unknown>;

const suites = ['vibrant', 'professional'] as const;
const modes = ['light', 'dark'] as const;
const devices = ['desktop', 'tablet', 'mobile'] as const;
const title = (word: string) => word[0].toUpperCase() + word.slice(1);

async function generatePenpot(edit?: (source: string) => Promise<void>) {
  const workspace = await makeWorkspace();
  try {
    if (edit) await edit(workspace.source);
    const result = runGenerator(workspace.root, 'src', 'out', ['--penpot', 'penpot/tokens.json']);
    const file = result.status === 0 ? await readJson(join(workspace.root, 'penpot/tokens.json')) as PenpotFile : undefined;
    const data = result.status === 0 ? await readJson(join(workspace.out, 'tokens.json')) as Record<string, Record<string, Record<string, string>>> : undefined;
    const typography = result.status === 0 ? await readJson(join(workspace.out, 'typography.json')) as Record<string, Record<string, string | number>> : undefined;
    return { ...result, file, data, typography };
  } finally {
    await workspace.dispose();
  }
}

const tokensOf = (file: PenpotFile, set: string) => file[set] as Record<string, Token>;

test('the Penpot token JSON has one Suite x Mode theme per suite and mode, and one Device theme per size', async () => {
  const { status, stderr, file } = await generatePenpot();
  expect(stderr).toBe('');
  expect(status).toBe(0);
  const byGroup = (group: string) => file!.$themes.filter(theme => theme.group === group).map(theme => theme.name);
  expect(byGroup('Suite x Mode')).toEqual(['Vibrant / Light', 'Vibrant / Dark', 'Professional / Light', 'Professional / Dark']);
  expect(byGroup('Device')).toEqual(['Desktop', 'Tablet', 'Mobile']);
  // 每個 theme 只啟用自己的 set（加共用的 Base），所以同群組只能啟用一個組合（ISSUE-015）。
  const enabled = (theme: Theme) => Object.entries(theme.selectedTokenSets).filter(([, state]) => state === 'enabled').map(([name]) => name);
  for (const theme of file!.$themes) {
    for (const name of enabled(theme)) expect(file![name], `${theme.name} 啟用的 set ${name} 存在`).toBeDefined();
    expect(enabled(theme).filter(name => name !== 'Base')).toHaveLength(1);
  }
});

test('every Suite x Mode set carries the DTCG colour values of that suite and mode', async () => {
  const { file, data } = await generatePenpot();
  // 程式變數合併後以設計檔舊名輸出（ADR 0004）。
  const legacyName: Record<string, string> = { 'accent-secondary': 'secondary', 'metric-background': 'card-highlight' };
  for (const suite of suites) for (const mode of modes) {
    const set = tokensOf(file!, `Suite x Mode/${title(suite)}-${title(mode)}`);
    const css = data![suite][mode];
    const resolve = (value: string): string => { const ref = value.match(/^var\(--([a-z0-9-]+)\)$/); return ref ? resolve(css[ref[1]]) : value; };
    const colours = Object.entries(css).filter(([, value]) => /^#[0-9A-Fa-f]{6}$/.test(resolve(value)));
    expect(colours.length).toBeGreaterThan(10);
    for (const [name, value] of colours) {
      const token = set[legacyName[name] ?? name];
      expect(token, `${suite}/${mode} 缺 ${name}`).toBeDefined();
      expect(token.$type).toBe('color');
      expect(token.$value.toUpperCase()).toBe(resolve(value).toUpperCase());
    }
  }
});

test('every Device set carries the font sizes of that device in pixels', async () => {
  const { file, typography } = await generatePenpot();
  const px = (value: string | number) => String(value).endsWith('rem') ? Number.parseFloat(String(value)) * 16 : Number.parseFloat(String(value));
  for (const device of devices) {
    const set = tokensOf(file!, `Device/${title(device)}`);
    expect(Number(set['fs-hero'].$value)).toBe(px(typography!.hero[device]));
    expect(Number(set['fs-title'].$value)).toBe(px(typography!.title[device]));
    expect(Number(set['fs-section'].$value)).toBe(px(typography!.section[device]));
    expect(set['fs-hero'].$type).toBe('fontSizes');
  }
});

test('changing a DTCG colour changes the Penpot token JSON for that combination only', async () => {
  const { file } = await generatePenpot(async source => {
    const path = join(source, 'suite/vibrant/light.tokens.json');
    const tokens = await readJson(path);
    tokens.accent.$value = '#123456';
    await writeFile(path, JSON.stringify(tokens));
  });
  expect(tokensOf(file!, 'Suite x Mode/Vibrant-Light').accent.$value).toBe('#123456');
  expect(tokensOf(file!, 'Suite x Mode/Vibrant-Dark').accent.$value).toBe('#64C2BC');
});

test('the committed docs/mockup/themes/penpot-tokens.json is generated output, identical to a fresh npm run generate', async () => {
  const committed = await readText(fileURLToPath(new URL('../docs/mockup/themes/penpot-tokens.json', import.meta.url)));
  const workspace = await makeWorkspace();
  try {
    expect(runGenerator(workspace.root, 'src', 'out', ['--penpot', 'penpot.json']).status).toBe(0);
    expect(committed).toBe(await readText(join(workspace.root, 'penpot.json')));
  } finally {
    await workspace.dispose();
  }
});
