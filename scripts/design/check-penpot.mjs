// 離線檢查元件庫設計檔的 Penpot 匯出（ISSUE-027，PR-FILE-16、26、27）。
// 檢查三件事，任何差異都回報，CLI 以非零結束碼結束並逐行列出：
//   1. 母版：檔名、名稱（正規化後）與數量（23）等於 bindings.json 的清單。
//   2. 綁定：逐節點的 token 綁定等於 bindings.json（匯出檔存的是短鍵，見 BIND_KEYS）。
//   3. 解析值：依各 theme 啟用的 token set 與 tokenSetOrder 在匯出檔內離線解析，12 組 Suite x Mode x Device 的值
//      逐筆等於 variables.json；同樣的解析也拿來和 penpot-tokens.json 比，分辨是 Penpot 檔漂移還是產生器漂移。
// 匯出檔是不受信任的資料：只在記憶體內解開（沿用 penpot-dump.mjs 的 buildDump），不寫檔、不執行其中任何內容。
//
// 離線可解析的範圍與限制：
//   - 只做 token set 的疊加（後者覆蓋前者）；形狀上存的解析值只有匯出當下啟用的 theme，其他 theme 的值無法從形狀讀到，
//     所以「母版實際顯示的顏色」沒有被驗證，驗證的是「token 綁定 + token 值」這兩層的乘積。
//   - 不解析別名（值以 `{` 開頭）；遇到會回報「無法離線解析」，不會當作通過。
//   - theme 的 set 狀態只認 enabled。
//   - 幾何、版面、文字內容、字重、元件表示都不檢查。
//
// 用法：node scripts/design/check-penpot.mjs [匯出檔.penpot] [--bindings f] [--variables f] [--tokens f] [--expect-masters N]
//   --expect-masters 只給測試用縮小夾具，預設 23。
//   省略參數時讀 docs/mockup/luca-style-library.penpot 與 docs/mockup/themes/{bindings,variables,penpot-tokens}.json。
// 結束碼：0 一致、1 有差異或匯出檔無法解析、2 用法錯誤。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buildDump, orderedSets } from './penpot-dump.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const DEFAULT_EXPORT = resolve(root, 'docs/mockup/luca-style-library.penpot');
const DEFAULT_THEMES = resolve(root, 'docs/mockup/themes');

export const LIBRARY_NAME = 'luca-style-library';
export const EXPECTED_MASTER_COUNT = 23;

// 母版名稱：Penpot 把板名斜線兩側補成空白（`C / Button / Primary`），bindings.json 沒有（ISSUE-025 決策一）。
export const normalizeName = (name) => name.replace(/\s*\/\s*/g, '/');

// bindings.json 的綁定鍵 -> 匯出檔 appliedTokens 的短鍵（見 delivery-verification「離線可讀與不可讀」）。
const BIND_KEYS = {
  fill: ['fill'],
  stroke: ['strokeColor'],
  strokeWidth: ['strokeWidth'],
  fontFamily: ['fontFamily'],
  cornerRadius: ['r1', 'r2', 'r3', 'r4'],
  padding: ['p1', 'p2', 'p3', 'p4'],
};
// bindings.json 的節點型別 -> Penpot 的形狀型別（icon 與 component 在 Penpot 都是 board，匯出檔裡型別是 frame）。
const NODE_TYPES = { frame: 'frame', component: 'frame', icon: 'frame', text: 'text' };

// ---- 已接受的表示差異（明確、限定範圍；範圍外的同類差異照樣回報）----
// 每一項都要寫清楚出處，不在這裡的差異一律視為差異。
const ACCEPTED = [
  {
    // ISSUE-026：舊設計檔的一個 frame 帶 4 層填色（fill[i].opacity）；Penpot 的不透明度 token 綁在形狀上，
    // 所以該 board 的子節點是 4 個疊放的矩形，各綁一個 opacity token，矩形名稱是 token 名去掉 `-opacity`。
    master: 'C/State/Loading', path: '0', pattern: /^fill\[(\d+)\]\.opacity$/, kind: 'stack',
  },
  {
    // ISSUE-026：Penpot 沒有單邊描邊寬，metric-border-left 沒有綁；描邊取固定值 1。
    master: 'C/Card/Metric', path: '-', key: 'strokeWidth.left', token: 'metric-border-left', kind: 'unbound',
  },
  {
    // ISSUE-024（PR-FILE-33）：Penpot 沒有布林，陰影開關改以 shadow token 表示。
    master: 'C/Card/Metric', path: '-', key: 'effect.enabled', token: 'elevation-enabled', kind: 'shadow', shadowToken: 'metric-shadow',
  },
];

// 沒有 Penpot token 的變數：suite-label 是一般字串（Penpot 沒有此型別，build.mjs 不輸出）；
// elevation-enabled 是布林，改由 metric-shadow 的色彩 alpha 判斷（alpha 為 0 即關）。
const NO_TOKEN_VARIABLES = new Set(['suite-label']);
const SHADOW_VARIABLE = 'elevation-enabled';
const SHADOW_TOKEN = 'metric-shadow';

// ---- 母版與綁定 ----

// 把 Penpot 形狀樹轉成 bindings.json 的 path：根為 `-`，子節點索引取 Penpot `shapes` 的反向序
// （Penpot 由下而上存，bindings.json 是由上而下）。stackPaths 內的節點，其子節點是疊放矩形，不進 map。
function pathMap(shape, stackPaths) {
  const map = new Map();
  const walk = (node, path) => {
    map.set(path, node);
    if (stackPaths.has(path)) return;
    [...(node.children ?? [])].reverse().forEach((child, i) => walk(child, path === '-' ? String(i) : `${path}.${i}`));
  };
  walk(shape, '-');
  return map;
}

const tokensOf = (node) => node.appliedTokens ?? {};

// 把一個節點的 bind 換算成期望的 appliedTokens；回傳 { expected, stack, problems }。
function expectBind(masterName, path, bind) {
  const expected = {};
  const problems = [];
  let stack = null;
  for (const [key, token] of Object.entries(bind)) {
    if (BIND_KEYS[key]) {
      for (const short of BIND_KEYS[key]) expected[short] = token;
      continue;
    }
    const rule = ACCEPTED.find((a) => a.master === masterName && a.path === path && (a.pattern ? a.pattern.test(key) : a.key === key && a.token === token));
    if (!rule) {
      problems.push(`${masterName} 路徑 ${path} ${key}（${token}）：不在已接受的表示差異內，未被接受`);
    } else if (rule.kind === 'stack') {
      (stack ??= []).push({ index: Number(rule.pattern.exec(key)[1]), token });
    } else if (rule.kind === 'shadow') {
      expected.shadow = rule.shadowToken;
    } // kind === 'unbound'：Penpot 不綁，expected 不加；匯出檔若綁了會被當成多出的綁定。
  }
  if (stack) stack.sort((a, b) => a.index - b.index);
  return { expected, stack, problems };
}

function checkMasters(dump, bindings, diffs, expectedCount) {
  const masters = [];
  for (const page of dump.pages) {
    for (const shape of page.shapes) {
      if (shape.type === 'frame') masters.push(shape);
      else diffs.push(`頂層有非 board 的形狀：${shape.name}（${shape.type}）`);
    }
  }
  const listed = bindings.masters.map((m) => m.frame);
  if (listed.length !== expectedCount) diffs.push(`bindings.json 列了 ${listed.length} 個母版，應為 ${expectedCount}`);
  const byName = new Map();
  for (const m of masters) {
    const name = normalizeName(m.name);
    if (byName.has(name)) diffs.push(`母版名稱重複：${name}`);
    else byName.set(name, m);
  }
  for (const name of listed) if (!byName.has(name)) diffs.push(`缺少母版：${name}`);
  const listedSet = new Set(listed);
  for (const name of byName.keys()) if (!listedSet.has(name)) diffs.push(`多出母版：${name}`);
  if (masters.length !== listed.length) diffs.push(`母版數量：匯出檔 ${masters.length}，bindings.json ${listed.length}`);

  for (const spec of bindings.masters) {
    const shape = byName.get(spec.frame);
    if (shape) checkMaster(spec, shape, diffs);
  }
}

function checkMaster(spec, shape, diffs) {
  const name = spec.frame;
  const plans = new Map();
  const stackPaths = new Set();
  for (const node of spec.nodes) {
    const plan = expectBind(name, node.path, node.bind);
    diffs.push(...plan.problems);
    plans.set(node.path, plan);
    if (plan.stack) stackPaths.add(node.path);
  }
  const map = pathMap(shape, stackPaths);
  if (map.size !== spec.nodeCount) diffs.push(`${name} 節點數：bindings.json 為 ${spec.nodeCount}，匯出檔為 ${map.size}`);

  const listedPaths = new Set(spec.nodes.map((n) => n.path));
  for (const node of spec.nodes) {
    const actual = map.get(node.path);
    if (!actual) {
      diffs.push(`${name} 路徑 ${node.path}：匯出檔沒有此節點`);
      continue;
    }
    const wantType = NODE_TYPES[node.type];
    if (wantType !== actual.type) diffs.push(`${name} 路徑 ${node.path} 型別：bindings.json 為 ${node.type}（Penpot ${wantType}），匯出檔為 ${actual.type}`);
    diffTokens(`${name} 路徑 ${node.path}`, plans.get(node.path).expected, tokensOf(actual), diffs);
    if (plans.get(node.path).stack) checkStack(name, plans.get(node.path).stack, actual, diffs);
  }
  // bindings.json 沒列的節點必須沒有任何綁定。
  for (const [path, actual] of map) {
    if (!listedPaths.has(path)) diffTokens(`${name} 路徑 ${path}`, {}, tokensOf(actual), diffs, 'bindings.json 沒有列此節點的綁定');
  }
}

function diffTokens(where, expected, actual, diffs, noneNote = 'bindings.json 沒有') {
  for (const [key, token] of Object.entries(expected)) {
    if (actual[key] === undefined) diffs.push(`${where} ${key}：bindings.json 為 ${token}，匯出檔未綁定`);
    else if (actual[key] !== token) diffs.push(`${where} ${key}：bindings.json 為 ${token}，匯出檔為 ${actual[key]}`);
  }
  for (const [key, token] of Object.entries(actual)) {
    if (!(key in expected)) diffs.push(`${where} ${key}：${noneNote}，匯出檔為 ${token}`);
  }
}

// 疊放矩形：依 fill 索引順序，每個矩形名稱為 token 名去掉 `-opacity`，只綁一個 opacity，沒有子節點。
function checkStack(masterName, stack, board, diffs) {
  const rects = board.children ?? [];
  const where = `${masterName} 疊放矩形`;
  if (rects.length !== stack.length) diffs.push(`${where}：bindings.json 有 ${stack.length} 層填色，匯出檔有 ${rects.length} 個子節點`);
  stack.forEach(({ token }, i) => {
    const rect = rects[i];
    if (!rect) return;
    const want = token.replace(/-opacity$/, '');
    if (rect.type !== 'rect') diffs.push(`${where} 第 ${i} 個：型別應為 rect，匯出檔為 ${rect.type}`);
    if (rect.name !== want) diffs.push(`${where} 第 ${i} 個：名稱應為 ${want}，匯出檔為 ${rect.name}`);
    if ((rect.children ?? []).length) diffs.push(`${where} 第 ${i} 個：不應有子節點`);
    diffTokens(`${where} 第 ${i} 個`, { opacity: token }, tokensOf(rect), diffs);
  });
}

// ---- token 解析（PR-FILE-16）----

// 內部形狀：{ sets: [{ name, tokens }]（依 tokenSetOrder）, themes: [{ group, name, selectedTokenSets }] }
function fromDump(tokens) {
  return { sets: tokens.sets, themes: tokens.themes };
}

function fromTokenFile(raw) {
  return { sets: orderedSets(raw).sets, themes: raw.$themes ?? [] };
}

// 回傳 { values: Map<名稱, token>, problems: [] }：後面的 set 覆蓋前面的。
function resolveCombo(source, themeNames) {
  const problems = [];
  const enabled = new Set();
  for (const { group, name } of themeNames) {
    const theme = source.themes.find((t) => t.group === group && t.name === name);
    if (!theme) {
      problems.push(`缺少 theme：${group} / ${name}`);
      continue;
    }
    for (const [set, state] of Object.entries(theme.selectedTokenSets ?? {})) if (state === 'enabled') enabled.add(set);
  }
  const values = new Map();
  for (const { name, tokens } of source.sets) {
    if (!enabled.has(name)) continue;
    for (const [token, def] of Object.entries(tokens)) values.set(token, def);
  }
  return { values, problems };
}

// 別名以 `{token}` 表示；陰影等複合值的欄位內也可能有別名，所以遞迴找字串。
const isAlias = (v) => (typeof v === 'string' ? v.includes('{') : v !== null && typeof v === 'object' && Object.values(v).some(isAlias));
const num = (v) => Number(String(v).replace('%', ''));
const lower = (v) => String(v).toLowerCase();

// 把 token 值正規化成可比較的形式（匯出檔與來源 JSON 的三種寫法差異：fontFamilies 陣列、0% 寫成 0、$description）。
function normValue(type, value) {
  if (type === 'fontFamilies') return Array.isArray(value) ? value.join(', ') : String(value);
  if (type === 'color') return lower(value);
  if (type === 'shadow') {
    const list = Array.isArray(value) ? value : [value];
    return list.map((s) => ({ color: lower(s.color), offsetX: num(s.offsetX), offsetY: num(s.offsetY), blur: num(s.blur), spread: num(s.spread), inset: s.inset === true || s.inset === 'true' }));
  }
  if (['number', 'spacing', 'fontSizes', 'fontWeights', 'borderWidth', 'borderRadius', 'opacity', 'sizing', 'dimension'].includes(type)) return num(value);
  return String(value);
}

const show = (v) => (typeof v === 'object' ? JSON.stringify(v) : String(v));
const same = (a, b) => (typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 1e-6 : JSON.stringify(a) === JSON.stringify(b));

// 陰影色 alpha：#rrggbbaa 取最後兩碼，#rrggbb 視為不透明，#rgba/#rgb 同理。
function alphaOf(color) {
  const h = String(color).replace('#', '');
  if (h.length === 8) return parseInt(h.slice(6), 16);
  if (h.length === 4) return parseInt(h[3] + h[3], 16);
  return 255;
}

function checkResolved(dumpTokens, variables, penpotTokens, diffs) {
  const exportSource = fromDump(dumpTokens);
  const fileSource = fromTokenFile(penpotTokens);
  const { mode, suite, device } = variables.axes;
  const unresolvable = new Set();
  const extras = new Set();
  const varNames = new Set(variables.variables.map((v) => v.name));

  for (const m of mode) for (const s of suite) for (const d of device) {
    const label = `${m}/${s}/${d}`;
    const themeNames = [{ group: 'Suite x Mode', name: `${s} / ${m}` }, { group: 'Device', name: d }];
    const a = resolveCombo(exportSource, themeNames);
    const b = resolveCombo(fileSource, themeNames);
    for (const p of new Set([...a.problems.map((x) => `匯出檔 ${x}`), ...b.problems.map((x) => `penpot-tokens.json ${x}`)])) diffs.push(p);

    const normOf = (def) => normValue(def.$type, def.$value);
    const aliasOf = (name, def) => {
      if (!isAlias(def.$value)) return false;
      if (!unresolvable.has(name)) diffs.push(`解析值 ${name} @ ${label}：無法離線解析別名 ${show(def.$value)}`);
      unresolvable.add(name);
      return true;
    };

    // 匯出檔 vs variables.json
    for (const v of variables.variables) {
      const want = v.values[label];
      if (NO_TOKEN_VARIABLES.has(v.name)) continue;
      if (v.name === SHADOW_VARIABLE) {
        const def = a.values.get(SHADOW_TOKEN);
        if (!def) { diffs.push(`[variables.json] 缺少 ${SHADOW_TOKEN} @ ${label}：${SHADOW_VARIABLE} 靠它判斷`); continue; }
        if (aliasOf(SHADOW_TOKEN, def)) continue;
        const shadows = normValue('shadow', def.$value);
        const on = shadows.length > 0 && alphaOf(shadows[0].color) > 0;
        if (on !== want) diffs.push(`[variables.json] 解析值 ${v.name} @ ${label}：匯出檔的 ${SHADOW_TOKEN} 為${on ? '開' : '關'}（${show(shadows[0]?.color)}），variables.json 為 ${want}`);
        continue;
      }
      const def = a.values.get(v.name);
      if (!def) { diffs.push(`[variables.json] 缺少 ${v.name} @ ${label}：匯出檔解析不到此 token，variables.json 有`); continue; }
      if (aliasOf(v.name, def)) continue;
      const got = normOf(def);
      const exp = v.type === 'color' ? lower(want) : v.type === 'number' ? Number(want) : String(want);
      if (!same(got, exp)) diffs.push(`[variables.json] 解析值 ${v.name} @ ${label}：匯出檔為 ${show(got)}，variables.json 為 ${show(exp)}`);
    }
    for (const name of a.values.keys()) if (!varNames.has(name) && name !== SHADOW_TOKEN) extras.add(name);

    // 匯出檔 vs penpot-tokens.json（全部 token，含 metric-shadow）
    for (const name of new Set([...a.values.keys(), ...b.values.keys()])) {
      const x = a.values.get(name);
      const y = b.values.get(name);
      if (!x) { diffs.push(`[penpot-tokens.json] 缺少 ${name} @ ${label}：匯出檔解析不到，penpot-tokens.json 有`); continue; }
      if (!y) { diffs.push(`[penpot-tokens.json] 多出 ${name} @ ${label}：匯出檔有，penpot-tokens.json 沒有`); continue; }
      if (aliasOf(name, x) || aliasOf(name, y)) continue;
      if (x.$type !== y.$type) diffs.push(`[penpot-tokens.json] 型別 ${name} @ ${label}：匯出檔為 ${x.$type}，penpot-tokens.json 為 ${y.$type}`);
      else if (!same(normOf(x), normOf(y))) diffs.push(`[penpot-tokens.json] 解析值 ${name} @ ${label}：匯出檔為 ${show(normOf(x))}，penpot-tokens.json 為 ${show(normOf(y))}`);
    }
  }
  for (const name of [...extras].sort()) diffs.push(`[variables.json] 多出 ${name}：匯出檔有此 token，variables.json 沒有`);
}

// ---- 公開入口 ----

// 回傳差異字串陣列（空 = 一致）。匯出檔本身壞掉（非 zip、綁定指向不存在的 token）時丟出 Error。
// expectedMasterCount 只給測試縮小夾具用，正式檢查固定為 23。
export function checkLibrary(buf, { bindings, variables, penpotTokens }, { expectedMasterCount = EXPECTED_MASTER_COUNT } = {}) {
  const dump = JSON.parse(buildDump(buf));
  const diffs = [];
  if (dump.files.length !== 1) diffs.push(`匯出檔應只有 1 個檔案，實際 ${dump.files.length} 個`);
  const file = dump.files[0];
  if (file.name !== LIBRARY_NAME) diffs.push(`檔案名稱是「${file.name}」，應為 ${LIBRARY_NAME}（匯出前要先在 Penpot 改名）`);
  checkMasters(file, bindings, diffs, expectedMasterCount);
  checkResolved(file.tokens, variables, penpotTokens, diffs);
  return diffs;
}

function main(argv) {
  const usage = '用法：node scripts/design/check-penpot.mjs [匯出檔.penpot] [--bindings f] [--variables f] [--tokens f] [--expect-masters N]';
  const opts = { bindings: `${DEFAULT_THEMES}/bindings.json`, variables: `${DEFAULT_THEMES}/variables.json`, tokens: `${DEFAULT_THEMES}/penpot-tokens.json` };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--bindings' || a === '--variables' || a === '--tokens' || a === '--expect-masters') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) { console.error(usage); return 2; }
      opts[a.slice(2)] = value;
      if (a === '--expect-masters' && !/^[1-9]\d*$/.test(value)) { console.error(usage); return 2; }
    } else if (a.startsWith('--')) { console.error(usage); return 2; }
    else positional.push(a);
  }
  if (positional.length > 1) { console.error(usage); return 2; }
  const file = positional[0] ?? DEFAULT_EXPORT;

  const expected = opts['expect-masters'] ? Number(opts['expect-masters']) : EXPECTED_MASTER_COUNT;
  let diffs;
  try {
    const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
    diffs = checkLibrary(readFileSync(file), { bindings: read(opts.bindings), variables: read(opts.variables), penpotTokens: read(opts.tokens) }, { expectedMasterCount: expected });
  } catch (e) {
    console.error(`錯誤：${e.message}`);
    return 1;
  }
  if (diffs.length) {
    console.error(`不一致：${file} 有 ${diffs.length} 項差異`);
    console.error(diffs.join('\n'));
    return 1;
  }
  console.log(`一致：${file}（${expected} 個母版的名稱與綁定、各 theme 組合的解析值）`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
