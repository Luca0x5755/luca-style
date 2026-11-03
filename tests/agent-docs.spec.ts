import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
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

// ISSUE-008／PR-ADOPT-08：DESIGN.md 開頭的 front matter 由 DTCG 原始檔產生，front matter 之後的正文是手寫的。
const frontMatterOf = (text: string) => text.match(/^---\n[\s\S]*?\n---\n/)?.[0] ?? '';

// 以暫存目錄的 DESIGN.md 副本執行產生器；輸出目錄也在暫存，不動 dist 與已提交的檔案。
function regenerate(designMd: string) {
  const dir = mkdtempSync(join(tmpdir(), 'luca-design-md-'));
  try {
    const target = join(dir, 'DESIGN.md');
    writeFileSync(target, designMd);
    const result = spawnSync(process.execPath, ['build.mjs', '--source', 'src', '--out', join(dir, 'dist'), '--design-md', target], { cwd: join(root, 'packages/tokens'), encoding: 'utf8' });
    return { status: result.status, stderr: result.stderr, text: readFileSync(target, 'utf8') };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('regenerating DESIGN.md from the DTCG source leaves its front matter unchanged', () => {
  const committed = read('DESIGN.md');
  const result = regenerate(committed);
  expect(result.stderr).toBe('');
  expect(result.status).toBe(0);
  expect(frontMatterOf(committed), 'DESIGN.md 沒有 front matter').not.toBe('');
  expect(frontMatterOf(result.text)).toBe(frontMatterOf(committed));
});

test('regenerating replaces only the front matter: hand-written prose survives byte for byte and a second run changes nothing', () => {
  const prose = '\n# 手寫標題\n\n手寫說明，含 `--accent` 與 | 表格。\n\n## 元件\n\n最後一行沒有額外換行。\n';
  const stale = `---\nversion: alpha\nname: 過期\ncolors:\n  primary: "#000000"\n---\n${prose}`;
  const first = regenerate(stale);
  expect(first.status, first.stderr).toBe(0);
  expect(first.text.slice(frontMatterOf(first.text).length)).toBe(prose);
  expect(frontMatterOf(first.text)).toBe(frontMatterOf(read('DESIGN.md')));
  expect(regenerate(first.text).text).toBe(first.text);
  // Windows 的 CRLF 檔案：輸出仍是 LF，與 LF 輸入的結果相同。
  const crlf = regenerate(stale.replace(/\n/g, '\r\n'));
  expect(crlf.text).toBe(first.text);
  expect(crlf.text).not.toContain('\r');
});

test('front matter colors, typography, radii and spacing match the vibrant light values in the built tokens', () => {
  const front = frontMatterOf(read('DESIGN.md'));
  const data = JSON.parse(readFileSync(join(root, 'packages/tokens/dist/tokens.json'), 'utf8')).vibrant.light as Record<string, string>;
  const typography = JSON.parse(readFileSync(join(root, 'packages/tokens/dist/typography.json'), 'utf8')) as Record<string, Record<string, string | number>>;
  // 兩層縮排的 key: value 行，依所屬區塊取出。
  const section = (name: string) => Object.fromEntries([...front.matchAll(new RegExp(`^${name}:\n((?:  .*\n)+)`, 'gm'))].flatMap(match => [...match[1].matchAll(/^  ([a-z0-9-]+): "?([^"\n]+)"?$/gm)].map(entry => [entry[1], entry[2]])));
  const colors = section('colors');
  for (const name of ['bg', 'surface', 'text', 'border', 'success', 'warning', 'error', 'accent', 'accent-hover', 'focus-ring']) expect(colors[name], `colors.${name}`).toBe(data[name]);
  expect(colors.primary).toBe(data.accent);
  expect(Object.values(colors).every(value => /^#[0-9A-Fa-f]{6}$/.test(value)), '每個顏色都是色碼，沒有 var() 參照').toBe(true);
  expect(section('rounded')).toEqual({ card: data['radius-card'], control: data['radius-control'] });
  expect(section('spacing')['space-4']).toBe(data['space-4']);
  expect(front).toContain(`    fontSize: "${typography.hero.desktop}"`);
  expect(front).toContain(`    fontWeight: ${typography.hero.weight}`);
});

test('DESIGN.md prose says the front matter holds only the vibrant light values and points to the spec document for the rest', () => {
  const prose = read('DESIGN.md').slice(frontMatterOf(read('DESIGN.md')).length);
  expect(prose).toMatch(/front matter[^\n]*只是 `vibrant` 套系日間模式的代表值/);
  expect(prose).toMatch(/其他套系與暗黑模式的值只看\[設計變數規格\]\(https:\/\/github\.com\/Luca0x5755\/luca-style\/blob\/main\/docs\/design-tokens\.md\)/);
});

// 以釘住版本的 @google/design.md 檢查；用 node 直接執行入口檔，不依賴 npx 的行為。
function lintDesignMd(text: string) {
  const dir = mkdtempSync(join(tmpdir(), 'luca-design-lint-'));
  try {
    const file = join(dir, 'DESIGN.md');
    writeFileSync(file, text);
    const result = spawnSync(process.execPath, [join(root, 'node_modules/@google/design.md/dist/index.js'), 'lint', file], { encoding: 'utf8' });
    const report = JSON.parse(result.stdout) as { findings: { severity: string; rule?: string; message: string }[]; summary: { errors: number; warnings: number } };
    return { status: result.status, report };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('DESIGN.md passes the Google DESIGN.md lint with no errors and no warnings', () => {
  const { status, report } = lintDesignMd(read('DESIGN.md'));
  expect(report.findings.filter(finding => finding.severity !== 'info')).toEqual([]);
  expect(report.summary.errors).toBe(0);
  expect(status).toBe(0);
});

test('the lint fails on a DESIGN.md whose component token references a color that does not exist', () => {
  const broken = read('DESIGN.md').replace(/^---\n/, '---\ncomponents:\n  button-primary:\n    backgroundColor: "{colors.nope}"\n');
  const { status, report } = lintDesignMd(broken);
  expect(report.findings.map(finding => finding.rule)).toContain('broken-ref');
  expect(status).not.toBe(0);
});
