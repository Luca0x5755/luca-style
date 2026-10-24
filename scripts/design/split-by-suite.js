// 已完成的一次性工具：來源 docs/mockup/components.fig 已刪除（提交 ebe6c61 找得回），本腳本現在無法執行，
// 留下來是為了記錄切檔做法與下方的 Windows 修補說明（其他腳本引用）。
//
// 把 docs/mockup/components.fig 依套系切成兩個可用 MCP 編輯的設計檔：
//   docs/mockup/components-vibrant.fig      精緻活力
//   docs/mockup/components-professional.fig 精緻專業
// 用法：node scripts/design/split-by-suite.js
//
// 做法：以離線 `openpencil eval` 讀入原檔，刪掉另一套系的頂層 frame，
// 並移除「Internal Only Canvas」頁，再輸出成新檔。完全離線，不經過 OpenPencil App，
// 因為在 App 內大量刪除節點會讓 WebAssembly 渲染器損壞並使 App 當機。
// 共用物件（C/ 母版、Library guide、00 / Canvas directory、兩個套系標題文字）兩檔各留一份。
//
// Windows 注意事項：openpencil 需要兩處本機修補，否則會出現
//   ENOENT D:\C:\Users\...\canvaskit.wasm
// 修補位置在全域 npm 目錄 @open-pencil/cli/node_modules/@open-pencil/core/dist/ 下的
//   io/formats/raster/headless.js 與 canvaskit.js，
// 以 fileURLToPath 取代直接使用 URL.pathname。重新安裝套件會還原修補，需再套用一次。
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const source = join(root, 'docs/mockup/components.fig');

// 每個套系要刪除的是「另一個套系」的頂層 frame。
// 名稱形如 <頁>/Professional/...、Professional/...、Professional ?/...。
// 只比對 FRAME，所以兩個「… / Style zone heading」文字節點與 COMPONENT 母版不會被誤刪。
const suites = [
  { output: 'docs/mockup/components-vibrant.fig', drop: 'Professional' },
  { output: 'docs/mockup/components-professional.fig', drop: 'Vibrant' },
];

// 在 openpencil 內執行的 Figma Plugin API 腳本，以 stdin 傳入。
const buildEvalScript = (drop) => `
const drop = ${JSON.stringify(drop)}
const dropName = new RegExp('^(?:[^/]+/)?' + drop + '(?: ?/|/)')
const isOtherSuite = (n) => n.type === 'FRAME' && dropName.test(n.name)
const library = figma.root.children.find((p) => p.name === 'Library guide')
if (!library) throw new Error('找不到 Library guide 頁')
const removed = library.children.filter(isOtherSuite)
removed.forEach((n) => n.remove())
// 移除 Internal Only Canvas 頁（原檔為空白頁，不含任何節點）。
figma.root.children.filter((p) => p.name === 'Internal Only Canvas').forEach((p) => {
  if (p.children.length > 0) throw new Error('Internal Only Canvas 不是空白頁，請先確認內容')
  p.remove()
})
return { removed: removed.length, remaining: library.children.length }
`;

for (const { output, drop } of suites) {
  const target = join(root, output);
  // shell: true 是為了在 Windows 上執行 openpencil.cmd。
  const result = execFileSync(
    'openpencil',
    ['eval', source, '--stdin', '-o', target],
    { cwd: dirname(source), input: buildEvalScript(drop), encoding: 'utf8', shell: true },
  );
  console.log(`${output}（移除 ${drop}）\n${result.trim()}`);
}
