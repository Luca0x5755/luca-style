// 離線解析 Penpot 匯出檔（ISSUE-020 試點、ISSUE-023 正式化，PR-FILE-23）。
// 離線讀取 Penpot 匯出的 `.penpot`（zip），列出母版名稱與數量，另列 token set、theme 與每個形狀的 token 綁定。
// 匯出檔是不受信任的資料：只在記憶體內解開，不寫檔、不執行其中任何內容。
// 用法：node scripts/design/parse-export.mjs <匯出檔.penpot> [--json]
// 結束碼：0 成功、1 解析失敗（原因印在 stderr）、2 用法錯誤。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readZip } from './read-zip.mjs';

export const ROOT_ID = '00000000-0000-0000-0000-000000000000';

export function json(entries, name) {
  const data = entries.get(name);
  if (!data) throw new Error(`匯出檔缺少 ${name}`);
  try {
    return JSON.parse(data.toString('utf8'));
  } catch (e) {
    throw new Error(`${name} 不是合法 JSON：${e.message}`);
  }
}

// 母版 = 頁面根 frame 的直接子節點中的 board。巢狀 board（例如 Loading image）不算。
export function parseExport(buf) {
  return parseEntries(readZip(buf));
}

// 已解開的條目表版本，供 penpot-dump.mjs 共用同一組驗證。
export function parseEntries(entries) {
  const manifest = json(entries, 'manifest.json');
  if (manifest.type !== 'penpot/export-files') throw new Error(`manifest.type 不是 penpot/export-files：${manifest.type}`);
  if (manifest.version !== 1) throw new Error(`不支援的匯出版本 ${manifest.version}`);
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) throw new Error('manifest 沒有任何檔案');

  const files = manifest.files.map((entry) => parseFile(entries, entry));
  const masters = files.flatMap((f) => f.masters);
  if (masters.length === 0) throw new Error('匯出檔裡找不到任何母版（頁面根 frame 底下沒有 board）');
  return { generatedBy: manifest.generatedBy, files, masters };
}

function parseFile(entries, entry) {
  const base = `files/${entry.id}`;
  const meta = json(entries, `${base}.json`);
  const masters = [];
  const pages = [];

  // 不用正規表示式：id 來自不受信任的 manifest，不能當成樣式。
  const pagePrefix = `${base}/pages/`;
  const pageIds = [...entries.keys()]
    .filter((k) => k.startsWith(pagePrefix) && k.endsWith('.json') && !k.slice(pagePrefix.length).includes('/'))
    .map((k) => k.slice(pagePrefix.length, -'.json'.length));
  for (const pageId of pageIds) {
    const page = json(entries, `${base}/pages/${pageId}.json`);
    pages.push(page.name);
    const shapeOf = (id) => json(entries, `${base}/pages/${pageId}/${id}.json`);
    const root = shapeOf(ROOT_ID);
    for (const id of root.shapes ?? []) {
      const shape = shapeOf(id);
      if (shape.type !== 'frame') continue;
      const bindings = [];
      const seen = new Set();
      const walk = (s, path, id) => {
        if (seen.has(id)) throw new Error(`${path} 的子節點參照形成循環`);
        seen.add(id);
        if (s.appliedTokens && Object.keys(s.appliedTokens).length) bindings.push({ path, type: s.type, tokens: s.appliedTokens });
        for (const childId of s.shapes ?? []) {
          const child = shapeOf(childId);
          walk(child, `${path} > ${child.name}`, childId);
        }
      };
      walk(shape, shape.name, id);
      // 元件欄位名稱未經真實元件驗證：本匯出檔沒有元件，只能依 Penpot 的命名猜（見 delivery-verification）。
      const isComponent = Boolean(shape.componentId || shape.mainInstance);
      masters.push({ name: shape.name, page: page.name, isComponent, bindings });
    }
  }

  const tokens = entries.has(`${base}/tokens.json`) ? json(entries, `${base}/tokens.json`) : {};
  const sets = Object.keys(tokens).filter((k) => !k.startsWith('$'));
  const themes = (tokens.$themes ?? []).map((t) => ({ group: t.group, name: t.name, sets: t.selectedTokenSets }));
  const known = new Set(sets.flatMap((s) => Object.keys(tokens[s])));
  for (const m of masters) {
    for (const b of m.bindings) {
      for (const [prop, token] of Object.entries(b.tokens)) {
        if (!known.has(token)) throw new Error(`${b.path} 的 ${prop} 綁定到不存在的 token：${token}`);
      }
    }
  }
  const mediaCount = [...entries.keys()].filter((k) => k.startsWith(`${base}/media/`)).length;
  return { id: entry.id, name: meta.name ?? entry.name, pages, masters, sets, themes, activeThemes: tokens.$metadata?.activeThemes ?? [], mediaCount };
}

function main(argv) {
  const args = argv.filter((a) => !a.startsWith('--'));
  if (args.length !== 1) {
    console.error('用法：node scripts/design/parse-export.mjs <匯出檔.penpot> [--json]');
    return 2;
  }
  let result;
  try {
    result = parseExport(readFileSync(args[0]));
  } catch (e) {
    console.error(`錯誤：${e.message}`);
    return 1;
  }
  if (argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
    return 0;
  }
  for (const f of result.files) {
    console.log(`檔案：${f.name}（媒體 ${f.mediaCount}）`);
    console.log(`母版：${f.masters.length}`);
    for (const m of f.masters) console.log(`- ${m.name}${m.isComponent ? '（元件）' : ''}`);
    console.log(`token set：${f.sets.length}；theme：${f.themes.length}`);
  }
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
