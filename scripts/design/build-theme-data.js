// 主題資料建置與檢查：把從 .pen 抽出的原始文字轉成三份 JSON，並提供唯讀檢查。
//   docs/mockup/themes/variables-raw.txt  變數定義（Pencil GetVariables 的輸出）
//   docs/mockup/themes/extract-raw.txt    綁定抽取結果（見 docs/delivery-verification.md 的擷取片段）
// 用法：
//   node scripts/design/build-theme-data.js               建置 variables.json / bindings.json / resolved.json
//   node scripts/design/build-theme-data.js --check       檢查三份 JSON 的內部一致性與獨立計數
//   node scripts/design/build-theme-data.js --check-fig   與兩個套系設計檔比對節點數、名稱雜湊與節點類型
//   node scripts/design/build-theme-data.js --check-doc   檢查 docs/delivery-verification.md 的記載
// 結束碼：0 通過；1 有差異（逐行列出）；2 讀檔或格式錯誤。
//
// 測試用環境變數：THEME_RAW_DIR（原始檔目錄）、THEME_OUT_DIR（輸出目錄）。
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const themesDir = join(root, 'docs/mockup/themes');
const rawDir = resolve(process.env.THEME_RAW_DIR || themesDir);
const outDir = resolve(process.env.THEME_OUT_DIR || themesDir);

const fail = (message, code = 2) => {
  console.log(message);
  process.exit(code);
};

// 解析 variables-raw.txt：第一行是主題軸，之後每行「變數名 JSON」。
const parseVariables = (text) => {
  const lines = text.split('\n').filter((l) => l.length > 0);
  const axes = JSON.parse(lines[0]);
  const variables = lines.slice(1).map((line) => {
    const at = line.indexOf(' ');
    const def = JSON.parse(line.slice(at + 1));
    return { name: line.slice(0, at), type: def.type, raw: def.value };
  });
  return { axes, variables };
};

// 變數在某個主題組合下的值：有主題條目時取「條目主題的每個軸都符合」的第一筆；常數直接回傳。
const valueIn = (raw, theme) => {
  if (!Array.isArray(raw)) return raw;
  const hit = raw.find((entry) => Object.entries(entry.theme || {}).every(([axis, v]) => theme[axis] === v));
  return hit ? hit.value : undefined;
};

const comboKey = (t) => `${t.mode}/${t.suite}/${t.device}`;

const buildVariables = ({ axes, variables }) => {
  const combos = [];
  for (const mode of axes.mode) for (const suite of axes.suite) for (const device of axes.device) combos.push({ mode, suite, device });
  return {
    axes,
    count: variables.length,
    variables: variables.map((v) => ({
      name: v.name,
      type: v.type,
      definition: v.raw,
      values: Object.fromEntries(combos.map((c) => [comboKey(c), valueIn(v.raw, c)])),
    })),
  };
};

const read = (dir, name) => {
  try {
    return readFileSync(join(dir, name), 'utf8');
  } catch (error) {
    return fail(`[讀取] ${name}：${String(error.message).split('\n')[0]}`);
  }
};

// 與 .pen 擷取片段相同的 32 位元雜湊（djb2 變體，輸出 36 進位）；只用來抓傳輸錯誤，不防蓄意碰撞。
// 同一個演算法還出現在 extract-pen-themes.pen.js 與下方 figScript 字串內（都跑在別的沙箱，無法 import），改動時三處要一起改。
const hash = (text) => {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return h.toString(36);
};

const TYPE_NAMES = { f: 'frame', t: 'text', i: 'icon', r: 'rectangle' };
const DEFAULT_THEME = { mode: 'Light', suite: 'Vibrant', device: 'Desktop' };

// 頁面 frame 的主題：由名稱的各段推出；名稱沒寫的軸用預設，另有三個明列的例外頁（裝置寫在頁名裡）。
// 對應 .pen 的實際 theme 屬性：Library guide、頂層標題文字、母版沒有 theme（用預設）。
const themeOf = (name) => {
  const parts = name.split('/').map((p) => p.trim());
  const pick = (options, fallback) => options.find((o) => parts.includes(o)) || fallback;
  let device = pick(['Desktop', 'Tablet', 'Mobile'], DEFAULT_THEME.device);
  if (parts.some((p) => p.startsWith('Mobile '))) device = 'Mobile';
  if (parts.some((p) => p.startsWith('Tablet '))) device = 'Tablet';
  return { mode: pick(['Light', 'Dark'], DEFAULT_THEME.mode), suite: pick(['Vibrant', 'Professional'], DEFAULT_THEME.suite), device };
};

// 解析 extract-raw.txt；本體雜湊對不上、引用了不存在的集合或變數時記入 problems。
const parseExtract = (text, variableNames) => {
  const problems = [];
  const independent = {};
  const sets = new Map();
  const bodies = new Map();
  const entries = [];
  let pencilCheck = null;
  const lines = text.split('\n').filter((l) => l.length > 0);
  for (const line of lines) {
    if (line.startsWith('#independent-count ')) {
      const m = line.match(/^#independent-count (\S+) (\d+) (\d+) (.*)$/);
      if (!m) fail('[格式] extract-raw.txt 的 #independent-count 行無法解析：' + line.slice(0, 60));
      const [, scope, nodes, total, json] = m;
      independent[scope] = { nodes: Number(nodes), total: Number(total), kinds: JSON.parse(json) };
    } else if (line.startsWith('#pencil-resolve-check ')) {
      pencilCheck = line.slice('#pencil-resolve-check '.length);
    } else if (/^S[0-9a-z]+=/.test(line)) {
      const eq = line.indexOf('=');
      sets.set(line.slice(1, eq), line.slice(eq + 1));
    } else if (line.startsWith('@@')) {
      const isMaster = line.startsWith('@@M ');
      const [name, nodes, nameHash, body] = (() => {
        const f = line.slice(isMaster ? 4 : 3).split('|');
        return [f.slice(0, -3).join('|'), Number(f[f.length - 3]), f[f.length - 2], f[f.length - 1]];
      })();
      entries.push({ name, master: isMaster, nodeCount: nodes, nameHash, bodyId: body });
    } else if (/^B[0-9a-z]+ /.test(line)) {
      const m = line.match(/^(B[0-9a-z]+) (\S+) (\d+) ?(.*)$/);
      if (!m) fail('[格式] extract-raw.txt 的本體行無法解析：' + line.slice(0, 60));
      const [, id, bodyHash, count, rest] = m;
      const nodes = [];
      const textLines = [];
      for (const pair of rest.split(' ').filter((p) => p.length > 0)) {
        const at = pair.lastIndexOf(':');
        const path = pair.slice(0, at);
        const set = sets.get(pair.slice(at + 1));
        if (set === undefined) {
          problems.push('[集合] ' + id + '：找不到集合 S' + pair.slice(at + 1));
          continue;
        }
        textLines.push(path + '|' + set);
        const bar = set.indexOf('|');
        const bind = {};
        for (const item of set.slice(bar + 1).split(';')) {
          const e = item.indexOf('=');
          bind[item.slice(0, e)] = item.slice(e + 1);
        }
        nodes.push({ path, type: TYPE_NAMES[set.slice(0, bar)] || set.slice(0, bar), bind });
      }
      if (hash(textLines.join('\n')) !== bodyHash || nodes.length !== Number(count)) {
        problems.push('[雜湊] ' + id + '：離線展開後的雜湊或筆數與 Pencil 端記錄不符');
      }
      bodies.set(id, nodes);
    }
  }
  for (const entry of entries) {
    const nodes = bodies.get(entry.bodyId);
    if (!nodes) {
      problems.push('[本體] ' + entry.name + '：找不到本體 ' + entry.bodyId);
      continue;
    }
    entry.nodes = nodes;
    for (const node of nodes) {
      for (const variable of Object.values(node.bind)) {
        if (!variableNames.has(variable)) problems.push('[變數] ' + entry.name + ' ' + node.path + '：不存在的變數 ' + variable);
      }
    }
  }
  return { entries, independent, pencilCheck, problems };
};

const loadBuild = () => {
  const parsedVars = parseVariables(read(rawDir, 'variables-raw.txt'));
  const variables = buildVariables(parsedVars);
  const names = new Set(parsedVars.variables.map((v) => v.name));
  const extract = parseExtract(read(rawDir, 'extract-raw.txt'), names);
  return { variables, extract };
};

const bindingsOf = (entries) =>
  entries.map((e) => ({
    frame: e.name,
    theme: e.master ? { ...DEFAULT_THEME } : themeOf(e.name),
    nodeCount: e.nodeCount,
    nameHash: e.nameHash,
    nodes: e.nodes,
  }));

// 每個 frame 一個區塊、每個節點一行，讓 git diff 與人工檢視都讀得動。
const stringifyGroups = (key, groups) =>
  '"' + key + '": [\n' +
  groups
    .map((g) => ' {"frame":' + JSON.stringify(g.frame) + ',"theme":' + JSON.stringify(g.theme) + ',"nodeCount":' + g.nodeCount + ',"nameHash":' + JSON.stringify(g.nameHash) + ',"nodes":[\n' +
      g.nodes.map((n) => '  ' + JSON.stringify(n)).join(',\n') + '\n ]}')
    .join(',\n') +
  '\n]';

// 解析後的值：變數在該 frame 主題下的值（opacity 變數保留原值 0~100，不做 Pencil 的 0~1 正規化）。
const resolveGroups = (groups, variables) => {
  const byName = new Map(variables.variables.map((v) => [v.name, v]));
  return groups.map((g) => ({
    frame: g.frame,
    theme: g.theme,
    nodes: g.nodes.map((n) => ({
      path: n.path,
      values: Object.fromEntries(Object.entries(n.bind).map(([prop, name]) => [prop, byName.get(name)?.values[comboKey(g.theme)]])),
    })),
  }));
};

const stringifyResolved = (key, groups) =>
  '"' + key + '": [\n' +
  groups
    .map((g) => ' {"frame":' + JSON.stringify(g.frame) + ',"theme":' + JSON.stringify(g.theme) + ',"nodes":[\n' +
      g.nodes.map((n) => '  ' + JSON.stringify(n)).join(',\n') + '\n ]}')
    .join(',\n') +
  '\n]';

// 由原始檔產生三份 JSON 的文字內容（建置與檢查共用，檢查時用來比對磁碟上的檔案）。
const generate = () => {
  const { variables, extract } = loadBuild();
  const all = bindingsOf(extract.entries);
  const frames = all.filter((g, i) => !extract.entries[i].master);
  const masters = all.filter((g, i) => extract.entries[i].master);
  return {
    variables,
    extract,
    frames,
    masters,
    files: {
      'variables.json': JSON.stringify(variables, null, 1) + '\n',
      'bindings.json': '{\n' + stringifyGroups('frames', frames) + ',\n' + stringifyGroups('masters', masters) + '\n}\n',
      'resolved.json':
        '{\n' + stringifyResolved('frames', resolveGroups(frames, variables)) + ',\n' + stringifyResolved('masters', resolveGroups(masters, variables)) + '\n}\n',
    },
  };
};

// 變數值的型別是否符合宣告型別。
const valueFits = (type, value) => {
  if (type === 'color') return typeof value === 'string' && /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/.test(value);
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (type === 'boolean') return typeof value === 'boolean';
  if (type === 'string') return typeof value === 'string';
  return false;
};

// 逐「節點類型:屬性」計數，鍵格式與 .pen 端獨立計數相同。
const countKinds = (groups) => {
  const counts = {};
  let total = 0;
  let nodes = 0;
  for (const g of groups) {
    nodes += g.nodeCount;
    for (const n of g.nodes) {
      for (const prop of Object.keys(n.bind)) {
        const key = n.type + ':' + prop;
        counts[key] = (counts[key] || 0) + 1;
        total++;
      }
    }
  }
  return { counts, total, nodes };
};

const MAX_BYTES = Number(process.env.THEME_MAX_BYTES || 5 * 1024 * 1024);
const REQUIRED_PROPS = (process.env.THEME_REQUIRED_PROPS ?? 'fill,stroke,strokeWidth,fontFamily,fontSize,gap,padding,cornerRadius,effect')
  .split(',')
  .filter((p) => p.length > 0);

const checkOutputs = () => {
  const problems = [];
  const gen = generate();
  problems.push(...gen.extract.problems);
  const summary = [];
  for (const [name, expected] of Object.entries(gen.files)) {
    const actual = read(outDir, name);
    if (actual !== expected) problems.push('[內容] ' + name + '：與由原始檔重新產生的內容不同');
    const bytes = Buffer.byteLength(actual);
    if (bytes > MAX_BYTES) problems.push('[大小] ' + name + '：' + bytes + ' bytes 超過上限 ' + MAX_BYTES + '，請改為每套系一份');
    summary.push(name + ' bytes=' + bytes);
  }
  for (const v of gen.variables.variables) {
    for (const [combo, value] of Object.entries(v.values)) {
      if (!valueFits(v.type, value)) problems.push('[型別] ' + v.name + ' 在 ' + combo + '：值 ' + JSON.stringify(value) + ' 不符宣告型別 ' + v.type);
    }
  }
  for (const [scope, groups] of [['expanded-frames', gen.frames], ['expanded-masters', gen.masters]]) {
    const want = gen.extract.independent[scope];
    if (!want) {
      problems.push('[計數] extract-raw.txt 缺少 #independent-count ' + scope);
      continue;
    }
    const got = countKinds(groups);
    if (got.nodes !== want.nodes) problems.push('[計數] ' + scope + '：節點數 ' + got.nodes + '，獨立計數為 ' + want.nodes);
    if (got.total !== want.total) problems.push('[計數] ' + scope + '：綁定總數 ' + got.total + '，獨立計數為 ' + want.total);
    for (const key of new Set([...Object.keys(got.counts), ...Object.keys(want.kinds)])) {
      if ((got.counts[key] || 0) !== (want.kinds[key] || 0)) {
        problems.push('[計數] ' + scope + ' ' + key + '：輸出 ' + (got.counts[key] || 0) + '，獨立計數 ' + (want.kinds[key] || 0));
      }
    }
  }
  const used = new Set([...gen.frames, ...gen.masters].flatMap((g) => g.nodes.flatMap((n) => Object.keys(n.bind).map((p) => p.split(/[.[]/)[0]))));
  for (const prop of REQUIRED_PROPS) if (!used.has(prop)) problems.push('[屬性] 綁定中沒有任何 ' + prop);
  if (!gen.extract.pencilCheck || !/mismatches=0\b/.test(gen.extract.pencilCheck)) problems.push('[Pencil 比對] extract-raw.txt 沒有 mismatches=0 的紀錄');
  const total = countKinds(gen.frames).total + countKinds(gen.masters).total;
  summary.push('frames=' + gen.frames.length, 'masters=' + gen.masters.length, 'bindings=' + total, 'variables=' + gen.variables.count);
  return { problems, summary };
};

const finish = ({ problems, summary }) => {
  for (const line of summary) console.log(line);
  if (problems.length) fail(problems.join('\n'), 1);
  console.log('全部一致');
  process.exit(0);
};

// 在 openpencil 內執行：回傳頁面最上層每個節點的節點數、名稱序列雜湊與「路徑:類型」清單。
// 路徑規則與 .pen 端相同：根為 -，其下以各層子節點的 0 起算索引相連。
const FIG_PAGE = 'Library guide';
const figScript = String.raw`
const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; return h.toString(36) }
const page = figma.root.children.find((p) => p.name === ${JSON.stringify(FIG_PAGE)})
if (!page) return { error: '找不到頁面' }
return { nodes: page.children.map((f) => {
  const names = [], paths = []
  const walk = (n, path) => { names.push(n.name); paths.push(path + ':' + n.type); if (n.children) n.children.forEach((c, i) => walk(c, path === '-' ? String(i) : path + '.' + i)) }
  walk(f, '-')
  return { name: f.name, top: f.type, n: names.length, hash: hash(names.join('\u0001')), paths }
}) }
`;

const readFig = (label, file) => {
  try {
    const out = execFileSync('openpencil', ['eval', '"' + file + '"', '--stdin'], {
      cwd: dirname(file), input: figScript, encoding: 'utf8', shell: true, stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024,
    });
    const result = JSON.parse(out.replace(/\x1b\[[0-9;]*m/g, '').trim());
    if (result.error) throw new Error(result.error);
    return result.nodes;
  } catch (error) {
    return fail('[讀取] ' + label + '：' + String(error.message).split('\n')[0]);
  }
};

// .pen 展開後的節點類型對應到 .fig 的類型：實例在 .fig 裡是 INSTANCE／FRAME，圖示可能是 FRAME 或向量。
const typeFits = (penType, figType) => {
  if (penType === 'text') return figType === 'TEXT';
  if (penType === 'rectangle') return figType === 'RECTANGLE';
  if (penType === 'frame') return ['FRAME', 'INSTANCE', 'COMPONENT', 'GROUP'].includes(figType);
  return figType !== 'TEXT';
};

const checkFig = () => {
  const gen = generate();
  const problems = [...gen.extract.problems];
  const figs = {
    Vibrant: readFig('vibrant', resolve(process.env.THEME_FIG_VIBRANT || join(root, 'docs/mockup/components-vibrant.fig'))),
    Professional: readFig('professional', resolve(process.env.THEME_FIG_PROFESSIONAL || join(root, 'docs/mockup/components-professional.fig'))),
  };
  const byName = Object.fromEntries(Object.entries(figs).map(([k, list]) => [k, new Map(list.map((n) => [n.name, n]))]));
  const entries = gen.extract.entries;
  const groupByName = new Map([...gen.frames, ...gen.masters].map((g) => [g.frame, g]));
  let nodeChecks = 0;
  for (const e of entries) {
    const parts = e.name.split('/').map((p) => p.trim());
    const suiteOnly = e.master || /^(Vibrant|Professional) \//.test(e.name) ? null : ['Vibrant', 'Professional'].find((x) => parts.includes(x)) || null;
    const where = suiteOnly ? [suiteOnly] : ['Vibrant', 'Professional'];
    const group = groupByName.get(e.name);
    for (const suite of where) {
      const fig = byName[suite].get(e.name);
      if (!fig) {
        problems.push('[缺少] ' + e.name + '：' + suite + ' 設計檔內沒有');
        continue;
      }
      if (fig.n !== e.nodeCount) problems.push('[節點數] ' + e.name + '（' + suite + '）：.fig 為 ' + fig.n + '，.pen 展開後為 ' + e.nodeCount);
      if (fig.hash !== e.nameHash) problems.push('[名稱序列] ' + e.name + '（' + suite + '）：節點名稱的深度優先序列與 .pen 展開後不同');
      const types = new Map(fig.paths.map((p) => [p.slice(0, p.lastIndexOf(':')), p.slice(p.lastIndexOf(':') + 1)]));
      for (const node of group.nodes) {
        nodeChecks++;
        const figType = types.get(node.path);
        if (figType === undefined) problems.push('[路徑] ' + e.name + '（' + suite + '）：.fig 內沒有路徑 ' + node.path);
        else if (!typeFits(node.type, figType)) problems.push('[類型] ' + e.name + '（' + suite + '）路徑 ' + node.path + '：.pen 為 ' + node.type + '，.fig 為 ' + figType);
      }
    }
  }
  // 反向：.fig 內每個非母版的頂層節點都必須出現在抽取結果裡。
  const known = new Set(entries.map((e) => e.name));
  for (const [suite, map] of Object.entries(byName)) {
    for (const [name, fig] of map) {
      if (fig.top !== 'COMPONENT' && !known.has(name)) problems.push('[多出] ' + name + '：' + suite + ' 設計檔有，但抽取結果沒有');
    }
  }
  return { problems, summary: ['frames=' + gen.frames.length, 'masters=' + gen.masters.length, 'pathChecks=' + nodeChecks] };
};

// 文件檢查：抽樣表的值要等於 resolved.json，記載的檔案大小與筆數要等於實際檔案。
// 「Pencil 畫面所見」欄是人工目視 Pencil 截圖的結果，腳本只確認它有填，無法驗證其內容。
const checkDoc = () => {
  const problems = [];
  const docPath = resolve(process.env.THEME_DOC || join(root, 'docs/delivery-verification.md'));
  const snippetPath = resolve(process.env.THEME_SCRIPT_SNIPPET || join(root, 'scripts/design/extract-pen-themes.pen.js'));
  const min = Number(process.env.THEME_SAMPLE_MIN || 5);
  const doc = read(dirname(docPath), docPath.slice(dirname(docPath).length + 1));
  const gen = generate();
  for (const needle of ['build-theme-data.js', 'extract-raw.txt', 'extract-pen-themes.pen.js']) {
    if (!doc.includes(needle)) problems.push('[文件] 沒有提到 ' + needle);
  }
  let snippet = '';
  try {
    snippet = readFileSync(snippetPath, 'utf8');
  } catch {
    problems.push('[文件] 找不到擷取片段 ' + snippetPath);
  }
  if (snippet && !snippet.includes('resolveInstances')) problems.push('[文件] 擷取片段沒有使用 resolveInstances');
  const total = countKinds(gen.frames).total + countKinds(gen.masters).total;
  const expectCount = { 'variables.json': gen.variables.count, 'bindings.json': total, 'resolved.json': total };
  for (const [file, count] of Object.entries(expectCount)) {
    const m = doc.match(new RegExp('^\\| ' + file.replace('.', '\\.') + ' \\| (\\d+) \\| (\\d+) \\|', 'm'));
    if (!m) {
      problems.push('[大小] 文件沒有 ' + file + ' 的大小與筆數列');
      continue;
    }
    const actual = Buffer.byteLength(read(outDir, file));
    if (Number(m[1]) !== actual) problems.push('[大小] ' + file + '：文件記載 ' + m[1] + ' bytes，實際 ' + actual + ' bytes');
    if (Number(m[2]) !== count) problems.push('[筆數] ' + file + '：文件記載 ' + m[2] + '，實際 ' + count);
  }
  const resolved = resolveGroups(gen.frames, gen.variables);
  const byName = new Map(resolved.map((g) => [g.frame, g]));
  const seen = { Dark: new Set(), Light: new Set() };
  for (const line of doc.split('\n')) {
    const cells = line.match(/^\| (.+) \|$/)?.[1].split(' | ');
    if (!cells || cells.length !== 5 || !byName.has(cells[0])) continue;
    const [frame, path, prop, value, seenOnScreen] = cells;
    const group = byName.get(frame);
    const node = group.nodes.find((n) => n.path === path);
    const actual = node?.values[prop];
    if (actual === undefined) problems.push('[抽樣] ' + frame + ' 路徑 ' + path + ' 沒有屬性 ' + prop);
    else if (String(actual) !== value.trim()) problems.push('[抽樣] ' + frame + ' 路徑 ' + path + ' ' + prop + '：文件 ' + value + '，resolved.json 為 ' + actual);
    if (!seenOnScreen.trim()) problems.push('[抽樣] ' + frame + '：「Pencil 畫面所見」欄是空的');
    seen[group.theme.mode].add(frame);
  }
  for (const m of ['Dark', 'Light']) if (seen[m].size < min) problems.push('[抽樣] ' + m + ' frame 只有 ' + seen[m].size + ' 個，至少需要 ' + min + ' 個');
  return { problems, summary: ['Dark=' + seen.Dark.size, 'Light=' + seen.Light.size] };
};

const mode = process.argv[2] || '--build';
if (mode === '--build') {
  const gen = generate();
  if (gen.extract.problems.length) fail(gen.extract.problems.join('\n'), 1);
  for (const [name, text] of Object.entries(gen.files)) writeFileSync(join(outDir, name), text);
} else if (mode === '--check') {
  finish(checkOutputs());
} else if (mode === '--check-doc') {
  finish(checkDoc());
} else if (mode === '--check-fig') {
  finish(checkFig());
} else {
  fail('未知的模式 ' + mode);
}
