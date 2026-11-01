import { expect, type Browser, type Locator, type Page } from '@playwright/test';
import { cssRgb, neutralValues } from './tokens-helpers';
import { overviewScreen, overviewStates, type OverviewCell } from './visual-matrix';

// 狀態總覽頁只在開發環境開放；visual 專案的 baseURL 是 4173，warm-up 也拿不到 baseURL，所以寫出完整來源。
export const devOrigin = 'http://127.0.0.1:4178';
export const overviewPath = '/dev/state-overview';
// 格內網址不帶寬度：寬度由視窗或 iframe 決定。
type CellDocument = Omit<OverviewCell, 'width'>;
export const cellQuery = ({ state, suite, mode }: CellDocument) => String(new URLSearchParams({ screen: overviewScreen, state, suite, mode }));
const cellPath = (cell: CellDocument) => `${overviewPath}/frame?${cellQuery(cell)}`;

// 色值來源是前端規格 §5.4 的色票表。
export const palette = {
  vibrant: { light: '#147F82', dark: '#64C2BC' },
  professional: { light: '#625C83', dark: '#ABA4D7' },
} as const;

export const columnCount = (element: Locator) => element.evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length);
// 欄數是 834 真的走到 @media 的證據：它介於 1023 與 599 兩個斷點之間，組合與另外兩種寬度都不同。
const columnsAt = { 1280: { layout: 2, metrics: 3 }, 834: { layout: 1, metrics: 3 }, 390: { layout: 1, metrics: 1 } } as const;
const loadingImages = { vibrant: 'tide', professional: 'square' } as const;

async function expectStateContent(page: Page, state: OverviewCell['state']) {
  const message = `狀態內容 ${state}`;
  if (state === 'loading') {
    await expect(page.getByRole('status').first(), message).toContainText('產品資料載入中');
    await expect(page.getByRole('status').first(), message).toHaveAttribute('aria-busy', 'true');
  } else if (state === 'empty') {
    await expect(page.getByRole('status').first(), message).toContainText('目前尚無產品資料');
  } else if (state === 'error') {
    await expect(page.getByRole('alert'), message).toContainText('產品資料載入失敗');
  } else {
    await expect(page.getByRole('region', { name: '摘要資訊' }), message).toBeVisible();
    await expect(page.getByRole('cell', { name: '每月規劃', exact: true }), message).toBeVisible();
  }
  if (state !== 'success') await expect(page.getByRole('cell', { name: '每月規劃', exact: true }), message).toHaveCount(0);
}

// `animations:'disabled'` 凍不住 GIF，靠減少動態改用靜態 PNG；背景圖不算在 load 事件內，要自己等它解碼。
async function expectStaticLoadingImage(page: Page, { suite, mode }: OverviewCell) {
  const image = page.locator('.luca-loading-animation');
  const background = await image.evaluate(node => getComputedStyle(node).backgroundImage);
  expect(background, '載入圖').toContain(`${loadingImages[suite]}-${mode}.png`);
  await page.evaluate(async value => {
    const decoded = new Image();
    decoded.src = /url\("(.+)"\)/.exec(value)![1];
    await decoded.decode();
  }, background);
}

// font-display:swap 下字體載入失敗 fonts.ready 仍會成立，那張基準拍到的就是備用字型，所以要逐一看 FontFace。
async function expectFontsLoaded(page: Page) {
  await expect.poll(() => page.evaluate(async () => {
    await document.fonts.ready;
    const faces = Array.from(document.fonts);
    const isLoaded = (family: string) => faces.some(face => face.family.replace(/['"]/g, '') === family && face.status === 'loaded');
    return { failed: faces.filter(face => face.status === 'error').map(face => face.family), inter: isLoaded('Inter'), noto: isLoaded('Noto Sans TC') };
  }), '字體').toEqual({ failed: [], inter: true, noto: true });
}

// 把一種組合開成頂層的格內文件，確認它呈現的就是要求的組合才交給呼叫者。
// 這些斷言排在截圖之前，所以壞掉的畫面在 update:visual 時也寫不進基準。
export async function openCell(page: Page, cell: OverviewCell) {
  const { state, suite, mode, width } = cell;
  await page.setViewportSize({ width, height: 1000 });
  // 減少動態：避免轉場中途被掃到或截到，Loading 也才會換成靜態圖。
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(cellPath(cell));
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-suite', suite);
  await expect(html).toHaveAttribute('data-mode', mode);
  await expect(html).toHaveCSS('color-scheme', mode);
  await expect(html).toHaveCSS('--accent', palette[suite][mode]);
  await expect(html).toHaveCSS('background-color', cssRgb(neutralValues.bg[mode]));
  await expectStateContent(page, state);
  expect(await page.evaluate(() => window.innerWidth), '視窗寬度').toBe(width);
  expect(await columnCount(page.locator('.product-layout')), '.product-layout 欄數').toBe(columnsAt[width].layout);
  if (state === 'success') expect(await columnCount(page.locator('.product-metrics')), '.product-metrics 欄數').toBe(columnsAt[width].metrics);
  // 開發模式的 CSS 由 JS 注入；這條樣式來自 @luca-style/react/css，沒載入時值會是 visible。
  await expect(page.locator('.luca-table-region'), '元件樣式').toHaveCSS('overflow-x', 'auto');
  if (state === 'loading') await expectStaticLoadingImage(page, cell);
  await page.waitForLoadState('networkidle');
  await expectFontsLoaded(page);
}

// 冷快取時 vite 第一次看到依賴會重新最佳化並整頁重載，重載會洗掉測試注入的樣式。先走一輪，讓這件事發生在這裡。
export async function warmUpOverview(browser: Browser) {
  const page = await browser.newPage();
  try {
    for (const state of overviewStates) {
      await page.goto(`${devOrigin}${cellPath({ state, suite: 'vibrant', mode: 'light' })}`);
      await expect(page.locator('.product-page')).toBeVisible({ timeout: 60_000 });
      await page.waitForLoadState('networkidle');
    }
    await page.goto(`${devOrigin}${overviewPath}`);
    await expect(page.getByRole('link', { name: '開原尺寸 · Success', exact: true })).toBeVisible({ timeout: 60_000 });
    await page.waitForLoadState('networkidle');
  } finally {
    await page.close();
  }
}
