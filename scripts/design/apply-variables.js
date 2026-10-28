// 在元件庫設計檔建立變數集合與模式，值取自 docs/mockup/themes/variables.json。
// variables.json 由 npm run generate 自 packages/tokens/src 的 DTCG 原始檔產生（ISSUE-003，ADR 0004），不要手改；
// 集合與模式也由產生器決定（`collections` 與每個變數的 `collection`）；本腳本只照著建立並驗證。
// 改設計變數的流程：改 DTCG 原始檔 → npm run generate → 本腳本套用 → --check。
//   docs/mockup/luca-style-library.fig  唯一的設計檔（ADR 0007）：23 個母版加設計變數，沒有頁面 frame
// 用法：
//   node scripts/design/apply-variables.js           套用（已是最新就不寫檔；可重跑，不產生重複）
//   node scripts/design/apply-variables.js --check   唯讀檢查檔案與 variables.json 逐筆一致，並檢查節點數
//   node scripts/design/apply-variables.js --list    唯讀列出每個變數在每個模式的值（逐行：集合 | 變數 | 型別 | 模式 | 值）
// 結束碼：0 一致；1 有差異或 variables.json 無法建模（逐行列出）；2 讀檔或 openpencil 執行失敗。
//
// 建模（Figma 的模式屬於集合，一個節點在每個集合只持有一個模式，所以一個集合的模式只對應一組軸）：
//   Base          單一模式 Default：不隨套系、明暗、裝置變化的常數。
//   Device        Desktop、Tablet、Mobile：只依裝置變化的變數（標題字級）。
//   Suite x Mode  Vibrant / Light 等四種組合：依套系或明暗變化的變數（圓角、背景、文字、主色、成功／警告／錯誤色等）。
//     只依其中一軸的變數在另一軸的兩個模式寫同樣的值，切換一個節點的套系與明暗只設這一個集合（ISSUE-015）。
//     不用別名拆成套系、明暗兩個集合：離線 openpencil 的匯出與 resolve*VariableForNode 都不解別名（ISSUE-004 探測）。
//   舊版的 Suite、Mode 集合在套用時移除，其變數改建在 Suite x Mode；母版綁定隨後以 apply-bindings.js 重綁。
// 型別對應：color → COLOR（0..1 浮點）、number → FLOAT、string → STRING、boolean → BOOLEAN。
// opacity 類變數維持 variables.json 的 0–100 原值；綁定端若需要 0–1 自行換算。
//
// 全程以離線 `openpencil eval` 讀寫檔案，不經過 OpenPencil App。
// Windows 的 openpencil 本機修補事項見 docs/delivery-verification.md〈Windows 上執行 openpencil 的本機修補〉。
//
// 測試用環境變數：APPLY_VARIABLES_JSON、APPLY_VARIABLES_LIBRARY、
//   APPLY_VARIABLES_NODE_LIMIT（節點數上限，預設 10000）。
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const jsonPath = resolve(process.env.APPLY_VARIABLES_JSON || join(root, 'docs/mockup/themes/variables.json'));
const NODE_LIMIT = Number(process.env.APPLY_VARIABLES_NODE_LIMIT || 10000);
const libraryPath = resolve(process.env.APPLY_VARIABLES_LIBRARY || join(root, 'docs/mockup/luca-style-library.fig'));

const TYPE_MAP = { color: 'COLOR', number: 'FLOAT', string: 'STRING', boolean: 'BOOLEAN' };

const fail = (message, code) => {
  console.log(message);
  process.exit(code);
};

// ---------- 建模（純函式） ----------

const keyOf = (mode, suite, device) => `${mode}/${suite}/${device}`;

// 集合的某個模式對應 variables.json 的哪一個組合鍵：模式名稱以「 / 」分隔，依集合的軸順序對應；沒有涵蓋的軸取第一個值。
const comboOf = (axes, collection, modeName) => {
  const parts = modeName.split(' / ');
  const pick = Object.fromEntries(Object.keys(axes).map((axis) => [axis, axes[axis][0]]));
  collection.axes.forEach((axis, i) => { pick[axis] = parts[i]; });
  return keyOf(pick.mode, pick.suite, pick.device);
};

// 變數在某一軸上是否變化：存在兩個只差這一軸的組合，值不同。
const variesOn = (variable, axes, axis) => {
  const [a, b] = Object.keys(axes).filter((x) => x !== axis);
  return axes[a].some((x) => axes[b].some((y) => new Set(axes[axis].map((z) => {
    const pick = { [a]: x, [b]: y, [axis]: z };
    return JSON.stringify(variable.values[keyOf(pick.mode, pick.suite, pick.device)]);
  })).size > 1));
};

const hexToColor = (hexText) => {
  const n = (i) => parseInt(hexText.slice(i, i + 2), 16) / 255;
  return { r: n(1), g: n(3), b: n(5), a: 1 };
};

const toFigmaValue = (variable, value) => (variable.type === 'color' ? hexToColor(value) : value);

// 回傳 { plan: { collections }, errors: [] }。
const buildPlan = (data) => {
  const errors = [];
  const { axes } = data;
  const collections = data.collections || [];
  if (collections.length === 0) return { plan: { collections: [] }, errors: ['variables.json 沒有 collections；請先 npm run generate'] };
  const placed = Object.fromEntries(collections.map((c) => [c.name, []]));
  for (const v of data.variables) {
    const bad = axes.mode.some((m) => axes.device.some((d) => axes.suite.some((x) => v.values[keyOf(m, x, d)] === undefined)));
    if (bad) {
      errors.push(`${v.name}：缺少部分 mode/suite/device 組合的值`);
      continue;
    }
    if (v.type === 'color' && Object.values(v.values).some((c) => !/^#[0-9A-Fa-f]{6}$/.test(c))) {
      errors.push(`${v.name}：顏色值必須是 #RRGGBB`);
      continue;
    }
    if (!TYPE_MAP[v.type]) {
      errors.push(`${v.name}：不支援的型別 ${v.type}`);
      continue;
    }
    const target = collections.find((c) => c.name === v.collection);
    if (!target) {
      errors.push(`${v.name}：集合 ${v.collection} 不存在於 variables.json 的 collections`);
      continue;
    }
    // 變數變化的軸必須都被集合的模式涵蓋，否則切換模式時值會被吃掉。
    const uncovered = Object.keys(axes).filter((axis) => variesOn(v, axes, axis) && !target.axes.includes(axis));
    if (uncovered.length > 0) {
      errors.push(`${v.name}：依 ${uncovered.join('、')} 變化，但集合 ${target.name} 的模式不涵蓋；一個節點在每個集合只持有一個模式，請改放涵蓋全部變化軸的集合`);
      continue;
    }
    placed[target.name].push(v);
  }
  return {
    plan: {
      collections: collections.map((c) => ({
        name: c.name,
        modes: c.modes,
        variables: placed[c.name].map((v) => ({
          name: v.name,
          type: TYPE_MAP[v.type],
          values: Object.fromEntries(c.modes.map((m) => [m, toFigmaValue(v, v.values[comboOf(axes, c, m)])])),
        })),
      })),
    },
    errors,
  };
};

// ---------- openpencil 呼叫 ----------

// shell: true 是為了在 Windows 上執行 openpencil.cmd；路徑加引號以防空白。
const evalOn = (file, code, extraArgs = []) => {
  try {
    return execFileSync('openpencil', ['eval', `"${file}"`, '--stdin', '--json', ...extraArgs], {
      input: code,
      encoding: 'utf8',
      shell: true,
      maxBuffer: 256 * 1024 * 1024,
    });
  } catch (error) {
    fail(`openpencil 執行失敗（${file}）：${String(error.stderr || error.stdout || error.message).trim().split('\n')[0]}`, 2);
  }
};

// 唯讀：回傳節點數與全部集合、變數。mode 值已轉成以模式名稱為鍵。
const READ_SCRIPT = `
let nodes = 0
const walk = (n) => { nodes++; (n.children || []).forEach(walk) }
figma.root.children.forEach(walk)
const cols = figma.getLocalVariableCollections()
const byId = new Map(cols.map((c) => [c.id, c]))
const variables = figma.getLocalVariables().map((v) => {
  const c = byId.get(v.collectionId)
  return {
    name: v.name,
    type: v.type,
    collection: c ? c.name : null,
    values: c ? Object.fromEntries(c.modes.map((m) => [m.name, v.valuesByMode[m.modeId]])) : {},
  }
})
return { nodes, collections: cols.map((c) => ({ name: c.name, modes: c.modes.map((m) => m.name) })), variables }
`;

const readState = (file) => JSON.parse(evalOn(file, READ_SCRIPT));

// 套用：先全部驗證（有問題就丟錯，不改檔），再建立或更新。
const applyScript = (plan) => `
const plan = ${JSON.stringify(plan)}
const managed = plan.collections.map((c) => c.name)
const cols = figma.getLocalVariableCollections()
const managedIds = new Set()
for (const pc of plan.collections) {
  const same = cols.filter((c) => c.name === pc.name)
  if (same.length > 1) throw new Error('重複的集合：' + pc.name)
  if (same[0]) managedIds.add(same[0].id)
}
const planNames = new Set(plan.collections.flatMap((c) => c.variables.map((v) => v.name)))
const allVars = figma.getLocalVariables()
const varsOf = (id) => allVars.filter((v) => v.collectionId === id)
// ISSUE-015 之前的版面留下的 Suite、Mode 集合：只認這兩個名稱，且變數全是計畫內的名稱，才視為我們先前建的而整個移除；
// 混有其他變數或名稱不同的集合可能是使用端自建的，不動它，照樣拒絕。
const RETIRED_NAMES = ['Suite', 'Mode']
const retired = cols.filter((c) => !managedIds.has(c.id) && RETIRED_NAMES.includes(c.name)).filter((c) => {
  const vs = varsOf(c.id)
  return vs.length > 0 && vs.every((v) => planNames.has(v.name))
})
const retiredIds = new Set(retired.map((c) => c.id))
const seen = new Map()
for (const v of allVars) {
  if (retiredIds.has(v.collectionId)) continue
  if (managedIds.has(v.collectionId)) {
    const key = v.collectionId + '/' + v.name
    if (seen.has(key)) throw new Error('集合內有重複的同名變數：' + v.name)
    seen.set(key, true)
  } else if (planNames.has(v.name)) {
    throw new Error('同名變數位於受管理集合之外：' + v.name)
  }
}
let created = 0, updated = 0, removed = 0
for (const c of retired) {
  for (const v of varsOf(c.id)) { figma.deleteVariable(v.id); removed++ }
  figma.deleteVariableCollection(c.id)
}
// 先清掉各集合內不在計畫裡的變數，再建立，避免變數換集合時同名衝突。
for (const pc of plan.collections) {
  const col = cols.find((c) => c.name === pc.name)
  if (!col) continue
  const planned = new Set(pc.variables.map((v) => v.name))
  for (const v of figma.getLocalVariables().filter((x) => x.collectionId === col.id)) {
    if (!planned.has(v.name)) { figma.deleteVariable(v.id); removed++ }
  }
}
for (const pc of plan.collections) {
  let col = cols.find((c) => c.name === pc.name)
  if (!col) {
    col = figma.createVariableCollection(pc.name)
    figma.graph.renameMode(col.id, col.modes[0].modeId, pc.modes[0])
  }
  const fresh = () => figma.getVariableCollectionById(col.id)
  for (const name of pc.modes) {
    if (!fresh().modes.some((m) => m.name === name)) figma.graph.addMode(col.id, col.id + '/mode/' + name, name)
  }
  for (const m of fresh().modes) {
    if (!pc.modes.includes(m.name)) figma.graph.removeMode(col.id, m.modeId)
  }
  const modeId = (name) => fresh().modes.find((m) => m.name === name).modeId
  for (const pv of pc.variables) {
    let v = figma.getLocalVariables().find((x) => x.collectionId === col.id && x.name === pv.name)
    if (v && v.type !== pv.type) { figma.deleteVariable(v.id); v = undefined; removed++ }
    if (v) updated++
    else { v = figma.createVariable(pv.name, pv.type, col.id, pv.values[pc.modes[0]]); created++ }
    for (const m of pc.modes) figma.setVariableValue(v.id, modeId(m), pv.values[m])
  }
}
return { created, updated, removed, retired: retired.map((c) => c.name) }
`;

// ---------- 比對 ----------

const hexOf = (c) => '#' + [c.r, c.g, c.b].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('').toUpperCase();

const show = (value) => {
  if (value && typeof value === 'object' && 'r' in value) return hexOf(value);
  return String(value);
};

// FLOAT 變數在 .fig 內以 32 位元浮點數儲存（1.2 讀回 1.2000000476837158），數值以同精度比對。
const sameValue = (type, actual, expected) => {
  if (type === 'color') return !!actual && typeof actual === 'object' && hexOf(actual) === expected.toUpperCase() && actual.a === 1;
  if (type === 'number') return typeof actual === 'number' && Math.fround(actual) === Math.fround(expected);
  return actual === expected;
};

// 獨立於建模：對 variables.json 每個變數、它所在集合的每個模式，
// 在檔案內找該變數，取同名模式的值，與 JSON 對應組合的值逐筆比。
const compare = (data, state, plan) => {
  const diffs = [];
  const { axes } = data;
  const byName = new Map();
  for (const v of state.variables) byName.set(v.name, [...(byName.get(v.name) || []), v]);
  const expectedNames = new Set(data.variables.map((v) => v.name));
  const expectedCollections = plan.collections.map((c) => c.name);
  const dupCollections = state.collections.map((c) => c.name).filter((n, i, a) => a.indexOf(n) !== i);
  for (const n of new Set(dupCollections)) diffs.push(`[重複集合] ${n}`);
  for (const pc of plan.collections) {
    const col = state.collections.find((c) => c.name === pc.name);
    if (!col) diffs.push(`[缺集合] ${pc.name}`);
    else if (JSON.stringify(col.modes) !== JSON.stringify(pc.modes)) diffs.push(`[模式] ${pc.name}：檔案為 ${col.modes.join('、')}，應為 ${pc.modes.join('、')}`);
  }
  for (const c of state.collections) {
    if (!expectedCollections.includes(c.name) && state.variables.some((v) => v.collection === c.name && expectedNames.has(v.name))) {
      diffs.push(`[多餘集合] ${c.name} 含有 variables.json 的變數`);
    }
  }
  // 只管 variables.json 宣告的集合：其他集合裡的變數不是我們建的，不算差異，否則套用永遠清不掉。
  for (const v of state.variables) {
    if (expectedCollections.includes(v.collection) && !expectedNames.has(v.name)) diffs.push(`[多餘變數] ${v.collection} / ${v.name}`);
  }
  const placement = new Map(plan.collections.flatMap((c) => c.variables.map((v) => [v.name, c.name])));
  for (const [name, list] of byName) if (list.length > 1 && expectedNames.has(name)) diffs.push(`[重複變數] ${name} 出現 ${list.length} 次`);
  for (const jv of data.variables) {
    const found = byName.get(jv.name) || [];
    if (found.length === 0) {
      diffs.push(`[缺變數] ${jv.name}`);
      continue;
    }
    if (found.length > 1) continue;
    const fv = found[0];
    if (fv.collection !== placement.get(jv.name)) {
      diffs.push(`[集合] ${jv.name}：位於 ${fv.collection}，應在 ${placement.get(jv.name)}`);
      continue;
    }
    if (fv.type !== TYPE_MAP[jv.type]) {
      diffs.push(`[型別] ${jv.name}：檔案為 ${fv.type}，應為 ${TYPE_MAP[jv.type]}`);
      continue;
    }
    const collection = data.collections.find((c) => c.name === jv.collection);
    for (const mode of collection.modes) {
      const key = comboOf(axes, collection, mode);
      if (!(mode in fv.values)) {
        diffs.push(`[模式] ${jv.name}：找不到模式 ${mode}（檔案模式 ${Object.keys(fv.values).join('、')}）`);
        continue;
      }
      if (!sameValue(jv.type, fv.values[mode], jv.values[key])) {
        diffs.push(`[值] ${jv.name} @ ${collection.name}／${mode}（${key}）：檔案為 ${show(fv.values[mode])}，應為 ${show(jv.values[key])}`);
      }
    }
  }
  return [...new Set(diffs)];
};

// ---------- 主流程 ----------

const args = process.argv.slice(2);
const command = args.includes('--list') ? 'list' : args.includes('--check') ? 'check' : 'apply';

let data;
try {
  data = JSON.parse(readFileSync(jsonPath, 'utf8'));
} catch (error) {
  fail(`讀不到 variables.json（${jsonPath}）：${error.message}`, 2);
}

const { plan, errors } = buildPlan(data);
if (errors.length > 0) fail(errors.map((e) => `[無法建模] ${e}`).join('\n'), 1);

const report = (diffs, nodes) => {
  const limit = nodes >= NODE_LIMIT ? [`[節點數] 節點數 ${nodes} 已達上限 ${NODE_LIMIT}`] : [];
  const all = [...diffs, ...limit];
  console.log(`元件庫（${libraryPath}）：節點數 ${nodes}，${all.length === 0 ? '變數與 variables.json 逐筆一致' : `${all.length} 項差異`}`);
  for (const d of all) console.log(`  ${d}`);
  return all.length === 0 ? 0 : 1;
};

if (command === 'list') {
  const state = readState(libraryPath);
  console.log(`# 元件庫（${libraryPath}）節點數 ${state.nodes}`);
  for (const pc of plan.collections) {
    for (const v of state.variables.filter((x) => x.collection === pc.name)) {
      for (const m of Object.keys(v.values)) console.log(`${pc.name} | ${v.name} | ${v.type} | ${m} | ${show(v.values[m])}`);
    }
  }
  process.exit(0);
}
let state = readState(libraryPath);
let diffs = compare(data, state, plan);
if (command === 'apply') {
  if (diffs.length === 0) {
    console.log('已是最新，不寫檔');
  } else {
    const result = JSON.parse(evalOn(libraryPath, applyScript(plan), ['-w']));
    console.log(`已套用（新增 ${result.created}、更新 ${result.updated}、移除 ${result.removed}${result.retired.length ? `；移除舊集合 ${result.retired.join('、')}` : ''}）`);
    state = readState(libraryPath);
    diffs = compare(data, state, plan);
  }
}
process.exit(report(diffs, state.nodes));
