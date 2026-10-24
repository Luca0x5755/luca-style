// 版面修正與檢查共用的 openpencil 片段（在 `openpencil eval` 內執行，可用 figma）。
// relayout-fig.js 用來修正與檢查，verify-split.js 用來驗收，兩處共用同一份檢查邏輯。

// 唯讀檢查，回傳 { nan, overlaps, outOfBounds, examples }：
//   nan          行高為 NaN 的文字數（.pen 轉 .fig 的遺留值，離線引擎量不出高度）。
//   overlaps     自動排版 frame 內，相鄰子節點在排版方向上互相重疊（容許 0.5px 誤差）的組數。
//   outOfBounds  子節點超出自動排版父 frame 範圍的數量。
export const CHECK_SNIPPET = `
let nan = 0, overlaps = 0, outOfBounds = 0
const examples = []
const walk = (n) => {
  if (n.type === 'TEXT' && n.lineHeight && typeof n.lineHeight.value === 'number' && Number.isNaN(n.lineHeight.value)) nan++
  const kids = (n.children || []).filter((c) => c.visible !== false && c.layoutPositioning !== 'ABSOLUTE')
  if (n.layoutMode === 'VERTICAL' || n.layoutMode === 'HORIZONTAL') {
    const vertical = n.layoutMode === 'VERTICAL'
    for (let i = 1; i < kids.length; i++) {
      const a = kids[i - 1], b = kids[i]
      const end = vertical ? a.y + a.height : a.x + a.width
      const start = vertical ? b.y : b.x
      if (start < end - 0.5) {
        overlaps++
        if (examples.length < 5) examples.push(n.name + '：' + a.name + ' 與 ' + b.name + ' 重疊 ' + Math.round(end - start) + 'px')
      }
    }
    for (const c of kids) if (c.y + c.height > n.height + 0.5 || c.x + c.width > n.width + 0.5) outOfBounds++
  }
  ;(n.children || []).forEach(walk)
}
figma.root.children.forEach((pg) => pg.children.forEach(walk))
return { nan, overlaps, outOfBounds, examples }
`;

// 修正並回傳 { lineHeights, multiline, nodes }。步驟：
//   1. NaN 行高改為 AUTO。
//   2. 重設自動高度文字的縮放模式，讓引擎重新量測。
//   3. 含換行的文字，引擎只量一行：逐段量測後加總，改為固定高度（resize 會把模式設為 NONE）。
//   4. 由最深層往上，用「間距 +1 再還原」逼每個自動排版 frame 重算。
//   5. 對每個節點把座標與高度「改成別的值再改回來」。離線存檔只保存明確寫入過的值，
//      單靠重算的結果存不進檔案。改回後比對快照，若有節點與重算結果不同就丟錯，不存檔。
export const FIX_SNIPPET = `
const texts = [], frames = [], all = []
const walk = (n, depth) => {
  all.push(n)
  if (n.type === 'TEXT') texts.push(n)
  if (n.layoutMode && n.layoutMode !== 'NONE') frames.push([depth, n])
  ;(n.children || []).forEach((c) => walk(c, depth + 1))
}
figma.root.children.forEach((pg) => pg.children.forEach((c) => walk(c, 0)))
let lineHeights = 0, multiline = 0
for (const t of texts) {
  const lh = t.lineHeight
  if (lh && typeof lh.value === 'number' && Number.isNaN(lh.value)) { t.lineHeight = { unit: 'AUTO' }; lineHeights++ }
  const mode = t.textAutoResize
  if (mode === 'HEIGHT' || mode === 'WIDTH_AND_HEIGHT') { t.textAutoResize = 'NONE'; t.textAutoResize = mode }
}
for (const t of texts) {
  if (t.textAutoResize === 'HEIGHT' && t.characters.includes('\\n')) {
    const full = t.characters, width = t.width
    let sum = 0
    for (const paragraph of full.split('\\n')) { t.characters = paragraph || ' '; sum += t.height }
    t.characters = full
    t.resize(width, sum)
    multiline++
  }
}
frames.sort((a, b) => b[0] - a[0])
for (const [, f] of frames) { const v = f.itemSpacing; f.itemSpacing = v + 1; f.itemSpacing = v }
const snap = new Map(all.map((n) => [n.id, [n.x, n.y, n.width, n.height]]))
const write = (id, o) => figma.graph.updateNode(id, o)
for (const n of all) {
  const [x, y, w, h] = snap.get(n.id)
  write(n.id, { x: x + 1, y: y + 1 }); write(n.id, { x, y })
  if (n.type !== 'TEXT' || n.textAutoResize === 'NONE') { write(n.id, { height: h + 1 }); write(n.id, { height: h }) }
}
let drift = 0
for (const n of all) {
  const s = snap.get(n.id)
  if (Math.abs(n.x - s[0]) > 0.01 || Math.abs(n.y - s[1]) > 0.01 || Math.abs(n.width - s[2]) > 0.01 || Math.abs(n.height - s[3]) > 0.01) drift++
}
if (drift > 0) throw new Error('寫入座標後有 ' + drift + ' 個節點與重算結果不同')
return { lineHeights, multiline, nodes: all.length }
`;
