// penpot-dump.mjs 的測試（ISSUE-023，PR-FILE-32）：只經命令列觀察結束碼、stderr 與寫出的 dump 位元組。
// 夾具 fixtures/dump-export.json 手工縮小，含 uuid 形狀 id 與全部已知易變欄位；不提交真實匯出檔。
// 執行：node --test scripts/design/penpot-dump.test.mjs
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zip } from './penpot-test-helpers.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const cli = resolve(here, 'penpot-dump.mjs');
const fixture = () => structuredClone(JSON.parse(readFileSync(join(here, 'fixtures/dump-export.json'), 'utf8')));

const dirs = [];
after(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), 'penpot-dump-'));
  dirs.push(d);
  return d;
};

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
const ZERO = '00000000-0000-0000-0000-000000000000';
// 易變欄位名（見 docs/delivery-verification.md「能否提交進 repo」）。
const VOLATILE_KEYS = ['revn', 'vern', 'modifiedAt', 'createdAt', 'hash', 'teamId', 'migrations', 'generatedBy', 'features', 'mediaId'];

// 把匯出內容（物件表）變成「同一份設計、不同次匯出」：換掉所有 uuid（含 theme id）、改易變欄位值、
// 反轉條目與 tokens 鍵序、反轉媒體條目順序。回傳新的條目物件與 DOS 時間。
function reexport(entries) {
  let n = 0;
  const map = new Map();
  const swap = (text) => text.replace(UUID, (u) => {
    if (u === ZERO) return u;
    if (!map.has(u)) map.set(u, `bbbbbbbb-1111-4111-8111-${String(++n).padStart(12, '0')}`);
    return map.get(u);
  });
  const reverseKeys = (v) => {
    if (Array.isArray(v)) return v.map(reverseKeys);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).reverse().map(([k, x]) => [k, reverseKeys(x)]));
    return v;
  };
  const touch = (v) => {
    if (Array.isArray(v)) return v.map(touch);
    if (v && typeof v === 'object') {
      return Object.fromEntries(Object.entries(v).map(([k, x]) => {
        if (k === 'revn' || k === 'vern') return [k, x + 100];
        if (k === 'modifiedAt' || k === 'createdAt') return [k, '2030-01-01T00:00:00.000000Z'];
        if (k === 'hash') return [k, 'blake2b:ffff'];
        if (k === 'generatedBy') return [k, 'penpot/9.9.9'];
        if (k === 'migrations') return [k, [...x, 'legacy-999']];
        if (k === 'features') return [k, [...x, 'new-feature/v9']];
        return [k, touch(x)];
      }));
    }
    return v;
  };
  const out = {};
  for (const [name, value] of Object.entries(entries).reverse()) {
    const body = JSON.parse(swap(JSON.stringify(value)));
    out[swap(name)] = name.endsWith('tokens.json') ? reverseKeys(touch(body)) : touch(body);
  }
  return out;
}

function dump(buf, args = []) {
  const dir = tmp();
  const file = join(dir, 'lib.penpot');
  writeFileSync(file, buf);
  const r = spawnSync(process.execPath, [cli, file, ...args], { encoding: 'utf8' });
  const out = join(dir, 'lib.dump.json');
  return { ...r, dir, file, out, text: existsSync(out) ? readFileSync(out, 'utf8') : null };
}

test('writes the dump next to the export, and a second process produces identical bytes', () => {
  const buf = zip(fixture());
  const a = dump(buf);
  const b = dump(buf);
  assert.equal(a.status, 0, a.stderr);
  assert.ok(a.text && a.text.length > 0);
  assert.equal(Buffer.compare(Buffer.from(a.text), Buffer.from(b.text)), 0);
});

test('a re-export of the same design (new ids, times, entry and key order) gives the same bytes', () => {
  const entries = fixture();
  const a = dump(zip(entries, { dosTime: 0x6000, dosDate: 0x5a21 }));
  const b = dump(zip(reexport(entries), { dosTime: 0x1234, dosDate: 0x5c9f, deflate: true }));
  assert.equal(b.status, 0, b.stderr);
  assert.equal(b.text, a.text);
});

test('the dump holds no id and no volatile field', () => {
  const entries = fixture();
  const { text } = dump(zip(entries));
  assert.ok(text);
  assert.equal(text.match(UUID), null);
  const ids = [...JSON.stringify(entries).matchAll(/"id":"([^"]+)"/g)].map((m) => m[1]).filter((i) => i !== ZERO);
  assert.ok(ids.length >= 8);
  for (const id of ids) assert.ok(!text.includes(id), `dump 含 id ${id}`);
  for (const k of VOLATILE_KEYS) assert.ok(!text.includes(`"${k}"`), `dump 含易變欄位 ${k}`);
  for (const v of ['2026-10-29', 'blake2b', 'legacy-2', 'penpot/2.18']) assert.ok(!text.includes(v), `dump 含易變值 ${v}`);
});

// ---- 順序有意義：不是排序掉，而是依來源的順序欄位 ----

const keyOf = (entries, suffix) => Object.keys(entries).find((k) => k.endsWith(suffix));
const keyNamed = (entries, name) => Object.keys(entries).find((k) => entries[k].name === name);
const names = (text, from) => [...text.matchAll(new RegExp(`"name": "(${from.join('|')})"`, 'g'))].map((m) => m[1]);

test('top-level shape order follows the page root shapes order', () => {
  const f = fixture();
  assert.deepEqual(names(dump(zip(f)).text, ['C / Image', 'C / Button']), ['C / Image', 'C / Button']);
  f[keyOf(f, `${ZERO}.json`)].shapes.reverse();
  assert.deepEqual(names(dump(zip(f)).text, ['C / Image', 'C / Button']), ['C / Button', 'C / Image']);
});

test('token sets follow tokenSetOrder', () => {
  const f = fixture();
  assert.deepEqual(names(dump(zip(f)).text, ['Base', 'Mode/Dark']), ['Base', 'Mode/Dark']);
  f[keyOf(f, '/tokens.json')].$metadata.tokenSetOrder.reverse();
  assert.deepEqual(names(dump(zip(f)).text, ['Base', 'Mode/Dark']), ['Mode/Dark', 'Base']);
});

test('children order follows the parent shapes order', () => {
  const f = fixture();
  const extra = 'aaaaaaaa-0000-4000-8000-000000000099';
  const labelKey = keyNamed(f, 'Label');
  f[labelKey.replace(/[^/]+\.json$/, `${extra}.json`)] = { ...f[labelKey], id: extra, name: 'Second' };
  const parent = f[keyNamed(f, 'C / Button')];
  parent.shapes.push(extra);
  assert.deepEqual(names(dump(zip(f)).text, ['Label', 'Second']), ['Label', 'Second']);
  parent.shapes.reverse();
  assert.deepEqual(names(dump(zip(f)).text, ['Label', 'Second']), ['Second', 'Label']);
});

// ---- 設計內容改動時 dump 要變（各自獨立） ----

const changes = {
  'a master name': (f) => { f[keyNamed(f, 'C / Button')].name = 'C / Button2'; },
  'a token binding': (f) => { f[keyNamed(f, 'Label')].appliedTokens = {}; },
  'a token value': (f) => { f[keyOf(f, '/tokens.json')].Base.radius.$value = '12'; },
  'a theme name': (f) => { f[keyOf(f, '/tokens.json')].$themes[0].name = 'Night'; },
  'a media name': (f) => { f[keyNamed(f, 'alpha-loading')].name = 'alpha-renamed'; },
};
for (const [what, mutate] of Object.entries(changes)) {
  test(`changing ${what} changes the dump`, () => {
    const f = fixture();
    const before = dump(zip(f)).text;
    mutate(f);
    const after = dump(zip(f));
    assert.equal(after.status, 0, after.stderr);
    assert.notEqual(after.text, before);
  });
}

// ---- 檢查模式 ----

const check = (file, extra = []) => spawnSync(process.execPath, [cli, file, '--check', ...extra], { encoding: 'utf8' });

test('--check exits 0 when the committed dump matches', () => {
  const first = dump(zip(fixture()));
  const r = check(first.file);
  assert.equal(r.status, 0, r.stderr);
});

test('--check exits 0 for a re-export of the same design (no false alarm)', () => {
  const first = dump(zip(fixture()));
  writeFileSync(first.file, zip(reexport(fixture()), { dosTime: 0x1111 }));
  const r = check(first.file);
  assert.equal(r.status, 0, r.stderr);
});

test('--check exits 1 and lists the changed token value as - / + lines', () => {
  const first = dump(zip(fixture()));
  const f = fixture();
  f[keyOf(f, '/tokens.json')].Base.radius.$value = '12';
  writeFileSync(first.file, zip(f));
  const r = check(first.file);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /^- +"\$value": "8"$/m);
  assert.match(r.stderr, /^\+ +"\$value": "12"$/m);
  assert.equal(readFileSync(first.out, 'utf8'), first.text, '--check 不可改寫 dump');
});

test('--check exits 1 and lists the removed font-zh binding', () => {
  const first = dump(zip(fixture()));
  const f = fixture();
  f[keyNamed(f, 'Label')].appliedTokens = {};
  writeFileSync(first.file, zip(f));
  const r = check(first.file);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /^- .*"fontFamily": "font-zh"$/m);
});

test('--check exits 1 when only the order differs', () => {
  const first = dump(zip(fixture()));
  const f = fixture();
  f[keyOf(f, `${ZERO}.json`)].shapes.reverse();
  writeFileSync(first.file, zip(f));
  const r = check(first.file);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /^[-+] /m);
});

test('--check exits 1 when the committed dump is missing', () => {
  const dir = tmp();
  const file = join(dir, 'lib.penpot');
  writeFileSync(file, zip(fixture()));
  const r = check(file);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /找不到已提交的 dump/);
  assert.equal(existsSync(join(dir, 'lib.dump.json')), false);
});

test('--check --out compares the given path and writes nothing', () => {
  const first = dump(zip(fixture()));
  const elsewhere = join(first.dir, 'elsewhere.json');
  writeFileSync(elsewhere, first.text);
  assert.equal(check(first.file, ['--out', elsewhere]).status, 0);
  const tampered = first.text.replace('"8"', '"9"');
  writeFileSync(elsewhere, tampered);
  const bad = check(first.file, ['--out', elsewhere]);
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /"9"/);
  assert.equal(readFileSync(elsewhere, 'utf8'), tampered);
});

test('--out writes to the given path instead of beside the export', () => {
  const dir = tmp();
  const file = join(dir, 'lib.penpot');
  writeFileSync(file, zip(fixture()));
  const target = join(dir, 'custom.json');
  const r = spawnSync(process.execPath, [cli, file, '--out', target], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(target));
  assert.equal(existsSync(join(dir, 'lib.dump.json')), false);
});

// ---- 錯誤與用法 ----

test('exits 2 without exactly one path, or with an unknown flag', () => {
  assert.equal(spawnSync(process.execPath, [cli], { encoding: 'utf8' }).status, 2);
  assert.equal(spawnSync(process.execPath, [cli, 'a.penpot', '--bogus'], { encoding: 'utf8' }).status, 2);
});

test('exits 1 with the reason for a broken export and writes no dump', () => {
  const r = dump(Buffer.from('not a zip at all, just text padding padding'));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /不是 zip 檔/);
  assert.equal(r.text, null);
});

test('exits 1 when a token binding points at a token that no set defines', () => {
  const f = fixture();
  f[keyNamed(f, 'Label')].appliedTokens = { fontFamily: 'font-missing' };
  const r = dump(zip(f));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /font-missing/);
});

// ---- 守門：真實匯出檔不進 repo ----

test('the repo tracks no real export: no zip magic bytes, no .penpot, fixtures are JSON only', () => {
  const root = resolve(here, '../..');
  const ls = spawnSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], { cwd: root, encoding: 'buffer' });
  assert.equal(ls.status, 0);
  const files = ls.stdout.toString('utf8').split('\0').filter(Boolean);
  assert.ok(files.length > 0);
  for (const f of files) {
    assert.ok(!f.endsWith('.penpot'), `被追蹤或待追蹤的匯出檔 ${f}`);
    const p = join(root, f);
    if (!existsSync(p)) continue; // 已 git rm、尚未提交
    if (f.endsWith('.fig')) continue; // OpenPencil 的 .fig 本身是 zip，由 ISSUE-029 退役；這裡只擋 Penpot 匯出檔偽裝成其他副檔名
    const head = readFileSync(p).subarray(0, 4);
    assert.notDeepEqual([...head], [0x50, 0x4b, 0x03, 0x04], `${f} 以 zip 魔術位元組開頭`);
  }
  const fixtures = files.filter((f) => f.startsWith('scripts/design/fixtures/'));
  assert.ok(fixtures.length >= 2);
  for (const f of fixtures) assert.ok(f.endsWith('.json'), `fixtures 內有非 JSON：${f}`);
  for (const f of files.filter((x) => x.endsWith('.dump.json'))) {
    assert.equal(readFileSync(join(root, f), 'utf8').match(UUID), null, `${f} 含 uuid`);
  }
});

// ---- 審查後補的邊界 ----

test('--out may not point at the input export, which is left untouched', () => {
  const dir = tmp();
  const file = join(dir, 'lib.penpot');
  const buf = zip(fixture());
  writeFileSync(file, buf);
  const r = spawnSync(process.execPath, [cli, file, '--out', file], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.equal(Buffer.compare(readFileSync(file), buf), 0);
});

test('--out without a value (or swallowing the next flag) is a usage error', () => {
  assert.equal(spawnSync(process.execPath, [cli, 'a.penpot', '--out'], { encoding: 'utf8' }).status, 2);
  assert.equal(spawnSync(process.execPath, [cli, 'a.penpot', '--out', '--check'], { encoding: 'utf8' }).status, 2);
});

test('exits 1 with a message, not a stack trace, when the dump cannot be written or read', () => {
  const dir = tmp();
  const file = join(dir, 'lib.penpot');
  writeFileSync(file, zip(fixture()));
  const w = spawnSync(process.execPath, [cli, file, '--out', join(dir, 'no-such-dir', 'x.json')], { encoding: 'utf8' });
  assert.equal(w.status, 1);
  assert.match(w.stderr, /^錯誤：無法寫入/m);
  const r = spawnSync(process.execPath, [cli, file, '--check', '--out', dir], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /^錯誤：無法讀取/m);
});

test('two pages with the same name dump identically whatever the entry order', () => {
  const f = fixture();
  const pageKey = keyOf(f, 'aaaaaaaa-0000-4000-8000-000000000002.json');
  const otherId = 'aaaaaaaa-0000-4000-8000-000000000077';
  const prefix = pageKey.slice(0, -'.json'.length);
  const second = {};
  for (const [k, v] of Object.entries(f)) {
    if (k === pageKey) second[pageKey.replace('0002.json', '0077.json')] = { ...v, id: otherId };
    else if (k.startsWith(`${prefix}/`)) second[k.replace('0002/', '0077/')] = { ...v, pageId: otherId, name: v.name === 'Label' ? 'Other label' : v.name };
  }
  const merged = { ...f, ...second };
  const a = dump(zip(merged)).text;
  const b = dump(zip(Object.fromEntries(Object.entries(merged).reverse()))).text;
  assert.equal((a.match(/"name": "Page 1"/g) ?? []).length, 2);
  assert.equal(b, a);
});
