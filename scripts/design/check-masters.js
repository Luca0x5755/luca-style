// 母版一致性比對：兩個套系設計檔各帶一份共用物件，改一處必須兩邊都改，本腳本取代人工核對。
//   docs/mockup/components-vibrant.fig      精緻活力
//   docs/mockup/components-professional.fig 精緻專業
// 用法：node scripts/design/check-masters.js
// 結束碼：0 全部相同；1 有差異（逐行列出）；2 讀檔失敗。
//
// 比對單元（以名稱配對，兩檔各一份）：
//   - 22 個 COMPONENT 母版（名稱 C/...，名單寫死於 EXPECTED_MASTERS）
//   - 共用 frame：Library guide、00 / Canvas directory
//   - 2 個頂層 TEXT：Vibrant / Style zone heading、Professional / Style zone heading
// 「相同」的定義：單元內所有節點依樹序、以子節點索引路徑配對，逐節點比對 PROPS 列出的屬性：
//   型別、名稱、可見度、不透明度、混合模式、填色、描邊（含粗細／對齊／虛線／四邊粗細）、效果、
//   圓角（含四角）、clipsContent、旋轉、尺寸、約束、auto-layout 全部屬性（方向、對齊、間距、
//   四邊 padding、換行、sizing mode、layoutGrow／Align／Positioning、min/max）、
//   文字（characters、字型、字級、字重、對齊、字距、行高、大小寫、裝飾、自動縮放，
//   另含混合樣式的分段內容）、樣式 id、元件屬性定義，以及子節點數量。
// x / y：頂層單元不比（兩檔頁面版面不同，頂層位置可以不同）；所有後代的 x / y 是相對父節點，要比。
// 不比：節點 id 與絕對座標（absoluteTransform 等）。不做逐像素比對。
// 值以 JSON 字串逐項比對（不是雜湊），差異輸出會指出節點路徑與屬性名稱。
//
// 全程以離線、唯讀的 `openpencil eval` 讀檔（不加 -o / -w），不經過 OpenPencil App。
// Windows 的 openpencil 本機修補事項見 split-by-suite.js 檔頭。
//
// 測試用：可用環境變數覆寫路徑，指向故意改壞的副本：
//   CHECK_MASTERS_VIBRANT / CHECK_MASTERS_PROFESSIONAL
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const mockup = join(root, 'docs/mockup');
const pick = (envName, file) => resolve(process.env[envName] || join(mockup, file));

const paths = {
  vibrant: pick('CHECK_MASTERS_VIBRANT', 'components-vibrant.fig'),
  professional: pick('CHECK_MASTERS_PROFESSIONAL', 'components-professional.fig'),
};

const PAGE = 'Library guide';
// 基準清單：母版名單有合法增減時需同步修改。
const EXPECTED_MASTERS = [
  'C/Button/Primary', 'C/Button/Secondary', 'C/Button/Hover', 'C/Button/Focus', 'C/Button/Disabled', 'C/Button/Loading',
  'C/Field/Default', 'C/Field/Focus', 'C/Field/Error', 'C/Field/Disabled',
  'C/Status/Success', 'C/Status/Warning', 'C/Status/Error',
  'C/State/Loading', 'C/State/Empty', 'C/State/Error',
  'C/Card/Metric', 'C/Table', 'C/Nav/Desktop', 'C/Nav/Mobile', 'C/Select', 'C/Checkbox',
];
const SHARED_FRAMES = ['Library guide', '00 / Canvas directory'];
const SHARED_TEXTS = ['Vibrant / Style zone heading', 'Professional / Style zone heading'];

// 逐節點比對的屬性（x / y 另處理：後代才比）。
const PROPS = [
  'type', 'name', 'visible', 'opacity', 'blendMode', 'fills', 'strokes', 'strokeWeight', 'strokeAlign', 'dashPattern',
  'strokeTopWeight', 'strokeBottomWeight', 'strokeLeftWeight', 'strokeRightWeight', 'effects',
  'cornerRadius', 'topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius', 'cornerSmoothing',
  'clipsContent', 'rotation', 'width', 'height', 'constraints',
  'layoutMode', 'layoutDirection', 'primaryAxisAlignItems', 'counterAxisAlignItems', 'itemSpacing', 'counterAxisSpacing',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'layoutWrap', 'primaryAxisSizingMode', 'counterAxisSizingMode',
  'counterAxisAlignContent', 'layoutGrow', 'layoutAlign', 'layoutPositioning', 'layoutSizingHorizontal', 'layoutSizingVertical',
  'minWidth', 'maxWidth', 'minHeight', 'maxHeight',
  'characters', 'fontName', 'fontSize', 'fontWeight', 'textAlignHorizontal', 'textAlignVertical', 'letterSpacing',
  'lineHeight', 'textCase', 'textDecoration', 'textAutoResize',
  'fillStyleId', 'strokeStyleId', 'effectStyleId', 'textStyleId', 'componentPropertyDefinitions',
];

// 在 openpencil 內執行的腳本：回傳每個頂層單元的逐節點屬性（值已轉成 JSON 字串）。
const evalScript = `
const PROPS = ${JSON.stringify(PROPS)}
const page = figma.root.children.find((p) => p.name === ${JSON.stringify(PAGE)})
if (!page) return { error: '找不到頁面 ' + ${JSON.stringify(PAGE)} }
// 混合樣式的值是 Symbol，JSON.stringify 會吞掉，所以明確轉成字串。
const ser = (v) => (typeof v === 'symbol' ? '"MIXED"' : JSON.stringify(v === undefined ? null : v, (k, x) => (typeof x === 'symbol' ? 'MIXED' : x)))
const read = (n, key) => { try { return ser(n[key]) } catch (e) { return '"ERR"' } }
const record = (n, isTop) => {
  const p = {}
  for (const k of PROPS) p[k] = read(n, k)
  if (!isTop) { p.x = read(n, 'x'); p.y = read(n, 'y') }
  if (n.type === 'TEXT') {
    try { p.segments = ser(n.getStyledTextSegments(['fontSize', 'fontName', 'fontWeight', 'fills', 'letterSpacing', 'lineHeight', 'textCase', 'textDecoration'])) } catch (e) { p.segments = '"ERR"' }
  }
  p.childCount = String(n.children ? n.children.length : 0)
  return p
}
const walk = (n, path, isTop, out) => {
  out.push({ path, props: record(n, isTop) })
  if (n.children) n.children.forEach((c, i) => walk(c, path + '/' + i, false, out))
  return out
}
const units = page.children.map((n) => ({ type: n.type, name: n.name, nodes: walk(n, '', true, []) }))
return { units }
`;

const readUnits = (label, file) => {
  try {
    // shell: true 是為了在 Windows 上執行 openpencil.cmd；cwd 在專案內以便套用本機設定。
    const out = execFileSync('openpencil', ['eval', `"${file}"`, '--stdin'], {
      cwd: mockup, input: evalScript, encoding: 'utf8', shell: true, stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 512 * 1024 * 1024,
    });
    // eval 結果為 JSON；去除可能的終端色碼後解析。
    const result = JSON.parse(out.replace(/\x1b\[[0-9;]*m/g, '').trim());
    if (result.error) throw new Error(result.error);
    return result.units;
  } catch (error) {
    console.log(`[讀取] ${label}：${String(error.message).split('\n')[0]}`);
    process.exit(2);
  }
};

const files = { vibrant: readUnits('vibrant', paths.vibrant), professional: readUnits('professional', paths.professional) };
const diffs = [];

// 取出要比對的單元；缺少、重名或名單外的母版都是差異。
const select = (where, units) => {
  const found = new Map();
  const wanted = [
    ...EXPECTED_MASTERS.map((name) => ({ name, type: 'COMPONENT', tag: '母版名單' })),
    ...SHARED_FRAMES.map((name) => ({ name, type: 'FRAME', tag: '共用缺失' })),
    ...SHARED_TEXTS.map((name) => ({ name, type: 'TEXT', tag: '共用缺失' })),
  ];
  for (const w of wanted) {
    const hits = units.filter((u) => u.name === w.name && u.type === w.type);
    if (hits.length === 0) diffs.push(`[${w.tag}] ${w.name}：${where} 沒有這個單元`);
    else {
      if (hits.length > 1) diffs.push(`[重複] ${w.name}：${where} 有 ${hits.length} 個同名單元`);
      found.set(w.name, hits[0]);
    }
  }
  const known = new Set(EXPECTED_MASTERS);
  const masters = units.filter((u) => u.type === 'COMPONENT');
  for (const m of masters) if (!known.has(m.name)) diffs.push(`[母版名單] ${m.name}：${where} 多出名單以外的母版`);
  return { found, masterCount: masters.length };
};

const v = select('vibrant', files.vibrant);
const p = select('professional', files.professional);

const label = (path) => (path === '' ? '本身' : `節點 ${path}`);
for (const [name, a] of v.found) {
  const b = p.found.get(name);
  if (!b) continue;
  const pa = new Map(a.nodes.map((n) => [n.path, n.props]));
  const pb = new Map(b.nodes.map((n) => [n.path, n.props]));
  for (const [path, props] of pa) {
    const other = pb.get(path);
    if (!other) {
      diffs.push(`[差異] ${name}：${label(path)} 只在 vibrant 有（子節點數量不同）`);
      continue;
    }
    for (const key of Object.keys(props)) {
      if (props[key] !== other[key]) diffs.push(`[差異] ${name}：${label(path)}（${JSON.parse(props.name)}）的 ${key} 不同`);
    }
  }
  for (const path of pb.keys()) {
    if (!pa.has(path)) diffs.push(`[差異] ${name}：${label(path)} 只在 professional 有（子節點數量不同）`);
  }
}

const nodeTotal = [...v.found.values()].reduce((sum, u) => sum + u.nodes.length, 0);
console.log(`頁面：${PAGE}`);
console.log(`母版：vibrant ${v.masterCount}、professional ${p.masterCount}（預期 ${EXPECTED_MASTERS.length}）`);
console.log(`共用 frame：${SHARED_FRAMES.length}；頂層 TEXT：${SHARED_TEXTS.length}`);
console.log(`比對單元：${v.found.size}，vibrant 節點：${nodeTotal}，每節點屬性：${PROPS.length}`);
if (diffs.length > 0) {
  console.log(diffs.join('\n'));
  const names = new Set(diffs.map((d) => d.match(/^\[[^\]]+\] ([^：]+)：/)?.[1]));
  console.log(`共 ${diffs.length} 項差異，涉及 ${names.size} 個單元：${[...names].join('、')}`);
  process.exit(1);
}
console.log('全部相同');
