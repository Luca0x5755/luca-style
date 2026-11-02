import { test, expect, type Locator } from '@playwright/test';
import { rm } from 'node:fs/promises';
import { buildHarness, origin, serveHarness } from './theme-harness';

// 操作元件的實際高度（PR-STYLE-55、56）。期望值直接抄前端規格 §5.4.1 的表，不從 CSS 變數讀，變數被改時測試才會失敗。
const controlHeight = {
  vibrant:{ compact:40, standard:48, comfortable:56 },
  professional:{ compact:40, standard:48, comfortable:52 },
} as const;
const suites = ['vibrant', 'professional'] as const;
const densities = ['compact', 'standard', 'comfortable'] as const;
const shapes = ['rounded', 'sharp'] as const;
const combinations = suites.flatMap(suite => densities.flatMap(density => shapes.map(shape => ({ suite, density, shape, height:controlHeight[suite][density] }))));
const query = ({ suite, density, shape }:{ suite:string; density:string; shape:string }) => `${origin}/?persist=0&accent=none&samples=long&suite=${suite}&density=${density}&shape=${shape}`;

const heightOf = (element:Locator) => element.evaluate(node => node.getBoundingClientRect().height);
// 內容超出盒子時，scroll 尺寸會大於 client 尺寸。
const overflowOf = (element:Locator) => element.evaluate(node => ({ block:node.scrollHeight - node.clientHeight, inline:node.scrollWidth - node.clientWidth }));
const noOverflow = { block:0, inline:0 };
// 樣本容器的寬度：元件被長字串撐寬時，自己的 scroll 尺寸看不出來，要比外框。
const containerWidth = 160;
const widthOf = (element:Locator) => element.evaluate(node => node.getBoundingClientRect().width);
// 文字實際排成幾行：數選取範圍裡不同的行頂位置。
const lineCount = (element:Locator) => element.evaluate(node => {
  const range = document.createRange();
  range.selectNodeContents(node);
  return new Set([...range.getClientRects()].filter(rect => rect.width > 0).map(rect => Math.round(rect.top))).size;
});

test.describe('control height in the test harness', () => {
  let outDir = '';
  test.beforeAll(async () => { outDir = await buildHarness(); });
  test.afterAll(async () => { if (outDir) await rm(outDir, { recursive:true, force:true }); });

  for (const combination of combinations) {
    const { suite, density, shape, height } = combination;
    const name = `${suite}/${density}/${shape}`;

    test.describe(name, () => {
      test.beforeEach(async ({ page }) => {
        await serveHarness(page, outDir);
        await page.goto(query(combination));
      });

      test(`single-line Button, Select and TextField are ${height}px tall`, async ({ page }) => {
        const samples = page.getByRole('region', { name:'元件樣本' });
        const controls = {
          '主要按鈕':samples.getByRole('button', { name:'主要按鈕' }),
          '次要按鈕':samples.getByRole('button', { name:'次要按鈕' }),
          'Select':samples.getByLabel('樣本選單'),
          'TextField':samples.getByLabel('樣本欄位'),
        };
        const measured = Object.fromEntries(await Promise.all(Object.entries(controls).map(async ([control, element]) => [control, await heightOf(element)])));
        expect(measured).toEqual({ '主要按鈕':height, '次要按鈕':height, 'Select':height, 'TextField':height });
      });

      test('a Button with long text grows and keeps its text inside', async ({ page }) => {
        const button = page.getByRole('region', { name:'長文字樣本' }).getByRole('button', { name:/^這是一段很長的文字/ });
        expect(await heightOf(button)).toBeGreaterThan(height);
        expect(await lineCount(button)).toBeGreaterThanOrEqual(2);
        expect(await overflowOf(button)).toEqual(noOverflow);
        expect(await widthOf(button)).toBeLessThanOrEqual(containerWidth);
      });

      test('a Button in a tight flex row keeps a short label on one line', async ({ page }) => {
        const button = page.getByRole('button', { name:'Save' });
        expect(await heightOf(button)).toBe(height);
        expect(await lineCount(button)).toBe(1);
      });

      test('a Button with long text in a flex row stays inside the row', async ({ page }) => {
        const button = page.getByRole('region', { name:'窄 flex 列樣本' }).getByRole('button');
        expect(await heightOf(button)).toBeGreaterThan(height);
        expect(await widthOf(button)).toBeLessThanOrEqual(containerWidth);
        expect(await overflowOf(button)).toEqual(noOverflow);
      });

      test('a Select with a long value grows and keeps its text inside', async ({ page }) => {
        const select = page.getByLabel('長值選單');
        expect(await heightOf(select)).toBeGreaterThan(height);
        // 只數值的文字：欄位裡的圖示頂端和文字行不同，數整個欄位時單行也會得到 2。
        expect(await lineCount(select.locator('.luca-select-value'))).toBeGreaterThanOrEqual(2);
        expect(await overflowOf(select)).toEqual(noOverflow);
        expect(await widthOf(select)).toBeLessThanOrEqual(containerWidth);
      });

      test('an open Select grows long options only', async ({ page }) => {
        await page.getByLabel('長值選單').click();
        const listbox = page.getByRole('listbox');
        const long = listbox.getByRole('option', { name:/^這是一段很長的文字/ });
        expect(await heightOf(long)).toBeGreaterThan(40);
        expect(await overflowOf(long)).toEqual(noOverflow);
        expect(await widthOf(long)).toBeLessThanOrEqual(containerWidth);
        expect(await heightOf(listbox.getByRole('option', { name:'短選項' }))).toBe(40);
      });

      test('a TextField with a long label grows the field but not the input', async ({ page }) => {
        const label = page.locator('label', { hasText:'長標籤' });
        const shortField = page.locator('label', { hasText:'長值輸入' }).locator('..');
        expect(await heightOf(page.getByLabel('長標籤'))).toBe(height);
        expect(await overflowOf(label)).toEqual(noOverflow);
        expect(await widthOf(label)).toBeLessThanOrEqual(containerWidth);
        expect(await heightOf(label.locator('..'))).toBeGreaterThan(await heightOf(shortField));
      });

      test('long helper text wraps instead of widening the field', async ({ page }) => {
        const helper = page.getByText(/^長說明這是/);
        expect(await widthOf(helper)).toBeLessThanOrEqual(containerWidth);
        expect(await widthOf(page.getByLabel('長說明輸入'))).toBeLessThanOrEqual(containerWidth);
      });

      test('a TextField with a long value stays one line and scrolls sideways', async ({ page }) => {
        const input = page.getByLabel('長值輸入');
        expect(await heightOf(input)).toBe(height);
        expect((await overflowOf(input)).inline).toBeGreaterThan(0);
        expect(await input.evaluate(node => { node.scrollLeft = 9999; return node.scrollLeft; })).toBeGreaterThan(0);
      });

      test('a TextField with a larger font grows and keeps its text inside', async ({ page }) => {
        const input = page.getByLabel('大字輸入');
        expect(await heightOf(input)).toBeGreaterThan(height);
        expect((await overflowOf(input)).block).toBe(0);
      });
    });
  }
});

test('the built showcase renders Button, Select and TextField at the standard height', async ({ page }) => {
  await page.goto('/components');
  const form = page.getByRole('form', { name:'示範設定' });
  const measured = {
    Button:await heightOf(form.getByRole('button', { name:'儲存設定', exact:true })),
    Select:await heightOf(form.getByLabel('通知頻率')),
    TextField:await heightOf(form.getByLabel('計畫名稱', { exact:true })),
  };
  expect(measured).toEqual({ Button:48, Select:48, TextField:48 });
});
