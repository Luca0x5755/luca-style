import { test, expect } from '@playwright/test';

const homeHeading = /為你的下一個專案，\s*建立一致的起點。/;
const nav = (page: import('@playwright/test').Page) => page.getByRole('navigation', { name: '主要導覽' });

test('visitor on an unknown path sees the not-found page with the requested path', async ({ page }) => {
  await page.goto('/missing-page');
  await expect(page.getByRole('heading', { level: 1, name: '找不到這個頁面' })).toBeVisible();
  await expect(page.getByRole('heading', { name: homeHeading })).toHaveCount(0);
  await expect(page.locator('main > p.eyebrow')).toContainText('/missing-page');
  await expect(page.getByText('網址 /missing-page 沒有對應的頁面。請回到設計系統入口，其他頁面也可從導覽進入。')).toBeVisible();
});

test('the production build shows the not-found page at the state overview url', async ({ page }) => {
  for (const path of ['/dev/state-overview', '/dev/state-overview/']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: '找不到這個頁面' })).toBeVisible();
    for (const name of ['Loading', 'Empty', 'Error', 'Success']) await expect(page.getByRole('region', { name, exact: true })).toHaveCount(0);
  }
});

test('listed routes and the entry do not show the not-found page', async ({ page }) => {
  for (const route of ['/', '/foundations', '/components', '/templates/product', '/templates/intro']) {
    await page.goto(route);
    await expect(page.getByRole('heading', { name: '找不到這個頁面' })).toHaveCount(0);
  }
  await page.goto('/');
  await expect(page.getByRole('heading', { name: homeHeading })).toBeVisible();
});

test('visitor can return to the design system entry from the not-found page', async ({ page }) => {
  await page.goto('/missing-page');
  await page.getByRole('link', { name: '返回設計系統入口', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: homeHeading })).toBeVisible();
});

test('not-found page keeps navigation, suite and mode switching', async ({ page }) => {
  await page.goto('/missing-page');
  for (const label of ['設計基礎', '共用元件', '產品範本', '介紹範本']) {
    await expect(nav(page).getByRole('link', { name: label })).toBeVisible();
  }
  await page.getByLabel('風格套系').selectOption('professional');
  await page.getByLabel('明暗模式').selectOption('dark');
  await expect(page.locator('main > p.eyebrow')).toContainText('精緻專業 · 石墨紫 / 暗黑');
  await nav(page).getByRole('link', { name: '共用元件' }).click();
  await expect(page).toHaveURL(/\/components$/);
});

test('not-found four states show the specified copy and retry recovers', async ({ page }) => {
  await page.goto('/missing-page');
  const states: [string, 'status' | 'alert', string][] = [
    ['loading', 'status', '正在確認這個網址對應的頁面。'],
    ['empty', 'status', '這個網址沒有可顯示的內容，可以先回到設計系統入口。'],
    ['error', 'alert', '頁面內容無法載入。請重試，或回到設計系統入口。'],
  ];
  for (const [state, role, text] of states) {
    await page.getByLabel('樣張狀態').selectOption(state);
    await expect(page.getByRole(role)).toContainText(text);
    await expect(nav(page)).toBeVisible();
    await expect(page.getByRole('link', { name: '返回設計系統入口', exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: '重試', exact: true }).click();
  await expect(page.getByRole('status')).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByLabel('樣張狀態')).toHaveValue('success');
});

test('not-found page has no horizontal overflow at 390, 834 and 1280px in every state', async ({ page }) => {
  await page.goto('/missing-page');
  for (const width of [390, 834, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const state of ['success', 'loading', 'empty', 'error']) {
      await page.getByLabel('樣張狀態').selectOption(state);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
  }
});

test('not-found page wraps a very long requested path without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.goto(`/${'a'.repeat(120)}`);
  await expect(page.getByRole('heading', { level: 1, name: '找不到這個頁面' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
