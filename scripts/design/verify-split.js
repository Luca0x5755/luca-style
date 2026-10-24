// 結構驗收：以 docs/mockup/themes/baseline.json 為基準，檢查兩個套系設計檔。
// baseline.json 記錄拆檔前單檔 components.fig 每個頁面 frame 的名稱、節點數與文字雜湊（該檔已刪除，提交 ebe6c61 找得回）。
//   docs/mockup/components-vibrant.fig      精緻活力
//   docs/mockup/components-professional.fig 精緻專業
// 用法：node scripts/design/verify-split.js
// 結束碼：0 全部一致；1 結構不一致（逐行列出差異）；2 讀檔失敗。
//
// 比對內容（逐個頁面 frame，與原檔同名 frame 比）：
//   - 名稱：兩檔合計涵蓋原檔全部 frame；套系 frame 不得同時出現在兩檔，也不得出現在不屬於它的套系檔。
//   - 節點數：frame 本身加上所有層級的後代。
//   - 文字：所有後代 TEXT 節點的 characters，依樹序逐字比對。
//   - 填色：不再與基準比。原單檔 components.fig 的顏色是丟失主題後的預設主題攤平值，Dark 與 Professional 的 frame
//     加上變數與綁定之後本來就與它不同，所以顏色改由 verify-themes.js 對 resolved.json 驗收。
//   - 明暗模式：同一個設計檔內，名稱只差 Light／Dark 的兩個 frame（同一頁面群組），顏色分布不得完全相同
//     （顏色分布＝frame 本身與全部後代的填色、描邊顏色，各色出現次數）。完全相同代表明暗模式遺失
//     （.pen 轉 .fig 後的狀態）；有任何一組相同就回報非零結束碼。這是保險絲，不是保真比對，保真見 verify-themes.js。
//   - 版面：兩個設計檔內不得有 NaN 行高、自動排版內相鄰節點重疊、子節點超出父 frame（檢查邏輯見 layout-snippets.js，
//     修正見 relayout-fig.js）。這是數值檢查，不等於畫面看起來正確。
// 母版（COMPONENT）與頂層 TEXT 不在本腳本範圍（母版比對見 ISSUE-004）。不做逐像素比對。
//
// 全程以離線、唯讀的 `openpencil eval` 讀檔（不加 -o / -w），不經過 OpenPencil App。
// Windows 的 openpencil 本機修補事項見 split-by-suite.js 檔頭。
//
// 測試用：可用環境變數覆寫路徑，指向故意改壞的副本：
//   VERIFY_SPLIT_SOURCE / VERIFY_SPLIT_VIBRANT / VERIFY_SPLIT_PROFESSIONAL
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHECK_SNIPPET } from './layout-snippets.js';
import { GUIDE_PAGE, IGNORED_PAGES, pageOf } from './pages.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const mockup = join(root, 'docs/mockup');
const pick = (envName, file) => resolve(process.env[envName] || join(mockup, file));

const paths = {
  source: pick('VERIFY_SPLIT_SOURCE', 'themes/baseline.json'),
  vibrant: pick('VERIFY_SPLIT_VIBRANT', 'components-vibrant.fig'),
  professional: pick('VERIFY_SPLIT_PROFESSIONAL', 'components-professional.fig'),
};

// 基準的 frame 數；基準檔有合法增減時需同步修改。
const EXPECTED_FRAMES = 302;
// 無套系的共用 frame：兩檔各留一份，內容須與原檔一致，不受「不得同時出現」限制。
const SHARED = new Set(['Library guide', '00 / Canvas directory']);
// 與 split-by-suite.js 相同的套系判定（兩處規則須同步修改；刻意不共用，讓驗收獨立於切檔邏輯）：<頁>/Professional/...、Professional/...、Professional ?/...。
const suiteOf = (name) => {
  for (const suite of ['Vibrant', 'Professional']) {
    if (new RegExp('^(?:[^/]+/)?' + suite + '(?: ?/|/)').test(name)) return suite;
  }
  return null;
};

// 文字與顏色分布只比 32 位元雜湊加長度，用途是抓誤改，不防蓄意碰撞。
// 在 openpencil 內執行的腳本：回傳所有畫布頁最上層每個 FRAME 的摘要（所在畫布頁、節點數與文字／填色雜湊）。
const evalScript = `
const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; return h.toString(16) + ':' + s.length }
if (!figma.root.children.some((p) => p.name === ${JSON.stringify(GUIDE_PAGE)})) return { error: '找不到畫布頁 ' + ${JSON.stringify(GUIDE_PAGE)} }
const IGNORED = ${JSON.stringify(IGNORED_PAGES)}
const tops = []
for (const pg of figma.root.children) if (!IGNORED.includes(pg.name)) for (const n of pg.children) if (n.type === 'FRAME') tops.push({ page: pg.name, f: n })
const frames = tops.map(({ page, f }) => {
  const all = [f].concat(f.findAll(() => true))
  const texts = all.filter((n) => n.type === 'TEXT').map((n) => n.characters)
  // 顏色分布：填色與描邊的顏色（十六進位）出現次數，依色碼排序後串成字串再雜湊。
  const hex = (c) => '#' + [c.r, c.g, c.b].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('')
  const dist = {}
  for (const n of all) for (const p of [].concat(n.fills || [], n.strokes || [])) if (p && p.color) dist[hex(p.color)] = (dist[hex(p.color)] || 0) + 1
  const colors = hash(Object.keys(dist).sort().map((k) => k + 'x' + dist[k]).join(','))
  return { name: f.name, page, nodes: all.length, texts: hash(JSON.stringify(texts)), colors }
})
return { frames }
`;

const readFrames = (label, file) => {
  try {
    // shell: true 是為了在 Windows 上執行 openpencil.cmd；cwd 在專案內以便套用本機設定。
    const out = execFileSync('openpencil', ['eval', `"${file}"`, '--stdin'], {
      cwd: mockup, input: evalScript, encoding: 'utf8', shell: true, stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024,
    });
    // eval 結果為 JSON；去除可能的終端色碼後解析。
    const result = JSON.parse(out.replace(/\x1b\[[0-9;]*m/g, '').trim());
    if (result.error) throw new Error(result.error);
    return result.frames;
  } catch (error) {
    console.log(`[讀取] ${label}：${String(error.message).split('\n')[0]}`);
    process.exit(2);
  }
};

// 版面檢查：回傳 { nan, overlaps, outOfBounds, examples }。
const readLayout = (label, file) => {
  try {
    const out = execFileSync('openpencil', ['eval', `"${file}"`, '--stdin'], {
      cwd: mockup, input: CHECK_SNIPPET, encoding: 'utf8', shell: true, stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024,
    });
    return JSON.parse(out.replace(/\x1b\[[0-9;]*m/g, '').trim());
  } catch (error) {
    console.log(`[讀取] ${label} 版面：${String(error.message).split('\n')[0]}`);
    process.exit(2);
  }
};

const readBaseline = () => {
  try {
    return JSON.parse(readFileSync(paths.source, 'utf8')).frames;
  } catch (error) {
    console.log(`[讀取] 基準：${String(error.message).split('\n')[0]}`);
    process.exit(2);
  }
};

const source = readBaseline();
const vibrant = readFrames('vibrant', paths.vibrant);
const professional = readFrames('professional', paths.professional);

const diffs = [];
const byName = (frames) => new Map(frames.map((f) => [f.name, f]));
const src = byName(source);
const files = { vibrant: byName(vibrant), professional: byName(professional) };

if (src.size !== source.length) diffs.push('[基準] 基準檔內有同名 frame，名稱必須唯一');
// 設計檔內若有同名 frame，Map 會覆蓋而漏檢，先列出。
for (const [where, frames] of [['vibrant', vibrant], ['professional', professional]]) {
  const seen = new Set();
  for (const { name } of frames) {
    if (seen.has(name)) diffs.push(`[重複] ${name}：${where} 內有同名 frame`);
    seen.add(name);
  }
}
if (source.length !== EXPECTED_FRAMES) {
  diffs.push(`[基準] 預期 ${EXPECTED_FRAMES} 個 frame，實得 ${source.length}`);
}

// 每個 frame 必須在規則指定的畫布頁（規則見 pages.js）。
for (const [where, frames] of [['vibrant', vibrant], ['professional', professional]]) {
  for (const { name, page } of frames) {
    const expected = pageOf(name, 'FRAME');
    if (page !== expected) diffs.push(`[畫布頁] ${name}：${where} 在「${page}」，應在「${expected}」`);
  }
}

const compare = (name, base, actual, where) => {
  if (base.nodes !== actual.nodes) diffs.push(`[節點數] ${name}：${where} 為 ${actual.nodes}，基準為 ${base.nodes}`);
  if (base.texts !== actual.texts) diffs.push(`[文字] ${name}：${where} 的文字內容與基準不同`);
};

for (const base of source) {
  const name = base.name;
  const inV = files.vibrant.get(name);
  const inP = files.professional.get(name);
  if (SHARED.has(name)) {
    for (const [where, hit] of [['vibrant', inV], ['professional', inP]]) {
      if (!hit) diffs.push(`[共用缺失] ${name}：${where} 沒有這個共用 frame`);
      else compare(name, base, hit, where);
    }
    continue;
  }
  if (!inV && !inP) {
    diffs.push(`[遺失] ${name}：兩個設計檔都沒有`);
    continue;
  }
  if (inV && inP) diffs.push(`[重複] ${name}：同時出現在 vibrant 與 professional`);
  const suite = suiteOf(name);
  const owner = suite === 'Vibrant' ? 'vibrant' : suite === 'Professional' ? 'professional' : null;
  if (!owner) {
    diffs.push(`[基準] ${name}：無法判定所屬套系`);
    continue;
  }
  const other = owner === 'vibrant' ? 'professional' : 'vibrant';
  if (files[other].has(name) && !(inV && inP)) diffs.push(`[重複] ${name}：出現在不屬於它的 ${other}`);
  const hit = files[owner].get(name);
  if (hit) compare(name, base, hit, owner);
  else diffs.push(`[遺失] ${name}：所屬的 ${owner} 設計檔沒有`);
}

// 設計檔有、基準沒有的 frame。
for (const [where, map] of Object.entries(files)) {
  for (const name of map.keys()) {
    if (!src.has(name)) diffs.push(`[多餘] ${name}：${where} 有這個 frame，基準沒有`);
  }
}

// 明暗模式：同一個設計檔內，名稱只差 Light／Dark 的 frame 配成一組，顏色分布不得完全相同。
let lightDarkPairs = 0;
for (const [where, frames] of [['vibrant', vibrant], ['professional', professional]]) {
  const groups = new Map();
  for (const f of frames) {
    const m = f.name.match(/(^|\/)(Light|Dark)(?=\/|$)/);
    if (!m) continue;
    const key = f.name.replace(/(^|\/)(Light|Dark)(?=\/|$)/, '$1*');
    if (!groups.has(key)) groups.set(key, {});
    groups.get(key)[m[2]] = f;
  }
  for (const [key, g] of groups) {
    if (!g.Light || !g.Dark) continue;
    lightDarkPairs++;
    if (g.Light.colors === g.Dark.colors) diffs.push(`[明暗相同] ${key}：${where} 的 Light 與 Dark 顏色分布完全相同（明暗模式遺失）`);
  }
}

for (const [where, file] of [['vibrant', paths.vibrant], ['professional', paths.professional]]) {
  const r = readLayout(where, file);
  if (r.nan > 0) diffs.push(`[版面] ${where}：${r.nan} 個文字的行高是 NaN`);
  if (r.overlaps > 0) diffs.push(`[版面] ${where}：${r.overlaps} 組相鄰節點重疊（${r.examples.join('；')}）`);
  if (r.outOfBounds > 0) diffs.push(`[版面] ${where}：${r.outOfBounds} 個子節點超出父 frame`);
}

console.log(`畫布頁：${[...new Set([...vibrant, ...professional].map((f) => f.page))].join("、")}`);
console.log(`基準 frame：${source.length}`);
console.log(`vibrant frame：${vibrant.length}`);
console.log(`professional frame：${professional.length}`);
console.log(`共用 frame：${source.filter((f) => SHARED.has(f.name)).length}`);
console.log(`套系 frame：${source.filter((f) => !SHARED.has(f.name)).length}`);
console.log(`明暗成對：${lightDarkPairs} 組`);
if (diffs.length > 0) {
  console.log(diffs.join('\n'));
  console.log(`共 ${diffs.length} 項差異`);
  process.exit(1);
}
console.log('全部一致');
