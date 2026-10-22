import { test, expect } from '@playwright/test';

// GitHub Pages 會把 foundations/index.html 的網址 301 到帶尾斜線的路徑，應用須視為同一路由。
const nav = (page: import('@playwright/test').Page) => page.getByRole('navigation', { name: '主要導覽' });

test('visitor on a trailing-slash route sees the same page as without the slash', async ({ page }) => {
  for (const [path, heading, label] of [
    ['/foundations/', '設計基礎', '設計基礎'],
    ['/components/', '共用元件', '共用元件'],
    ['/templates/product/', '把今天，安排得剛剛好。', '產品範本'],
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: '找不到這個頁面' })).toHaveCount(0);
    await expect(nav(page).getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page');
  }
});

test('unknown path with a trailing slash still shows the not-found page', async ({ page }) => {
  await page.goto('/missing/');
  await expect(page.getByRole('heading', { level: 1, name: '找不到這個頁面' })).toBeVisible();
});
