import { test, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

test('structured accent source reaches public package data and browser button', async ({ page }) => {
  const source = new URL('../packages/tokens/src/suite/vibrant/light.tokens.json', import.meta.url);
  const original = await readFile(source, 'utf8');
  const build = () => execFileSync(process.execPath, [process.env.npm_execpath!, 'run', 'build'], {stdio:'pipe'});
  try {
    const changed = JSON.parse(original);
    changed.accent.$value = '#9A4C32';
    await writeFile(source, JSON.stringify(changed, null, 2));
    build();
    const {default: data} = await import('@luca-style/tokens/data', {with:{type:'json'}});
    expect(data.vibrant.light.accent).toBe('#9A4C32');
    await page.goto('/');
    await expect(page.getByRole('button', {name:'探索設計基礎 →'})).toHaveCSS('background-color','rgb(154, 76, 50)');
  } finally {
    await writeFile(source, original);
    build();
  }
});
