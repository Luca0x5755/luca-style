// 把兩個套系設計檔的 frame 依產品頁面分到不同畫布頁，避免所有 frame 擠在一頁使 OpenPencil 當機。
//   docs/mockup/components-vibrant.fig
//   docs/mockup/components-professional.fig
// 用法：
//   node scripts/design/paginate-fig.js           分頁（已是最新就不寫檔；可重跑）
//   node scripts/design/paginate-fig.js --check   唯讀檢查：位置不對的頂層節點、連不到母版的實例
// 結束碼：0 沒有問題；1 有問題（逐行列出）；2 讀檔或 openpencil 執行失敗。
// 規則見 pages.js：frame 名稱第一段是產品頁面就放同名畫布頁，其餘（母版、檢視板、目錄、標題）放 Library guide。
//
// 只搬移，不改任何節點內容與 frame 名稱。一次只處理一個檔案；
// 執行前請先在 OpenPencil App 關閉這兩個檔案（unsaved: discard），避免 App 回寫。
//
// 全程以離線 `openpencil eval` 讀寫檔案。Windows 的 openpencil 本機修補事項見 split-by-suite.js 檔頭。
// 測試用環境變數：PAGINATE_VIBRANT、PAGINATE_PROFESSIONAL。
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGE_RULES_SNIPPET } from './pages.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const files = [
  { suite: 'Vibrant', path: resolve(process.env.PAGINATE_VIBRANT || join(root, 'docs/mockup/components-vibrant.fig')) },
  { suite: 'Professional', path: resolve(process.env.PAGINATE_PROFESSIONAL || join(root, 'docs/mockup/components-professional.fig')) },
];

// 唯讀：回傳各畫布頁的 frame 數與節點數、位置不對的頂層節點、連不到母版的實例。
const CHECK_SNIPPET = `${PAGE_RULES_SNIPPET}
const pages = {}
const misplaced = []
let unresolved = 0
let instances = 0
for (const pg of figma.root.children) {
  if (IGNORED_PAGES.includes(pg.name)) continue
  let nodes = 0
  for (const top of pg.children) {
    const all = [top].concat(top.findAll ? top.findAll(() => true) : [])
    nodes += all.length
    for (const n of all) {
      if (n.type !== 'INSTANCE') continue
      instances++
      let main = null
      try { main = n.mainComponent } catch (e) {}
      if (!main) unresolved++
    }
    if (pageOf(top.name, top.type) !== pg.name) misplaced.push({ name: top.name, from: pg.name, to: pageOf(top.name, top.type) })
  }
  pages[pg.name] = { frames: pg.children.length, nodes }
}
for (const need of [GUIDE_PAGE].concat(PRODUCT_PAGES)) if (!pages[need]) pages[need] = { frames: 0, nodes: 0, missing: true }
return { pages, misplaced: misplaced.length, examples: misplaced.slice(0, 5).map((m) => m.name + '：在 ' + m.from + '，應在 ' + m.to), instances, unresolved }
`;

// 寫入：必要時建立畫布頁，把位置不對的頂層節點搬過去。
const FIX_SNIPPET = `${PAGE_RULES_SNIPPET}
const byName = (n) => figma.root.children.find((p) => p.name === n)
const moves = []
for (const pg of figma.root.children) {
  if (IGNORED_PAGES.includes(pg.name)) continue
  for (const top of pg.children) if (pageOf(top.name, top.type) !== pg.name) moves.push({ top, to: pageOf(top.name, top.type) })
}
let created = 0
for (const m of moves) {
  let target = byName(m.to)
  if (!target) { target = figma.createPage(); target.name = m.to; created++ }
  target.appendChild(m.top)
}
return { moved: moves.length, created }
`;

// shell: true 是為了在 Windows 上執行 openpencil.cmd；路徑加引號以防空白。
const evalOn = (file, code, extraArgs = []) => {
  try {
    const out = execFileSync('openpencil', ['eval', `"${file}"`, '--stdin', '--json', ...extraArgs], {
      input: code, encoding: 'utf8', shell: true, stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024,
    });
    return JSON.parse(out.replace(/\x1b\[[0-9;]*m/g, '').trim());
  } catch (error) {
    console.log(`openpencil 執行失敗（${file}）：${String(error.stderr || error.stdout || error.message).trim().split('\n')[0]}`);
    process.exit(2);
  }
};

const problems = (r) => r.misplaced + r.unresolved + Object.values(r.pages).filter((p) => p.missing).length;
const describe = (suite, r) => {
  const sizes = Object.entries(r.pages).map(([name, p]) => `${name} ${p.frames}/${p.nodes}`).join('、');
  const lines = [`${suite}：位置不對 ${r.misplaced}、連不到母版的實例 ${r.unresolved}（實例共 ${r.instances}）`, `  各畫布頁 frame/節點：${sizes}`];
  for (const e of r.examples) lines.push(`  ${e}`);
  return lines.join('\n');
};

const apply = !process.argv.includes('--check');
let exit = 0;
for (const file of files) {
  let result = evalOn(file.path, CHECK_SNIPPET);
  if (apply && problems(result) > 0) {
    const fixed = evalOn(file.path, FIX_SNIPPET, ['-w']);
    console.log(`${file.suite}：已分頁（搬移 ${fixed.moved}、新增畫布頁 ${fixed.created}）`);
    result = evalOn(file.path, CHECK_SNIPPET);
  } else if (apply) {
    console.log(`${file.suite}：已是最新，不寫檔`);
  }
  console.log(describe(file.suite, result));
  if (problems(result) > 0) exit = 1;
}
process.exit(exit);
