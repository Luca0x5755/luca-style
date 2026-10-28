import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// ISSUE-013／PR-STYLE-43：repo 根目錄的 llms.txt 與 DESIGN.md 給代理讀。
// 散文由人寫，但事實（變數名、顏色、等級、元件、props、程式範例）一律對照實際的建置資料與公開匯出。

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path: string) => readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n');
const repoUrl = 'https://github.com/Luca0x5755/luca-style/blob/main/';

test('llms.txt follows the llms.txt format and every link points at a real file, including the spec document and DESIGN.md', () => {
  const text = read('llms.txt');
  const lines = text.split('\n');
  expect(lines[0]).toMatch(/^# \S/);
  expect(lines.find(line => line.trim() !== '' && line !== lines[0])).toMatch(/^> \S/);
  expect(text).toMatch(/^## .+\n\n?- \[.+\]\(.+\)/m);
  const links = [...text.matchAll(/^- \[([^\]]+)\]\(([^)]+)\)/gm)].map(match => match[2]);
  expect(links.length).toBeGreaterThanOrEqual(3);
  for (const link of links) {
    expect(link.startsWith(repoUrl), `${link} 應指向 repo 的 main 分支`).toBe(true);
    expect(existsSync(join(root, link.slice(repoUrl.length))), `${link} 對應的檔案不存在`).toBe(true);
  }
  expect(links).toContain(`${repoUrl}docs/design-tokens.md`);
  expect(links).toContain(`${repoUrl}DESIGN.md`);
});

// 公開匯出與型別資訊：從 TypeScript 程式庫介面取得，不手抄。
const entry = join(root, 'packages/react/src/index.tsx');
const program = ts.createProgram([entry], {
  jsx: ts.JsxEmit.ReactJSX, strict: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, skipLibCheck: true, noEmit: true, types: ['node'],
});
const checker = program.getTypeChecker();
const moduleSymbol = checker.getSymbolAtLocation(program.getSourceFile(entry)!)!;
const exports = () => checker.getExportsOfModule(moduleSymbol);
const aliased = (symbol: ts.Symbol) => symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
const declaredType = (name: string) => checker.getDeclaredTypeOfSymbol(aliased(exports().find(symbol => symbol.name === name)!));
const valueExports = () => exports().filter(symbol => aliased(symbol).flags & ts.SymbolFlags.Value).map(symbol => symbol.name);
const propertiesOf = (typeName: string) => declaredType(typeName).getProperties().map(property => property.name);
const literalsOf = (typeName: string) => (declaredType(typeName) as ts.UnionType).types.map(type => (type as ts.StringLiteralType).value);

test('DESIGN.md names every public export of @luca-style/react, every ThemeProvider prop, every AccentInput field and every level', () => {
  const doc = read('DESIGN.md');
  const names = valueExports();
  expect(names).toEqual(expect.arrayContaining(['ThemeProvider', 'Select', 'themeInitScript']));
  for (const name of names) expect(doc, `DESIGN.md 沒提到匯出 ${name}`).toMatch(new RegExp(`\\b${name}\\b`));
  for (const prop of propertiesOf('ThemeProviderProps')) expect(doc, `DESIGN.md 沒提到 ThemeProvider 的 ${prop}`).toMatch(new RegExp(`\\b${prop}\\b`));
  for (const field of propertiesOf('AccentInput')) expect(doc, `DESIGN.md 沒提到 AccentInput 的 ${field}`).toMatch(new RegExp(`\\b${field}\\b`));
  for (const type of ['StyleSuite', 'ColorMode', 'Density', 'Shape']) for (const value of literalsOf(type)) expect(doc, `DESIGN.md 沒提到 ${type} 的 ${value}`).toContain(`\`${value}\``);
});

test('variable names and colors quoted in the docs exist in the built tokens', () => {
  const css = readFileSync(join(root, 'packages/tokens/dist/tokens.css'), 'utf8');
  const data = JSON.parse(readFileSync(join(root, 'packages/tokens/dist/tokens.json'), 'utf8')) as Record<string, Record<string, Record<string, string>>>;
  const defined = new Set([...css.matchAll(/^\s+--([a-z0-9-]+):/gm)].map(match => match[1]));
  const colors = new Set(Object.values(data).flatMap(suite => Object.values(suite)).flatMap(mode => Object.values(mode)).map(value => value.toUpperCase()));
  for (const file of ['DESIGN.md', 'llms.txt']) {
    const text = read(file);
    // 範本寫法 --type-<角色>-size 不是實際變數名，略過。
    const used = [...text.matchAll(/--([a-z][a-z0-9-]*)(?![a-z0-9<>-])/g)].map(match => match[1]);
    for (const name of used) expect(defined.has(name), `${file} 提到不存在的變數 --${name}`).toBe(true);
    // 程式範例裡的顏色是使用端自己的輸入（例如專案強調色），不是設計變數的值，所以只檢查說明文字。
    const prose = text.replace(/^```[\s\S]*?^```/gm, '');
    for (const color of prose.match(/#[0-9A-Fa-f]{6}\b/g) ?? []) expect(colors.has(color.toUpperCase()), `${file} 提到不在建置資料中的顏色 ${color}`).toBe(true);
  }
  // 文件至少要引用一個實際的變數，否則上面的檢查是空轉。
  expect(read('DESIGN.md')).toMatch(/--[a-z]/);
});

// 不檢查副作用匯入（fonts.css 沒有型別宣告，使用端靠 bundler 的 client 型別處理）；具名匯入與型別照常檢查。
// 擷取 ```ts／```tsx 區塊，各自成一個檔案，以與專案相同的選項編譯；放在被忽略的 node_modules/.cache 下才解析得到 workspace 套件。
function typecheck(snippets: string[]) {
  const dir = join(root, 'node_modules/.cache/luca-design-md');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const files = snippets.map((code, index) => { const file = join(dir, `snippet-${index}.tsx`); writeFileSync(file, code); return file; });
  const result = spawnSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '--ignoreConfig', '--pretty', 'false', '--noUncheckedSideEffectImports', 'false', '--jsx', 'react-jsx', '--strict', '--target', 'ES2022', '--module', 'ESNext',
    '--moduleResolution', 'Bundler', '--skipLibCheck', '--esModuleInterop', '--resolveJsonModule', '--types', 'node', '--lib', 'ES2022,DOM', ...files], { cwd: root, encoding: 'utf8' });
  rmSync(dir, { recursive: true, force: true });
  return { status: result.status, output: result.stdout + result.stderr };
}
const snippetsOf = (markdown: string) => [...markdown.matchAll(/^```tsx?\n([\s\S]*?)^```/gm)].map(match => match[1]);

test('every ts/tsx code block in DESIGN.md compiles against the built packages', () => {
  const snippets = snippetsOf(read('DESIGN.md'));
  expect(snippets.length).toBeGreaterThanOrEqual(3);
  const result = typecheck(snippets);
  expect(result.output).toBe('');
  expect(result.status).toBe(0);
});

test('the typecheck harness fails on a snippet that uses a prop value which does not exist', () => {
  const result = typecheck([`import { ThemeProvider } from '@luca-style/react';\nexport const App = () => <ThemeProvider suite="nope" density="tiny">x</ThemeProvider>;\n`]);
  expect(result.status).not.toBe(0);
  expect(result.output).toContain('error TS2322');
});

function packedFiles(directory: string) {
  const result = spawnSync('npm', ['pack', '--dry-run', '--json'], { cwd: join(root, 'packages', directory), encoding: 'utf8', shell: true });
  expect(result.status, result.stderr).toBe(0);
  return (JSON.parse(result.stdout)[0].files as { path: string }[]).map(file => file.path);
}

test('the packed @luca-style/react tarball contains DESIGN.md and llms.txt, and @luca-style/tokens contains the spec document', () => {
  expect(packedFiles('react')).toEqual(expect.arrayContaining(['DESIGN.md', 'llms.txt']));
  expect(packedFiles('tokens')).toEqual(expect.arrayContaining(['design-tokens.md']));
});
