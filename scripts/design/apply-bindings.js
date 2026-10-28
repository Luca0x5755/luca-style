// 把變數綁到元件庫設計檔的 23 個母版。
//   docs/mockup/luca-style-library.fig  唯一的設計檔（ADR 0007）
// 資料來源（docs/mockup/themes/）：bindings.json（哪個母版節點的哪個屬性綁哪個變數）、variables.json（變數值）。
// 用法：
//   node scripts/design/apply-bindings.js           套用（已一致就不寫檔；可重跑，不產生重複綁定）
//   node scripts/design/apply-bindings.js --check   唯讀：逐筆比對綁定、儲存值與節點數
// 結束碼：0 一致；1 有差異（逐行列出）；2 讀檔或 openpencil 執行失敗。
//
// 節點對應：母版名稱加索引路徑（根為 -，其下為各層 0 起算的子節點索引，以 . 相連），
//   規則見 docs/delivery-verification.md「節點對應規則」。
//
// 屬性對應（bindings.json 的屬性 → .fig 欄位）：
//   fill → fills/0/color；stroke → strokes/0/color；strokeWidth → strokeWeight；
//   strokeWidth.left → borderLeftWeight；fontFamily、fontSize、cornerRadius 同名；
//   gap → itemSpacing；padding → paddingLeft／Right／Top／Bottom 四個欄位。
//   effect.enabled 與 fill[i].opacity 在 openpencil 沒有對應的綁定欄位（只有 visible 與整個節點的 opacity，
//   後者會被限制在 0–1，不是 0–100），所以不綁定，只把儲存值設成解析值：
//   effect 的 visible、第 i 個填色的 opacity（變數值 ÷ 100）。
// 儲存值：綁定後把節點的固定值覆蓋為「預設模式（Vibrant、Light、Desktop）下的變數值」，不遺留矛盾。
//   母版不設模式；切換套系與明暗時由使用它的節點（或總覽 frame）設定 Suite x Mode 集合的模式（ISSUE-015）。
//
// 懸空綁定：變數集合重建後，節點上會留下指向已不存在變數的綁定（fills[0]、fontFamily），離線寫檔時基準版本無法序列化這些節點，
//   所以套用前先在記憶體中清掉；套用後檔案內不再有懸空綁定。
//
// 全程以離線 `openpencil eval` 讀寫檔案，不經過 OpenPencil App。Windows 修補事項見 docs/delivery-verification.md〈Windows 上執行 openpencil 的本機修補〉。
//
// 測試用環境變數：APPLY_BINDINGS_LIBRARY、APPLY_BINDINGS_DIR、
//   APPLY_BINDINGS_NODE_LIMIT（節點數上限，預設 10000）。
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const dir = resolve(process.env.APPLY_BINDINGS_DIR || join(root, 'docs/mockup/themes'));
const NODE_LIMIT = Number(process.env.APPLY_BINDINGS_NODE_LIMIT || 10000);
const libraryPath = resolve(process.env.APPLY_BINDINGS_LIBRARY || join(root, 'docs/mockup/luca-style-library.fig'));

// 母版儲存的是預設模式的值。
const DEFAULT_COMBO = 'Light/Vibrant/Desktop';

const fail = (message, code) => {
  console.log(message);
  process.exit(code);
};

const readJson = (name) => {
  try {
    return JSON.parse(readFileSync(join(dir, name), 'utf8'));
  } catch (error) {
    return fail(`讀不到 ${name}（${dir}）：${error.message}`, 2);
  }
};

// ---------- 計畫（純資料，無 openpencil） ----------

// 回傳 { plan: [entry...], errors }。
// entry = { name, nodes: [{ path, props: { 屬性: { v: 變數名, value: 值 } } }] }
const buildPlan = (bindings, variables) => {
  const byName = new Map(variables.variables.map((v) => [v.name, v]));
  const errors = [];
  const plan = bindings.masters.map((g) => ({
    name: g.frame,
    nodes: g.nodes.map((n) => {
      const props = {};
      for (const [prop, name] of Object.entries(n.bind)) {
        const value = byName.get(name)?.values[DEFAULT_COMBO];
        if (value === undefined) errors.push(`${g.frame} ${n.path} ${prop}：變數 ${name} 沒有 ${DEFAULT_COMBO} 的值`);
        props[prop] = { v: name, value };
      }
      return { path: n.path, props };
    }),
  }));
  return { plan, errors };
};

// ---------- openpencil 呼叫 ----------

// shell: true 是為了在 Windows 上執行 openpencil.cmd；路徑加引號以防空白。
const evalOn = (file, code, extraArgs = []) => {
  try {
    return execFileSync('openpencil', ['eval', `"${file}"`, '--stdin', '--json', ...extraArgs], {
      input: code,
      encoding: 'utf8',
      shell: true,
      maxBuffer: 512 * 1024 * 1024,
    });
  } catch (error) {
    fail(`openpencil 執行失敗（${file}）：${String(error.stderr || error.stdout || error.message).trim().split('\n').find((l) => l.trim()) || ''}`, 2);
  }
};

// 在 openpencil 內執行：apply 為 false 時唯讀，只回報差異；為 true 時依計畫修改並回報修改了幾處。
// 差異一律用同一套比對邏輯產生，所以套用後再跑一次唯讀就是獨立的驗證。
const RUN_SCRIPT = (plan, apply) => String.raw`
const plan = ${JSON.stringify(plan)}
const apply = ${apply}
// 頂層節點散在各畫布頁，統一攤平後依名稱找。
const tops = figma.root.children.flatMap((p) => p.children)
const vars = figma.getLocalVariables()
const V = Object.fromEntries(vars.map((v) => [v.name, v]))
const ids = new Set(vars.map((v) => v.id))
const diffs = []
let changes = 0
const note = (text) => { if (diffs.length < 400) diffs.push(text) }
let nodes = 0
const count = (n) => { nodes++; (n.children || []).forEach(count) }
figma.root.children.forEach(count)

// 套用前先在記憶體清掉懸空綁定（不經事件，不會被記為變更；原因見檔頭）。
let dangling = 0
for (const [, nd] of figma.graph.nodes) {
  const bv = nd.boundVariables || {}
  const bad = Object.keys(bv).filter((k) => !ids.has(bv[k]))
  if (bad.length === 0) continue
  dangling++
  if (apply) nd.boundVariables = Object.fromEntries(Object.entries(bv).filter(([k]) => ids.has(bv[k])))
}

const hex = (c) => '#' + [c.r, c.g, c.b].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('').toUpperCase()
const rgb = (h) => ({ r: parseInt(h.slice(1, 3), 16) / 255, g: parseInt(h.slice(3, 5), 16) / 255, b: parseInt(h.slice(5, 7), 16) / 255, a: 1 })
const near = (a, b) => typeof a === 'number' && Math.abs(a - b) < 1e-6
const at = (f, p) => (p === '-' ? f : p.split('.').reduce((n, i) => n && n.children && n.children[+i], f))
const bindField = { fill: 'fills/0/color', stroke: 'strokes/0/color', fontFamily: 'fontFamily', fontSize: 'fontSize', cornerRadius: 'cornerRadius', gap: 'itemSpacing', strokeWidth: 'strokeWeight', 'strokeWidth.left': 'borderLeftWeight' }
const numField = { fontSize: 'fontSize', cornerRadius: 'cornerRadius', gap: 'itemSpacing' }
const padFields = ['paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom']

const ensureBound = (where, node, field, name) => {
  const v = V[name]
  if (!v) { note('[變數] ' + where + '：檔內沒有變數 ' + name); return }
  if (figma.graph.getNode(node.id).boundVariables[field] === v.id) return
  note('[綁定] ' + where + ' ' + field + '：尚未綁定 ' + name)
  if (apply) { figma.bindVariable(node.id, field, v.id); changes++ }
}

for (const entry of plan) {
  const frame = tops.find((f) => f.name === entry.name)
  if (!frame) { note('[缺少] ' + entry.name + '：設計檔內沒有這個母版'); continue }
  for (const n of entry.nodes) {
    const node = at(frame, n.path)
    const where = entry.name + ' ' + n.path
    if (!node) { note('[路徑] ' + where + '：節點不存在'); continue }
    const p = n.props
    if (p.fill) {
      ensureBound(where, node, 'fills/0/color', p.fill.v)
      const cur = node.fills[0]
      if (!cur || hex(cur.color) !== p.fill.value.toUpperCase()) {
        note('[儲存值] ' + where + ' fill：' + (cur ? hex(cur.color) : '無') + '，應為 ' + p.fill.value)
        if (apply) { node.fills = [{ ...(cur || { type: 'SOLID', opacity: 1, visible: true, blendMode: 'NORMAL' }), color: rgb(p.fill.value) }, ...node.fills.slice(1)]; changes++ }
      }
    }
    if (p.stroke) {
      let cur = node.strokes[0]
      if (!cur) {
        note('[儲存值] ' + where + ' stroke：沒有描邊，應補上 ' + p.stroke.value)
        if (apply) { node.strokes = [{ type: 'SOLID', color: rgb(p.stroke.value), opacity: 1, visible: true, blendMode: 'NORMAL' }]; changes++ }
      } else if (hex(cur.color) !== p.stroke.value.toUpperCase()) {
        note('[儲存值] ' + where + ' stroke：' + hex(cur.color) + '，應為 ' + p.stroke.value)
        if (apply) { node.strokes = [{ ...cur, color: rgb(p.stroke.value) }, ...node.strokes.slice(1)]; changes++ }
      }
      ensureBound(where, node, 'strokes/0/color', p.stroke.v)
      // 粗細：只在綁了粗細變數時檢查（綁定值優先；只綁左邊時其餘三邊為 1）；沒綁的粗細沿用檔內現值，補描邊時為 1。
      let w
      if (p.strokeWidth) w = [p.strokeWidth.value, p.strokeWidth.value, p.strokeWidth.value, p.strokeWidth.value]
      else if (p['strokeWidth.left']) w = [1, 1, 1, p['strokeWidth.left'].value]
      const g = figma.graph.getNode(node.id)
      if (w) {
        const uniform = w.every((x) => x === w[0])
        const have = g.independentStrokeWeights ? [g.borderTopWeight, g.borderRightWeight, g.borderBottomWeight, g.borderLeftWeight] : Array(4).fill(g.strokeWeight)
        if (!w.every((x, i) => near(have[i], x)) || g.independentStrokeWeights === uniform) {
          note('[儲存值] ' + where + ' 描邊粗細：' + have.join(',') + '，應為 ' + w.join(','))
          if (apply) {
            if (uniform) node.strokeWeight = w[0]
            else { node.strokeTopWeight = w[0]; node.strokeRightWeight = w[1]; node.strokeBottomWeight = w[2]; node.strokeLeftWeight = w[3] }
            changes++
          }
        }
      }
    }
    if (p.strokeWidth) ensureBound(where, node, 'strokeWeight', p.strokeWidth.v)
    if (p['strokeWidth.left']) ensureBound(where, node, 'borderLeftWeight', p['strokeWidth.left'].v)
    if (p.fontFamily) {
      ensureBound(where, node, 'fontFamily', p.fontFamily.v)
      const family = node.fontName && node.fontName.family
      if (family !== p.fontFamily.value) {
        note('[儲存值] ' + where + ' fontFamily：' + family + '，應為 ' + p.fontFamily.value)
        if (apply) { node.fontName = { ...node.fontName, family: p.fontFamily.value }; changes++ }
      }
    }
    for (const prop of Object.keys(numField)) {
      if (!p[prop]) continue
      const field = numField[prop]
      ensureBound(where, node, field, p[prop].v)
      if (!near(node[field], p[prop].value)) {
        note('[儲存值] ' + where + ' ' + prop + '：' + node[field] + '，應為 ' + p[prop].value)
        if (apply) { node[field] = p[prop].value; changes++ }
      }
    }
    if (p.padding) {
      for (const field of padFields) {
        ensureBound(where, node, field, p.padding.v)
        if (!near(node[field], p.padding.value)) {
          note('[儲存值] ' + where + ' ' + field + '：' + node[field] + '，應為 ' + p.padding.value)
          if (apply) { node[field] = p.padding.value; changes++ }
        }
      }
    }
    if (p['effect.enabled']) {
      const want = p['effect.enabled'].value
      if (node.effects.length === 0) note('[儲存值] ' + where + ' effect：節點沒有效果可設定')
      else if (node.effects.some((e) => e.visible !== want)) {
        note('[儲存值] ' + where + ' effect.visible：應為 ' + want)
        if (apply) { node.effects = node.effects.map((e) => ({ ...e, visible: want })); changes++ }
      }
    }
    for (let i = 0; i < 4; i++) {
      const prop = p['fill[' + i + '].opacity']
      if (!prop) continue
      const fill = node.fills[i]
      if (!fill) { note('[儲存值] ' + where + ' fill[' + i + ']：沒有這個填色'); continue }
      if (!near(fill.opacity, prop.value / 100)) {
        note('[儲存值] ' + where + ' fill[' + i + '].opacity：' + fill.opacity + '，應為 ' + prop.value / 100)
        if (apply) { node.fills = node.fills.map((f, j) => (j === i ? { ...f, opacity: prop.value / 100 } : f)); changes++ }
      }
    }
  }
}
return { nodes, diffs, changes, dangling }
`;

// ---------- 主流程 ----------

const args = process.argv.slice(2);
const command = args.includes('--check') ? 'check' : 'apply';

const { plan, errors } = buildPlan(readJson('bindings.json'), readJson('variables.json'));
if (errors.length > 0) fail(errors.slice(0, 20).map((e) => `[資料] ${e}`).join('\n') + (errors.length > 20 ? `\n……共 ${errors.length} 項` : ''), 1);

const bindingTotal = plan.reduce((a, e) => a + e.nodes.reduce((b, n) => b + Object.keys(n.props).length, 0), 0);
let result = JSON.parse(evalOn(libraryPath, RUN_SCRIPT(plan, false)));
if (command === 'apply') {
  if (result.diffs.length === 0) {
    console.log('已是最新，不寫檔');
  } else {
    const done = JSON.parse(evalOn(libraryPath, RUN_SCRIPT(plan, true), ['-w']));
    console.log(`已套用（修改 ${done.changes} 處）`);
    result = JSON.parse(evalOn(libraryPath, RUN_SCRIPT(plan, false)));
  }
}
const all = [...result.diffs];
if (result.nodes >= NODE_LIMIT) all.push(`[節點數] 節點數 ${result.nodes} 已達上限 ${NODE_LIMIT}`);
console.log(`元件庫（${libraryPath}）：節點數 ${result.nodes}，${plan.length} 個母版、${bindingTotal} 筆綁定，${all.length === 0 ? '綁定與儲存值全部一致' : `${all.length} 項差異`}`);
if (result.dangling > 0) console.log(`  （仍有 ${result.dangling} 個節點帶有指向不存在變數的綁定）`);
for (const d of all.slice(0, 30)) console.log(`  ${d}`);
if (all.length > 30) console.log(`  ……另有 ${all.length - 30} 項`);
process.exit(all.length > 0 ? 1 : 0);
