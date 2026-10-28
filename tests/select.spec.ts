import { test, expect, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile, rm } from 'node:fs/promises';
import type { SelectProps } from '../packages/react/src/controls.js';
import { deriveAccent } from '../packages/tokens/accent.js';
import { buildHarness, origin, serveHarness } from './theme-harness';
import { hexChannels, neutralsOf } from './tokens-helpers';

// ISSUE-009：Select 改用 Base UI 的自訂選單（PR-STYLE-39、PR-STYLE-40 的 Select 部分）。

// 編譯期相容檢查（PR-STYLE-40）：0.1.0 原生 select 的常用寫法仍可編譯；不再支援的屬性若又能編譯，
// npm run typecheck 會因 @ts-expect-error 未被用到而失敗。升級說明列出同一份清單。
const acceptsSelect = (props:SelectProps) => props;
acceptsSelect({label:'分類', id:'category', className:'wide', name:'category', value:'a', defaultValue:2, disabled:false, required:true, form:'plan', autoComplete:'off',
  helper:'說明', error:'錯誤', 'aria-describedby':'note', title:'提示', onFocus:() => undefined, onBlur:() => undefined,
  onChange:event => { const value:string = event.target.value; return value; }});
// @ts-expect-error 自訂選單不支援多選
acceptsSelect({label:'分類', multiple:true});
// @ts-expect-error 自訂選單沒有列高
acceptsSelect({label:'分類', size:4});
// @ts-expect-error 值只接受單一字串或數字，不再接受陣列
acceptsSelect({label:'分類', value:['a', 'b']});

test('@luca-style/react depends on @base-ui/react ^1.9 with react and react-dom 19 as peers', async () => {
  const manifest = JSON.parse(await readFile(new URL('../packages/react/package.json', import.meta.url), 'utf8'));
  expect(manifest.dependencies['@base-ui/react']).toMatch(/^\^1\.(9|[1-9]\d)\./);
  expect(manifest.peerDependencies).toEqual({ react:'^19.0.0', 'react-dom':'^19.0.0' });
});

test('clicking a Select opens a styled listbox and picking an option updates the field', async ({ page }) => {
  await page.goto('/components');
  const field = page.getByLabel('選單示例');
  await expect(field).toHaveText('精緻活力 · 潮汐');
  await field.click();
  const listbox = page.getByRole('listbox');
  await expect(listbox.getByRole('option')).toHaveText(['精緻活力 · 潮汐', '精緻專業 · 石墨紫', '自訂強調色', '舊版主題（不可選）']);
  await listbox.getByRole('option', { name:'精緻專業 · 石墨紫' }).click();
  await expect(listbox).toBeHidden();
  await expect(field).toHaveText('精緻專業 · 石墨紫');
});

// 把 CSS 變數解析成計算後的 rgb()；探針放在選單之外（樣張的 main、載具的主題容器），選單沒繼承到變數時比對才會不同。
const resolved = (page:Page, name:string, inside = 'main') => page.evaluate(([variable, selector]) => {
  const probe = document.createElement('div');
  probe.style.color = `var(${variable})`;
  document.querySelector(selector)!.append(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  return value;
}, [name, inside]);
const css = (locator:Locator, property:string) => locator.evaluate((element, name) => getComputedStyle(element).getPropertyValue(name), property);

test('the open popup matches C/Select/Open: field width, 4px below, 40px options, hover, selected and unavailable items', async ({ page }) => {
  await page.emulateMedia({ reducedMotion:'reduce' });
  await page.goto('/components');
  const field = page.getByLabel('選單示例');
  await field.click();
  const listbox = page.getByRole('listbox');
  await expect(listbox).toBeVisible();
  const fieldBox = (await field.boundingBox())!, popupBox = (await listbox.boundingBox())!;
  expect(Math.abs(popupBox.width - fieldBox.width)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(popupBox.x - fieldBox.x)).toBeLessThanOrEqual(0.5);
  expect(popupBox.y - (fieldBox.y + fieldBox.height)).toBeCloseTo(4, 0);
  for (const option of await listbox.getByRole('option').all()) expect((await option.boundingBox())!.height).toBe(40);

  const selected = listbox.getByRole('option', { name:'精緻活力 · 潮汐' });
  await expect(selected).toHaveAttribute('aria-selected', 'true');
  await expect(selected).toHaveCSS('background-color', await resolved(page, '--accent-soft'));
  expect(Number(await css(selected, 'font-weight'))).toBeGreaterThanOrEqual(600);
  // 不加打勾：選中項只有文字，沒有圖示或指示元素。
  expect(await selected.evaluate(element => [element.textContent, element.querySelectorAll('svg, img, [aria-hidden]').length])).toEqual(['精緻活力 · 潮汐', 0]);

  const hovered = listbox.getByRole('option', { name:'精緻專業 · 石墨紫' });
  await hovered.hover();
  await expect(hovered).toHaveCSS('background-color', await resolved(page, '--surface-subtle'));

  const unavailable = listbox.getByRole('option', { name:/舊版主題/ });
  await expect(unavailable).toHaveAttribute('aria-disabled', 'true');
  await expect(unavailable).toHaveText('舊版主題（不可選）');
  await expect(unavailable).toHaveCSS('color', await resolved(page, '--muted'));
  expect(await css(listbox, 'box-shadow')).not.toBe('none');
});

// 期望值抄自前端規格：柔和強調表面見 §5.5.2 的表，圓角見 §5.4.2（活力預設 rounded 16px、專業預設 sharp 3px）。
const accentSoft = { vibrant:{ light:'rgb(227, 242, 240)', dark:'rgb(23, 54, 55)' }, professional:{ light:'rgb(238, 237, 244)', dark:'rgb(45, 42, 59)' } } as const;
const controlRadius = { vibrant:'16px', professional:'3px' } as const;
for (const suite of ['vibrant', 'professional'] as const) {
  for (const mode of ['light', 'dark'] as const) {
    test(`${suite}/${mode}: popup, hover, selected and unavailable colours follow the suite and mode, with no serious axe findings while open`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion:'reduce' });
      await page.goto('/components');
      await page.getByLabel('風格套系').selectOption(suite);
      await page.getByLabel('明暗模式').selectOption(mode);
      await expect(page.locator('html')).toHaveCSS('color-scheme', mode);
      await page.getByLabel('選單示例').click();
      const listbox = page.getByRole('listbox');
      await expect(listbox).toBeVisible();
      await expect(listbox).toHaveCSS('background-color', await resolved(page, '--surface'));
      await expect(listbox).toHaveCSS('border-top-color', await resolved(page, '--border'));
      await expect(listbox).toHaveCSS('border-top-left-radius', controlRadius[suite]);
      expect(await css(listbox, 'box-shadow')).not.toBe('none');
      const selected = listbox.getByRole('option', { name:'精緻活力 · 潮汐' });
      await expect(selected).toHaveCSS('background-color', accentSoft[suite][mode]);
      await expect(selected).toHaveCSS('color', await resolved(page, '--text'));
      const hovered = listbox.getByRole('option', { name:'精緻專業 · 石墨紫' });
      await hovered.hover();
      await expect(hovered).toHaveCSS('background-color', await resolved(page, '--surface-subtle'));
      await expect(hovered).toHaveCSS('color', await resolved(page, '--text'));
      await expect(listbox.getByRole('option', { name:/舊版主題/ })).toHaveCSS('color', await resolved(page, '--muted'));
      // Base UI 開啟時在選單前後放 aria-hidden 的焦點守衛（tabindex=0，聚焦即轉回選單或欄位），axe 以 aria-hidden-focus 回報；
      // 這是函式庫的焦點圈定機制，不是內容，故排除，其餘整頁照常掃描。
      const { violations } = await new AxeBuilder({ page }).exclude('[data-base-ui-focus-guard]').analyze();
      expect(violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(' | ')}`)).toEqual([]);
    });
  }
}

test('keyboard opens, moves, selects and closes the Select, returning focus to the field with the double focus ring', async ({ page }) => {
  await page.emulateMedia({ reducedMotion:'reduce' });
  await page.goto('/components');
  const field = page.getByLabel('選單示例');
  const listbox = page.getByRole('listbox');
  const option = (name:string|RegExp) => listbox.getByRole('option', { name });
  // 以鍵盤移入焦點，欄位才會是 :focus-visible。
  await field.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(field).toBeFocused();
  for (const key of ['Enter', 'Space', 'ArrowDown', 'ArrowUp']) {
    await test.step(`${key} opens and Escape closes without changing the value`, async () => {
      await page.keyboard.press(key);
      await expect(listbox).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(listbox).toBeHidden();
      await expect(field).toHaveText('精緻活力 · 潮汐');
      await expect(field).toBeFocused();
    });
  }
  await test.step('after closing, the field shows the 2px surface inner ring and 2px focus-ring outer ring', async () => {
    const ring = await resolved(page, '--focus-ring'), surface = await resolved(page, '--surface');
    expect(await field.evaluate(node => node.matches(':focus-visible'))).toBe(true);
    await expect(field).toHaveCSS('outline', `${ring} solid 2px`);
    await expect(field).toHaveCSS('outline-offset', '2px');
    await expect(field).toHaveCSS('box-shadow', `${surface} 0px 0px 0px 2px`);
  });
  await test.step('arrow keys move through the options; the unavailable one can be reached and read but not chosen', async () => {
    await page.keyboard.press('Enter');
    await expect(option('精緻活力 · 潮汐')).toBeFocused();
    for (const name of ['精緻專業 · 石墨紫', '自訂強調色', /舊版主題/]) {
      await page.keyboard.press('ArrowDown');
      await expect(option(name)).toBeFocused();
    }
    // 不可選項照 WAI-ARIA 可被方向鍵讀到，但 Enter 不會選它，選單也不關。
    await page.keyboard.press('Enter');
    await expect(listbox).toBeVisible();
    await expect(option(/舊版主題/)).toHaveAttribute('aria-selected', 'false');
    for (const name of ['自訂強調色', '精緻專業 · 石墨紫']) {
      await page.keyboard.press('ArrowUp');
      await expect(option(name)).toBeFocused();
    }
  });
  await test.step('Enter selects the current option, closes the popup and returns focus to the field', async () => {
    await page.keyboard.press('Enter');
    await expect(listbox).toBeHidden();
    await expect(field).toHaveText('精緻專業 · 石墨紫');
    await expect(field).toBeFocused();
  });
});

// target="self" 時主題屬性與強調色變數只在 ThemeProvider 的外層 div 上；選單 portal 出去後仍須在這個容器裡。
test.describe('Select inside ThemeProvider target="self"', () => {
  let outDir:string;
  test.beforeAll(async () => { outDir = await buildHarness(); });
  test.afterAll(async () => { if (outDir) await rm(outDir, {recursive:true, force:true}); });
  const themeOf = (listbox:Locator) => listbox.evaluate(element => {
    const theme = element.closest('[data-luca-theme]');
    return theme && {suite:theme.getAttribute('data-suite'), mode:theme.getAttribute('data-mode'), provider:theme === document.querySelector('#root [data-luca-theme]')};
  });

  for (const suite of ['vibrant', 'professional'] as const) {
    for (const mode of ['light', 'dark'] as const) {
      test(`${suite}/${mode}: the popup opens inside the provider container and takes its colours and shape`, async ({ page }) => {
        await page.emulateMedia({ colorScheme:mode, reducedMotion:'reduce' });
        await serveHarness(page, outDir);
        await page.goto(`${origin}/?persist=0&accent=none&suite=${suite}`);
        await expect(page.getByLabel('目前明暗')).toHaveText(mode);
        await page.getByLabel('樣本選單').click();
        const listbox = page.getByRole('listbox');
        await expect(listbox).toBeVisible();
        expect(await themeOf(listbox)).toEqual({suite, mode, provider:true});
        await expect(listbox).toHaveCSS('background-color', await resolved(page, '--surface', '[data-luca-theme]'));
        await expect(listbox).toHaveCSS('border-top-left-radius', controlRadius[suite]);
        await expect(listbox.getByRole('option', { name:'精緻活力 · 潮汐' })).toHaveCSS('background-color', accentSoft[suite][mode]);
      });
    }
  }

  test('a shape override and a project accent on the container reach the popup', async ({ page }) => {
    const accent = {light:'#9A4C32'};
    await page.emulateMedia({ colorScheme:'light', reducedMotion:'reduce' });
    await serveHarness(page, outDir);
    await page.goto(`${origin}/?persist=0&suite=vibrant&shape=sharp&accent=${encodeURIComponent(JSON.stringify(accent))}`);
    await page.getByLabel('樣本選單').click();
    const listbox = page.getByRole('listbox');
    await expect(listbox).toHaveCSS('border-top-left-radius', '3px');
    const soft = deriveAccent(accent, 'light', await neutralsOf('light'))['accent-soft'];
    const rgb = `rgb(${hexChannels(soft).join(', ')})`;
    await expect(listbox.getByRole('option', { name:'精緻活力 · 潮汐' })).toHaveCSS('background-color', rgb);
  });

  test('0.1.0 props keep working: label, helper, error with aria-describedby, disabled, controlled value, option text as value and form name', async ({ page }) => {
    await serveHarness(page, outDir);
    await page.goto(`${origin}/?persist=0`);
    const form = page.getByRole('form', { name:'選單相容性' });
    const controlled = form.getByLabel('受控選單');
    await expect(controlled).toHaveText('每週');
    await expect(controlled).toHaveAccessibleDescription('每週寄一次摘要。');
    await controlled.click();
    await page.getByRole('option', { name:'每日' }).click();
    await expect(form.getByLabel('受控值')).toHaveText('daily');
    await expect(controlled).toHaveText('每日');
    const byText = form.getByLabel('文字當值');
    await expect(byText).toHaveText('個人計畫');
    await byText.click();
    await page.getByRole('option', { name:'團隊活動' }).click();
    const invalid = form.getByLabel('錯誤選單');
    await expect(invalid).toHaveAttribute('aria-invalid', 'true');
    await expect(invalid).toHaveAccessibleDescription('另有補充說明。 請選擇分類。');
    await expect(form.getByLabel('停用選單')).toBeDisabled();
    await form.getByRole('button', { name:'送出選單' }).click();
    expect(JSON.parse(await form.getByLabel('送出內容').innerText())).toEqual([['frequency', 'daily'], ['category', '團隊活動']]);
  });
});
