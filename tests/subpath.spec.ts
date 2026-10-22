import { test, expect, type Page } from '@playwright/test';

// 以 /luca-style/ base 建置的樣張；從入口經導覽切換，不直接開深層網址（vite preview 會回退首頁）。
const base = '/luca-style';
const homeHeading = /為你的下一個專案，\s*建立一致的起點。/;
const routes = [
  { label: '設計基礎', path: '/foundations', heading: '設計基礎' },
  { label: '共用元件', path: '/components', heading: '共用元件' },
  { label: '產品範本', path: '/templates/product', heading: '把今天，安排得剛剛好。' },
  { label: '介紹範本', path: '/templates/intro', heading: /為重要的事，\s*留出清楚的空間。/ },
];
const eyebrow = (page: Page) => page.locator('main > p.eyebrow');

test('developer can reach every showcase route from the sub-path entry through navigation', async ({ page }) => {
  await page.goto(`${base}/`);
  await expect(page.getByRole('heading', { name: homeHeading })).toBeVisible();
  await expect(eyebrow(page)).toHaveText(/^\/ \//);
  for (const route of routes) {
    await page.getByRole('navigation', { name: '主要導覽' }).getByRole('link', { name: route.label }).click();
    await expect(page).toHaveURL(new RegExp(`${base}${route.path}$`));
    await expect(page.getByRole('heading', { name: route.heading, exact: typeof route.heading === 'string' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: '主要導覽' }).getByRole('link', { name: route.label })).toHaveAttribute('aria-current', 'page');
    await expect(eyebrow(page)).toHaveText(new RegExp(`^${route.path} /`));
  }
});

test('brand link returns to the sub-path entry', async ({ page }) => {
  await page.goto(`${base}/`);
  await page.getByRole('navigation', { name: '主要導覽' }).getByRole('link', { name: '設計基礎' }).click();
  const brand = page.getByRole('navigation', { name: '主要導覽' }).locator('a.luca-brand');
  await expect(brand).toHaveAttribute('href', `${base}/`);
  await brand.click();
  await expect(page).toHaveURL(new RegExp(`${base}/$`));
  await expect(page.getByRole('heading', { name: homeHeading })).toBeVisible();
});

test('in-page links stay inside the sub-path', async ({ page }) => {
  await page.goto(`${base}/`);
  await page.getByRole('button', { name: '探索設計基礎 →' }).click();
  await expect(page).toHaveURL(new RegExp(`${base}/foundations$`));

  const explore = [
    { name: '設計基礎', url: `${base}/foundations$` },
    { name: '查看共用元件', url: `${base}/components$` },
    { name: '查看產品範本', url: `${base}/templates/product$` },
    { name: '查看介紹頁範本', url: `${base}/templates/intro$` },
    { name: '返回設計系統入口', url: `${base}/$` },
  ];
  for (const link of explore) {
    await page.goto(`${base}/`);
    await page.getByRole('region', { name: '繼續探索' }).getByRole('link', { name: link.name }).click();
    await expect(page).toHaveURL(new RegExp(link.url));
  }

  // 這兩個連結只出現在介紹頁範本，需先經導覽切換過去。
  for (const name of ['查看範本 →', '查看完整範本 →']) {
    await page.goto(`${base}/`);
    await page.getByRole('navigation', { name: '主要導覽' }).getByRole('link', { name: '介紹範本' }).click();
    await page.getByRole('link', { name }).click();
    await expect(page).toHaveURL(new RegExp(`${base}/templates/product$`));
  }

  await page.getByRole('navigation', { name: '主要導覽' }).getByRole('link', { name: '共用元件' }).click();
  await page.getByRole('link', { name: '檢視產品介面範本 →' }).click();
  await expect(page).toHaveURL(new RegExp(`${base}/templates/product$`));
});
