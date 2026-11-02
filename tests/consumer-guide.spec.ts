import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ISSUE-009／PR-ADOPT-07：接入文件的每段程式碼都要和乾淨專案的檔案一致，或在 jsdom 與建置輸出上真的執行過。
// 逐字比對與執行的測試都附「改壞的片段」一起跑：片段寫錯時測試必須變紅，不只是片段不見才紅。
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n');
const guide = read('docs/consumer-guide.md');

// 取標題底下的內容，到下一個同級或更高級的標題為止。
function section(text: string, title: string) {
  const lines = text.split('\n');
  const start = lines.findIndex(line => /^#{2,3} /.test(line) && line.replace(/^#+ /, '') === title);
  expect(start, `找不到標題「${title}」`).toBeGreaterThan(-1);
  const level = lines[start].match(/^#+/)![0].length;
  const end = lines.findIndex((line, index) => index > start && /^#{2,3} /.test(line) && line.match(/^#+/)![0].length <= level);
  return lines.slice(start + 1, end === -1 ? undefined : end).join('\n');
}

// 取標題底下第一個含 marker 的圍欄程式碼區塊內容。
function fence(title: string, marker: string, text = guide) {
  const blocks = [...section(text, title).matchAll(/^```[\w-]*\n([\s\S]*?)^```/gm)].map(match => match[1]);
  const found = blocks.find(block => block.includes(marker));
  expect(found, `〈${title}〉沒有含 ${marker} 的程式碼區塊`).toBeDefined();
  return found!;
}

// 比對用的正規化：每行去頭尾空白、去掉空行與整行註解（範例檔的註解是給維護者看的，不屬於貼上的內容）。
const lines = (code: string) => code.split('\n').map(line => line.trim()).filter(line => line !== '' && !/^(\/\/|\/\*)/.test(line));
const sameCode = (snippet: string, file: string) => lines(snippet).join('\n') === lines(file).join('\n');
// 片段只是要併進現有設定的幾行：每一行都必須逐字出現在乾淨專案的檔案裡。
const subsetCode = (snippet: string, file: string) => lines(snippet).every(line => lines(file).includes(line));

// 兩種改壞法：改一個字（寫錯），和刪掉最長的一行（漏寫）。以 basis 的最長一行為準，改 target 裡同一行，
// 這樣不管 target 是文件片段還是範例檔，改壞的都是兩邊共有的那一行。
function wrongVersions(target: string, basis = target) {
  const longest = lines(basis).reduce((best, line) => line.length > best.length ? line : best, '');
  const actual = target.split('\n').find(line => line.trim() === longest);
  expect(actual, `找不到要改壞的行：${longest}`).toBeDefined();
  return [target.replace(actual!, actual!.replace(/[A-Za-z]{3,}/, 'zzz')), target.replace(`${actual}\n`, '')];
}

const snippets: {name: string; title: string; marker: string; file: string; mode: 'same' | 'subset'}[] = [
  {name: 'Tailwind v3 的 tailwind.config.js', title: '與 Tailwind v3 並用', marker: 'presets: [lucaPreset]', file: 'examples/tailwind-v3/tailwind.config.js', mode: 'same'},
  {name: 'Tailwind v3 的 postcss.config.js', title: '與 Tailwind v3 並用', marker: 'plugins: {tailwindcss', file: 'examples/tailwind-v3/postcss.config.js', mode: 'same'},
  {name: 'Tailwind v3 的 CSS 入口', title: '與 Tailwind v3 並用', marker: "tailwindcss/base", file: 'examples/tailwind-v3/src/index.css', mode: 'same'},
  {name: 'Tailwind v4 的 CSS 入口', title: '與 Tailwind v4 並用', marker: 'tailwindcss/theme.css', file: 'examples/tailwind-v4/src/index.css', mode: 'same'},
  {name: 'Tailwind v4 的 vite.config.js（併進現有設定的片段）', title: '與 Tailwind v4 並用', marker: 'plugins: [tailwindcss()]', file: 'examples/tailwind-v4/vite.config.js', mode: 'subset'},
  {name: 'Next 的 app/layout.tsx', title: '與 Next 並用（App Router）', marker: 'RootLayout', file: 'examples/next/app/layout.tsx', mode: 'same'},
  {name: 'Next 的 app/providers.tsx', title: '與 Next 並用（App Router）', marker: 'export function Providers', file: 'examples/next/app/providers.tsx', mode: 'same'},
  {name: 'React 18 的 vite.config.js（完整檔案）', title: "Vite 的 `'use client'` 警告", marker: 'rolldownOptions', file: 'examples/react-18/vite.config.js', mode: 'same'},
  {name: 'React 18 的首屏腳本外掛片段', title: '整頁主題與防閃爍', marker: 'transformIndexHtml', file: 'examples/react-18/vite.config.js', mode: 'subset'},
  {name: 'React 18 的 ThemeProvider 那一行', title: 'React 18', marker: '<ThemeProvider suite="professional"', file: 'examples/react-18/src/main.tsx', mode: 'subset'},
];

for (const snippet of snippets) {
  test(`the guide quotes ${snippet.name} from the clean project, and a wrong snippet fails the comparison`, () => {
    const code = fence(snippet.title, snippet.marker);
    const file = read(snippet.file);
    const matches = snippet.mode === 'same' ? sameCode : subsetCode;
    expect(matches(code, file), `接入文件的程式碼區塊和 ${snippet.file} 不一致`).toBe(true);
    // 改壞的文件片段與改壞的範例檔都要被抓到；反過來測，比對才不是恆真。
    // 片段模式下少一行仍是子集合，不算錯；只有寫錯的那一種要被抓到。
    const wrongSnippets = snippet.mode === 'same' ? wrongVersions(code) : wrongVersions(code).slice(0, 1);
    for (const wrong of wrongSnippets) expect(matches(wrong, file), `改壞的文件片段仍被當成一致：${wrong}`).toBe(false);
    for (const wrong of wrongVersions(file, code)) expect(matches(code, wrong), '範例檔被改壞後仍被當成一致').toBe(false);
  });
}

test('the guide pins the React 18 clean project versions, and a bumped version fails the comparison', () => {
  const commands = fence('React 18', 'react@18.3.1');
  const versions = (text: string) => Object.fromEntries([...text.matchAll(/(@?[\w/-]+)@(\d+\.\d+\.\d+)/g)].map(match => [match[1], match[2]]));
  const project = JSON.parse(read('examples/react-18/package.json')) as {dependencies: Record<string, string>; devDependencies: Record<string, string>};
  const installed = {...project.dependencies, ...project.devDependencies};
  const quoted = versions(commands);
  expect(Object.keys(quoted).sort()).toEqual(['@types/react', '@types/react-dom', 'react', 'react-dom']);
  for (const [name, version] of Object.entries(quoted)) expect(installed[name], `${name} 的版本和 examples/react-18/package.json 不同`).toBe(version);
  // 版本寫錯時比對要變紅。
  expect(versions(commands.replace('18.3.1', '18.3.0'))['react']).not.toBe(installed['react']);
  expect(guide).toContain('React 18.3.1');
});

test('the Tailwind and React 18 clean projects still carry the strings the guide relies on', () => {
  expect(read('examples/react-18/vite.config.js')).toContain("themeInitScript({suite: 'professional'})");
  expect(read('examples/react-18/src/main.tsx')).toContain('<ThemeProvider suite="professional" target="document">');
});

// ---- 在 jsdom 與建置輸出上執行文件的程式碼 ----

const runner = join(root, 'tests/fixtures/guide-jsdom-runner.mjs');
const scratch = join(root, 'test-results/guide-snippets');
let counter = 0;
// NODE_ENV 固定成 development：react 的 production 版沒有 act，測試行程若繼承 production 會讓 Testing Library 失敗。
// 把原始碼寫到 repo 內（裸模組名稱才解得到 node_modules），交給 jsdom 執行器；回傳結果。
async function run(source: string) {
  mkdirSync(scratch, {recursive: true});
  const file = join(scratch, `snippet-${process.pid}-${counter++}.tsx`);
  await writeFile(file, source);
  const result = spawnSync(process.execPath, [runner, file], {cwd: root, encoding: 'utf8', env: {...process.env, NODE_ENV: 'development'}});
  return {ok: result.status === 0 && result.stdout.includes('SNIPPET OK'), output: `${result.stdout}\n${result.stderr}`};
}
const mustRun = async (source: string) => { const result = await run(source); expect(result.ok, result.output).toBe(true); };
const mustFail = async (source: string, why: string) => { const result = await run(source); expect(result.ok, `${why}，執行卻成功了`).toBe(false); };

test.describe('guide code that is executed', () => {
  test.setTimeout(120_000);

  test('the jsdom snippet runs as written: fireEvent.change does not change the Select, pointerDown before the click does', async () => {
    const code = fence('在 jsdom 測試 Select', 'fireEvent.pointerDown');
    expect(code).toContain('fireEvent.change');
    await mustRun(code);
    // 片段寫錯時要變紅：拿掉 pointerDown，選項不會被選取。
    await mustFail(code.replace(/^.*fireEvent\.pointerDown.*\n/m, ''), '拿掉 pointerDown 的片段應該失敗');
    // 把預期改成 fireEvent.change 有效，片段也要變紅。
    await mustFail(code.replace('expect(picked).toEqual([]);', "expect(picked).toEqual(['pear']);"), '預期寫錯的片段應該失敗');
  });

  test('the MutationObserver snippet reports data-mode changes made by ThemeProvider target="document"', async () => {
    const code = fence('整頁主題與防閃爍', 'new MutationObserver(');
    expect(code).toContain('data-mode');
    const around = (body: string) => `import {act, render} from '@testing-library/react';
import {ThemeProvider, useTheme} from '@luca-style/react';
const modes: (string | undefined)[] = [];
const onModeChange = (mode: string | undefined) => modes.push(mode);
let change = (_mode: 'light' | 'dark') => {};
function Probe() { change = useTheme().setMode; return null; }
${body}
render(<ThemeProvider persist={false} target="document"><Probe/></ThemeProvider>);
await act(async () => { change('dark'); });
await new Promise(done => setTimeout(done, 20));
expect(modes).toContain('dark');
`;
    await mustRun(around(code));
    // 監看別的節點就收不到變化。
    await mustFail(around(code.replace('observer.observe(document.documentElement,', 'observer.observe(document.body,')), '監看錯節點的片段應該失敗');
  });

  test('the old hand-written script sample writes data-theme and style.colorScheme, and the built themeInitScript writes neither', async () => {
    const sample = fence('整頁主題與防閃爍', 'style.colorScheme');
    expect(sample).toContain("'data-theme'");
    await mustRun(`const mode = 'dark';\n${sample}\nexpect(document.documentElement.getAttribute('data-theme')).toBe('dark');\nexpect(document.documentElement.style.colorScheme).toBe('dark');\n`);
    // themeInitScript 取自建置輸出，所以建置改了寫入的屬性，這裡就會變紅。
    const initScript = (extra: string) => `import {themeInitScript} from '@luca-style/react';
window.eval(themeInitScript({suite: 'professional'}));
const html = document.documentElement;
expect(html.getAttribute('data-suite')).toBe('professional');
expect(html.getAttribute('data-mode')).toBe('light');
${extra}`;
    await mustRun(initScript("expect(html.getAttribute('data-theme')).toBeNull();\nexpect(html.style.colorScheme).toBe('');"));
    // 反向：若斷言說它會寫 data-theme，要變紅，證明上面的 toBeNull 不是恆真。
    await mustFail(initScript("expect(html.getAttribute('data-theme')).toBe('light');"), '斷言 data-theme 會被寫入應該失敗');
  });

  test('the third-party portal snippet lands under the theme only with target="document"', async () => {
    const code = fence('第三方 portal', 'createPortal');
    expect(code).toContain('target="document"');
    await mustRun(code);
    // target="self" 時主題屬性只在外層 div，掛到 body 的 portal 拿不到（落回 :root 的預設主題），片段的斷言要變紅。
    await mustFail(code.replace('target="document"', 'target="self"'), 'target="self" 的片段應該失敗');
  });

  test('the built tokens CSS falls back to the vibrant light theme on :root, which is what a portal outside the theme container gets', () => {
    expect(readFileSync(join(root, 'packages/tokens/dist/tokens.css'), 'utf8')).toMatch(/^:root, \[data-luca-theme\]\[data-suite="vibrant"\]\[data-mode="light"\] \{/);
  });

  test('themeInitScript output from the build has no data-theme or colorScheme even for the vibrant default', async () => {
    await mustRun(`import {themeInitScript} from '@luca-style/react';\nwindow.eval(themeInitScript());\nexpect(document.documentElement.getAttribute('data-suite')).toBe('vibrant');\nexpect(document.documentElement.getAttribute('data-theme')).toBeNull();\n`);
  });
});

test('every themeInitScript call in the guide passes a suite', () => {
  const calls = [...guide.matchAll(/themeInitScript\(([^)]*)\)/g)].map(match => match[1]);
  expect(calls.length).toBeGreaterThanOrEqual(3);
  for (const args of calls) expect(args, `themeInitScript(${args}) 沒有傳 suite`).toMatch(/suite/);
  // 反向：沒傳 suite 的呼叫要被這條規則抓到。
  expect('themeInitScript()'.match(/themeInitScript\(([^)]*)\)/)![1]).not.toMatch(/suite/);
});

test('the Vite clean project passes the same suite to the first-paint script and to ThemeProvider', () => {
  expect(read('examples/react-18/vite.config.js').match(/themeInitScript\(\{suite: '(\w+)'\}\)/)?.[1]).toBe(read('examples/react-18/src/main.tsx').match(/<ThemeProvider suite="(\w+)"/)?.[1]);
});

// ---- 安裝用 npm，文件不再有打包檔接法 ----

test('the guide installs from npm with a single command', () => {
  expect(fence('安裝', 'npm install')).toContain('npm install @luca-style/tokens @luca-style/react react react-dom');
});

test('no document still tells readers to pack or install tarballs, except the clean project test mechanism', () => {
  const banned = ['tarball', 'npm pack', '.tgz', '沒有公開 npm 發布要求'];
  for (const path of ['README.md', 'llms.txt', 'docs/adoption-prompt.md', 'docs/consumer-guide.md']) {
    let text = read(path);
    // 例外：〈獨立消費端驗證〉描述乾淨專案測試怎麼跑，那是測試機制，不是接入步驟。
    if (path === 'docs/consumer-guide.md') text = text.replace(section(text, '獨立消費端驗證'), '');
    for (const word of banned) expect(text.toLowerCase(), `${path} 還有「${word}」`).not.toContain(word.toLowerCase());
  }
  // 反向：例外只限那一節，其他地方出現就要被抓到。
  expect(section(guide, '獨立消費端驗證').toLowerCase()).toContain('tarball');
});

// ---- 連結不能斷 ----

test('relative links in the guide and README resolve to files and headings that exist', () => {
  const slug = (heading: string) => heading.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');
  for (const doc of ['docs/consumer-guide.md', 'README.md']) {
    const text = read(doc).replace(/^```[\s\S]*?^```/gm, '');
    const links = [...text.matchAll(/\]\(([^)\s]+)\)/g)].map(match => match[1]).filter(link => !/^(https?:|mailto:|#)/.test(link));
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      const [path, anchor] = link.split('#');
      const target = resolve(root, dirname(doc), decodeURIComponent(path));
      expect(existsSync(target), `${doc} 的連結 ${link} 指向不存在的檔案`).toBe(true);
      if (anchor && target.endsWith('.md')) {
        const slugs = readFileSync(target, 'utf8').split(/\r?\n/).filter(line => /^#{1,6} /.test(line)).map(line => slug(line.replace(/^#+ /, '')));
        expect(slugs, `${doc} 的連結 ${link} 指向不存在的標題`).toContain(decodeURIComponent(anchor));
      }
    }
  }
  expect(slug('狀態總覽頁承諾')).toBe('狀態總覽頁承諾');
});

// ---- PR-ADOPT-07 搬進 truth layer ----

test('PR-ADOPT-07 lives in the design-system capability with all 7 items, and the guide covers each one', () => {
  const capability = read('docs/capabilities/design-system.md');
  const adoption = capability.indexOf('### 接入與發佈承諾');
  expect(adoption).toBeGreaterThan(-1);
  const promises = capability.slice(adoption, capability.indexOf('### 狀態總覽頁承諾'));
  const promise = promises.match(/^PR-ADOPT-07 — .*$/m)?.[0] ?? '';
  expect(promise, '「接入與發佈承諾」沒有 PR-ADOPT-07').not.toBe('');
  for (const item of ['MutationObserver', 'data-theme', 'suite', 'fireEvent.change', 'pointerDown', 'target="self"', 'design-tokens.md']) expect(promise, `PR-ADOPT-07 沒有提到 ${item}`).toContain(item);
  // 其他編號不重編：01 到 05、08 仍在同一小節。
  for (const id of ['01', '02', '03', '04', '05', '08']) expect(promises).toMatch(new RegExp(`^PR-ADOPT-${id} — `, 'm'));
  // 第 7 項在文件裡的落點：Windows 換行符差異的指令在圍欄內。
  expect(fence('在 luca-style 檢出內建置', 'git checkout -- docs/design-tokens.md')).toContain('git checkout -- docs/design-tokens.md');
});

// ---- React 版本說法一致 ----

test('the guide and DESIGN.md state the React peer range of the published package', () => {
  const peer = (JSON.parse(read('packages/react/package.json')) as {peerDependencies: Record<string, string>}).peerDependencies;
  expect(peer.react).toBe('^18.0.0 || ^19.0.0');
  expect(peer['react-dom']).toBe(peer.react);
  expect(guide).toContain(`\`${peer.react}\``);
  const row = read('DESIGN.md').split('\n').find(line => line.startsWith('| `@luca-style/react`')) ?? '';
  expect(row).toContain('React 18 與 19');
  expect(row).not.toContain('React 19 元件');
});

// ---- 相依的安裝腳本 ----

test('package-lock.json lists no package with an install script except the allowlisted optional ones', () => {
  const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8')) as {packages: Record<string, {hasInstallScript?: boolean; optional?: boolean}>};
  // 允許清單要寫明理由：fsevents 只在 macOS 安裝，是 optional 相依，本來就在 lockfile 裡。
  const allowed: Record<string, string> = {'node_modules/fsevents': 'macOS 專用的 optional 相依'};
  const withScripts = Object.entries(lock.packages).filter(([, info]) => info.hasInstallScript).map(([name]) => name);
  expect(withScripts.filter(name => !(name in allowed)), '出現未列入允許清單的安裝腳本').toEqual([]);
  for (const name of withScripts) expect(lock.packages[name].optional, `${name} 必須是 optional`).toBe(true);
  // 測試相依一律釘死版本，不帶 ^ 或 ~。
  const dev = (JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {devDependencies: Record<string, string>}).devDependencies;
  for (const name of ['jsdom', '@testing-library/react', '@testing-library/dom', 'react', 'react-dom']) expect(dev[name], `${name} 沒有釘死版本`).toMatch(/^\d+\.\d+\.\d+$/);
});
