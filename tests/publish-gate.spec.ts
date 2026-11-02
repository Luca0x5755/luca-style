import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// 以假的結論檔驗證發佈閘門（不連網、不發佈）。閘門是獨立腳本，退出碼 0 才允許往下發佈。
const script = fileURLToPath(new URL('../scripts/check-publish-gate.mjs', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'luca-gate-'));
const gate = (path: string) => spawnSync(process.execPath, [script, path], { encoding: 'utf8' });
const verdict = (name: string, body: string) => {
  const path = join(dir, name);
  writeFileSync(path, body);
  return path;
};

test('gate passes only when the verdict says copyBetter is exactly false', () => {
  expect(gate(verdict('pass.json', '{"copyBetter": false}')).status).toBe(0);
});

test('gate fails when the verdict file does not exist', () => {
  const result = gate(join(dir, 'missing.json'));
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('missing.json');
});

test('gate fails when copyBetter is true', () => {
  expect(gate(verdict('better.json', '{"copyBetter": true}')).status).not.toBe(0);
});

for (const [name, body] of [
  ['absent.json', '{"other": 1}'],
  ['string.json', '{"copyBetter": "false"}'],
  ['null.json', '{"copyBetter": null}'],
  ['broken.json', '{"copyBetter": fal'],
  ['array.json', '[false]'],
] as const) {
  test(`gate fails closed on a malformed verdict (${name})`, () => {
    expect(gate(verdict(name, body)).status).not.toBe(0);
  });
}

test('gate fails when no path argument is given', () => {
  expect(spawnSync(process.execPath, [script], { encoding: 'utf8' }).status).not.toBe(0);
});
