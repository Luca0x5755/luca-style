// 元件庫設計檔的母版檢查：23 個母版都在、都綁了設計變數，且四種「套系 × 明暗」組合解析出來的值與 variables.json 一致。
//   docs/mockup/luca-style-library.fig  唯一的設計檔（ADR 0007）
// 用法：node scripts/design/check-masters.js
// 結束碼：0 通過；1 有差異（逐行列出）；2 讀檔失敗。
//
// 檢查項目：
//   1. 結構：只有一個有內容的畫布頁（App 為存放變數自動維持的空頁 Internal Only Canvas 可以存在，但必須是空的）；
//      該頁的頂層節點恰為 23 個、全是 COMPONENT，名稱等於 EXPECTED_MASTERS（不多、不缺、不重複）；沒有殘留的頁面 frame。
//   2. 綁定：docs/mockup/themes/bindings.json 列出的每個母版節點的每個屬性都綁了指定的變數（有綁定欄位的屬性）；
//      每個母版至少有一個綁定的填色；有圓角的母版至少有一個綁定的圓角（導覽列沒有圓角；Checkbox 的勾選框是兩套系共用的 3px 常數，不綁）；
//      沒有指向不存在變數的懸空綁定。
//   3. 解析值：對「Vibrant、Professional × Light、Dark」四種組合，把母版的 Suite、Mode、Suite x Mode、Device 模式設成該組合，
//      每個綁定屬性解析出來的值必須等於 variables.json 該組合的值（顏色以 1/255 容差、數值以 float32 精度）。
//      所以綁定被移除、換成別的變數、變數被放進沒有涵蓋其變化軸的集合，或模式被改壞，都會失敗。
//   各變數本身的值是否與 DTCG 原始檔一致，由 apply-variables.js --check 負責；儲存值由 apply-bindings.js --check 負責。
//
// 全程以離線、唯讀的 `openpencil eval` 讀檔（不加 -o / -w；設定模式只發生在記憶體內），不經過 OpenPencil App。
// Windows 的 openpencil 本機修補事項見 docs/delivery-verification.md〈Windows 上執行 openpencil 的本機修補〉。
//
// 測試用：可用環境變數覆寫路徑，指向故意改壞的副本：
//   CHECK_MASTERS_LIBRARY（設計檔）、CHECK_MASTERS_THEMES（themes 資料夾）
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const themesDir = resolve(process.env.CHECK_MASTERS_THEMES || join(root, 'docs/mockup/themes'));
const libraryPath = resolve(process.env.CHECK_MASTERS_LIBRARY || join(root, 'docs/mockup/luca-style-library.fig'));

// 基準清單：母版名單有合法增減時需同步修改（ADR 0007、前端規格 §5.5.1）。
const EXPECTED_MASTERS = [
  'C/Button/Primary', 'C/Button/Secondary', 'C/Button/Hover', 'C/Button/Focus', 'C/Button/Disabled', 'C/Button/Loading',
  'C/Field/Default', 'C/Field/Focus', 'C/Field/Error', 'C/Field/Disabled',
  'C/Status/Success', 'C/Status/Warning', 'C/Status/Error',
  'C/State/Loading', 'C/State/Empty', 'C/State/Error',
  'C/Card/Metric', 'C/Table', 'C/Nav/Desktop', 'C/Nav/Mobile', 'C/Select', 'C/Select/Open', 'C/Checkbox',
];
// App 為存放變數自動維持的空頁，所有檢查略過它的內容，但它必須是空的。
const VARIABLE_HOLDER_PAGE = 'Internal Only Canvas';

const readJson = (name) => {
  try {
    return JSON.parse(readFileSync(join(themesDir, name), 'utf8'));
  } catch (error) {
    console.log(`[讀取] ${name}（${themesDir}）：${error.message}`);
    process.exit(2);
  }
};
const bindings = readJson('bindings.json').masters;
const variables = readJson('variables.json');
const byName = Object.fromEntries(variables.variables.map((v) => [v.name, v]));
const collectionOf = (name) => variables.collections.find((c) => c.name === byName[name]?.collection);

// 四種「套系 × 明暗」組合；裝置固定 Desktop。每個集合要設的模式名稱由 variables.json 的 collections 決定。
const COMBOS = variables.axes.suite.flatMap((suite) => variables.axes.mode.map((mode) => ({ suite, mode, device: variables.axes.device[0] })));
const modesFor = (combo) => Object.fromEntries(variables.collections.map((c) => [
  c.name,
  c.axes.length === 0 ? c.modes[0] : c.axes.map((axis) => combo[axis]).join(' / '),
]));

// 綁定屬性（bindings.json）→ .fig 綁定欄位與值型別。effect.enabled 與 fill[i].opacity 沒有綁定欄位，不在此檢查。
const FIELDS = {
  fill: [['fills/0/color', 'color']], stroke: [['strokes/0/color', 'color']], fontFamily: [['fontFamily', 'string']],
  fontSize: [['fontSize', 'number']], cornerRadius: [['cornerRadius', 'number']], gap: [['itemSpacing', 'number']],
  strokeWidth: [['strokeWeight', 'number']], 'strokeWidth.left': [['borderLeftWeight', 'number']],
  padding: ['paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom'].map((f) => [f, 'number']),
};

// 預期值：每個（母版、節點路徑、綁定欄位）在每個組合的值，由 bindings.json 與 variables.json 算出（不看檔案內容）。
const expected = bindings.flatMap((m) => m.nodes.flatMap((n) => Object.entries(n.bind)
  .filter(([prop]) => FIELDS[prop])
  .flatMap(([prop, name]) => FIELDS[prop].map(([field, kind]) => ({
    master: m.frame, path: n.path, field, kind, variable: name,
    values: COMBOS.map((c) => byName[name]?.values[`${c.mode}/${c.suite}/${c.device}`]),
  })))));

// 在 openpencil 內執行：回傳結構資訊、每個綁定欄位的實際綁定，以及四種組合下的解析值。
const evalScript = () => `
const WANT = ${JSON.stringify(expected.map(({ master, path, field, kind, variable }) => ({ master, path, field, kind, variable })))}
const MODES = ${JSON.stringify(COMBOS.map(modesFor))}
const MASTER_BIND = ${JSON.stringify(Object.fromEntries(bindings.map((m) => [m.frame, m.nodes.map((n) => n.path)])))}
const HOLDER = ${JSON.stringify(VARIABLE_HOLDER_PAGE)}
const pages = figma.root.children.map((p) => ({ name: p.name, tops: p.children.map((n) => ({ type: n.type, name: n.name })) }))
const content = figma.root.children.filter((p) => p.name !== HOLDER)
const masters = content.flatMap((p) => p.children).filter((n) => n.type === 'COMPONENT')
const ids = new Set(figma.getLocalVariables().map((v) => v.id))
const varName = Object.fromEntries(figma.getLocalVariables().map((v) => [v.id, v.name]))
const cols = figma.getLocalVariableCollections()
const at = (f, p) => (p === '-' ? f : p.split('.').reduce((n, i) => n && n.children && n.children[+i], f))
const hex = (c) => c ? '#' + [c.r, c.g, c.b].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('').toUpperCase() : null
const result = { pages, bound: [], resolved: [], dangling: [], missing: [], counts: {} }
for (const m of masters) {
  let hasFill = false, hasRadius = false, rounded = false, nodes = 0
  const walk = (n) => {
    nodes++
    const bv = figma.graph.getNode(n.id).boundVariables || {}
    if (bv['fills/0/color']) hasFill = true
    if (bv.cornerRadius) hasRadius = true
    if (n.cornerRadius > 0) rounded = true
    for (const k of Object.keys(bv)) if (!ids.has(bv[k])) result.dangling.push(m.name + ' ' + n.name + ' ' + k)
    ;(n.children || []).forEach(walk)
  }
  walk(m)
  result.counts[m.name] = { nodes, hasFill, hasRadius, rounded }
}
const masterByName = Object.fromEntries(masters.map((m) => [m.name, m]))
for (const w of WANT) {
  const m = masterByName[w.master]
  const node = m && at(m, w.path)
  if (!node) { result.missing.push(w.master + ' ' + w.path); result.bound.push(null); continue }
  const id = figma.graph.getNode(node.id).boundVariables[w.field]
  result.bound.push(id ? (varName[id] || '(不存在的變數)') : null)
}
// 逐組合設定母版的模式後解析；modes 只存在記憶體內。
MODES.forEach((modes, ci) => {
  const wanted = {}
  for (const [cn, mn] of Object.entries(modes)) {
    const c = cols.find((x) => x.name === cn)
    const mode = c && c.modes.find((x) => x.name === mn)
    if (c && mode) wanted[c.id] = mode.modeId
  }
  for (const m of masters) figma.graph.updateNode(m.id, { variableModes: wanted })
  WANT.forEach((w, wi) => {
    const m = masterByName[w.master]
    const node = m && at(m, w.path)
    const id = node && figma.graph.getNode(node.id).boundVariables[w.field]
    let got = null
    if (id && ids.has(id)) {
      try {
        const r = w.kind === 'color' ? figma.graph.resolveColorVariableForNode(node.id, id) : w.kind === 'string' ? figma.graph.resolveStringVariableForNode(node.id, id) : figma.graph.resolveNumberVariableForNode(node.id, id)
        got = w.kind === 'color' ? hex(r) : r === undefined ? null : r
      } catch (e) { got = null }
    }
    ;(result.resolved[wi] ??= [])[ci] = got
  })
})
return result
`;

const readFile = () => {
  try {
    // shell: true 是為了在 Windows 上執行 openpencil.cmd；cwd 在專案內以便套用本機設定。
    const out = execFileSync('openpencil', ['eval', `"${libraryPath}"`, '--stdin'], {
      cwd: root, input: evalScript(), encoding: 'utf8', shell: true, stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 512 * 1024 * 1024,
    });
    // eval 結果為 JSON；去除可能的終端色碼後解析。
    return JSON.parse(out.replace(/\x1b\[[0-9;]*m/g, '').trim());
  } catch (error) {
    console.log(`[讀取] ${libraryPath}：${String(error.message).split('\n')[0]}`);
    process.exit(2);
  }
};

const same = (kind, got, want) => {
  if (got === null || got === undefined) return false;
  if (kind === 'color') return got === String(want).toUpperCase();
  if (kind === 'number') return typeof got === 'number' && Math.fround(got) === Math.fround(want);
  return got === want;
};

const file = readFile();
const diffs = [];

// 1. 結構
const contentPages = file.pages.filter((p) => p.name !== VARIABLE_HOLDER_PAGE);
if (contentPages.length !== 1) diffs.push(`[頁面] 有內容的畫布頁應恰好 1 個，實際 ${contentPages.length} 個（${contentPages.map((p) => p.name).join('、')}）`);
for (const holder of file.pages.filter((p) => p.name === VARIABLE_HOLDER_PAGE)) {
  if (holder.tops.length > 0) diffs.push(`[頁面] ${VARIABLE_HOLDER_PAGE} 必須是空頁，實際有 ${holder.tops.length} 個節點`);
}
const tops = contentPages.flatMap((p) => p.tops);
if (tops.length !== EXPECTED_MASTERS.length) diffs.push(`[母版名單] 頂層節點應恰為 ${EXPECTED_MASTERS.length} 個，實際 ${tops.length} 個`);
for (const t of tops) if (t.type !== 'COMPONENT') diffs.push(`[母版名單] ${t.name}：頂層節點必須是 COMPONENT，實際是 ${t.type}（不可殘留頁面 frame 或文字）`);
for (const name of EXPECTED_MASTERS) {
  const hits = tops.filter((t) => t.name === name && t.type === 'COMPONENT').length;
  if (hits === 0) diffs.push(`[母版名單] ${name}：沒有這個母版`);
  else if (hits > 1) diffs.push(`[重複] ${name}：有 ${hits} 個同名母版`);
}
for (const t of tops) if (t.type === 'COMPONENT' && !EXPECTED_MASTERS.includes(t.name)) diffs.push(`[母版名單] ${t.name}：多出名單以外的母版`);
for (const m of bindings) if (!EXPECTED_MASTERS.includes(m.frame)) diffs.push(`[資料] bindings.json 有名單以外的母版 ${m.frame}`);
for (const name of EXPECTED_MASTERS) if (!bindings.some((m) => m.frame === name)) diffs.push(`[資料] bindings.json 缺少母版 ${name}`);

// 2. 綁定
file.missing.forEach((where) => diffs.push(`[節點] ${where}：bindings.json 指定的節點不存在`));
expected.forEach((e, i) => {
  if (file.bound[i] !== e.variable && file.bound[i] !== null) diffs.push(`[綁定] ${e.master} ${e.path} ${e.field}：綁的是 ${file.bound[i]}，應為 ${e.variable}`);
  else if (file.bound[i] === null && !file.missing.includes(`${e.master} ${e.path}`)) diffs.push(`[綁定] ${e.master} ${e.path} ${e.field}：沒有綁定，應綁 ${e.variable}`);
});
for (const name of EXPECTED_MASTERS) {
  const c = file.counts[name];
  if (!c) continue;
  if (!c.hasFill) diffs.push(`[綁定] ${name}：沒有任何綁定的填色`);
  if (c.rounded && !c.hasRadius) diffs.push(`[綁定] ${name}：有圓角的節點，但沒有任何綁定的圓角`);
  const listed = bindings.find((m) => m.frame === name);
  if (listed && listed.nodeCount !== c.nodes) diffs.push(`[節點數] ${name}：bindings.json 記 ${listed.nodeCount} 個節點，檔案有 ${c.nodes} 個`);
}
for (const d of file.dangling) diffs.push(`[懸空綁定] ${d}：指向不存在的變數`);
for (const e of expected) {
  const v = byName[e.variable];
  if (!v) diffs.push(`[資料] ${e.master} ${e.path}：variables.json 沒有變數 ${e.variable}`);
  else if (!collectionOf(e.variable)) diffs.push(`[資料] ${e.variable}：沒有所屬集合`);
}

// 3. 解析值
expected.forEach((e, i) => {
  COMBOS.forEach((combo, ci) => {
    const want = e.values[ci];
    const got = file.resolved[i]?.[ci];
    if (want === undefined) return;
    if (!same(e.kind, got, want)) {
      diffs.push(`[解析值] ${e.master} ${e.path} ${e.field}（${e.variable}）@ ${combo.suite} / ${combo.mode}：解析為 ${got}，variables.json 為 ${want}`);
    }
  });
});

const nodeTotal = Object.values(file.counts).reduce((sum, c) => sum + c.nodes, 0);
console.log(`頁面：${file.pages.map((p) => `${p.name}（${p.tops.length}）`).join('、')}`);
console.log(`母版：${tops.length}（預期 ${EXPECTED_MASTERS.length}），母版節點 ${nodeTotal}`);
console.log(`綁定屬性：${expected.length} 筆，組合 ${COMBOS.length} 種（${COMBOS.map((c) => `${c.suite}/${c.mode}`).join('、')}）`);
if (diffs.length > 0) {
  console.log(diffs.join('\n'));
  const names = new Set(diffs.map((d) => d.match(/^\[[^\]]+\] (C\/[^ ：]+)/)?.[1]).filter(Boolean));
  console.log(`共 ${diffs.length} 項差異${names.size ? `，涉及 ${names.size} 個母版：${[...names].join('、')}` : ''}`);
  process.exit(1);
}
console.log('全部通過');
