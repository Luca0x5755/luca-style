// build-theme-data.js 的行為測試：只經由公開邊界（命令列＋環境變數指定的目錄）觀察輸出檔與結束碼。
// 用法：node --test scripts/design/build-theme-data.test.js
// 預期值都是手算或手寫的字面值，不用被測程式的邏輯重算。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = resolve(dirname(fileURLToPath(import.meta.url)), 'build-theme-data.js');

// 迷你變數檔：bg 依明暗、radius-card 依套系、fs-hero 依裝置、font-zh 為常數。
const VARIABLES = [
  '{"mode":["Light","Dark"],"suite":["Vibrant","Professional"],"device":["Desktop","Tablet","Mobile"]}',
  'bg {"type":"color","value":[{"value":"#F7F7F2","theme":{"mode":"Light"}},{"value":"#151A18","theme":{"mode":"Dark"}}]}',
  'radius-card {"type":"number","value":[{"value":20,"theme":{"suite":"Vibrant"}},{"value":3,"theme":{"suite":"Professional"}}]}',
  'fs-hero {"type":"number","value":[{"value":56,"theme":{"device":"Desktop"}},{"value":44,"theme":{"device":"Tablet"}},{"value":32,"theme":{"device":"Mobile"}}]}',
  'font-zh {"type":"string","value":"Noto Sans TC"}',
].join('\n') + '\n';

// 迷你抽取檔：兩個頁面 frame（同一個本體）與一個母版。
// 本體雜湊 qf188f、4d1pjh 是用獨立的 djb2-xor 算法事先算好的字面值。
const EXTRACT = [
  '#independent-count expanded-frames 4 10 {"frame:fill":2,"frame:cornerRadius":2,"text:fill":2,"text:fontFamily":2,"text:fontSize":2}',
  '#independent-count expanded-masters 1 1 {"frame:cornerRadius":1}',
  '#pencil-resolve-check mismatches=0 frames=2 masters=1',
  'S0=f|fill=bg;cornerRadius=radius-card',
  'S1=t|fill=bg;fontFamily=font-zh;fontSize=fs-hero',
  '@@ Home/Vibrant/Dark/Desktop/Success|2|15ujf82|B0',
  'B0 qf188f 2 -:0 0:1',
  '@@ Home/Professional/Light/Mobile/Success|2|15ujf82|B0',
  'S2=f|cornerRadius=radius-card',
  '@@M C/X|1|3768kx|B1',
  'B1 4d1pjh 1 -:2',
].join('\n') + '\n';

const setup = (extract = EXTRACT, variables = VARIABLES) => {
  const dir = mkdtempSync(join(tmpdir(), 'theme-data-'));
  writeFileSync(join(dir, 'extract-raw.txt'), extract);
  writeFileSync(join(dir, 'variables-raw.txt'), variables);
  return dir;
};
const run = (dir, ...args) => runWith(dir, { THEME_REQUIRED_PROPS: 'fill,cornerRadius,fontFamily,fontSize' }, ...args);
const runWith = (dir, env, ...args) =>
  spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    env: { ...process.env, THEME_RAW_DIR: dir, THEME_OUT_DIR: dir, ...env },
  });
const readJson = (dir, name) => JSON.parse(readFileSync(join(dir, name), 'utf8'));

// variables.json 改由 npm run generate 自 DTCG 產生（ISSUE-003）；本腳本只在記憶體內用 variables-raw.txt 解析 resolved.json。
test('不寫出 variables.json，以免蓋掉由 DTCG 產生的設計檔變數資料', () => {
  const dir = setup();
  const r = run(dir);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(readdirSync(dir).sort(), ['bindings.json', 'extract-raw.txt', 'resolved.json', 'variables-raw.txt']);
});


test('bindings.json 展開每個 frame 的節點路徑、類型與屬性綁定，並記錄主題', () => {
  const dir = setup();
  assert.equal(run(dir).status, 0);
  const b = readJson(dir, 'bindings.json');
  assert.equal(b.frames.length, 2);
  const f = b.frames[0];
  assert.equal(f.frame, 'Home/Vibrant/Dark/Desktop/Success');
  assert.deepEqual(f.theme, { mode: 'Dark', suite: 'Vibrant', device: 'Desktop' });
  assert.equal(f.nodeCount, 2);
  assert.deepEqual(f.nodes, [
    { path: '-', type: 'frame', bind: { fill: 'bg', cornerRadius: 'radius-card' } },
    { path: '0', type: 'text', bind: { fill: 'bg', fontFamily: 'font-zh', fontSize: 'fs-hero' } },
  ]);
  assert.deepEqual(b.frames[1].theme, { mode: 'Light', suite: 'Professional', device: 'Mobile' });
  assert.equal(b.masters.length, 1);
  assert.equal(b.masters[0].frame, 'C/X');
  assert.deepEqual(b.masters[0].nodes, [{ path: '-', type: 'frame', bind: { cornerRadius: 'radius-card' } }]);
});

test('本體雜湊與傳輸內容不符時失敗並指出本體', () => {
  const dir = setup(EXTRACT.replace('B0 qf188f 2 -:0 0:1', 'B0 qf188f 2 -:0 0:0'));
  const r = run(dir);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /B0.*雜湊/);
});

test('綁定指向不存在的變數時失敗', () => {
  const dir = setup(EXTRACT.replace('fontFamily=font-zh', 'fontFamily=font-nope'));
  const r = run(dir);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /font-nope/);
});

test('resolved.json 依各 frame 自己的主題解析每個綁定的實際值', () => {
  const dir = setup();
  assert.equal(run(dir).status, 0);
  const r = readJson(dir, 'resolved.json');
  assert.deepEqual(r.frames[0].theme, { mode: 'Dark', suite: 'Vibrant', device: 'Desktop' });
  assert.deepEqual(r.frames[0].nodes, [
    { path: '-', values: { fill: '#151A18', cornerRadius: 20 } },
    { path: '0', values: { fill: '#151A18', fontFamily: 'Noto Sans TC', fontSize: 56 } },
  ]);
  assert.deepEqual(r.frames[1].nodes, [
    { path: '-', values: { fill: '#F7F7F2', cornerRadius: 3 } },
    { path: '0', values: { fill: '#F7F7F2', fontFamily: 'Noto Sans TC', fontSize: 32 } },
  ]);
  assert.deepEqual(r.masters[0].theme, { mode: 'Light', suite: 'Vibrant', device: 'Desktop' });
  assert.deepEqual(r.masters[0].nodes, [{ path: '-', values: { cornerRadius: 20 } }]);
});

const built = (extract, variables) => {
  const dir = setup(extract, variables);
  assert.equal(run(dir).status, 0);
  return dir;
};

test('--check 對一致的輸出通過，並印出各檔大小與筆數', () => {
  const dir = built();
  const r = run(dir, '--check');
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /bindings.json.*bytes/);
});

test('--check 在輸出的逐類型筆數與獨立計數不符時失敗並指出類型', () => {
  const dir = built(EXTRACT.replace('"text:fontSize":2', '"text:fontSize":3'));
  const r = run(dir, '--check');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /text:fontSize/);
});

test('--check 在 resolved.json 被改動時失敗', () => {
  const dir = built();
  const p = join(dir, 'resolved.json');
  writeFileSync(p, readFileSync(p, 'utf8').replace('#151A18', '#000000'));
  const r = run(dir, '--check');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /resolved.json/);
});

test('--check 在變數值型別與宣告型別不符時失敗', () => {
  const dir = built(EXTRACT, VARIABLES.replace('"value":"Noto Sans TC"', '"value":12'));
  const r = run(dir, '--check');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /font-zh.*型別/);
});

test('--check 在單檔超過大小上限時失敗並提示改為每套系一份', () => {
  const dir = built();
  const r = runWith(dir, { THEME_REQUIRED_PROPS: 'fill', THEME_MAX_BYTES: '100' }, '--check');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /每套系/);
});

test('--check 在綁定缺少必備屬性類別時失敗', () => {
  const dir = built();
  const r = runWith(dir, { THEME_REQUIRED_PROPS: 'fill,stroke' }, '--check');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /stroke/);
});

// 以下兩個測試用真實的兩個套系設計檔（離線唯讀），各約 8 秒。
test('--check-fig 對真實資料通過：節點數、名稱序列、綁定路徑與類型都對得上 .fig', () => {
  const r = spawnSync(process.execPath, [script, '--check-fig'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /frames=304/);
});

test('--check-fig 在 .pen 展開節點數與 .fig 不符時失敗並指出 frame', () => {
  const real = resolve(dirname(script), '../../docs/mockup/themes');
  const dir = mkdtempSync(join(tmpdir(), 'theme-data-'));
  writeFileSync(join(dir, 'variables-raw.txt'), readFileSync(join(real, 'variables-raw.txt')));
  writeFileSync(
    join(dir, 'extract-raw.txt'),
    readFileSync(join(real, 'extract-raw.txt'), 'utf8').replace('@@ Home/Vibrant/Dark/Desktop/Success|50|', '@@ Home/Vibrant/Dark/Desktop/Success|51|'),
  );
  const r = runWith(dir, {}, '--check-fig');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /節點數.*Home\/Vibrant\/Dark\/Desktop\/Success/);
});

// --check-doc：文件內的抽樣表與檔案大小／筆數要和實際輸出一致。
const docFor = (dir, { value = '#151A18', bytes } = {}) => {
  const size = (n) => readFileSync(join(dir, n)).length;
  const doc = [
    '## 主題資料擷取',
    '擷取腳本 scripts/design/extract-pen-themes.pen.js，建置腳本 scripts/design/build-theme-data.js，輸入 extract-raw.txt。',
    '| 檔案 | bytes | 筆數 |',
    '| --- | --- | --- |',
    `| bindings.json | ${bytes ?? size('bindings.json')} | 11 |`,
    `| resolved.json | ${size("resolved.json")} | 11 |`,
    '| frame | 路徑 | 屬性 | resolved.json 值 | Pencil 畫面所見 |',
    '| --- | --- | --- | --- | --- |',
    `| Home/Vibrant/Dark/Desktop/Success | - | fill | ${value} | 深色底 |`,
    '| Home/Professional/Light/Mobile/Success | - | fill | #F7F7F2 | 淺色底 |',
  ].join('\n') + '\n';
  const path = join(dir, 'doc.md');
  writeFileSync(path, doc);
  return path;
};
const checkDoc = (dir, doc) => runWith(dir, { THEME_DOC: doc, THEME_SAMPLE_MIN: '1', THEME_SCRIPT_SNIPPET: join(dir, 'snippet.js') }, '--check-doc');

test('--check-doc 對一致的文件通過', () => {
  const dir = built();
  writeFileSync(join(dir, 'snippet.js'), 'Get(id, visit, { resolveInstances: true })');
  const r = checkDoc(dir, docFor(dir));
  assert.equal(r.status, 0, r.stdout);
});

test('--check-doc 在抽樣表的值與 resolved.json 不符時失敗', () => {
  const dir = built();
  writeFileSync(join(dir, 'snippet.js'), 'x');
  const r = checkDoc(dir, docFor(dir, { value: '#000000' }));
  assert.equal(r.status, 1);
  assert.match(r.stdout, /Home\/Vibrant\/Dark\/Desktop\/Success.*#000000/);
});

test('--check-doc 在記載的檔案大小與實際不符時失敗', () => {
  const dir = built();
  writeFileSync(join(dir, 'snippet.js'), 'x');
  const r = checkDoc(dir, docFor(dir, { bytes: 1 }));
  assert.equal(r.status, 1);
  assert.match(r.stdout, /bindings\.json.*bytes/);
});

test('--check-doc 在抽樣的 Dark 或 Light frame 數不足時失敗', () => {
  const dir = built();
  writeFileSync(join(dir, 'snippet.js'), 'x');
  const r = runWith(dir, { THEME_DOC: docFor(dir), THEME_SAMPLE_MIN: '2', THEME_SCRIPT_SNIPPET: join(dir, 'snippet.js') }, '--check-doc');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /Dark/);
});
