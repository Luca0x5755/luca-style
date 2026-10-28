// 母版一致性比對：兩個套系設計檔各帶一份共用物件，改一處必須兩邊都改，本腳本取代人工核對。
//   docs/mockup/components-vibrant.fig      精緻活力
//   docs/mockup/components-professional.fig 精緻專業
// 用法：node scripts/design/check-masters.js
// 結束碼：0 全部相同；1 有差異（逐行列出）；2 讀檔失敗。
//
// 比對單元（以名稱配對，兩檔各一份）：
//   - 23 個 COMPONENT 母版（名稱 C/...，名單寫死於 EXPECTED_MASTERS）
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
// 套系專屬的值（ISSUE-009 綁定變數之後，兩檔母版的顏色、圓角、內距等各用自己套系的值，本來就不同）：
//   「相同」改為「去掉套系專屬值後相同，且套系專屬值由各檔自己的變數值解釋」，而不是放寬成永遠通過：
//   1. 有綁定的屬性（填色與描邊色、字型、字級、圓角、間距、內距、描邊粗細）：比對的是綁定的「變數名稱」，
//      兩檔必須綁同一個變數（每個節點的綁定表 JSON 相同）；該屬性的儲存值不比對兩檔是否相等，
//      改驗證每檔「儲存值＝自己這個檔案裡該變數解析後的值」（解析用 resolve*VariableForNode）。
//      所以：綁定被移除或換成別的變數 → 失敗；儲存值被手改成不等於變數值 → 失敗。
//   2. 沒有綁定欄位、只存值的屬性（fill[i].opacity、effect.enabled，值依套系不同，例如 loading 母版）：
//      每檔的儲存值必須等於 theme-expected.js 推導的該套系值（Professional 用 variables.json 的 Professional 值）。
//   3. 其餘屬性（名稱、型別、結構、文字內容、版面、未綁定的顏色等）照舊逐值全等。
//   4. x／y／寬／高：一個單元內任一節點的版面相關值（四邊內距、間距、描邊粗細、字級、字型名）兩檔不同時，
//      該單元的這四個幾何屬性由這些值決定（hug 內容），不直接比，並在輸出列出哪些單元；兩檔版面值全相同的單元仍嚴格比對幾何。
//   各變數本身的值是否正確（Vibrant 與 Professional 各自的色票），不在這支腳本：由 apply-variables.js --check 與 verify-themes.js 負責。
//   strokeWidth.left 的儲存值讀回 API 讀不到，這個屬性只比綁定的變數名稱。
//
// 全程以離線、唯讀的 `openpencil eval` 讀檔（不加 -o / -w），不經過 OpenPencil App。
// Windows 的 openpencil 本機修補事項見 docs/delivery-verification.md〈Windows 上執行 openpencil 的本機修補〉。
//
// 測試用：可用環境變數覆寫路徑，指向故意改壞的副本：
//   CHECK_MASTERS_VIBRANT / CHECK_MASTERS_PROFESSIONAL / CHECK_MASTERS_THEMES（themes 資料夾）
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadExpected } from './theme-expected.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const mockup = join(root, 'docs/mockup');
const themesDir = resolve(process.env.CHECK_MASTERS_THEMES || join(mockup, 'themes'));
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
  'C/Card/Metric', 'C/Table', 'C/Nav/Desktop', 'C/Nav/Mobile', 'C/Select', 'C/Select/Open', 'C/Checkbox',
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

// 屬性綁定欄位 → 被它解釋的 PROPS 名稱（綁定的屬性不直接比儲存值，見檔頭）。
const FIELD_PROPS = {
  'fills/0/color': ['fills', 'segments'], 'strokes/0/color': ['strokes'], fontFamily: ['fontName', 'segments'],
  fontSize: ['fontSize', 'segments'], cornerRadius: ['cornerRadius', 'topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius'],
  itemSpacing: ['itemSpacing'], paddingTop: ['paddingTop'], paddingRight: ['paddingRight'], paddingBottom: ['paddingBottom'], paddingLeft: ['paddingLeft'],
  strokeWeight: ['strokeWeight', 'strokeTopWeight', 'strokeBottomWeight', 'strokeLeftWeight', 'strokeRightWeight'], borderLeftWeight: ['strokeWeight', 'strokeTopWeight', 'strokeBottomWeight', 'strokeLeftWeight', 'strokeRightWeight'],
};

// 在 openpencil 內執行的腳本：回傳每個頂層單元的逐節點屬性（值已轉成 JSON 字串）。
// 有綁定的屬性：記錄綁定表（欄位 → 變數名稱），並檢查「儲存值是否等於自己檔案裡該變數的解析值」，
//   兩檔之間不再比這些屬性的儲存值。
// expect：無綁定欄位的 fill[i].opacity 與 effect.enabled 的該套系期望值（單元名稱 → 路徑 → 值），同樣只驗證儲存值。
const evalScript = (expect) => `
const PROPS = ${JSON.stringify(PROPS)}
const FIELD_PROPS = ${JSON.stringify(FIELD_PROPS)}
const EXPECT = ${JSON.stringify(expect)}
const page = figma.root.children.find((p) => p.name === ${JSON.stringify(PAGE)})
if (!page) return { error: '找不到頁面 ' + ${JSON.stringify(PAGE)} }
const varName = Object.fromEntries(figma.getLocalVariables().map((v) => [v.id, v.name]))
// 混合樣式的值是 Symbol，JSON.stringify 會吞掉，所以明確轉成字串。
const ser = (v) => (typeof v === 'symbol' ? '"MIXED"' : JSON.stringify(v === undefined ? null : v, (k, x) => (typeof x === 'symbol' ? 'MIXED' : x)))
const read = (n, key) => { try { return ser(n[key]) } catch (e) { return '"ERR"' } }
const hex = (c) => '#' + [c.r, c.g, c.b].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('').toUpperCase()
const colorEq = (a, b) => [0, 1, 2].every((i) => Math.abs([a.r, a.g, a.b][i] - [b.r, b.g, b.b][i]) * 255 <= 1 + 1e-6)
const SEG_KEYS = ['fontSize', 'fontName', 'fontWeight', 'fills', 'letterSpacing', 'lineHeight', 'textCase', 'textDecoration']
const record = (n, isTop, unit, path) => {
  const p = {}
  const g = figma.graph.getNode(n.id)
  const bound = {}
  for (const [field, id] of Object.entries(g.boundVariables || {})) bound[field] = varName[id] || '(不存在的變數)'
  const explained = new Set()
  for (const field of Object.keys(bound)) for (const k of FIELD_PROPS[field] || []) explained.add(k)
  const ex = (EXPECT[unit] || {})[path] || {}
  const problems = []
  // 綁定屬性：儲存值必須等於自己檔案裡該變數的解析值。
  const check = (field, kind, stored) => {
    if (!bound[field] || stored === undefined) return
    let got
    try {
      const id = g.boundVariables[field]
      got = kind === 'color' ? figma.graph.resolveColorVariableForNode(n.id, id) : kind === 'string' ? figma.graph.resolveStringVariableForNode(n.id, id) : figma.graph.resolveNumberVariableForNode(n.id, id)
    } catch (e) { problems.push(field + '：變數解析失敗'); return }
    const ok = kind === 'color' ? stored && got && colorEq(stored, got) : kind === 'string' ? stored === got : typeof stored === 'number' && Math.abs(stored - got) <= 1 / 255 + 1e-9
    if (!ok) problems.push(field + '：儲存值 ' + (kind === 'color' ? (stored ? hex(stored) : stored) : stored) + '，變數 ' + bound[field] + ' 解析為 ' + (kind === 'color' ? (got ? hex(got) : got) : got))
  }
  check('fills/0/color', 'color', n.fills && n.fills[0] && n.fills[0].color)
  check('strokes/0/color', 'color', n.strokes && n.strokes[0] && n.strokes[0].color)
  check('fontFamily', 'string', n.fontName && n.fontName.family)
  check('fontSize', 'number', n.fontSize)
  check('cornerRadius', 'number', n.cornerRadius)
  check('itemSpacing', 'number', n.itemSpacing)
  for (const f of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']) check(f, 'number', n[f])
  check('strokeWeight', 'number', n.strokeWeight)
  // 無綁定欄位、只存值的屬性：必須等於該套系的期望值，兩檔之間不比。
  const opacityIdx = Object.keys(ex).filter((k) => /^fill\\[\\d\\]\\.opacity$/.test(k)).map((k) => +k[5])
  for (const i of opacityIdx) {
    const f = n.fills[i]
    if (!f || Math.abs(f.opacity - ex['fill[' + i + '].opacity'] / 100) > 1 / 255) problems.push('fill[' + i + '].opacity：儲存值 ' + (f ? f.opacity : '無') + '，期望 ' + ex['fill[' + i + '].opacity'] / 100)
  }
  if (ex['effect.enabled'] !== undefined && (n.effects.length === 0 || n.effects.some((e) => e.visible !== ex['effect.enabled']))) problems.push('effect.enabled：儲存值與期望 ' + ex['effect.enabled'] + ' 不符')
  for (const k of PROPS) {
    if (explained.has(k) && !['fills', 'strokes', 'fontName', 'segments'].includes(k)) continue
    if (k === 'fills' && (bound['fills/0/color'] || opacityIdx.length)) {
      p[k] = ser(n.fills.map((f, i) => ({ ...f, color: i === 0 && bound['fills/0/color'] ? null : f.color, opacity: opacityIdx.includes(i) ? null : f.opacity })))
    } else if (k === 'strokes' && (bound['strokes/0/color'] || explained.has('strokeWeight'))) {
      // 描邊的顏色與粗細（粗細另由 strokeWeight 綁定解釋）各自去掉。
      p[k] = ser(n.strokes.map((f, i) => ({ ...f, color: i === 0 && bound['strokes/0/color'] ? null : f.color, weight: explained.has('strokeWeight') ? null : f.weight })))
    } else if (k === 'effects' && ex['effect.enabled'] !== undefined) {
      p[k] = ser(n.effects.map((e) => ({ ...e, visible: null })))
    } else if (k === 'fontName' && bound.fontFamily) {
      p[k] = ser({ ...n.fontName, family: null })
    } else if (k !== 'segments') {
      p[k] = read(n, k)
    }
  }
  if (!isTop) { p.x = read(n, 'x'); p.y = read(n, 'y') }
  if (n.type === 'TEXT') {
    // 混合樣式的分段內容；有綁定的欄位（字級、字型名、填色）在分段裡同樣去掉，只驗證儲存值。
    try {
      const segs = n.getStyledTextSegments(SEG_KEYS)
      p.segments = ser(segs.map((s) => ({
        ...s,
        fontSize: bound.fontSize ? null : s.fontSize,
        fontName: bound.fontFamily ? { ...s.fontName, family: null } : s.fontName,
        fills: bound['fills/0/color'] ? (s.fills || []).map((f) => ({ ...f, color: null })) : s.fills,
      })))
    } catch (e) { p.segments = '"ERR"' }
  }
  p.childCount = String(n.children ? n.children.length : 0)
  p.bound = ser(bound)
  // 影響版面的套系專屬值（內距、間距、描邊粗細、字級、字型名）：兩檔不同時，這個單元的 x／y／寬／高不比（見檔頭第 4 點）。
  p.layoutValues = ser([n.paddingTop, n.paddingRight, n.paddingBottom, n.paddingLeft, n.itemSpacing, n.strokeWeight, n.strokeLeftWeight, n.fontSize, n.fontName && n.fontName.family])
  return { props: p, problems }
}
const walk = (n, path, isTop, out, unit) => {
  const r = record(n, isTop, unit, path === '' ? '-' : path.slice(1).split('/').join('.'))
  out.push({ path, props: r.props, problems: r.problems })
  if (n.children) n.children.forEach((c, i) => walk(c, path + '/' + i, false, out, unit))
  return out
}
const units = page.children.map((n) => ({ type: n.type, name: n.name, nodes: walk(n, '', true, [], n.name) }))
return { units }
`;

// 路徑格式：eval 內的 path 是 '/0/1'（頂層為空字串），期望值表用 resolved.json 的 '0.1'（頂層為 '-'），這裡轉換。
const expectFor = (suite) => {
  const { entries, errors } = loadExpected(themesDir, suite);
  if (errors.length > 0) {
    console.log(errors.slice(0, 10).join('\n'));
    process.exit(2);
  }
  const out = {};
  for (const e of entries) {
    for (const n of e.nodes) {
      const keep = Object.fromEntries(Object.entries(n.values).filter(([k]) => k === 'effect.enabled' || /^fill\[\d\]\.opacity$/.test(k)));
      if (Object.keys(keep).length > 0) (out[e.frame] ??= {})[n.path] = keep;
    }
  }
  return out;
};

const readUnits = (label, file, suite) => {
  // 基準資料讀不到的錯誤要在 try 之外處理，才不會被誤標成設計檔讀取失敗。
  const expect = expectFor(suite);
  try {
    // shell: true 是為了在 Windows 上執行 openpencil.cmd；cwd 在專案內以便套用本機設定。
    const out = execFileSync('openpencil', ['eval', `"${file}"`, '--stdin'], {
      cwd: mockup, input: evalScript(expect), encoding: 'utf8', shell: true, stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 512 * 1024 * 1024,
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

const files = { vibrant: readUnits('vibrant', paths.vibrant, 'Vibrant'), professional: readUnits('professional', paths.professional, 'Professional') };
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

const GEOMETRY = ['x', 'y', 'width', 'height'];
const geometrySkipped = [];
const label = (path) => (path === '' ? '本身' : `節點 ${path}`);
for (const [name, a] of v.found) {
  const b = p.found.get(name);
  if (!b) continue;
  const pa = new Map(a.nodes.map((n) => [n.path, n.props]));
  const pb = new Map(b.nodes.map((n) => [n.path, n.props]));
  // 單元內任一節點的版面相關值（內距、間距、粗細、字級、字型名）兩檔不同，幾何屬性就由這些值決定，不直接比。
  const skipGeometry = [...pa].some(([path, props]) => pb.has(path) && props.layoutValues !== pb.get(path).layoutValues);
  if (skipGeometry) geometrySkipped.push(name);
  for (const [path, props] of pa) {
    const other = pb.get(path);
    if (!other) {
      diffs.push(`[差異] ${name}：${label(path)} 只在 vibrant 有（子節點數量不同）`);
      continue;
    }
    for (const key of Object.keys(props)) {
      if (key === 'layoutValues' || (skipGeometry && GEOMETRY.includes(key))) continue;
      if (props[key] !== other[key]) diffs.push(`[差異] ${name}：${label(path)}（${JSON.parse(props.name)}）的 ${key} 不同`);
    }
  }
  for (const path of pb.keys()) {
    if (!pa.has(path)) diffs.push(`[差異] ${name}：${label(path)} 只在 professional 有（子節點數量不同）`);
  }
}
// 套系專屬值必須由各檔自己的變數值解釋（見檔頭）：儲存值與綁定變數的解析值不符，或與該套系期望值不符。
for (const [where, side] of [['vibrant', v], ['professional', p]]) {
  for (const [name, unit] of side.found) {
    for (const n of unit.nodes) {
      for (const problem of n.problems) diffs.push(`[值與變數不符] ${name}：${label(n.path)}（${JSON.parse(n.props.name)}）${where} 的 ${problem}`);
    }
  }
}

const nodeTotal = [...v.found.values()].reduce((sum, u) => sum + u.nodes.length, 0);
console.log(`頁面：${PAGE}`);
console.log(`母版：vibrant ${v.masterCount}、professional ${p.masterCount}（預期 ${EXPECTED_MASTERS.length}）`);
console.log(`共用 frame：${SHARED_FRAMES.length}；頂層 TEXT：${SHARED_TEXTS.length}`);
console.log(`幾何（x／y／寬／高）改由套系專屬的版面值解釋、不直接比的單元：${geometrySkipped.length} 個${geometrySkipped.length ? `（${geometrySkipped.join('、')}）` : ''}`);
console.log(`比對單元：${v.found.size}，vibrant 節點：${nodeTotal}，每節點屬性：${PROPS.length}`);
if (diffs.length > 0) {
  console.log(diffs.join('\n'));
  const names = new Set(diffs.map((d) => d.match(/^\[[^\]]+\] ([^：]+)：/)?.[1]));
  console.log(`共 ${diffs.length} 項差異，涉及 ${names.size} 個單元：${[...names].join('、')}`);
  process.exit(1);
}
console.log('全部相同');
