// 在兩個套系設計檔建立變數集合與模式，值取自 docs/mockup/themes/variables.json。
//   docs/mockup/components-vibrant.fig      套用 Vibrant 的值
//   docs/mockup/components-professional.fig 套用 Professional 的值
// 用法：
//   node scripts/design/apply-variables.js           套用（已是最新就不寫檔；可重跑，不產生重複）
//   node scripts/design/apply-variables.js --check   唯讀檢查檔案與 variables.json 逐筆一致，並檢查節點數
//   node scripts/design/apply-variables.js --list    唯讀列出每個變數在每個模式的值（逐行：集合 | 變數 | 型別 | 模式 | 值）
// 結束碼：0 一致；1 有差異或 variables.json 無法建模（逐行列出）；2 讀檔或 openpencil 執行失敗。
//
// 建模（見 docs/delivery-verification.md〈套系設計檔的變數集合與模式（ISSUE-008）〉的「建模」；Figma 的模式屬於集合，一個節點在每個集合只持有一個模式）：
//   Mode   集合：Light、Dark。放依明暗變化的變數。
//   Device 集合：Desktop、Tablet、Mobile。只放依裝置變化的變數。
//   Base   集合：單一模式 Default。放不隨明暗與裝置變化的變數（常數，以及只依套系變化的變數）。
//   suite 軸不建模式：每個檔案只取自己套系的值。
//   分類看兩個套系合併後的變化軸，所以兩個檔案的集合結構完全相同。
//   同一變數同時依 mode 與 device 變化時拒絕，須先改 variables.json（拆成各依單軸的變數）。
// 型別對應：color → COLOR（0..1 浮點）、number → FLOAT、string → STRING、boolean → BOOLEAN。
// opacity 類變數維持 variables.json 的 0–100 原值，與 resolved.json 一致；綁定端若需要 0–1 自行換算。
//
// 全程以離線 `openpencil eval` 讀寫檔案，不經過 OpenPencil App。
// Windows 的 openpencil 本機修補事項見 docs/delivery-verification.md〈Windows 上執行 openpencil 的本機修補〉。
//
// 測試用環境變數：APPLY_VARIABLES_JSON、APPLY_VARIABLES_VIBRANT、APPLY_VARIABLES_PROFESSIONAL、
//   APPLY_VARIABLES_NODE_LIMIT（節點數上限，預設 10000）。
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const jsonPath = resolve(process.env.APPLY_VARIABLES_JSON || join(root, 'docs/mockup/themes/variables.json'));
const NODE_LIMIT = Number(process.env.APPLY_VARIABLES_NODE_LIMIT || 10000);

const files = [
  { suite: 'Vibrant', path: resolve(process.env.APPLY_VARIABLES_VIBRANT || join(root, 'docs/mockup/components-vibrant.fig')) },
  { suite: 'Professional', path: resolve(process.env.APPLY_VARIABLES_PROFESSIONAL || join(root, 'docs/mockup/components-professional.fig')) },
];

const TYPE_MAP = { color: 'COLOR', number: 'FLOAT', string: 'STRING', boolean: 'BOOLEAN' };

const fail = (message, code) => {
  console.log(message);
  process.exit(code);
};

// ---------- 建模（純函式） ----------

const keyOf = (mode, suite, device) => `${mode}/${suite}/${device}`;

// 變數在某一軸上是否變化：存在兩個只差這一軸的組合，值不同。
const variesOn = (variable, axes, axis) => {
  const others = Object.keys(axes).filter((a) => a !== axis);
  const lists = Object.fromEntries(Object.keys(axes).map((a) => [a, axes[a]]));
  const walk = (i, fixed) => {
    if (i === others.length) {
      const seen = lists[axis].map((v) => variable.values[keyOf(...['mode', 'suite', 'device'].map((a) => (a === axis ? v : fixed[a])))]);
      return new Set(seen.map((v) => JSON.stringify(v))).size > 1;
    }
    return lists[others[i]].some((v) => walk(i + 1, { ...fixed, [others[i]]: v }));
  };
  return walk(0, {});
};

const hexToColor = (hexText) => {
  const n = (i) => parseInt(hexText.slice(i, i + 2), 16) / 255;
  return { r: n(1), g: n(3), b: n(5), a: 1 };
};

const toFigmaValue = (variable, value) => (variable.type === 'color' ? hexToColor(value) : value);

// 回傳 { plans: { Vibrant: {collections}, ... }, errors: [] }。
const buildPlans = (data) => {
  const errors = [];
  const { axes } = data;
  const placed = { Mode: [], Device: [], Base: [] };
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
    const byMode = variesOn(v, axes, 'mode');
    const byDevice = variesOn(v, axes, 'device');
    if (byMode && byDevice) {
      errors.push(`${v.name}：同時依 mode 與 device 變化，一個節點在每個集合只持有一個模式，無法用單一集合表示；請先把它拆成各依單軸的變數`);
      continue;
    }
    placed[byMode ? 'Mode' : byDevice ? 'Device' : 'Base'].push(v);
  }
  const plans = {};
  for (const suite of axes.suite) {
    const dev0 = axes.device[0];
    const mode0 = axes.mode[0];
    const make = (name, modes, list, pick) => ({
      name,
      modes,
      variables: list.map((v) => ({
        name: v.name,
        type: TYPE_MAP[v.type],
        values: Object.fromEntries(modes.map((m) => [m, toFigmaValue(v, v.values[pick(m, suite)])])),
      })),
    });
    plans[suite] = {
      collections: [
        make('Mode', axes.mode, placed.Mode, (m, s) => keyOf(m, s, dev0)),
        make('Device', axes.device, placed.Device, (d, s) => keyOf(mode0, s, d)),
        make('Base', ['Default'], placed.Base, (_m, s) => keyOf(mode0, s, dev0)),
      ],
    };
  }
  return { plans, errors };
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
const seen = new Map()
for (const v of figma.getLocalVariables()) {
  if (managedIds.has(v.collectionId)) {
    const key = v.collectionId + '/' + v.name
    if (seen.has(key)) throw new Error('集合內有重複的同名變數：' + v.name)
    seen.set(key, true)
  } else if (planNames.has(v.name)) {
    throw new Error('同名變數位於受管理集合之外：' + v.name)
  }
}
let created = 0, updated = 0, removed = 0
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
  const planned = new Set(pc.variables.map((v) => v.name))
  for (const v of figma.getLocalVariables().filter((x) => x.collectionId === col.id)) {
    if (!planned.has(v.name)) { figma.deleteVariable(v.id); removed++ }
  }
  for (const pv of pc.variables) {
    let v = figma.getLocalVariables().find((x) => x.collectionId === col.id && x.name === pv.name)
    if (v && v.type !== pv.type) { figma.deleteVariable(v.id); v = undefined; removed++ }
    if (v) updated++
    else { v = figma.createVariable(pv.name, pv.type, col.id, pv.values[pc.modes[0]]); created++ }
    for (const m of pc.modes) figma.setVariableValue(v.id, modeId(m), pv.values[m])
  }
}
return { created, updated, removed }
`;

// ---------- 比對 ----------

const hexOf = (c) => '#' + [c.r, c.g, c.b].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('').toUpperCase();

const show = (value) => {
  if (value && typeof value === 'object' && 'r' in value) return hexOf(value);
  return String(value);
};

const sameValue = (type, actual, expected) => {
  if (type === 'color') return !!actual && typeof actual === 'object' && hexOf(actual) === expected.toUpperCase() && actual.a === 1;
  return actual === expected;
};

// 獨立於分類邏輯：對 variables.json 每個變數、本套系的每個 (mode, device) 組合，
// 在檔案內找該變數，用「集合有沒有叫這個名字的模式」挑出對應的模式值，與 JSON 逐筆比。
const compare = (data, suite, state, plan) => {
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
  // 只管本腳本的三個集合：其他集合裡的變數不是我們建的，不算差異，否則套用永遠清不掉。
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
    for (const mode of axes.mode) {
      for (const device of axes.device) {
        const expected = jv.values[keyOf(mode, suite, device)];
        const modeNames = Object.keys(fv.values);
        const pick = modeNames.includes(mode) && modeNames.length === axes.mode.length ? mode
          : modeNames.includes(device) ? device
            : modeNames.length === 1 ? modeNames[0] : null;
        if (pick === null) {
          diffs.push(`[模式] ${jv.name}：找不到對應 ${mode}/${device} 的模式（檔案模式 ${modeNames.join('、')}）`);
          continue;
        }
        if (!sameValue(jv.type, fv.values[pick], expected)) {
          diffs.push(`[值] ${jv.name} @ ${mode}/${suite}/${device}：檔案為 ${show(fv.values[pick])}，應為 ${show(expected)}`);
        }
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

const { plans, errors } = buildPlans(data);
if (errors.length > 0) fail(errors.map((e) => `[無法建模] ${e}`).join('\n'), 1);

let exit = 0;
const report = (file, diffs, nodes) => {
  const limit = nodes >= NODE_LIMIT ? [`[節點數] 節點數 ${nodes} 已達上限 ${NODE_LIMIT}`] : [];
  const all = [...diffs, ...limit];
  console.log(`${file.suite}（${file.path}）：節點數 ${nodes}，${all.length === 0 ? '變數與 variables.json 逐筆一致' : `${all.length} 項差異`}`);
  for (const d of all) console.log(`  ${d}`);
  if (all.length > 0) exit = 1;
};

for (const file of files) {
  const plan = plans[file.suite];
  if (command === 'list') {
    const state = readState(file.path);
    console.log(`# ${file.suite}（${file.path}）節點數 ${state.nodes}`);
    for (const pc of plan.collections) {
      for (const v of state.variables.filter((x) => x.collection === pc.name)) {
        for (const m of Object.keys(v.values)) console.log(`${pc.name} | ${v.name} | ${v.type} | ${m} | ${show(v.values[m])}`);
      }
    }
    continue;
  }
  let state = readState(file.path);
  let diffs = compare(data, file.suite, state, plan);
  if (command === 'apply') {
    if (diffs.length === 0) {
      console.log(`${file.suite}：已是最新，不寫檔`);
    } else {
      const result = JSON.parse(evalOn(file.path, applyScript(plan), ['-w']));
      console.log(`${file.suite}：已套用（新增 ${result.created}、更新 ${result.updated}、移除 ${result.removed}）`);
      state = readState(file.path);
      diffs = compare(data, file.suite, state, plan);
    }
  }
  report(file, diffs, state.nodes);
}
process.exit(exit);
