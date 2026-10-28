import { test, expect } from '@playwright/test';
import { readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { makeWorkspace, readJson, runGenerator } from './tokens-helpers';

// PR-STYLE-26：任一「風格套系 × 明暗模式」組合缺值時建置失敗，並指出缺的變數與組合。

async function buildWithout(layer: string, edit: (tokens: Record<string, Record<string, unknown>>) => void) {
  const workspace = await makeWorkspace();
  try {
    const file = join(workspace.source, layer);
    const tokens = await readJson(file);
    edit(tokens);
    await writeFile(file, JSON.stringify(tokens, null, 2));
    const result = runGenerator(workspace.root);
    return { ...result, outputs: await readdir(workspace.root) };
  } finally {
    await workspace.dispose();
  }
}

test('removing a suite-and-mode token fails the build naming that token and combination only', async () => {
  const result = await buildWithout('suite/professional/dark.tokens.json', tokens => { delete tokens.accent; });
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('accent');
  expect(result.stderr).toContain('professional/dark');
  for (const other of ['vibrant/light', 'vibrant/dark', 'professional/light']) expect(result.stderr).not.toContain(other);
  expect(result.outputs).not.toContain('out');
});

test('a missing layer file fails the build naming that file', async () => {
  const workspace = await makeWorkspace();
  try {
    await rm(join(workspace.source, 'suite/vibrant/common.tokens.json'));
    const result = runGenerator(workspace.root);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('suite/vibrant/common.tokens.json');
    expect(await readdir(workspace.root)).not.toContain('out');
  } finally {
    await workspace.dispose();
  }
});

test('removing a value from a shared mode layer names every combination of that mode and no other', async () => {
  const result = await buildWithout('mode/light.tokens.json', tokens => { delete tokens.text.$value; });
  expect(result.status).not.toBe(0);
  expect(result.stderr).toMatch(/text.*vibrant\/light/);
  expect(result.stderr).toMatch(/text.*professional\/light/);
  expect(result.stderr).not.toContain('/dark');
  expect(result.outputs).not.toContain('out');
});
