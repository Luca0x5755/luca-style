// check-penpot.mjs 的測試（ISSUE-027，PR-FILE-16、26、27）：只經 checkLibrary 與命令列觀察差異清單與結束碼。
// 夾具由 buildFixture() 即時組成縮小版的匯出檔與三份期望資料（bindings、variables、penpot-tokens），不提交假匯出檔。
// 最後一組測試對已提交的真實匯出檔跑一次。
// 執行：node --test scripts/design/check-penpot.test.mjs
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zip } from './penpot-test-helpers.mjs';
import { checkLibrary } from './check-penpot.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const cli = resolve(here, 'check-penpot.mjs');
const ZERO = '00000000-0000-0000-0000-000000000000';

const dirs = [];
after(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), 'check-penpot-'));
  dirs.push(d);
  return d;
};

// ---- 夾具 ----

const SUITES = ['Vibrant', 'Professional'];
const MODES = ['Light', 'Dark'];
const COMBOS = SUITES.flatMap((suite) => MODES.map((mode) => ({ suite, mode, set: `Suite x Mode/${suite}-${mode}`, theme: `${suite} / ${mode}` })));
const key = (c) => `${c.mode}/${c.suite}/Desktop`;

// 每個組合各自的字面值（用索引造出互不相同的顏色，讓「取錯組合」一定被抓到）。
const hex = (n) => `#${String(n).repeat(6)}`;
const literal = (i) => ({
  accent: hex(i + 1), text: hex(i + 5), border: hex(i + 2),
  radius: 4 + i, bwLeft: 1 + i, aOpacity: i === 0 ? 100 : 0, bOpacity: i === 1 ? 100 : 0,
  shadow: i < 2 ? { color: '#00000008', offsetX: '0', offsetY: '4', blur: '16', spread: '0', inset: false } : { color: '#00000000', offsetX: '0', offsetY: '0', blur: '0', spread: '0', inset: false },
});

function exportTokens() {
  const t = { Base: {}, 'Device/Desktop': {} };
  t.Base['font-zh'] = { $type: 'fontFamilies', $value: ['Noto Sans TC'], $description: '' };
  t.Base.pad = { $type: 'spacing', $value: '8', $description: '' };
  t['Device/Desktop']['fs-x'] = { $type: 'fontSizes', $value: '16', $description: '' };
  COMBOS.forEach((c, i) => {
    const v = literal(i);
    t[c.set] = {
      accent: { $type: 'color', $value: v.accent, $description: '' },
      text: { $type: 'color', $value: v.text, $description: '' },
      border: { $type: 'color', $value: v.border, $description: '' },
      radius: { $type: 'borderRadius', $value: String(v.radius), $description: '' },
      'metric-border-left': { $type: 'borderWidth', $value: String(v.bwLeft), $description: '' },
      // 匯出檔觀察：值為 0 的不透明度在匯出檔寫成 "0"，非 0 寫成 "100%"。
      'loading-a-opacity': { $type: 'opacity', $value: v.aOpacity ? '100%' : '0', $description: '' },
      'loading-b-opacity': { $type: 'opacity', $value: v.bOpacity ? '100%' : '0', $description: '' },
      'metric-shadow': { $type: 'shadow', $value: [v.shadow], $description: '' },
    };
  });
  return t;
}

const themes = () => [
  ...COMBOS.map((c) => ({ id: `t-${c.set}`, name: c.theme, group: 'Suite x Mode', selectedTokenSets: { Base: 'enabled', [c.set]: 'enabled' } })),
  { id: 't-desktop', name: 'Desktop', group: 'Device', selectedTokenSets: { Base: 'enabled', 'Device/Desktop': 'enabled' } },
];
const order = () => ['Base', ...COMBOS.map((c) => c.set), 'Device/Desktop'];

function penpotTokensFile() {
  const out = {};
  for (const [set, tokens] of Object.entries(exportTokens())) {
    out[set] = Object.fromEntries(Object.entries(tokens).map(([n, t]) => {
      let value = t.$value;
      if (t.$type === 'fontFamilies') value = value[0];
      if (t.$type === 'shadow') value = value[0];
      if (t.$type === 'opacity') value = value === '0' ? '0%' : value;
      return [n, { $value: value, $type: t.$type }];
    }));
  }
  out.$themes = themes().map(({ id, name, group, selectedTokenSets }) => ({ id, name, group, selectedTokenSets }));
  out.$metadata = { tokenSetOrder: order() };
  return out;
}

function variablesFile() {
  const vars = [];
  const add = (name, type, collection, valueOf) => vars.push({ name, type, collection, values: Object.fromEntries(COMBOS.map((c, i) => [key(c), valueOf(literal(i), i)])) });
  add('font-zh', 'string', 'Base', () => 'Noto Sans TC');
  add('suite-label', 'string', 'Suite x Mode', (_, i) => `label${i}`);
  add('pad', 'number', 'Base', () => 8);
  add('fs-x', 'number', 'Device', () => 16);
  add('accent', 'color', 'Suite x Mode', (v) => v.accent);
  add('text', 'color', 'Suite x Mode', (v) => v.text);
  add('border', 'color', 'Suite x Mode', (v) => v.border);
  add('radius', 'number', 'Suite x Mode', (v) => v.radius);
  add('metric-border-left', 'number', 'Suite x Mode', (v) => v.bwLeft);
  add('loading-a-opacity', 'number', 'Suite x Mode', (v) => v.aOpacity);
  add('loading-b-opacity', 'number', 'Suite x Mode', (v) => v.bOpacity);
  add('elevation-enabled', 'boolean', 'Suite x Mode', (_, i) => i < 2);
  return { axes: { mode: MODES, suite: SUITES, device: ['Desktop'] }, count: vars.length, variables: vars };
}

const r4 = (t) => ({ r1: t, r2: t, r3: t, r4: t });
const p4 = (t) => ({ p1: t, p2: t, p3: t, p4: t });

// 以 Penpot 的順序（shapes 由下而上，與 bindings 的 path 反向）列出的母版。
function masterSpecs() {
  return [
    {
      name: 'C / A', tokens: { fill: 'accent', ...r4('radius'), strokeColor: 'border' },
      children: [
        { name: 'Second', type: 'text', tokens: { fill: 'accent', fontFamily: 'font-zh' } },
        { name: 'First', type: 'text', tokens: { fill: 'text', fontFamily: 'font-zh' } },
      ],
    },
    { name: 'C / Card / Metric', tokens: { fill: 'accent', ...p4('pad'), shadow: 'metric-shadow', strokeColor: 'border' } },
    {
      name: 'C / State / Loading', tokens: {},
      children: [{
        name: 'Loading image', tokens: {},
        children: [
          { name: 'loading-a', type: 'rect', tokens: { opacity: 'loading-a-opacity' } },
          { name: 'loading-b', type: 'rect', tokens: { opacity: 'loading-b-opacity' } },
        ],
      }],
    },
  ];
}

function bindingsFile() {
  return {
    masters: [
      {
        frame: 'C/A', nodeCount: 3, nodes: [
          { path: '-', type: 'frame', bind: { fill: 'accent', cornerRadius: 'radius', stroke: 'border' } },
          { path: '0', type: 'text', bind: { fill: 'text', fontFamily: 'font-zh' } },
          { path: '1', type: 'text', bind: { fill: 'accent', fontFamily: 'font-zh' } },
        ],
      },
      {
        frame: 'C/Card/Metric', nodeCount: 1, nodes: [
          { path: '-', type: 'frame', bind: { fill: 'accent', stroke: 'border', 'strokeWidth.left': 'metric-border-left', 'effect.enabled': 'elevation-enabled', padding: 'pad' } },
        ],
      },
      {
        frame: 'C/State/Loading', nodeCount: 2, nodes: [
          { path: '-', type: 'frame', bind: {} },
          { path: '0', type: 'frame', bind: { 'fill[0].opacity': 'loading-a-opacity', 'fill[1].opacity': 'loading-b-opacity' } },
        ],
      },
    ],
  };
}

function exportEntries({ specs = masterSpecs(), tokens = exportTokens(), fileName = 'luca-style-library' } = {}) {
  const e = {
    'manifest.json': { type: 'penpot/export-files', version: 1, generatedBy: 'penpot/test', files: [{ id: 'f1', name: fileName }], relations: [] },
    'files/f1.json': { id: 'f1', name: fileName },
    'files/f1/pages/p1.json': { id: 'p1', name: 'Page 1', index: 0 },
  };
  let n = 0;
  const top = [];
  const add = (parent, spec) => {
    const id = `s${++n}`;
    const kids = (spec.children ?? []).map((c) => add(id, c));
    e[`files/f1/pages/p1/${id}.json`] = { id, name: spec.name, type: spec.type ?? 'frame', parentId: parent, frameId: parent, appliedTokens: spec.tokens ?? {}, shapes: kids };
    return id;
  };
  for (const s of specs) top.push(add(ZERO, s));
  e[`files/f1/pages/p1/${ZERO}.json`] = { id: ZERO, name: 'Root Frame', type: 'frame', parentId: ZERO, frameId: ZERO, shapes: top };
  e['files/f1/tokens.json'] = { ...tokens, $themes: themes(), $metadata: { tokenSetOrder: order(), activeThemes: [], activeSets: [] } };
  return e;
}

function fixture(edit = {}) {
  const inputs = { bindings: bindingsFile(), variables: variablesFile(), penpotTokens: penpotTokensFile() };
  const exp = { specs: masterSpecs(), tokens: exportTokens() };
  edit.apply?.({ inputs, exp });
  return { buf: zip(exportEntries(exp)), inputs };
}

const run = (edit) => {
  const { buf, inputs } = fixture({ apply: edit });
  return checkLibrary(buf, inputs, { expectedMasterCount: 3 });
};
const has = (diffs, re) => assert.ok(diffs.some((d) => re.test(d)), `沒有符合 ${re} 的差異：\n${diffs.join('\n')}`);
const master = (exp, name) => exp.specs.find((s) => s.name === name);

// ---- 一致 ----

test('a library that matches bindings, variables and penpot-tokens has no differences', () => {
  assert.deepEqual(run(), []);
});

// ---- 母版名稱與數量（PR-FILE-26） ----

test('a master missing from the export is reported by its normalized name', () => {
  const diffs = run(({ exp }) => exp.specs.splice(1, 1));
  has(diffs, /缺少母版.*C\/Card\/Metric/);
  has(diffs, /母版數量/);
});

test('a master that bindings.json does not list is reported as extra', () => {
  const diffs = run(({ exp }) => exp.specs.push({ name: 'C / Extra', tokens: {} }));
  has(diffs, /多出母版.*C\/Extra/);
});

test('bindings.json must list exactly 23 masters by default', () => {
  const { buf, inputs } = fixture();
  has(checkLibrary(buf, inputs), /列了 3 個母版，應為 23/);
});

test('a duplicated master name is reported', () => {
  const diffs = run(({ exp }) => exp.specs.push({ name: 'C / A', tokens: {} }));
  has(diffs, /重複.*C\/A/);
});

test('a top-level shape that is not a board is reported', () => {
  const diffs = run(({ exp }) => exp.specs.push({ name: 'stray', type: 'rect', tokens: {} }));
  has(diffs, /頂層.*stray/);
});

test('the file must be named luca-style-library', () => {
  const { buf, inputs } = fixture();
  const renamed = zip(exportEntries({ fileName: '嗨嗨' }));
  assert.deepEqual(checkLibrary(buf, inputs, { expectedMasterCount: 3 }), []);
  has(checkLibrary(renamed, inputs, { expectedMasterCount: 3 }), /檔案名稱.*嗨嗨/);
});

// ---- 節點與綁定（PR-FILE-27） ----

test('a binding to the wrong token is reported with master, path and key', () => {
  const diffs = run(({ exp }) => { master(exp, 'C / A').children[1].tokens.fill = 'border'; });
  has(diffs, /C\/A.*路徑 0.*fill.*text.*border/);
});

test('a missing binding is reported', () => {
  const diffs = run(({ exp }) => { delete master(exp, 'C / A').tokens.strokeColor; });
  has(diffs, /C\/A.*路徑 -.*strokeColor.*border/);
});

test('an extra binding on a listed node is reported', () => {
  const diffs = run(({ exp }) => { master(exp, 'C / A').children[0].tokens.fontSize = 'fs-x'; });
  has(diffs, /C\/A.*路徑 1.*fontSize/);
});

test('a binding on a node that bindings.json does not list is reported', () => {
  const diffs = run(({ exp }) => {
    const a = master(exp, 'C / A');
    a.children.unshift({ name: 'Third', type: 'text', tokens: { fill: 'accent' } });
  });
  has(diffs, /C\/A.*節點數/);
  has(diffs, /C\/A.*路徑 2.*fill/);
});

test('one corner radius bound to another token is reported per key', () => {
  const diffs = run(({ exp }) => { master(exp, 'C / A').tokens.r3 = 'pad'; });
  has(diffs, /C\/A.*路徑 -.*r3.*radius.*pad/);
});

test('a node type that differs from bindings.json is reported', () => {
  const diffs = run(({ exp }) => { master(exp, 'C / A').children[1].type = 'frame'; });
  has(diffs, /C\/A.*路徑 0.*型別.*text.*frame/);
});

test('a node count that differs from bindings.json is reported', () => {
  const diffs = run(({ inputs }) => { inputs.bindings.masters[0].nodeCount = 4; });
  has(diffs, /C\/A.*節點數.*4.*3/);
});

test('a binding that names a token missing from every set is a failure of the export itself', () => {
  assert.throws(() => run(({ exp }) => { master(exp, 'C / A').tokens.fill = 'nope'; }), /nope/);
});

// ---- 已接受的表示差異：有範圍，不會悄悄放寬 ----

test('the stacked loading rectangles are accepted only under C/State/Loading path 0 with the right order and tokens', () => {
  assert.deepEqual(run(), []);
  has(run(({ exp }) => { master(exp, 'C / State / Loading').children[0].children.reverse(); }), /C\/State\/Loading.*疊放矩形/);
  has(run(({ exp }) => { master(exp, 'C / State / Loading').children[0].children[0].tokens.opacity = 'loading-b-opacity'; }), /C\/State\/Loading.*疊放矩形/);
  has(run(({ exp }) => { master(exp, 'C / State / Loading').children[0].children.pop(); }), /C\/State\/Loading.*疊放矩形/);
  has(run(({ exp }) => { master(exp, 'C / State / Loading').children[0].children[1].type = 'frame'; }), /C\/State\/Loading.*疊放矩形/);
  // 同樣的 fill[i].opacity 寫在別的母版或別的路徑，不在接受範圍。
  has(run(({ inputs }) => { inputs.bindings.masters[0].nodes[1].bind['fill[0].opacity'] = 'loading-a-opacity'; }), /C\/A.*路徑 0.*fill\[0\]\.opacity.*未被接受/);
  has(run(({ inputs }) => { inputs.bindings.masters[2].nodes[0].bind['fill[0].opacity'] = 'loading-a-opacity'; }), /C\/State\/Loading.*路徑 -.*未被接受/);
});

test('the single-side stroke width and the shadow switch are accepted only on C/Card/Metric with their documented tokens', () => {
  // 單邊描邊寬在 Penpot 不綁：若 Metric 被綁上 strokeWidth 就是差異。
  has(run(({ exp }) => { master(exp, 'C / Card / Metric').tokens.strokeWidth = 'metric-border-left'; }), /C\/Card\/Metric.*strokeWidth/);
  // 陰影開關要綁 metric-shadow。
  has(run(({ exp }) => { delete master(exp, 'C / Card / Metric').tokens.shadow; }), /C\/Card\/Metric.*shadow/);
  // 別的母版聲稱有單邊描邊寬或陰影開關，不在接受範圍。
  has(run(({ inputs }) => { inputs.bindings.masters[0].nodes[0].bind['strokeWidth.left'] = 'metric-border-left'; }), /C\/A.*strokeWidth\.left.*未被接受/);
  has(run(({ inputs }) => { inputs.bindings.masters[0].nodes[0].bind['effect.enabled'] = 'elevation-enabled'; }), /C\/A.*effect\.enabled.*未被接受/);
  // 接受的 token 名不對也不行。
  has(run(({ inputs }) => { inputs.bindings.masters[1].nodes[0].bind['effect.enabled'] = 'other-flag'; }), /C\/Card\/Metric.*effect\.enabled.*未被接受/);
  // 完全不認得的鍵。
  has(run(({ inputs }) => { inputs.bindings.masters[0].nodes[0].bind.glow = 'accent'; }), /C\/A.*glow.*未被接受/);
});

// ---- 其他 theme 的解析值（PR-FILE-16） ----

test('every one of the 4 Suite x Mode combinations resolves to the values in variables.json', () => {
  // 每個組合都有不同的字面值（見 literal）；改任何一組的 token 都要被指名到該組合。
  for (const [i, c] of COMBOS.entries()) {
    const diffs = run(({ exp }) => { exp.tokens[c.set].accent.$value = '#abcdef'; });
    has(diffs, new RegExp(`accent.*${c.mode}/${c.suite}/Desktop.*#abcdef.*${literal(i).accent}`));
    assert.equal(diffs.filter((d) => /accent/.test(d) && !d.includes(`${c.mode}/${c.suite}/Desktop`) && /variables\.json/.test(d)).length, 0);
  }
});

test('a Base value is resolved for every combination and a later set overrides an earlier one', () => {
  has(run(({ exp }) => { exp.tokens.Base.pad.$value = '9'; }), /pad.*variables\.json/);
  // Device 在 tokenSetOrder 最後，覆蓋前面的同名 token。
  has(run(({ exp }) => { exp.tokens['Device/Desktop'].pad = { $type: 'spacing', $value: '12' }; }), /pad.*12.*8/);
});

test('a token that exists only in some sets is reported as missing for the combinations that lack it', () => {
  const diffs = run(({ exp }) => { delete exp.tokens[COMBOS[3].set].text; });
  has(diffs, /缺少.*text.*Dark\/Professional\/Desktop/);
});

test('values are compared by type: font arrays, percent opacity, colour case and numbers', () => {
  assert.deepEqual(run(({ exp, inputs }) => {
    exp.tokens[COMBOS[0].set].accent.$value = '#ABCDEF';
    inputs.penpotTokens[COMBOS[0].set].accent.$value = '#abcdef';
    inputs.variables.variables.find((v) => v.name === 'accent').values[key(COMBOS[0])] = '#abcdef';
  }), []);
  has(run(({ exp }) => { exp.tokens.Base['font-zh'].$value = ['Inter']; }), /font-zh.*Inter.*Noto Sans TC/);
  has(run(({ exp }) => { exp.tokens[COMBOS[0].set]['loading-a-opacity'].$value = '50%'; }), /loading-a-opacity.*50.*100/);
  has(run(({ exp }) => { exp.tokens[COMBOS[1].set].radius.$value = '99'; }), /radius.*99/);
});

test('the elevation boolean is checked through the alpha of metric-shadow', () => {
  has(run(({ exp }) => { exp.tokens[COMBOS[0].set]['metric-shadow'].$value[0].color = '#00000000'; }), /elevation-enabled.*Light\/Vibrant\/Desktop/);
  has(run(({ exp }) => { exp.tokens[COMBOS[3].set]['metric-shadow'].$value[0].color = '#00000020'; }), /elevation-enabled.*Dark\/Professional\/Desktop/);
});

test('variables without a Penpot token are limited to suite-label and elevation-enabled; unknown extra tokens are reported', () => {
  assert.deepEqual(run(), []);
  has(run(({ inputs }) => inputs.variables.variables.push({ name: 'new-token', type: 'number', collection: 'Base', values: Object.fromEntries(COMBOS.map((c) => [key(c), 1])) })), /缺少.*new-token/);
  has(run(({ exp }) => { exp.tokens.Base.surprise = { $type: 'color', $value: '#ffffff' }; }), /多出.*surprise/);
});

test('the export is also compared with penpot-tokens.json, so file drift and generator drift are told apart', () => {
  const diffs = run(({ inputs }) => { inputs.penpotTokens[COMBOS[2].set].accent.$value = '#123456'; });
  has(diffs, /penpot-tokens\.json.*accent.*Light\/Professional\/Desktop/);
  assert.equal(diffs.filter((d) => /variables\.json/.test(d)).length, 0);
});

test('an alias inside a composite value is reported too', () => {
  has(run(({ exp }) => { exp.tokens[COMBOS[0].set]['metric-shadow'].$value[0].color = '{accent}'; }), /metric-shadow.*無法離線解析/);
});

test('an alias value is reported as unresolvable rather than silently compared', () => {
  has(run(({ exp }) => { exp.tokens.Base.pad.$value = '{space-2}'; }), /pad.*無法離線解析/);
});

// ---- 命令列 ----

function cliRun(edit, extra = []) {
  const dir = tmp();
  const { buf, inputs } = fixture({ apply: edit });
  const file = join(dir, 'lib.penpot');
  writeFileSync(file, buf);
  writeFileSync(join(dir, 'b.json'), JSON.stringify(inputs.bindings));
  writeFileSync(join(dir, 'v.json'), JSON.stringify(inputs.variables));
  writeFileSync(join(dir, 't.json'), JSON.stringify(inputs.penpotTokens));
  const args = [file, '--bindings', join(dir, 'b.json'), '--variables', join(dir, 'v.json'), '--tokens', join(dir, 't.json'), '--expect-masters', '3', ...extra];
  return { ...spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' }), dir, file };
}

test('the CLI accepts a multi-digit --expect-masters', () => {
  const r = cliRun(undefined, ['--expect-masters', '23']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /列了 3 個母版，應為 23/);
});

test('the CLI exits 0 when everything matches', () => {
  const r = cliRun();
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /一致/);
});

test('the CLI exits 1 and lists every difference on stderr', () => {
  const r = cliRun(({ exp }) => {
    master(exp, 'C / A').children[1].tokens.fill = 'border';
    exp.specs.splice(1, 1);
  });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /缺少母版.*C\/Card\/Metric/);
  assert.match(r.stderr, /C\/A.*路徑 0.*fill/);
});

test('the CLI exits 1 for a file that is not an export, and 2 for bad usage', () => {
  const dir = tmp();
  const bad = join(dir, 'bad.penpot');
  writeFileSync(bad, 'not a zip');
  const r = spawnSync(process.execPath, [cli, bad], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /錯誤/);
  assert.equal(spawnSync(process.execPath, [cli, 'a.penpot', 'b.penpot'], { encoding: 'utf8' }).status, 2);
  assert.equal(spawnSync(process.execPath, [cli, '--bogus'], { encoding: 'utf8' }).status, 2);
  assert.equal(spawnSync(process.execPath, [cli, 'a.penpot', '--expect-masters', 'x'], { encoding: 'utf8' }).status, 2);
  assert.equal(spawnSync(process.execPath, [cli, 'a.penpot', '--bindings'], { encoding: 'utf8' }).status, 2);
});

// ---- 已提交的真實匯出檔 ----

test('the committed library export passes every check', () => {
  const r = spawnSync(process.execPath, [cli], { encoding: 'utf8', cwd: resolve(here, '../..') });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /23 個母版/);
});
