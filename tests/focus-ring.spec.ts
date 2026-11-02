import { test, expect, type Locator, type Page } from '@playwright/test';
import { rm } from 'node:fs/promises';
import { buildHarness, origin, serveHarness } from './theme-harness';
import { wcagContrast as contrast } from './tokens-helpers';

// PR-STYLE-46：所有共用元件的焦點框為雙圈——內圈 2px 主要表面色、外圈 2px 焦點框色（一般即主色）；
// 外圈與背景、主要表面、次級表面的對比至少 3:1。只看計算後的樣式，像素比對屬截圖基準。

// 解析後的 rgb() 取出 0–255 通道。
const channels = (color: string) => color.match(/[\d.]+/g)!.slice(0, 3).map(Number);

// 把 CSS 變數解析成計算後的 rgb()，用來和元件樣式比對。探針掛在 host 內，才吃得到該處主題的變數（測試載具沒有 <main>）。
async function resolved(page: Page, name: string, host = 'main') {
  return page.evaluate(([variable, selector]) => {
    const probe = document.createElement('div');
    probe.style.color = `var(${variable})`;
    document.querySelector(selector)!.append(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  }, [name, host]);
}

// 以鍵盤移入焦點，確保讀到的是 :focus-visible 的樣式。
async function focusRingOf(page: Page, element: Locator) {
  await element.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  return element.evaluate(node => {
    const computed = getComputedStyle(node);
    return { tag: node.tagName, focused: node.matches(':focus-visible'), outline: `${computed.outlineStyle} ${computed.outlineWidth} ${computed.outlineColor}`, offset: computed.outlineOffset, shadow: computed.boxShadow };
  });
}

const components: [string, (page: Page) => Locator][] = [
  ['primary button', page => page.getByRole('button', { name: '主要操作', exact: true })],
  ['secondary button', page => page.getByRole('button', { name: '次要操作', exact: true })],
  ['text field', page => page.getByLabel('預設欄位')],
  ['select', page => page.getByLabel('選單示例')],
  // 核取方塊是 Base UI 的 role=checkbox 節點；用角色定位，避免 getByLabel 落到旁邊隱藏的 input。
  ['checkbox', page => page.getByRole('checkbox', { name: '接收更新通知' })],
  ['navigation link', page => page.getByRole('navigation', { name: '範例導覽' }).getByRole('link', { name: '設計基礎' })],
  ['navigation brand link', page => page.getByRole('navigation', { name: '範例導覽' }).locator('.luca-brand')],
  ['content state retry button', page => page.getByRole('region', { name: '內容狀態' }).getByRole('button', { name: '重試', exact: true })],
  ['table region', page => page.getByRole('region', { name: '表格示例，可水平捲動' })],
];

for (const override of [false, true]) {
  for (const suite of ['vibrant', 'professional']) {
    for (const mode of ['light', 'dark']) {
      test(`${suite}/${mode}${override ? ' with project accent' : ''}: every component shows a 2px surface inner ring and a 2px focus-ring outer ring at 3:1`, async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto('/components');
        await page.getByLabel('風格套系').selectOption(suite);
        await page.getByLabel('明暗模式').selectOption(mode);
        if (override) await page.getByLabel('檢視專案強調色覆寫').check();
        await expect(page.locator('html')).toHaveCSS('color-scheme', mode);
        const ring = await resolved(page, '--focus-ring');
        const surface = await resolved(page, '--surface');
        const problems: string[] = [];
        for (const background of ['--bg', '--surface', '--surface-subtle']) {
          const ratio = contrast(channels(ring), channels(await resolved(page, background)));
          if (ratio < 3) problems.push(`focus-ring 對 ${background} 只有 ${ratio.toFixed(2)}`);
        }
        for (const [name, locate] of components) {
          const style = await focusRingOf(page, locate(page));
          if (!style.focused) problems.push(`${name}: 沒有 :focus-visible`);
          if (style.outline !== `solid 2px ${ring}`) problems.push(`${name}: 外圈 ${style.outline}，應為 solid 2px ${ring}`);
          if (style.offset !== '2px') problems.push(`${name}: outline-offset ${style.offset}，應為 2px`);
          if (style.shadow !== `${surface} 0px 0px 0px 2px`) problems.push(`${name}: 內圈 ${style.shadow}，應為 ${surface} 0px 0px 0px 2px`);
        }
        expect(problems).toEqual([]);
      });
    }
  }
}

// PR-STYLE-45：主按鈕滑過、按下的底色是推算出的 accent-hover、accent-pressed，不再用 brightness 濾鏡。
test('primary button uses accent-hover on hover and accent-pressed while pressed', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/components');
  const button = page.getByRole('button', { name: '移入或聚焦', exact: true });
  await button.hover();
  await expect(button).toHaveCSS('background-color', await resolved(page, '--accent-hover'));
  await expect(button).toHaveCSS('filter', 'none');
  await page.mouse.down();
  await expect(button).toHaveCSS('background-color', await resolved(page, '--accent-pressed'));
  await page.mouse.up();
});

// PR-STYLE-58：Button 渲染成連結時，焦點框同樣是雙圈。樣本在測試載具，從 @luca-style/react 匯入。
test.describe('Button rendered as a link on the test harness', () => {
  let outDir = '';
  test.beforeAll(async () => { outDir = await buildHarness(); });
  test.afterAll(async () => { if (outDir) await rm(outDir, { recursive: true, force: true }); });

  test('shows a 2px surface inner ring and a 2px focus-ring outer ring', async ({ page }) => {
    await serveHarness(page, outDir);
    await page.goto(`${origin}/?persist=0`);
    const samples = page.getByRole('region', { name: '連結樣本' });
    const host = '[aria-label="連結樣本"]';
    const [ring, surface] = [await resolved(page, '--focus-ring', host), await resolved(page, '--surface', host)];
    for (const name of ['元素連結', '函式連結']) {
      const style = await focusRingOf(page, samples.getByRole('link', { name }));
      expect(style).toEqual({ tag: 'A', focused: true, outline: `solid 2px ${ring}`, offset: '2px', shadow: `${surface} 0px 0px 0px 2px` });
    }
  });
});
