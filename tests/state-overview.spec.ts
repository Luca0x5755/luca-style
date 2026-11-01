import { test, expect, type BrowserContext, type FrameLocator, type Locator, type Page, type Request } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { cssRgb, neutralValues } from './tokens-helpers';

// 狀態總覽頁只在開發環境開放，這支測試跑在 `dev` 專案（port 4178 的 vite 開發伺服器）。
const overview = '/dev/state-overview';
const states = ['Loading', 'Empty', 'Error', 'Success'] as const;
const cell = (page: Page, name: string) => page.getByRole('region', { name, exact: true });
// 每格的畫面在自己的 iframe 裡。
const screen = (page: Page, name: string) => cell(page, name).frameLocator('iframe');

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
  await expect(screen(page, 'Loading').getByRole('status').first()).toContainText('產品資料載入中');
  await expect(screen(page, 'Empty').getByRole('status').first()).toContainText('目前尚無產品資料');
  for (const name of ['項目', '日期', '數值']) await expect(screen(page, 'Empty').getByRole('columnheader', { name, exact: true })).toBeVisible();
  await expect(screen(page, 'Error').getByRole('alert')).toContainText('產品資料載入失敗');
  await expect(screen(page, 'Success').getByRole('region', { name: '摘要資訊' })).toBeVisible();
  await expect(screen(page, 'Success').getByRole('cell', { name: '每月規劃', exact: true })).toBeVisible();
  await expect(screen(page, 'Success').getByRole('form', { name: '建立計畫' })).toBeVisible();
  for (const state of ['Loading', 'Empty', 'Error']) await expect(screen(page, state).getByRole('cell', { name: '每月規劃', exact: true })).toHaveCount(0);
});

// 取畫面內 .product-page 的文字，空白正規化，並排除只屬於範本的「樣張狀態」選單。
const productText = (root: Locator | FrameLocator) => root.locator('.product-page').evaluate(element => {
  const copy = element.cloneNode(true) as HTMLElement;
  copy.querySelector('.sample-control')?.remove();
  return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
});

test('each cell renders the same screen the product template shows for that state', async ({ page }) => {
  await page.goto(overview);
  const cells = new Map<string, string>();
  for (const state of states) cells.set(state, await productText(screen(page, state)));
  await page.goto('/templates/product');
  for (const state of states) {
    await page.getByLabel('樣張狀態').selectOption(state.toLowerCase());
    expect(cells.get(state), state).toBe(await productText(page.locator('main')));
  }
});

test('the sample state menu stays on the product template and is not on the overview', async ({ page }) => {
  await page.goto(overview);
  for (const state of states) {
    // 先確認畫面真的出現，空的 iframe 才不會讓下面的檢查空轉。
    await expect(screen(page, state).locator('.product-page')).toBeVisible();
    await expect(screen(page, state).getByLabel('樣張狀態')).toHaveCount(0);
  }
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
  for (const state of states) await expect(screen(page, state).locator('.product-page')).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(problems).toEqual([]);
});

test('retrying in the error cell leaves every cell in the state the overview gave it', async ({ page }) => {
  await page.goto(overview);
  const before = await Promise.all(states.map(state => productText(screen(page, state))));
  await screen(page, 'Error').getByRole('button', { name: '重試', exact: true }).click();
  await expect(screen(page, 'Error').getByRole('alert')).toBeVisible();
  expect(await Promise.all(states.map(state => productText(screen(page, state))))).toEqual(before);
});

// 公開元件與「元件不自己保存狀態」無法完全從瀏覽器觀察，以來源檢查補上（PR-REVIEW-05、06）。
const source = (name: string) => readFileSync(new URL(`../apps/showcase/src/${name}`, import.meta.url), 'utf8');

test('the overview and the product screen import only public packages and showcase files', () => {
  for (const name of ['state-overview.tsx', 'state-overview-frame.tsx', 'state-overview-screens.tsx', 'product.tsx']) {
    const imports = [...source(name).matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map(match => match[1]);
    expect(imports.length, name).toBeGreaterThan(0);
    for (const specifier of imports) expect(specifier, name).toMatch(/^(react|@luca-style\/react|\.\/[\w.-]+)$/);
  }
});

test('the overview renders the real product screen', () => {
  expect(source('state-overview-screens.tsx')).toMatch(/import\s*\{[^}]*\bProduct\b[^}]*\}\s*from\s*'\.\/product'/);
});

test('the product screen keeps neither the sample menu nor the state it presents', () => {
  const product = source('product.tsx');
  expect(product).not.toContain('樣張狀態');
  // 區分大小寫：<Select 是表單元件，<select 才是選單。
  expect(product).not.toContain('<select');
  expect(product).not.toMatch(/useState(?:<[^>]*>)?\(\s*(?:state\b|['"](?:success|loading|empty|error)['"])/);
});

// 色值來源是 §5.4 的色票表。
const palette = {
  vibrant: { light: '#147F82', dark: '#64C2BC' },
  professional: { light: '#625C83', dark: '#ABA4D7' },
} as const;
const modeKey = 'luca-style-mode';

async function expectAllCellsThemed(page: Page, suite: keyof typeof palette, mode: 'light' | 'dark') {
  for (const state of states) {
    const root = screen(page, state).locator('html');
    await expect(root, state).toHaveAttribute('data-suite', suite);
    await expect(root, state).toHaveAttribute('data-mode', mode);
    await expect(root, state).toHaveCSS('--accent', palette[suite][mode]);
    await expect(root, state).toHaveCSS('background-color', cssRgb(neutralValues.bg[mode]));
  }
}

test('switching the style suite changes all four cells together', async ({ page }) => {
  await page.goto(overview);
  await expectAllCellsThemed(page, 'vibrant', 'light');
  await page.getByLabel('風格套系').selectOption('professional');
  await expectAllCellsThemed(page, 'professional', 'light');
});

test('switching the color mode changes all four cells together', async ({ page }) => {
  await page.goto(overview);
  await page.getByLabel('明暗模式').selectOption('dark');
  await expectAllCellsThemed(page, 'vibrant', 'dark');
  await page.getByLabel('風格套系').selectOption('professional');
  await expectAllCellsThemed(page, 'professional', 'dark');
});

test('a stored dark preference does not leak into a cell asked to be light', async ({ page }) => {
  await page.goto('/templates/product');
  await page.evaluate(key => localStorage.setItem(key, 'dark'), modeKey);
  await page.goto(overview);
  // 等 iframe 顯示後再查，只看到中途的日間不算數。
  for (const state of states) await expect(cell(page, state).locator('iframe')).toBeVisible();
  await expectAllCellsThemed(page, 'vibrant', 'light');
});

const storedMode = (page: Page) => page.evaluate(key => localStorage.getItem(key), modeKey);

test('switching on the overview keeps a stored dark preference for other pages', async ({ page }) => {
  await page.goto('/templates/product');
  await page.evaluate(key => localStorage.setItem(key, 'dark'), modeKey);
  await page.goto(overview);
  await page.getByLabel('明暗模式').selectOption('dark');
  await expectAllCellsThemed(page, 'vibrant', 'dark');
  expect(await storedMode(page)).toBe('dark');
  await page.getByLabel('明暗模式').selectOption('light');
  await expectAllCellsThemed(page, 'vibrant', 'light');
  expect(await storedMode(page)).toBe('dark');
  await page.getByLabel('風格套系').selectOption('professional');
  await expectAllCellsThemed(page, 'professional', 'light');
  expect(await storedMode(page)).toBe('dark');
  await page.goto('/templates/product');
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-suite', 'vibrant');
});

test('switching on the overview stores nothing when no preference exists', async ({ page }) => {
  await page.goto(overview);
  await page.getByLabel('明暗模式').selectOption('dark');
  await expectAllCellsThemed(page, 'vibrant', 'dark');
  expect(await storedMode(page)).toBeNull();
  await page.getByLabel('風格套系').selectOption('professional');
  await expectAllCellsThemed(page, 'professional', 'dark');
  expect(await storedMode(page)).toBeNull();
  await page.goto('/templates/product');
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'light');
  await expect(page.locator('html')).toHaveAttribute('data-suite', 'vibrant');
});

const columnCount = (element: Locator) => element.evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length);
const widthChoices = [{ value: 'desktop', pixels: 1280 }, { value: 'mobile', pixels: 390 }] as const;

test('switching the width lays every cell out at that width like the real page', async ({ page }) => {
  // 對照組是 /templates/product 在同樣視窗寬度下的欄數。
  const real = new Map<number, { layout: number; metrics: number }>();
  for (const { pixels } of widthChoices) {
    await page.setViewportSize({ width: pixels, height: 1000 });
    await page.goto('/templates/product');
    real.set(pixels, { layout: await columnCount(page.locator('.product-layout')), metrics: await columnCount(page.locator('.product-metrics')) });
  }
  expect(real.get(1280)).toEqual({ layout: 2, metrics: 3 });
  expect(real.get(390)).toEqual({ layout: 1, metrics: 1 });

  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(overview);
  // 寬度只改 iframe 大小，不重新載入；重新載入的話這個記號會消失。
  for (const state of states) await screen(page, state).locator('html').evaluate(root => { root.dataset.kept = 'yes'; });
  for (const { value, pixels } of widthChoices) {
    await page.getByLabel('寬度').selectOption(value);
    for (const state of states) {
      await expect(screen(page, state).locator('html'), state).toHaveAttribute('data-kept', 'yes');
      await expect.poll(() => screen(page, state).locator('html').evaluate(() => window.innerWidth), state).toBe(pixels);
      await expect.poll(() => columnCount(screen(page, state).locator('.product-layout')), state).toBe(real.get(pixels)!.layout);
    }
    await expect.poll(() => columnCount(screen(page, 'Success').locator('.product-metrics'))).toBe(real.get(pixels)!.metrics);
  }
});

// 格內視窗要剛好等於內容高度：多了是留白，少了是裁切。
async function expectNoCellCropped(page: Page) {
  for (const state of states) {
    await expect.poll(async () => {
      const fit = await screen(page, state).locator('html').evaluate(() => {
        const root = document.getElementById('root')!.getBoundingClientRect().height;
        const html = document.documentElement;
        return Math.abs(root - window.innerHeight) <= 1 && html.scrollHeight <= window.innerHeight + 1 && html.scrollWidth <= window.innerWidth + 1;
      });
      const frame = (await cell(page, state).locator('iframe').boundingBox())!;
      const owner = (await cell(page, state).boundingBox())!;
      return fit && frame.width > 0 && frame.height > 0 && frame.x >= owner.x - 1 && frame.y >= owner.y - 1
        && frame.x + frame.width <= owner.x + owner.width + 1 && frame.y + frame.height <= owner.y + owner.height + 1;
    }, state).toBe(true);
  }
}

// 比例太小時同樣不溢出，所以要看格子是否填滿容器。
async function expectRowFilled(page: Page, names: readonly string[]) {
  const rowWidth = await cellRow(page).evaluate(node => node.clientWidth);
  await expect.poll(async () => {
    const [first, last] = await Promise.all([names[0], names[names.length - 1]].map(async name => (await cell(page, name).boundingBox())!));
    return Math.abs(last.x + last.width - first.x - rowWidth);
  }).toBeLessThanOrEqual(2);
}

test('no cell is cropped after each width switch', async ({ page }) => {
  await page.goto(overview);
  await expectNoCellCropped(page);
  for (const value of ['mobile', 'desktop']) {
    await page.getByLabel('寬度').selectOption(value);
    await expectNoCellCropped(page);
  }
});

test('the four cells stay in one row without overlap and fill it at both widths', async ({ page }) => {
  await page.goto(overview);
  for (const { value, pixels } of widthChoices) {
    await page.getByLabel('寬度').selectOption(value);
    for (const state of states) await expect(screen(page, state).locator('.product-page')).toBeVisible();
    await expectCellsInOneRow(page, states);
    const frame = (await cell(page, 'Success').locator('iframe').boundingBox())!;
    const overflow = await cellRow(page).evaluate(node => node.scrollWidth - node.clientWidth);
    expect(frame.width).toBeLessThan(pixels);
    expect(overflow).toBeLessThanOrEqual(0);
    const last = (await cell(page, 'Success').boundingBox())!;
    expect(last.x + last.width).toBeLessThanOrEqual(1280);
    await expectRowFilled(page, states);
  }
});

// 並排只有縮小一種（docs/decision-log.md 2026-11-01），舊的 layout 參數不再有作用。
for (const url of [overview, `${overview}?layout=scroll`]) {
  test(`${url} shrinks the four cells to fit the window`, async ({ page }) => {
    await page.goto(url);
    await expect(screen(page, 'Success').locator('.product-page')).toBeVisible();
    expect((await cell(page, 'Success').locator('iframe').boundingBox())!.width).toBeLessThan(1280);
    expect(await cellRow(page).evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(0);
    const last = (await cell(page, 'Success').boundingBox())!;
    expect(last.x + last.width).toBeLessThanOrEqual(1280);
    await expectRowFilled(page, states);
  });
}

test('a frame url with an unknown state renders no screen', async ({ page }) => {
  const reported = page.waitForEvent('console', message => message.text().includes('格內網址缺少可呈現的畫面或狀態'));
  await page.goto(`${overview}/frame?screen=/templates/product&state=unknown`);
  await reported;
  await expect(page.locator('.product-page')).toHaveCount(0);
});

// §5.3.7 的 Loading、Empty、Error：以 page.route 擋住或改寫請求來製造，頁面不留測試用參數。
const loadingHint = '此格載入中';
const failureCopy = '此格無法呈現';
const gate = () => {
  let open = () => {};
  const opened = new Promise<void>(resolve => { open = resolve; });
  return { open, opened };
};
const isFrameDocument = (state: string) => (url: URL) => url.pathname.endsWith('/dev/state-overview/frame') && url.searchParams.get('state') === state;
const fromFrame = (request: Request, state: string) => request.frame().url().includes(`state=${state}`);
const frameModule = '**/src/state-overview-frame.tsx*';
// 要在載入提示或失敗文案出現之後才呼叫，否則那格的連結本來就還沒出現，檢查會太早通過。
async function expectOnlyOthersLinked(page: Page, without: string) {
  await expect(cell(page, without).getByRole('link')).toHaveCount(0);
  for (const state of states.filter(other => other !== without)) await expect(actualSizeLink(page, state)).toBeVisible();
}
const others = (state: string) => states.filter(other => other.toLowerCase() !== state);

test('a cell still loading shows a hint until the frame reports ready, not until its document loads', async ({ page }) => {
  const documentGate = gate();
  const moduleGate = gate();
  await page.route(isFrameDocument('empty'), async route => { await documentGate.opened; await route.fallback(); });
  await page.route(frameModule, async route => {
    if (fromFrame(route.request(), 'empty')) await moduleGate.opened;
    await route.fallback();
  });
  await page.goto(overview, { waitUntil: 'commit' });

  const held = cell(page, 'Empty');
  const expectStillLoading = async () => {
    await expect(held.getByText(loadingHint)).toBeVisible();
    await expect(held.locator('iframe')).toBeHidden();
    for (const state of others('empty')) await expect(screen(page, state).locator('.product-page')).toBeVisible();
    await expectOnlyOthersLinked(page, 'Empty');
    for (const label of ['風格套系', '明暗模式', '寬度']) await expect(page.getByLabel(label)).toBeEnabled();
  };
  await expectStillLoading();

  documentGate.open();
  await expect.poll(async () => {
    const frame = page.frames().find(item => item.url().includes('state=empty'));
    return frame ? frame.evaluate(() => document.readyState).catch(() => 'navigating') : 'missing';
  }).toBe('complete');
  await expectStillLoading();

  moduleGate.open();
  await expect(screen(page, 'Empty').locator('.product-page')).toBeVisible();
  await expect(held.getByText(loadingHint)).toHaveCount(0);
  await expect(actualSizeLink(page, 'Empty')).toBeVisible();
});

test('a cell shows the hint again while it remounts after a theme switch', async ({ page }) => {
  await page.goto(overview);
  for (const state of states) await expect(screen(page, state).locator('.product-page')).toBeVisible();
  const moduleGate = gate();
  await page.route(frameModule, async route => {
    if (fromFrame(route.request(), 'success')) await moduleGate.opened;
    await route.fallback();
  });
  await page.getByLabel('明暗模式').selectOption('dark');
  await expect(cell(page, 'Success').getByText(loadingHint)).toBeVisible();
  await expect(cell(page, 'Success').locator('iframe')).toBeHidden();
  await expect(screen(page, 'Loading').locator('html')).toHaveAttribute('data-mode', 'dark');
  moduleGate.open();
  await expect(screen(page, 'Success').locator('html')).toHaveAttribute('data-mode', 'dark');
  await expect(cell(page, 'Success').getByText(loadingHint)).toHaveCount(0);
});

test('a cell that reports ready after timing out shows its screen and gains its link', async ({ page }) => {
  await page.clock.install();
  const moduleGate = gate();
  await page.route(frameModule, async route => {
    if (fromFrame(route.request(), 'empty')) await moduleGate.opened;
    await route.fallback();
  });
  await page.goto(overview);
  await expect(cell(page, 'Empty').getByText(loadingHint)).toBeVisible();
  await page.clock.fastForward(60_000);
  await expect(cell(page, 'Empty').getByText(failureCopy)).toBeVisible();
  await expectOnlyOthersLinked(page, 'Empty');
  moduleGate.open();
  await expect(screen(page, 'Empty').locator('.product-page')).toBeVisible();
  await expect(cell(page, 'Empty').getByText(failureCopy)).toHaveCount(0);
  await expect(actualSizeLink(page, 'Empty')).toBeVisible();
});

test('with no screen included the page says there is nothing to review', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/src/state-overview-screens.tsx*', route => route.fulfill({ contentType: 'text/javascript', body: 'export const overviewScreens=[];' }));
  await page.goto(overview);
  await expect(page.getByText('此頁沒有可審的畫面')).toBeVisible();
  for (const state of states) await expect(cell(page, state)).toHaveCount(0);
  expect(errors).toEqual([]);
});

async function expectOtherCellsKeepWorking(page: Page, broken: string) {
  for (const state of others(broken)) await expect(screen(page, state).locator('.product-page')).toBeVisible();
  await page.getByLabel('明暗模式').selectOption('dark');
  for (const state of others(broken)) await expect(screen(page, state).locator('html')).toHaveAttribute('data-mode', 'dark');
  await page.getByLabel('風格套系').selectOption('professional');
  for (const state of others(broken)) await expect(screen(page, state).locator('html')).toHaveAttribute('data-suite', 'professional');
  await page.getByLabel('寬度').selectOption('mobile');
  for (const state of others(broken)) await expect.poll(() => screen(page, state).locator('html').evaluate(() => window.innerWidth), state).toBe(390);
}

test('a cell whose screen throws explains the failure and the rest keep working', async ({ page }) => {
  // 只有 Empty 那格拿到會丟例外的畫面；保留兩個匯出，main.tsx 其他匯入才不會壞。
  await page.route('**/src/product.tsx*', async route => {
    if (fromFrame(route.request(), 'empty')) await route.fulfill({ contentType: 'text/javascript', body: 'export function Product(){throw new Error("故意失敗");}\nexport function ProductSamples(){return null;}' });
    else await route.fallback();
  });
  await page.goto(overview);
  await expect(cell(page, 'Empty').getByText(failureCopy)).toBeVisible();
  await expect(cell(page, 'Empty').locator('iframe')).toBeHidden();
  await expectOnlyOthersLinked(page, 'Empty');
  await expectOtherCellsKeepWorking(page, 'empty');
  await expect(cell(page, 'Empty').getByText(failureCopy)).toBeVisible();
});

test('a cell whose document never arrives times out into the failure message and the rest keep working', async ({ page }) => {
  await page.clock.install();
  await page.route(isFrameDocument('empty'), route => route.abort());
  await page.goto(overview);
  for (const state of others('empty')) await expect(screen(page, state).locator('.product-page')).toBeVisible();
  await expect(cell(page, 'Empty').getByText(loadingHint)).toBeVisible();
  await page.clock.fastForward(60_000);
  await expect(cell(page, 'Empty').getByText(failureCopy)).toBeVisible();
  await expectOnlyOthersLinked(page, 'Empty');
  await expectOtherCellsKeepWorking(page, 'empty');
  await page.clock.fastForward(60_000);
  await expect(cell(page, 'Empty').getByText(failureCopy)).toBeVisible();
});

// 兩個版面方向（PR-REVIEW-07）：假方向只存在這裡，用 page.route 改寫模組，所以不會留在 /templates/product，也進不了正式建置。
// 附加的文字在 Vite 轉換之後才接上：要以換行開頭（結尾是沒有換行的 sourceMappingURL），也只能寫純 JS。方向甲就是真正的 Product。
const secondRender = 'state=>`方向乙的 ${state}`';
const withTwoDirections = (target: Page | BrowserContext, render = secondRender) => target.route('**/src/state-overview-screens.tsx*', async route => {
  const response = await route.fetch();
  const body = `${await response.text()}\noverviewScreens[0].directions=[{...overviewScreens[0].directions[0],name:'方向甲'},{name:'方向乙',render:${render}}];`;
  await route.fulfill({ response, body });
});
const compared = ['方向甲 · Success', '方向乙 · Success'];
const cellRow = (page: Page) => page.locator('.state-overview-cells');
const frameParams = async (frame: Locator) => new URL((await frame.getAttribute('src'))!, 'http://localhost').searchParams;

async function expectCellsInOneRow(page: Page, names: readonly string[]) {
  const boxes = await Promise.all(names.map(async name => (await cell(page, name).boundingBox())!));
  for (let i = 0; i < boxes.length - 1; i++) {
    expect(boxes[i + 1].y).toBe(boxes[i].y);
    expect(boxes[i].x + boxes[i].width).toBeLessThanOrEqual(boxes[i + 1].x);
  }
}

test('a screen with two directions first compares only their Success side by side', async ({ page }) => {
  await withTwoDirections(page);
  await page.goto(overview);
  await expect(screen(page, compared[0]).getByRole('region', { name: '摘要資訊' })).toBeVisible();
  await expect(screen(page, compared[1]).getByText('方向乙的 success')).toBeVisible();
  await expect(cellRow(page).locator('.state-overview-cell')).toHaveCount(2);
  await expect(page.locator('iframe')).toHaveCount(2);
  for (const state of states) await expect(cell(page, state)).toHaveCount(0);
  const directions = [];
  for (const name of compared) {
    const params = await frameParams(cell(page, name).locator('iframe'));
    expect(params.get('state'), name).toBe('success');
    directions.push(params.get('direction'));
  }
  expect(directions).toEqual(['方向甲', '方向乙']);
  await expectCellsInOneRow(page, compared);
});

const choose = (page: Page, name: string) => page.getByRole('button', { name: `選定 ${name}`, exact: true }).click();
const directionChecks = {
  方向甲: {
    Loading: (frame: FrameLocator) => expect(frame.getByRole('status').first()).toContainText('產品資料載入中'),
    Empty: (frame: FrameLocator) => expect(frame.getByRole('status').first()).toContainText('目前尚無產品資料'),
    Error: (frame: FrameLocator) => expect(frame.getByRole('alert')).toContainText('產品資料載入失敗'),
    Success: (frame: FrameLocator) => expect(frame.getByRole('region', { name: '摘要資訊' })).toBeVisible(),
  },
  方向乙: {
    Loading: (frame: FrameLocator) => expect(frame.getByText('方向乙的 loading', { exact: true })).toBeVisible(),
    Empty: (frame: FrameLocator) => expect(frame.getByText('方向乙的 empty', { exact: true })).toBeVisible(),
    Error: (frame: FrameLocator) => expect(frame.getByText('方向乙的 error', { exact: true })).toBeVisible(),
    Success: (frame: FrameLocator) => expect(frame.getByText('方向乙的 success', { exact: true })).toBeVisible(),
  },
} as const;
type DirectionName = keyof typeof directionChecks;

async function expectFourStatesOf(page: Page, name: DirectionName) {
  await expect(page.locator('iframe')).toHaveCount(4);
  for (const state of states) {
    await directionChecks[name][state](screen(page, state));
    const params = await frameParams(cell(page, state).locator('iframe'));
    expect(params.get('direction'), state).toBe(name);
    expect(params.get('state'), state).toBe(state.toLowerCase());
    if (name === '方向甲') await expect(screen(page, state).getByText(/方向乙的/)).toHaveCount(0);
    else await expect(screen(page, state).locator('.product-page')).toHaveCount(0);
  }
  await expect(page.locator('h1')).toHaveText(`狀態總覽頁 · /templates/product · ${name}`);
  for (const label of compared) await expect(cell(page, label)).toHaveCount(0);
}

for (const name of ['方向甲', '方向乙'] as const) {
  test(`choosing ${name} shows that direction's four states side by side`, async ({ page }) => {
    await withTwoDirections(page);
    await page.goto(overview);
    await expect(page.locator('iframe')).toHaveCount(2);
    await choose(page, name);
    await expectFourStatesOf(page, name);
    await expectCellsInOneRow(page, states);
  });
}

test('two compared cells and the chosen four cells both fit in the row', async ({ page }) => {
  await withTwoDirections(page);
  await page.goto(overview);
  const overflow = () => cellRow(page).evaluate(node => node.scrollWidth - node.clientWidth);
  const frameWidth = async (name: string) => (await cell(page, name).locator('iframe').boundingBox())!.width;
  await directionChecks.方向乙.Success(screen(page, compared[1]));
  for (const { value, pixels } of widthChoices) {
    await page.getByLabel('寬度').selectOption(value);
    await directionChecks.方向甲.Success(screen(page, compared[0]));
    // 手機兩格放得下，比例就是 1。
    if (value === 'mobile') for (const name of compared) await expect.poll(() => frameWidth(name), name).toBeCloseTo(pixels, 0);
    expect(await overflow()).toBeLessThanOrEqual(0);
    // 比例還用四格算的話，兩格很小也不溢出。
    if (value === 'desktop') await expectRowFilled(page, compared);
    await expectCellsInOneRow(page, compared);
  }
  await choose(page, '方向甲');
  // 選定時寬度沒變，比例也要跟著格數重算，所以先驗一次再切換寬度。
  for (const state of states) await expect(screen(page, state).locator('.product-page')).toBeVisible();
  await expect.poll(async () => (await overflow()) <= 0).toBe(true);
  await expectRowFilled(page, states);
  for (const { value, pixels } of widthChoices) {
    await page.getByLabel('寬度').selectOption(value);
    for (const state of states) await expect(screen(page, state).locator('.product-page')).toBeVisible();
    await expect.poll(async () => (await overflow()) <= 0).toBe(true);
    await expectRowFilled(page, states);
    expect(await frameWidth('Success')).toBeLessThan(pixels);
    const last = (await cell(page, 'Success').boundingBox())!;
    expect(last.x + last.width).toBeLessThanOrEqual(1280);
    await expectCellsInOneRow(page, states);
  }
});

test('the controls change both compared cells and keep the chosen direction afterwards', async ({ page }) => {
  await withTwoDirections(page);
  await page.goto(overview);
  const expectAll = async (names: readonly string[], attribute: string, value: string) => {
    for (const name of names) await expect(screen(page, name).locator('html'), name).toHaveAttribute(attribute, value);
  };
  await page.getByLabel('風格套系').selectOption('professional');
  await expectAll(compared, 'data-suite', 'professional');
  await page.getByLabel('明暗模式').selectOption('dark');
  await expectAll(compared, 'data-mode', 'dark');
  await page.getByLabel('寬度').selectOption('mobile');
  for (const name of compared) await expect.poll(() => screen(page, name).locator('html').evaluate(() => window.innerWidth), name).toBe(390);
  expect(await storedMode(page)).toBeNull();

  await choose(page, '方向乙');
  await expectFourStatesOf(page, '方向乙');
  await expectAllCellsThemed(page, 'professional', 'dark');
  await page.getByLabel('明暗模式').selectOption('light');
  await expectAllCellsThemed(page, 'professional', 'light');
  await page.getByLabel('風格套系').selectOption('vibrant');
  await expectAllCellsThemed(page, 'vibrant', 'light');
  await page.getByLabel('寬度').selectOption('desktop');
  for (const state of states) await expect.poll(() => screen(page, state).locator('html').evaluate(() => window.innerWidth), state).toBe(1280);
  await expectFourStatesOf(page, '方向乙');
  expect(await storedMode(page)).toBeNull();
});

test('a direction that cannot render explains the failure in its cell and the other keeps working', async ({ page }) => {
  await withTwoDirections(page, '()=>{throw new Error("故意失敗")}');
  await page.goto(overview);
  await expect(cell(page, compared[1]).getByText(failureCopy)).toBeVisible();
  await expect(cell(page, compared[1]).locator('iframe')).toBeHidden();
  await directionChecks.方向甲.Success(screen(page, compared[0]));
  await page.getByLabel('明暗模式').selectOption('dark');
  await expect(screen(page, compared[0]).locator('html')).toHaveAttribute('data-mode', 'dark');
  await page.getByLabel('風格套系').selectOption('professional');
  await expect(screen(page, compared[0]).locator('html')).toHaveAttribute('data-suite', 'professional');
  await page.getByLabel('寬度').selectOption('mobile');
  await expect.poll(() => screen(page, compared[0]).locator('html').evaluate(() => window.innerWidth)).toBe(390);
});

test('a frame url picks the named direction of a two-direction screen', async ({ page }) => {
  await withTwoDirections(page);
  await page.goto(`${overview}/frame?screen=/templates/product&state=empty&direction=方向乙`);
  await expect(page.getByText('方向乙的 empty', { exact: true })).toBeVisible();
  await expect(page.locator('.product-page')).toHaveCount(0);
});

for (const [label, query] of [['an unknown', '&direction=方向丙'], ['no', '']]) {
  test(`a frame url naming ${label} direction of a two-direction screen renders no screen`, async ({ page }) => {
    await withTwoDirections(page);
    const reported = page.waitForEvent('console', message => message.text().includes('格內網址缺少可呈現的畫面或狀態'));
    await page.goto(`${overview}/frame?screen=/templates/product&state=success${query}`);
    await reported;
    await expect(page.locator('.product-page')).toHaveCount(0);
    await expect(page.getByText(/方向乙的/)).toHaveCount(0);
  });
}

test('a screen with one direction opens on its four states with nothing about directions', async ({ page }) => {
  await page.goto(overview);
  await expect(cellRow(page).locator('.state-overview-cell')).toHaveCount(4);
  await expect(page.locator('iframe')).toHaveCount(4);
  await expect(page.getByRole('button', { name: /選定/ })).toHaveCount(0);
  await expect(page.locator('h1')).toHaveText('狀態總覽頁 · /templates/product');
  await expect(page.locator('main.state-overview > *')).toHaveCount(3);
  for (const state of states) {
    const params = await frameParams(cell(page, state).locator('iframe'));
    expect([...params.keys()].sort(), state).toEqual(['mode', 'screen', 'state', 'suite']);
  }
});

// 「開原尺寸」連結開新分頁：page.route 與 page.setViewportSize 都帶不到新分頁，要用 context 層級的設定。
const actualSizeLink = (page: Page, name: string) => cell(page, name).getByRole('link', { name: `開原尺寸 · ${name}`, exact: true });

async function openActualSize(page: Page, name: string) {
  // rel="noopener" 下 popup 不一定觸發，所以從 context 接新分頁。
  const opened = page.context().waitForEvent('page');
  await actualSizeLink(page, name).click();
  return opened;
}

// 計算樣式看不到 CSS transform，所以要比 iframe 的框，再和格內視窗對照，才證明沒有縮放。
async function expectActualWidth(tab: Page, pixels: number) {
  const frame = tab.locator('iframe');
  await expect(frame).toHaveCount(1);
  await expect(frame).toBeVisible();
  const inner = await tab.frameLocator('iframe').locator('html').evaluate(() => window.innerWidth);
  const box = (await frame.boundingBox())!;
  expect(inner).toBe(pixels);
  expect(box.width).toBeCloseTo(pixels, 0);
}

test('each ready cell links to that same cell at its actual desktop size', async ({ page }) => {
  await page.goto(overview);
  for (const state of states) {
    const expected = await productText(screen(page, state));
    const tab = await openActualSize(page, state);
    await expectActualWidth(tab, 1280);
    const root = tab.frameLocator('iframe').locator('html');
    await expect(root, state).toHaveAttribute('data-suite', 'vibrant');
    await expect(root, state).toHaveAttribute('data-mode', 'light');
    expect(await productText(tab.frameLocator('iframe')), state).toBe(expected);
    await tab.close();
  }
});

test('each cell has one link named after it', async ({ page }) => {
  await page.goto(overview);
  for (const state of states) {
    await expect(actualSizeLink(page, state)).toHaveText('開原尺寸');
    await expect(cell(page, state).getByRole('link')).toHaveCount(1);
  }
});

test('a mobile link keeps the mobile layout in a desktop window', async ({ page }) => {
  await page.goto(overview);
  await page.getByLabel('寬度').selectOption('mobile');
  for (const state of states) {
    const tab = await openActualSize(page, state);
    await expectActualWidth(tab, 390);
    expect(await tab.evaluate(() => window.innerWidth), state).toBe(1280);
    expect(await columnCount(tab.frameLocator('iframe').locator('.product-layout')), state).toBe(1);
    if (state === 'Success') expect(await columnCount(tab.frameLocator('iframe').locator('.product-metrics'))).toBe(1);
    await tab.close();
  }
});

test.describe('in a window narrower than the desktop width', () => {
  test.use({ viewport: { width: 800, height: 800 } });

  test('a desktop link keeps the desktop layout and the tab scrolls sideways', async ({ page }) => {
    await page.goto(overview);
    const tab = await openActualSize(page, 'Success');
    await expectActualWidth(tab, 1280);
    expect(await columnCount(tab.frameLocator('iframe').locator('.product-layout'))).toBe(2);
    expect(await tab.evaluate(() => { window.scrollTo(99_999, 0); return { window: window.innerWidth, scrolled: window.scrollX > 0 }; })).toEqual({ window: 800, scrolled: true });
  });
});

test('a link follows the chosen theme and width without reloading its cell', async ({ page }) => {
  await page.goto(overview);
  await page.getByLabel('風格套系').selectOption('professional');
  await page.getByLabel('明暗模式').selectOption('dark');
  await expectAllCellsThemed(page, 'professional', 'dark');
  await screen(page, 'Empty').locator('html').evaluate(root => { root.dataset.kept = 'yes'; });
  for (const { value, pixels } of widthChoices) {
    await page.getByLabel('寬度').selectOption(value);
    const tab = await openActualSize(page, 'Empty');
    await expectActualWidth(tab, pixels);
    const root = tab.frameLocator('iframe').locator('html');
    await expect(root).toHaveAttribute('data-suite', 'professional');
    await expect(root).toHaveAttribute('data-mode', 'dark');
    await expect(root).toHaveCSS('--accent', palette.professional.dark);
    await tab.close();
  }
  await expect(screen(page, 'Empty').locator('html')).toHaveAttribute('data-kept', 'yes');
});

test('links open their own direction while comparing and after choosing', async ({ page, context }) => {
  await withTwoDirections(context);
  await page.goto(overview);
  for (const name of compared) await expect(cell(page, name).getByRole('link')).toHaveCount(1);
  const second = await openActualSize(page, compared[1]);
  await directionChecks.方向乙.Success(second.frameLocator('iframe'));
  await expect(second.frameLocator('iframe').locator('.product-page')).toHaveCount(0);
  await second.close();
  const first = await openActualSize(page, compared[0]);
  await directionChecks.方向甲.Success(first.frameLocator('iframe'));
  await expect(first.frameLocator('iframe').getByText(/方向乙的/)).toHaveCount(0);
  await first.close();
  await choose(page, '方向乙');
  for (const state of states) {
    const tab = await openActualSize(page, state);
    await directionChecks.方向乙[state](tab.frameLocator('iframe'));
    await tab.close();
  }
});

test('the single-cell view shows that cell alone and raises no errors', async ({ page, context }) => {
  const problems: string[] = [];
  context.on('weberror', error => problems.push(`weberror ${error.error().message}`));
  context.on('console', message => { if (message.type() === 'error') problems.push(`console ${message.text()}`); });
  await page.goto(overview);
  const tab = await openActualSize(page, 'Success');
  await expect(tab.frameLocator('iframe').locator('.product-page')).toBeVisible();
  await tab.waitForLoadState('networkidle');
  for (const label of ['風格套系', '明暗模式', '寬度']) await expect(tab.getByLabel(label)).toHaveCount(0);
  await expect(tab.getByRole('link')).toHaveCount(0);
  await expect(tab.locator('.state-overview-cells')).toHaveCount(0);
  expect(problems).toEqual([]);
});

// cell 是 query 不是網址；encodeURIComponent 讓 # 和 & 留在 cell 裡，才真的驗到這個參數。
for (const value of ['https://example.com/', '//example.com', 'javascript:alert(1)', '../../templates/product', '#x', 'screen=https://example.com&state=empty', 'screen=/templates/product&state=unknown', '']) {
  test(`the single-cell view keeps cell value "${value}" on the frame route and explains the failure`, async ({ page }) => {
    const origin = new URL(test.info().project.use.baseURL!).origin;
    const foreign: string[] = [];
    page.on('request', request => { if (!request.url().startsWith('data:') && new URL(request.url()).origin !== origin) foreign.push(request.url()); });
    const url = `${overview}?cell=${encodeURIComponent(value)}`;
    await page.goto(url);
    await expect(page.getByText(failureCopy)).toBeVisible();
    // 只有這一格，所以不說「其他格」；空字串也不能退回整個總覽頁。
    await expect(page.getByText('其他格')).toHaveCount(0);
    await expect(page.locator('.state-overview-cells')).toHaveCount(0);
    const src = new URL((await page.locator('iframe').getAttribute('src'))!, origin);
    expect({ origin: src.origin, pathname: src.pathname }).toEqual({ origin, pathname: '/dev/state-overview/frame' });
    expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe(url);
    await expect(page.locator('iframe')).toBeHidden();
    await expect(page.frameLocator('iframe').locator('.product-page')).toHaveCount(0);
    expect(foreign).toEqual([]);
  });
}

test('the single-cell view treats an unknown width as desktop', async ({ page }) => {
  await page.goto(`${overview}?cell=${encodeURIComponent('screen=/templates/product&state=empty&suite=vibrant&mode=light')}&width=abc`);
  await expectActualWidth(page, 1280);
});

test('the single-cell view shows the loading hint until its frame reports ready', async ({ page, context }) => {
  await page.goto(overview);
  await expect(actualSizeLink(page, 'Success')).toBeVisible();
  const moduleGate = gate();
  await context.route(frameModule, async route => { await moduleGate.opened; await route.fallback(); });
  const tab = await openActualSize(page, 'Success');
  await expect(tab.getByText(loadingHint)).toBeVisible();
  await expect(tab.locator('iframe')).toBeHidden();
  moduleGate.open();
  await expect(tab.frameLocator('iframe').locator('.product-page')).toBeVisible();
  await expect(tab.getByText(loadingHint)).toHaveCount(0);
});

test('opening a link from a light cell keeps a stored dark preference', async ({ page }) => {
  await page.goto('/templates/product');
  await page.evaluate(key => localStorage.setItem(key, 'dark'), modeKey);
  await page.goto(overview);
  const tab = await openActualSize(page, 'Success');
  await expect(tab.locator('iframe')).toBeVisible();
  await expect(tab.frameLocator('iframe').locator('html')).toHaveAttribute('data-mode', 'light');
  expect(await storedMode(tab)).toBe('dark');
});

test('opening a link from a dark cell stores nothing when no preference exists', async ({ page }) => {
  await page.goto(overview);
  await page.getByLabel('明暗模式').selectOption('dark');
  await expectAllCellsThemed(page, 'vibrant', 'dark');
  const tab = await openActualSize(page, 'Success');
  await expect(tab.locator('iframe')).toBeVisible();
  await expect(tab.frameLocator('iframe').locator('html')).toHaveAttribute('data-mode', 'dark');
  expect(await storedMode(tab)).toBeNull();
});
