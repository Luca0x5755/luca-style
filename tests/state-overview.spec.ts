import { test, expect, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// 狀態總覽頁只在開發環境開放，這支測試跑在 `dev` 專案（port 4178 的 vite 開發伺服器）。
const overview = '/dev/state-overview';
const states = ['Loading', 'Empty', 'Error', 'Success'] as const;
const cell = (page: Page, name: string) => page.getByRole('region', { name, exact: true });

test('the four product states are all on the page side by side without any interaction', async ({ page }) => {
  await page.goto(overview);
  const boxes = [];
  for (const state of states) {
    await expect(cell(page, state)).toBeVisible();
    boxes.push((await cell(page, state).boundingBox())!);
  }
  for (let i = 0; i < boxes.length - 1; i++) {
    expect(boxes[i + 1].y).toBe(boxes[i].y);
    expect(boxes[i].x + boxes[i].width).toBeLessThanOrEqual(boxes[i + 1].x);
  }
});

test('each cell shows the content its state specifies in §5.3.4', async ({ page }) => {
  await page.goto(overview);
  await expect(cell(page, 'Loading').getByRole('status').first()).toContainText('產品資料載入中');
  await expect(cell(page, 'Empty').getByRole('status').first()).toContainText('目前尚無產品資料');
  for (const name of ['項目', '日期', '數值']) await expect(cell(page, 'Empty').getByRole('columnheader', { name, exact: true })).toBeVisible();
  await expect(cell(page, 'Error').getByRole('alert')).toContainText('產品資料載入失敗');
  await expect(cell(page, 'Success').getByRole('region', { name: '摘要資訊' })).toBeVisible();
  await expect(cell(page, 'Success').getByRole('cell', { name: '每月規劃', exact: true })).toBeVisible();
  await expect(cell(page, 'Success').getByRole('form', { name: '建立計畫' })).toBeVisible();
  for (const state of ['Loading', 'Empty', 'Error']) await expect(cell(page, state).getByRole('cell', { name: '每月規劃', exact: true })).toHaveCount(0);
});

// 取畫面內 .product-page 的文字，空白正規化，並排除只屬於範本的「樣張狀態」選單。
const productText = (root: Locator) => root.locator('.product-page').evaluate(element => {
  const copy = element.cloneNode(true) as HTMLElement;
  copy.querySelector('.sample-control')?.remove();
  return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
});

test('each cell renders the same screen the product template shows for that state', async ({ page }) => {
  await page.goto(overview);
  const cells = new Map<string, string>();
  for (const state of states) cells.set(state, await productText(cell(page, state)));
  await page.goto('/templates/product');
  for (const state of states) {
    await page.getByLabel('樣張狀態').selectOption(state.toLowerCase());
    expect(cells.get(state), state).toBe(await productText(page.locator('main')));
  }
});

test('the sample state menu stays on the product template and is not on the overview', async ({ page }) => {
  await page.goto(overview);
  await expect(cell(page, 'Success')).toBeVisible();
  await expect(page.getByLabel('樣張狀態')).toHaveCount(0);
});

test('the overview needs no backend and renders without errors', async ({ page }) => {
  const problems: string[] = [];
  const origin = new URL(test.info().project.use.baseURL!).origin;
  page.on('request', request => {
    if (['fetch', 'xhr'].includes(request.resourceType())) problems.push(`${request.resourceType()} ${request.url()}`);
    if (!request.url().startsWith('data:') && new URL(request.url()).origin !== origin) problems.push(`跨來源 ${request.url()}`);
  });
  page.on('pageerror', error => problems.push(`pageerror ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') problems.push(`console ${message.text()}`); });
  await page.goto(overview);
  await expect(cell(page, 'Success')).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(problems).toEqual([]);
});

test('retrying in the error cell leaves every cell in the state the overview gave it', async ({ page }) => {
  await page.goto(overview);
  const before = await Promise.all(states.map(state => productText(cell(page, state))));
  await cell(page, 'Error').getByRole('button', { name: '重試', exact: true }).click();
  await expect(cell(page, 'Error').getByRole('alert')).toBeVisible();
  expect(await Promise.all(states.map(state => productText(cell(page, state))))).toEqual(before);
});

// 公開元件與「元件不自己保存狀態」無法完全從瀏覽器觀察，以來源檢查補上（PR-REVIEW-05、06）。
const source = (name: string) => readFileSync(new URL(`../apps/showcase/src/${name}`, import.meta.url), 'utf8');

test('the overview and the product screen import only public packages and showcase files', () => {
  for (const name of ['state-overview.tsx', 'product.tsx']) {
    const imports = [...source(name).matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map(match => match[1]);
    expect(imports.length, name).toBeGreaterThan(0);
    for (const specifier of imports) expect(specifier, name).toMatch(/^(react|@luca-style\/react|\.\/[\w.-]+)$/);
  }
});

test('the overview renders the real product screen', () => {
  expect(source('state-overview.tsx')).toMatch(/import\s*\{[^}]*\bProduct\b[^}]*\}\s*from\s*'\.\/product'/);
});

test('the product screen keeps neither the sample menu nor the state it presents', () => {
  const product = source('product.tsx');
  expect(product).not.toContain('樣張狀態');
  // 區分大小寫：<Select 是表單元件，<select 才是選單。
  expect(product).not.toContain('<select');
  expect(product).not.toMatch(/useState(?:<[^>]*>)?\(\s*(?:state\b|['"](?:success|loading|empty|error)['"])/);
});
