// parse-export.mjs 的測試（源自 ISSUE-020 試點，ISSUE-023 搬到 scripts/design/）：夾具由 fixtures/minimal-export.json 即時組成 zip，不提交真實匯出檔。
// 執行：node --test scripts/design/parse-export.test.mjs
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zip } from './penpot-test-helpers.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const cli = resolve(here, 'parse-export.mjs');
const fixture = () => structuredClone(JSON.parse(readFileSync(join(here, 'fixtures/minimal-export.json'), 'utf8')));

const dirs = [];
after(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

function runCli(buf, extra = []) {
  const dir = mkdtempSync(join(tmpdir(), 'penpot-export-'));
  dirs.push(dir);
  const file = join(dir, 'x.penpot');
  writeFileSync(file, buf);
  return spawnSync(process.execPath, [cli, file, ...extra], { encoding: 'utf8' });
}

test('lists the master names and count, exit 0', () => {
  const r = runCli(zip(fixture()));
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /母版：2\n- C \/ A\n- C \/ B\n/);
});

test('works for deflate-compressed archives too', () => {
  const r = runCli(zip(fixture(), { deflate: true }));
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /母版：2/);
});

test('a nested board is not counted as a master', () => {
  const r = runCli(zip(fixture()), ['--json']);
  const names = JSON.parse(r.stdout).masters.map((m) => m.name);
  assert.deepEqual(names, ['C / A', 'C / B']);
});

test('reports token sets, themes and the stored binding keys per shape', () => {
  const out = JSON.parse(runCli(zip(fixture()), ['--json']).stdout).files[0];
  assert.deepEqual(out.sets, ['Base', 'Mode/Dark']);
  assert.deepEqual(out.themes.map((t) => `${t.group}/${t.name}`), ['Mode/Dark']);
  assert.deepEqual(out.activeThemes, ['Mode/Dark']);
  assert.equal(out.mediaCount, 1);
  const a = out.masters[0].bindings;
  assert.deepEqual(a.map((b) => b.path), ['C / A', 'C / A > Label']);
  assert.deepEqual(a[1].tokens, { fontFamily: 'font-zh' });
});

test('exits 2 without exactly one path argument', () => {
  const r = spawnSync(process.execPath, [cli], { encoding: 'utf8' });
  assert.equal(r.status, 2);
});

test('exits 1 with the reason when the file is not a zip', () => {
  const r = runCli(Buffer.from('not a zip at all, just text padding padding'));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /不是 zip 檔/);
});

test('exits 1 when the manifest is missing', () => {
  const f = fixture();
  delete f['manifest.json'];
  const r = runCli(zip(f));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /缺少 manifest\.json/);
});

test('exits 1 when the manifest type is not a Penpot export', () => {
  const f = fixture();
  f['manifest.json'].type = 'other';
  const r = runCli(zip(f));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /manifest\.type/);
});

test('exits 1 when a JSON entry is malformed', () => {
  const f = fixture();
  f['files/f1.json'] = '{oops';
  const r = runCli(zip(f));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /files\/f1\.json 不是合法 JSON/);
});

test('exits 1 when the page has no boards at all', () => {
  const f = fixture();
  f['files/f1/pages/p1/00000000-0000-0000-0000-000000000000.json'].shapes = [];
  const r = runCli(zip(f));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /找不到任何母版/);
});

test('exits 1 when a binding points at a token that no set defines', () => {
  const f = fixture();
  f['files/f1/pages/p1/t1.json'].appliedTokens = { fontFamily: 'font-missing' };
  const r = runCli(zip(f));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /font-missing/);
});

test('rejects an entry whose path climbs out of the archive', () => {
  const f = fixture();
  f['../evil.json'] = {};
  const r = runCli(zip(f));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /路徑可疑/);
});

test('a non-board child at the page root is not a master', () => {
  const f = fixture();
  const R = '00000000-0000-0000-0000-000000000000';
  f[`files/f1/pages/p1/${R}.json`].shapes.push('r1');
  f['files/f1/pages/p1/r1.json'] = { id: 'r1', name: 'Loose rect', type: 'rect', parentId: R };
  const r = runCli(zip(f), ['--json']);
  assert.deepEqual(JSON.parse(r.stdout).masters.map((m) => m.name), ['C / A', 'C / B']);
});

test('exits 1 naming the file when a referenced shape file is missing', () => {
  const f = fixture();
  delete f['files/f1/pages/p1/t1.json'];
  const r = runCli(zip(f));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /缺少 files\/f1\/pages\/p1\/t1\.json/);
});

test('exits 1 on a child reference cycle instead of overflowing the stack', () => {
  const f = fixture();
  f['files/f1/pages/p1/t1.json'].shapes = ['b1'];
  const r = runCli(zip(f));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /循環/);
});

test('exits 1 naming the entry when deflate data is corrupt', () => {
  const bad = zip(fixture(), { deflate: true });
  const at = bad.indexOf(Buffer.from('manifest.json')) + 'manifest.json'.length;
  bad.fill(0xff, at, at + 8);
  const r = runCli(bad);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /manifest\.json 無法解壓/);
});

test('exits 1 when the input path does not exist', () => {
  const r = spawnSync(process.execPath, [cli, join(tmpdir(), 'penpot-export-no-such-file.penpot')], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /錯誤：/);
});

test('exits 1 instead of exhausting memory when entries inflate past the total cap', () => {
  const big = Buffer.alloc(1024 * 1024);
  const entries = {};
  for (let i = 0; i < 300; i++) entries['e' + i + '.bin'] = big;
  const r = runCli(zip(entries, { deflate: true }));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /總大小超過上限/);
});

test('treats a manifest file id as plain text, not as a pattern', () => {
  const f = fixture();
  f['manifest.json'].files[0].id = '(';
  const r = runCli(zip(f));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /缺少 files\/\(\.json/);
});
