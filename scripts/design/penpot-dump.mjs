// 由 Penpot 匯出檔產生正規化文字 dump，並檢查已提交的 dump 是否仍與匯出檔一致（ISSUE-023，PR-FILE-32）。
// 匯出檔是位元組不穩定的二進位 zip（時間戳、隨機縮圖 id、雜湊序鍵序、重產的 theme id），審查時看不到差異；
// dump 是只含設計內容的 JSON：不輸出任何 id、時間、縮圖，鍵遞迴排序，順序有意義的清單保留原序。
// 匯出檔是不受信任的資料：只在記憶體內解開（沿用 read-zip.mjs 的上限），不寫檔、不執行其中任何內容。
//
// 用法：
//   node scripts/design/penpot-dump.mjs <匯出檔.penpot> [--out <dump>]          產生 dump（預設寫在匯出檔旁，副檔名換成 .dump.json）
//   node scripts/design/penpot-dump.mjs <匯出檔.penpot> --check [--out <dump>]  比對已提交的 dump，不寫檔
// 結束碼：0 成功或一致、1 解析失敗或不一致（stderr 列出差異行，`- ` 為已提交、`+ ` 為現算）、2 用法錯誤。
import { readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readZip } from './read-zip.mjs';
import { parseEntries, json, ROOT_ID } from './parse-export.mjs';

const DUMP_VERSION = 1;
// 形狀上的 id 類欄位與可由 x／y／寬高推得的幾何，不進 dump。shapes 改以巢狀 children 呈現。
const SHAPE_DROP = new Set(['id', 'parentId', 'frameId', 'pageId', 'shapes', 'selrect', 'points', 'transform', 'transformInverse']);
// 任何層級都不輸出的易變欄位（時間、修訂號、雜湊、隨機媒體 id、遷移清單）。
const VOLATILE = new Set(['revn', 'vern', 'modifiedAt', 'createdAt', 'hash', 'teamId', 'migrations', 'mediaId']);

function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]));
  }
  return v;
}

// 遞迴移除易變欄位；媒體 id 換成媒體名稱（fillImage 等以 id 參照媒體）。
function clean(v, mediaNames, parentKey) {
  if (Array.isArray(v)) return v.map((x) => clean(x, mediaNames, parentKey));
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, x] of Object.entries(v)) {
      if (VOLATILE.has(k)) continue;
      // 陰影項目的 id 是每次建立時產生的隨機 uuid（ISSUE-027 的真實匯出才出現），與設計內容無關。
      if (k === 'id' && parentKey === 'shadow') continue;
      if (k === 'id' && typeof x === 'string' && mediaNames.has(x)) {
        out.mediaName = mediaNames.get(x);
        continue;
      }
      out[k] = clean(x, mediaNames, k);
    }
    return out;
  }
  return v;
}

// 依名稱排序；同名時以整個序列化內容當次要鍵，讓 zip 條目順序不影響結果。
function byName(a, b) {
  if (a.name !== b.name) return a.name < b.name ? -1 : 1;
  return byText(a, b);
}

function byText(a, b) {
  const x = JSON.stringify(a);
  const y = JSON.stringify(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

// 依 $metadata.tokenSetOrder 排 token set，沒列在順序裡的接在後面並排序；check-penpot.mjs 對 penpot-tokens.json 也用同一規則。
export function orderedSets(tokens) {
  const setNames = Object.keys(tokens).filter((k) => !k.startsWith('$'));
  const tokenMeta = tokens.$metadata ?? {};
  const order = Array.isArray(tokenMeta.tokenSetOrder) ? tokenMeta.tokenSetOrder.filter((n) => setNames.includes(n)) : [];
  const rest = setNames.filter((n) => !order.includes(n)).sort();
  return { order, sets: [...order, ...rest].map((name) => ({ name, tokens: tokens[name] })) };
}

function dumpFile(entries, entry) {
  const base = `files/${entry.id}`;
  const meta = json(entries, `${base}.json`);

  const mediaPrefix = `${base}/media/`;
  const mediaNames = new Map();
  const media = [];
  for (const key of entries.keys()) {
    if (!key.startsWith(mediaPrefix) || !key.endsWith('.json') || key.slice(mediaPrefix.length).includes('/')) continue;
    const m = json(entries, key);
    mediaNames.set(m.id, m.name);
    media.push({ name: m.name, mtype: m.mtype, width: m.width, height: m.height });
  }
  media.sort(byText);

  const pagePrefix = `${base}/pages/`;
  const pageIds = [...entries.keys()]
    .filter((k) => k.startsWith(pagePrefix) && k.endsWith('.json') && !k.slice(pagePrefix.length).includes('/'))
    .map((k) => k.slice(pagePrefix.length, -'.json'.length));
  const pages = pageIds.map((pageId) => {
    const page = json(entries, `${base}/pages/${pageId}.json`);
    const shapeOf = (id) => json(entries, `${base}/pages/${pageId}/${id}.json`);
    const seen = new Set();
    const build = (id, path) => {
      if (seen.has(id)) throw new Error(`${path} 的子節點參照形成循環`);
      seen.add(id);
      const s = shapeOf(id);
      const node = {};
      for (const [k, x] of Object.entries(s)) if (!SHAPE_DROP.has(k)) node[k] = x;
      const out = clean(node, mediaNames);
      const children = (s.shapes ?? []).map((childId) => build(childId, `${path} > ${shapeOf(childId).name}`));
      if (children.length) out.children = children;
      return out;
    };
    const root = shapeOf(ROOT_ID);
    return { name: page.name, shapes: (root.shapes ?? []).map((id) => build(id, shapeOf(id).name)) };
  }).sort(byName);

  const tokens = entries.has(`${base}/tokens.json`) ? json(entries, `${base}/tokens.json`) : {};
  const tokenMeta = tokens.$metadata ?? {};
  const { order, sets } = orderedSets(tokens);
  const themes = (tokens.$themes ?? [])
    .map((t) => ({ group: t.group, name: t.name, description: t.description, isSource: t.isSource, selectedTokenSets: t.selectedTokenSets }))
    .sort((a, b) => `${a.group}\u0000${a.name}`.localeCompare(`${b.group}\u0000${b.name}`, 'en'));
  const sorted = (a) => (Array.isArray(a) ? [...a].sort() : []);

  return {
    name: meta.name ?? entry.name,
    options: meta.options ?? {},
    pages,
    media,
    tokens: {
      sets,
      themes,
      tokenSetOrder: order,
      activeThemes: sorted(tokenMeta.activeThemes),
      activeSets: sorted(tokenMeta.activeSets),
    },
  };
}

// 回傳 dump 文字：2 格縮排、每個欄位一行、LF、結尾單一換行。
export function buildDump(buf) {
  const entries = readZip(buf);
  parseEntries(entries); // 先過同一組結構驗證（manifest、母版、token 綁定）。
  const manifest = json(entries, 'manifest.json');
  const files = manifest.files.map((entry) => dumpFile(entries, entry));
  files.sort(byName);
  return `${JSON.stringify(sortKeys({ dumpVersion: DUMP_VERSION, files }), null, 2)}\n`;
}

// 差異行：先去掉相同的頭尾，剩下的以行為單位做多重集合比對；只有順序不同時，整段中間列為 -／+。
export function diffLines(committed, current) {
  const a = committed.split('\n');
  const b = current.split('\n');
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
  const midA = a.slice(head, a.length - tail);
  const midB = b.slice(head, b.length - tail);
  const count = new Map();
  for (const l of midB) count.set(l, (count.get(l) ?? 0) + 1);
  const removed = [];
  for (const l of midA) {
    const n = count.get(l) ?? 0;
    if (n > 0) count.set(l, n - 1);
    else removed.push(l);
  }
  const countA = new Map();
  for (const l of midA) countA.set(l, (countA.get(l) ?? 0) + 1);
  const added = [];
  for (const l of midB) {
    const n = countA.get(l) ?? 0;
    if (n > 0) countA.set(l, n - 1);
    else added.push(l);
  }
  if (removed.length === 0 && added.length === 0) return [...midA.map((l) => `- ${l}`), ...midB.map((l) => `+ ${l}`)];
  return [...removed.map((l) => `- ${l}`), ...added.map((l) => `+ ${l}`)];
}

const MAX_DIFF_LINES = 200;

function sameFile(a, b) {
  try {
    return realpathSync(a) === realpathSync(b);
  } catch {
    return false; // 目標尚不存在，不可能是同一個檔
  }
}

function main(argv) {
  const usage = '用法：node scripts/design/penpot-dump.mjs <匯出檔.penpot> [--check] [--out <dump>]';
  const positional = [];
  let check = false;
  let out;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--check') check = true;
    else if (a === '--out') {
      out = argv[++i];
      if (!out || out.startsWith('--')) { console.error(usage); return 2; }
    } else if (a.startsWith('--')) { console.error(usage); return 2; }
    else positional.push(a);
  }
  if (positional.length !== 1) { console.error(usage); return 2; }
  const file = positional[0];
  const target = out ?? (file.endsWith('.penpot') ? file.slice(0, -'.penpot'.length) : file) + '.dump.json';

  let current;
  try {
    current = buildDump(readFileSync(file));
  } catch (e) {
    console.error(`錯誤：${e.message}`);
    return 1;
  }
  if (!check) {
    // 輸出路徑不可指到輸入的匯出檔本身（那是使用者唯一的副本）。
    if (sameFile(file, target)) {
      console.error(`錯誤：--out 不可指向輸入的匯出檔 ${file}`);
      return 2;
    }
    try {
      writeFileSync(target, current);
    } catch (e) {
      console.error(`錯誤：無法寫入 ${target}：${e.message}`);
      return 1;
    }
    console.log(`已寫入 ${target}`);
    return 0;
  }
  let committed;
  try {
    committed = readFileSync(target, 'utf8');
  } catch (e) {
    console.error(e.code === 'ENOENT' ? `不一致：找不到已提交的 dump ${target}，請先產生並提交` : `錯誤：無法讀取 ${target}：${e.message}`);
    return 1;
  }
  if (committed === current) {
    console.log(`一致：${target}`);
    return 0;
  }
  const diff = diffLines(committed, current);
  console.error(`不一致：${target} 與 ${file} 現算的 dump 不同（- 已提交、+ 現算）`);
  console.error(diff.slice(0, MAX_DIFF_LINES).join('\n'));
  if (diff.length > MAX_DIFF_LINES) console.error(`…另有 ${diff.length - MAX_DIFF_LINES} 行差異`);
  return 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
