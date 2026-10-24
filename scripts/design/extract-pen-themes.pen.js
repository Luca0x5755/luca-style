// 在 Pencil 的 `execute` 工具內執行的擷取片段（不是 Node 腳本，不能直接 node 執行）。
// 目標檔：docs/mockup/components.pen（加密檔，只能透過 pencil MCP 的 execute 存取，不可修改）。
// 該檔已從工作樹刪除，要重跑需先從提交歷史取回（最後存在的提交是刪除前一個）。
// Pencil 的 execute 不能寫檔：片段用 Print 輸出文字，再由人把輸出存成
//   docs/mockup/themes/extract-raw.txt、docs/mockup/themes/variables-raw.txt
// 之後執行 node scripts/design/build-theme-data.js 產生三份 JSON。
//
// 使用方式：每個「片段」是一次 execute 呼叫。execute 的規定是程式碼不含註解，
// 所以貼進去之前先去掉註解：
//   grep -v '^\s*//' scripts/design/extract-pen-themes.pen.js
// 並只貼需要的片段（片段之間以 `// ===== 片段` 分隔）。
//
// 節點路徑規則：對頁面 frame 呼叫 Get(id, visitor, { resolveInstances: true }) 取得展開後的樹，
// 路徑 = 根節點記為 -，其下每層用子節點的 0 起算索引以 . 相連。展開樹的順序、節點數與名稱
// 與 .fig 同名 frame 一致（由 build-theme-data.js --check-fig 驗證）。

// ===== 片段 1：印出變數定義（存成 variables-raw.txt，每行「變數名 JSON」，第一行是主題軸）=====
const g = GetVariables();
Print(JSON.stringify(g.themes));
for (const k in g.variables) Print(k + ' ' + JSON.stringify(g.variables[k]));

// ===== 片段 2：擷取綁定（輸出存成 extract-raw.txt 的主體；檔頭的 # 行來自片段 3、4）=====
// 輸出格式：
//   S<id>=<類型>|<屬性>=<變數>;...      屬性集合字典（第一次出現時印出）
//   @@ <frame 名稱>|<展開後節點數>|<名稱序列雜湊>|B<本體 id>      每個頁面 frame 一行；@@M 開頭是母版
//   B<id> <本體雜湊> <筆數> <路徑>:<集合 id> ...                 本體（內容相同的 frame 只印一次）
// 太長時把 START 往後調分批執行；前 START 個 frame 只重放（不輸出），好讓集合與本體編號維持一致。
const START = 0;
const MM = [], FR = [];
Get(document, (n, c) => { if (c.depth === 0) (n.reusable ? MM : FR).push([n.id, n.name, n.theme || null]); c.skipChildren(); });
const VV = GetVariables().variables;
const H = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; return h.toString(36); };
const isRef = v => typeof v === 'string' && v[0] === '$';
const leaves = (v, p, out) => {
  if (isRef(v)) { out.push([p, v.slice(1)]); return; }
  if (Array.isArray(v)) v.forEach((e, i) => leaves(e, p + '[' + i + ']', out));
  else if (v && typeof v === 'object') { for (const k in v) leaves(v[k], p + '.' + k, out); }
};
const getAt = (v, p) => { const m = p.match(/[^.\[\]]+/g); let o = v; for (const s of m) { if (o == null) return undefined; o = o[s]; } return o; };
const derive = (name, th) => {
  const d = VV[name]; if (!d) return undefined;
  const v = d.value; if (!Array.isArray(v)) return v;
  for (const e of v) if (Object.keys(e.theme || {}).every(k => th[k] === e.theme[k])) return e.value;
  return undefined;
};
const DEF = { mode: 'Light', suite: 'Vibrant', device: 'Desktop' };
const TL = { frame: 'f', text: 't', icon: 'i', rectangle: 'r' };
const SETS = new Map(), BODIES = new Map();
let BAD = 0, quiet = false;
const P = s => { if (!quiet) Print(s); };
const run = (id, name, theme) => {
  const th = theme || DEF, st = [], lines = [], names = [], refs = [];
  Get(id, (x, c) => {
    st[c.depth] = c.index; names.push(x.name);
    const o = [];
    for (const k in x) { if (['children', 'name', 'id', 'content', 'theme', 'type', 'ref'].includes(k)) continue; leaves(x[k], k, o); }
    if (o.length) {
      const p = c.depth === 0 ? '-' : st.slice(1, c.depth + 1).join('.');
      lines.push([p, (TL[x.type] || x.type) + '|' + o.map(e => e[0] + '=' + e[1]).join(';')]);
      refs.push([p, o]);
    }
  }, { resolveInstances: true });
  const res = {};
  Get(id, (x, c) => { st[c.depth] = c.index; res[c.depth === 0 ? '-' : st.slice(1, c.depth + 1).join('.')] = x; }, { resolveInstances: true, resolveVariables: true });
  let bad = 0;
  for (const [p, o] of refs) {
    const r = res[p];
    for (const [k, v] of o) {
      const a = getAt(r, k), b = derive(v, th);
      let ok = JSON.stringify(a) === JSON.stringify(b);
      // Pencil 解析後會把預設值省略：opacity 100、effect.enabled true、四邊相同的 strokeWidth。
      if (!ok) {
        if (k === 'effect.enabled') ok = (a === undefined && b === true);
        else if (k === 'strokeWidth.left') ok = (a === undefined && r.strokeWidth === b);
        else if (/^fill\[\d\]\.opacity$/.test(k)) ok = (a === undefined && b === 100) || (a === b / 100);
      }
      if (!ok) { bad++; if (bad <= 3) Print('BAD', name, p, k, v, JSON.stringify(a), JSON.stringify(b)); }
    }
  }
  BAD += bad;
  return { lines, n: names.length, h: H(names.join('\u0001')) };
};
const emit = (tag, name, r) => {
  const sid = l => { let s = SETS.get(l[1]); if (s === undefined) { s = SETS.size.toString(36); SETS.set(l[1], s); P('S' + s + '=' + l[1]); } return s; };
  const ids = r.lines.map(l => [l[0], sid(l)]);
  const body = ids.map(e => e[0] + ':' + e[1]).join(' ');
  const full = r.lines.map(l => l[0] + '|' + l[1]).join('\n');
  let b = BODIES.get(full), nw = false;
  if (b === undefined) { b = BODIES.size.toString(36); BODIES.set(full, b); nw = true; }
  P(tag + ' ' + name + '|' + r.n + '|' + r.h + '|B' + b);
  if (nw) P('B' + b + ' ' + H(full) + ' ' + r.lines.length + ' ' + body);
};
quiet = true;
for (const [id, name, th] of FR.slice(0, START)) emit('@@', name, run(id, name, th));
quiet = false;
for (const [id, name, th] of FR.slice(START)) emit('@@', name, run(id, name, th));
for (const [id, name] of MM) emit('@@M', name, run(id, name, null));
Print('BAD total', BAD, 'sets', SETS.size, 'bodies', BODIES.size, 'frames', FR.length, 'masters', MM.length);
// 預期：BAD total 0、frames 304、masters 22；「BAD total 0」就是 #pencil-resolve-check mismatches=0 的來源。

// ===== 片段 3：獨立計數（結果存成 extract-raw.txt 檔頭的 #independent-count 行）=====
// 不經過傳輸格式，直接對每個節點遞迴數出 $ 引用，作為 build-theme-data.js --check 的對照。
const tops = [];
Get(document, (n, c) => { if (c.depth === 0) tops.push([n.id, !!n.reusable]); c.skipChildren(); });
const isRef2 = v => typeof v === 'string' && v[0] === '$';
const cnt = (v, p, t, acc) => {
  if (isRef2(v)) { const k = t + ':' + p; acc[k] = (acc[k] || 0) + 1; return; }
  if (Array.isArray(v)) v.forEach((e, i) => cnt(e, p + '[' + i + ']', t, acc));
  else if (v && typeof v === 'object') { for (const k in v) cnt(v[k], p + '.' + k, t, acc); }
};
const count = (pred, expand) => {
  const acc = {}; let nodes = 0;
  for (const [id, ru] of tops) {
    if (!pred(ru)) continue;
    Get(id, x => { nodes++; for (const k in x) { if (['children', 'name', 'id', 'content', 'theme', 'type', 'ref', 'descendants'].includes(k)) continue; cnt(x[k], k, x.type, acc); } }, { resolveInstances: expand });
  }
  return { nodes, acc, total: Object.values(acc).reduce((a, b) => a + b, 0) };
};
for (const [label, pred, expand] of [['unexpanded-frames', r => !r, false], ['unexpanded-masters', r => r, false], ['expanded-frames', r => !r, true], ['expanded-masters', r => r, true]]) {
  const r = count(pred, expand);
  Print('#independent-count ' + label + ' ' + r.nodes + ' ' + r.total + ' ' + JSON.stringify(r.acc));
}

// ===== 片段 4：抽樣截圖（人工比對 resolved.json 與畫面）=====
// 換成要抽樣的 frame id（id 可用片段 2 開頭的 FR 清單取得）。
TakeScreenshot(['VkzD3', 'PvygW', 'AyT0s', 'deK0R', 'SmqZz']);

// ===== 片段 5：擷取不均勻的描邊粗細（結果整理成 docs/mockup/themes/strokes.json）=====
// .fig 轉換丟掉了所有描邊，ISSUE-009 重建描邊時需要粗細。均勻的 1、border-width 變數（1／1.5）與
// metric-border-left 變數（1,1,1,3）由變數或預設 1 決定，這裡只列其餘的節點：
// 只有下邊（0,0,1,0）、固定 2 或 3。輸出是「本體 → frame 名稱清單」，把相同本體的名稱合併成 groups。
const tops5 = [];
Get(document, (n, c) => { if (c.depth === 0) tops5.push([n.id, n.name]); c.skipChildren(); });
const spec5 = w => (w === undefined ? 1 : typeof w === 'number' ? w : [w.top || 0, w.right || 0, w.bottom || 0, w.left || 0].join(','));
const bodies5 = new Map();
for (const [id, name] of tops5) {
  const st = [];
  const items = [];
  Get(id, (x, c) => {
    st[c.depth] = c.index;
    if (x.stroke) {
      const s = spec5(x.strokeWidth);
      if (s !== 1 && s !== 1.5 && s !== '1,1,1,3') items.push((c.depth === 0 ? '-' : st.slice(1, c.depth + 1).join('.')) + '=' + s);
    }
  }, { resolveInstances: true, resolveVariables: true });
  if (items.length) {
    const b = items.join(' ');
    if (!bodies5.has(b)) bodies5.set(b, []);
    bodies5.get(b).push(name);
  }
}
let i5 = 0;
for (const [b, names] of bodies5) { Print('#' + i5 + ' ' + names.length + ' ' + b); Print('  ' + names.join(' | ')); i5++; }
// 預期 12 個本體、共 305 個 frame（5 個母版＋300 個頁面 frame）。
