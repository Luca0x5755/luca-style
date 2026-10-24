// 主題保真驗收：兩個套系設計檔每個頁面 frame、母版與共用項目，解析後的值必須與基準一致。
//   docs/mockup/components-vibrant.fig      精緻活力
//   docs/mockup/components-professional.fig 精緻專業
// 基準：docs/mockup/themes/resolved.json（由 .pen 擷取）；母版與共用項目的 Professional 期望值推導方式見 theme-expected.js。
// 用法：node scripts/design/verify-themes.js
// 結束碼：0 全部一致；1 有差異（逐行列出 frame、節點路徑、屬性、期望值、實際值）；2 讀檔或執行失敗。
//
// 比對方式（離線 `openpencil eval`，唯讀）：
//   - 「解析值」：用 figma.graph.resolve{Color,Number,String}VariableForNode(節點, 綁定的變數) 取得該節點在其 frame 模式下的值，
//     所以模式設錯（Dark frame 被設回 Light）、變數值被改、變數被換掉，都會讓解析值與基準不同。
//   - 「未綁定」：基準有值的屬性，檔案裡必須綁定變數；綁定被移除（儲存值還在）也會失敗。
//   - 「儲存值」：節點上實際存的值也必須等於基準（匯出與顯示用的是它）。
// 比對屬性：填色、描邊色、字型、字級、間距（gap）、內距（四邊各一）、圓角，另加描邊粗細（strokeWeight）。
// 浮點容忍：顏色每個通道、數值皆容忍 1/255 以內（存檔重讀會有約 1e-8 的誤差）。
// 沒有綁定欄位、只比儲存值的：effect.enabled（效果 visible）與 fill[i].opacity（變數值 ÷ 100）。
// 讀不回、所以不比的：strokeWidth.left（單邊描邊粗細，讀回 API 取不到），只計數並在輸出列出筆數。
// 不做逐像素比對。Windows 的 openpencil 本機修補事項見 split-by-suite.js 檔頭。
//
// 測試用環境變數：VERIFY_THEMES_VIBRANT、VERIFY_THEMES_PROFESSIONAL、VERIFY_THEMES_DIR。
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadExpected } from './theme-expected.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const dir = resolve(process.env.VERIFY_THEMES_DIR || join(root, 'docs/mockup/themes'));
const files = [
  { suite: 'Vibrant', path: resolve(process.env.VERIFY_THEMES_VIBRANT || join(root, 'docs/mockup/components-vibrant.fig')) },
  { suite: 'Professional', path: resolve(process.env.VERIFY_THEMES_PROFESSIONAL || join(root, 'docs/mockup/components-professional.fig')) },
];

// 輸出的類別順序（每類一行計數）。
const CLASSES = ['填色', '描邊', '字型', '字級', '間距', '內距', '圓角', '描邊粗細'];

// 在 openpencil 內執行：逐 frame、逐節點、逐屬性比對，回傳計數與差異。
const evalScript = (entries) => String.raw`
const entries = ${JSON.stringify(entries)}
const TOL = 1 / 255 + 1e-9
const page = figma.root.children[0]
const counts = {}
const diffs = []
let skipped = 0
const hex = (c) => '#' + [c.r, c.g, c.b].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('').toUpperCase()
const chan = (h, i) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16)
const colorOk = (actual, want) => [0, 1, 2].every((i) => Math.abs(actual[['r', 'g', 'b'][i]] * 255 - chan(want, i)) <= 1 + 1e-6)
const numOk = (a, b) => typeof a === 'number' && Math.abs(a - b) <= TOL
const at = (f, p) => (p === '-' ? f : p.split('.').reduce((n, i) => n && n.children && n.children[+i], f))
const bump = (cls) => { counts[cls] = (counts[cls] || 0) + 1 }
let truncated = false
const add = (frame, path, prop, want, got) => { if (diffs.length < 5000) diffs.push({ frame, path, prop, want: String(want), got: String(got) }); else truncated = true }

for (const e of entries) {
  const frame = page.children.find((f) => f.name === e.frame)
  if (!frame) { add(e.frame, '-', '(frame)', '存在', '設計檔內沒有這個 frame'); continue }
  for (const n of e.nodes) {
    const node = at(frame, n.path)
    if (!node) { add(e.frame, n.path, '(節點)', '存在', '路徑不存在'); continue }
    const g = figma.graph.getNode(node.id)
    const bv = g.boundVariables || {}
    const v = n.values
    // 解析值：先確認有綁定，再用該節點的模式解析。
    const resolveVia = (cls, prop, field, kind, want, stored) => {
      bump(cls)
      const varId = bv[field]
      if (!varId) { add(e.frame, n.path, prop, want, '未綁定變數（' + field + '）'); return }
      let got
      try {
        got = kind === 'color' ? figma.graph.resolveColorVariableForNode(node.id, varId)
          : kind === 'string' ? figma.graph.resolveStringVariableForNode(node.id, varId)
          : figma.graph.resolveNumberVariableForNode(node.id, varId)
      } catch (err) { add(e.frame, n.path, prop, want, '解析失敗：' + err.message); return }
      const ok = kind === 'color' ? got && colorOk(got, want) : kind === 'string' ? got === want : numOk(got, want)
      if (!ok) add(e.frame, n.path, prop, want, kind === 'color' ? (got ? hex(got) : got) : got)
      const sOk = kind === 'color' ? stored && colorOk(stored, want) : kind === 'string' ? stored === want : numOk(stored, want)
      if (!sOk) add(e.frame, n.path, prop + '（儲存值）', want, kind === 'color' ? (stored ? hex(stored) : stored) : stored)
    }
    if (v.fill !== undefined) resolveVia('填色', 'fill', 'fills/0/color', 'color', v.fill, node.fills && node.fills[0] && node.fills[0].color)
    if (v.stroke !== undefined) resolveVia('描邊', 'stroke', 'strokes/0/color', 'color', v.stroke, node.strokes && node.strokes[0] && node.strokes[0].color)
    if (v.fontFamily !== undefined) resolveVia('字型', 'fontFamily', 'fontFamily', 'string', v.fontFamily, node.fontName && node.fontName.family)
    if (v.fontSize !== undefined) resolveVia('字級', 'fontSize', 'fontSize', 'number', v.fontSize, node.fontSize)
    if (v.gap !== undefined) resolveVia('間距', 'gap', 'itemSpacing', 'number', v.gap, node.itemSpacing)
    if (v.cornerRadius !== undefined) resolveVia('圓角', 'cornerRadius', 'cornerRadius', 'number', v.cornerRadius, node.cornerRadius)
    if (v.strokeWidth !== undefined) resolveVia('描邊粗細', 'strokeWidth', 'strokeWeight', 'number', v.strokeWidth, node.strokeWeight)
    if (v.padding !== undefined) {
      for (const field of ['paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom']) resolveVia('內距', 'padding.' + field, field, 'number', v.padding, node[field])
    }
    if (v['strokeWidth.left'] !== undefined) skipped++
    if (v['effect.enabled'] !== undefined) {
      const bad = node.effects.length === 0 || node.effects.some((x) => x.visible !== v['effect.enabled'])
      bump('僅儲存值：effect.enabled')
      if (bad) add(e.frame, n.path, 'effect.enabled（儲存值）', v['effect.enabled'], node.effects.map((x) => x.visible).join(','))
    }
    for (let i = 0; i < 4; i++) {
      const w = v['fill[' + i + '].opacity']
      if (w === undefined) continue
      bump('僅儲存值：fill[i].opacity')
      const f = node.fills[i]
      if (!f || !numOk(f.opacity, w / 100)) add(e.frame, n.path, 'fill[' + i + '].opacity（儲存值）', w / 100, f ? f.opacity : '沒有這個填色')
    }
  }
}
return { counts, diffs, skipped, truncated }
`;

const evalOn = (label, file, entries) => {
  try {
    const out = execFileSync('openpencil', ['eval', `"${file}"`, '--stdin', '--json'], {
      input: evalScript(entries), encoding: 'utf8', shell: true, stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 512 * 1024 * 1024,
    });
    return JSON.parse(out.replace(/\x1b\[[0-9;]*m/g, '').trim());
  } catch (error) {
    console.log(`[讀取] ${label}：${String(error.stderr || error.message).trim().split('\n')[0]}`);
    process.exit(2);
  }
};

let failed = 0;
for (const file of files) {
  let expected;
  try {
    expected = loadExpected(dir, file.suite);
  } catch (error) {
    console.log(`[讀取] 基準資料（${dir}）：${error.message}`);
    process.exit(2);
  }
  const result = evalOn(file.suite, file.path, expected.entries);
  const lines = [...expected.errors];
  if (result.truncated) lines.push('[差異] 差異超過 5000 筆，只列出前 5000 筆');
  for (const d of result.diffs) lines.push(`[差異] ${d.frame} 節點 ${d.path} ${d.prop}：期望 ${d.want}，實際 ${d.got}`);
  const total = Object.values(result.counts).reduce((a, b) => a + b, 0);
  console.log(`${file.suite}（${file.path}）：${expected.entries.length} 個 frame／母版，比對 ${total} 筆`);
  for (const cls of [...CLASSES, ...Object.keys(result.counts).filter((c) => !CLASSES.includes(c))]) {
    console.log(`  ${cls}：${result.counts[cls] || 0}`);
  }
  console.log(`  不比對（strokeWidth.left，讀回 API 取不到）：${result.skipped}`);
  console.log(lines.length === 0 ? '  全部一致' : `  ${lines.length} 項差異`);
  for (const l of lines.slice(0, 100)) console.log(`  ${l}`);
  if (lines.length > 100) console.log(`  ……另有 ${lines.length - 100} 項`);
  if (lines.length > 0) failed++;
}
process.exit(failed > 0 ? 1 : 0);
