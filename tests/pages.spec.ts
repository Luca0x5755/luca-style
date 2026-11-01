import { test, expect, type Page } from '@playwright/test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { routeTable } from './route-table';

// 以 `build:pages` 產生、由模擬 GitHub Pages 的伺服器（port 4176）提供的樣張。
const base = '/luca-style';
const pagesDir = new URL('../apps/showcase/dist-pages/', import.meta.url);
const distDir = new URL('../apps/showcase/dist/', import.meta.url);
const nav = (page: Page) => page.getByRole('navigation', { name: '主要導覽' });
const pages = [
  { path: '/', heading: /為你的下一個專案，\s*建立一致的起點。/ },
  { path: '/foundations', heading: '設計基礎', label: '設計基礎' },
  { path: '/components', heading: '共用元件', label: '共用元件' },
  { path: '/templates/product', heading: '把今天，安排得剛剛好。', label: '產品範本' },
  { path: '/templates/intro', heading: /為重要的事，\s*留出清楚的空間。/, label: '介紹範本' },
];
const heading = (page: Page, value: string | RegExp) => page.getByRole('heading', { name: value, exact: typeof value === 'string' });

test('build:pages writes an index.html for every route in the table and a 404.html', () => {
  expect(routeTable).toHaveLength(5);
  for (const route of routeTable) expect(existsSync(new URL(`.${route === '/' ? '' : route}/index.html`, pagesDir)), route).toBe(true);
  expect(existsSync(new URL('404.html', pagesDir))).toBe(true);
});

test('plain npm run build output is unchanged and has no per-route pages', () => {
  expect(existsSync(new URL('index.html', distDir))).toBe(true);
  expect(existsSync(new URL('404.html', distDir))).toBe(false);
  expect(existsSync(new URL('foundations/index.html', distDir))).toBe(false);
  expect(readFileSync(new URL('index.html', distDir), 'utf8')).toContain('src="/assets/');
});

for (const route of pages) {
  test(`${route.path} opens directly and reloads with 200 and its own page`, async ({ page }) => {
    const response = await page.goto(`${base}${route.path}`);
    expect(response?.status()).toBe(200);
    await expect(heading(page, route.heading)).toBeVisible();
    if (route.label) await expect(nav(page).getByRole('link', { name: route.label })).toHaveAttribute('aria-current', 'page');
    const reloaded = await page.reload();
    expect(reloaded?.status()).toBe(200);
    await expect(heading(page, route.heading)).toBeVisible();
  });
}

test('trailing-slash route urls answer 200 directly and show the page', async ({ page, request }) => {
  for (const route of pages.filter(item => item.path !== '/')) {
    expect((await request.get(`${base}${route.path}/`, { maxRedirects: 0 })).status(), route.path).toBe(200);
    await page.goto(`${base}${route.path}/`);
    await expect(heading(page, route.heading)).toBeVisible();
    await expect(nav(page).getByRole('link', { name: route.label! })).toHaveAttribute('aria-current', 'page');
  }
});

test('server behaves like GitHub Pages for directory urls without a trailing slash', async ({ request }) => {
  const route = await request.get(`${base}/foundations`, { maxRedirects: 0 });
  expect(route.status()).toBe(301);
  expect(route.headers()['location']).toBe(`${base}/foundations/`);
  const root = await request.get(base, { maxRedirects: 0 });
  expect(root.status()).toBe(301);
  expect(root.headers()['location']).toBe(`${base}/`);
});

test('unknown urls answer 404 and show the not-found page', async ({ page }) => {
  for (const path of ['/nope', '/a/b/c', '/foundations/x', '/a/']) {
    const response = await page.goto(`${base}${path}`);
    expect(response?.status(), path).toBe(404);
    await expect(page.getByRole('heading', { level: 1, name: '找不到這個頁面' })).toBeVisible();
    await expect(page.getByRole('link', { name: '返回設計系統入口', exact: true })).toHaveAttribute('href', `${base}/`);
  }
});

test('the state overview url answers 404 and shows the not-found page', async ({ page }) => {
  for (const path of ['/dev/state-overview', '/dev/state-overview/', '/dev/state-overview/frame?screen=/templates/product&state=success']) {
    const response = await page.goto(`${base}${path}`);
    expect(response?.status(), path).toBe(404);
    await expect(page.getByRole('heading', { level: 1, name: '找不到這個頁面' })).toBeVisible();
    for (const name of ['Loading', 'Empty', 'Error', 'Success']) await expect(page.getByRole('region', { name, exact: true })).toHaveCount(0);
  }
});

test('neither build output contains the state overview page', () => {
  const markers = ['state-overview', '狀態總覽'];
  // 先確認標記真的在頁面原始碼裡，頁面改名時這條測試才不會空轉。
  const overviewSource = readFileSync(new URL('../apps/showcase/src/state-overview.tsx', import.meta.url), 'utf8');
  for (const marker of markers) expect(overviewSource, marker).toContain(marker);
  for (const dir of [distDir, pagesDir]) {
    expect(existsSync(new URL('dev/state-overview/index.html', dir))).toBe(false);
    expect(existsSync(new URL('dev/state-overview/frame/index.html', dir))).toBe(false);
    const files = readdirSync(dir, { recursive: true, withFileTypes: true }).filter(entry => entry.isFile());
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const path = join(file.parentPath, file.name);
      const content = readFileSync(path);
      for (const marker of markers) {
        expect(relative(fileURLToPath(dir), path).includes(marker), `${path} 的路徑含 ${marker}`).toBe(false);
        expect(content.includes(marker), `${path} 的內容含 ${marker}`).toBe(false);
      }
    }
  }
});

test('not-found page loads its stylesheet from the base even on deep urls', async ({ page, request }) => {
  await page.goto(`${base}/a/b/c`);
  const href = await page.locator('link[rel=stylesheet]').first().getAttribute('href');
  expect(href).toMatch(new RegExp(`^${base}/assets/`));
  expect((await request.get(href!)).status()).toBe(200);
});
