import { test, expect, type Locator, type Page } from '@playwright/test';
import { wcagContrast as contrast } from './tokens-helpers';

// PR-STYLE-46：所有共用元件的焦點框為雙圈——內圈 2px 主要表面色、外圈 2px 焦點框色（一般即主色）；
// 外圈與背景、主要表面、次級表面的對比至少 3:1。只看計算後的樣式，像素比對屬截圖基準。

// 解析後的 rgb() 取出 0–255 通道。
const channels = (color: string) => color.match(/[\d.]+/g)!.slice(0, 3).map(Number);

// 把 CSS 變數解析成計算後的 rgb()，用來和元件樣式比對。
async function resolved(page: Page, name: string) {
  return page.evaluate(variable => {
    const probe = document.createElement('div');
    probe.style.color = `var(${variable})`;
    document.querySelector('main')!.append(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  }, name);
}

const components: [string, (page: Page) => Locator][] = [
  ['primary button', page => page.getByRole('button', { name: '主要操作', exact: true })],
  ['secondary button', page => page.getByRole('button', { name: '次要操作', exact: true })],
  ['text field', page => page.getByLabel('預設欄位')],
  ['select', page => page.getByLabel('選單示例')],
  ['checkbox', page => page.getByLabel('接收更新通知')],
  ['navigation link', page => page.getByRole('navigation', { name: '範例導覽' }).getByRole('link', { name: '設計基礎' })],
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
          const element = locate(page);
          // 以鍵盤移入焦點，確保比對的是 :focus-visible 的樣式。
          await element.focus();
          await page.keyboard.press('Shift+Tab');
          await page.keyboard.press('Tab');
          const style = await element.evaluate(node => {
            const computed = getComputedStyle(node);
            return { focused: node.matches(':focus-visible'), outline: `${computed.outlineStyle} ${computed.outlineWidth} ${computed.outlineColor}`, offset: computed.outlineOffset, shadow: computed.boxShadow };
          });
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
