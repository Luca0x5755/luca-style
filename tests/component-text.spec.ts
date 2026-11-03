import { test, expect } from '@playwright/test';
import { rm } from 'node:fs/promises';
import { scan } from './axe-scan';
import { buildHarness, origin, serveHarness } from './theme-harness';

// PR-STYLE-59：StatusMessage、ContentState 寫死的文字可以替換，沒提供時維持原文字。
// PR-STYLE-60：Checkbox 可以隱藏標籤，輔助科技仍讀得到名稱。測試載具從 @luca-style/react 匯入。

test.describe('replaceable text and hidden label on the test harness', () => {
  let outDir = '';
  test.beforeAll(async () => { outDir = await buildHarness(); });
  test.afterAll(async () => { if (outDir) await rm(outDir, { recursive:true, force:true }); });
  test.beforeEach(async ({ page }) => {
    await serveHarness(page, outDir);
    await page.goto(`${origin}/?persist=0`);
  });

  // 預期文字取自 0.2.0 的輸出，不從元件原始碼推算。
  test('StatusMessage keeps the tone prefix by default or with an empty label, and replaces it with label', async ({ page }) => {
    const samples = page.getByRole('region', { name:'文字替換樣本' });
    const messages = samples.locator('.luca-status');
    await expect(messages).toHaveText(['成功 · 預設成功', '警告 · 預設警告', '錯誤 · 預設錯誤', 'Saved · 替換成功', '警告 · 空前綴']);
  });

  test('ContentState keeps its default title, description and retry text, also for an empty retryLabel, and retryLabel renames the retry button', async ({ page }) => {
    const samples = page.getByRole('region', { name:'文字替換樣本' });
    const states = samples.locator('.luca-content-state');
    await expect(states.locator('h3')).toHaveText(['內容載入中', '目前沒有可顯示的內容', '內容載入失敗', 'Failed to load', '空重試']);
    await expect(states.locator('p')).toHaveText(['正在準備內容，請稍候。', '內容準備好後會顯示於此。', '請重試以重新顯示內容。', 'Try again later.', '請重試以重新顯示內容。']);
    await expect(states.nth(2).getByRole('button')).toHaveText('重試');
    // 空字串不能做出沒有名稱的按鈕。
    await expect(states.nth(4).getByRole('button')).toHaveText('重試');
    const renamed = states.nth(3).getByRole('button', { name:'Try again', exact:true });
    await expect(renamed).toHaveText('Try again');
    await renamed.click();
    await expect(samples.getByLabel('重試次數')).toHaveText('1');
  });

  // display:none 或 visibility:hidden 時框是 0×0 且仍可能算進名稱，所以直接斷言視覺隱藏寫法的確切結果。
  test('Checkbox with hideLabel keeps label as its accessible name while the text is visually hidden', async ({ page }) => {
    const samples = page.getByRole('region', { name:'文字替換樣本' });
    const box = samples.getByRole('checkbox', { name:'隱藏標籤核取', exact:true });
    await expect(box).toHaveCount(1);
    const text = samples.getByText('隱藏標籤核取', { exact:true });
    const style = await text.evaluate(node => { const computed = getComputedStyle(node); return {display:computed.display, visibility:computed.visibility}; });
    expect(style.display).not.toBe('none');
    expect(style.visibility).not.toBe('hidden');
    const rect = await text.evaluate(node => { const {width, height} = node.getBoundingClientRect(); return {width, height}; });
    expect(rect).toEqual({ width:1, height:1 });
    // 說明文字照常顯示。
    await expect(samples.getByText('隱藏標籤的說明')).toBeVisible();
  });

  test('Checkbox with hideLabel toggles on click and Space and reports checked through onChange', async ({ page }) => {
    const samples = page.getByRole('region', { name:'文字替換樣本' });
    const box = samples.getByRole('checkbox', { name:'隱藏標籤核取', exact:true });
    const value = samples.getByLabel('隱藏標籤核取值');
    await box.click();
    await expect(box).toBeChecked();
    await expect(value).toHaveText('true');
    await box.focus();
    await page.keyboard.press('Space');
    await expect(box).not.toBeChecked();
    await expect(value).toHaveText('false');
  });

  // ISSUE-004 的單行高度：隱藏標籤不改變列高與方框尺寸。
  test('Checkbox with hideLabel has the same row height and box size as one with a visible label', async ({ page }) => {
    const samples = page.getByRole('region', { name:'文字替換樣本' });
    const measure = (name:string) => samples.getByRole('checkbox', { name, exact:true }).evaluate(node => {
      const row = node.closest('label')!.getBoundingClientRect();
      const box = node.getBoundingClientRect();
      return {rowHeight:row.height, boxWidth:box.width, boxHeight:box.height};
    });
    const hidden = await measure('隱藏標籤核取');
    expect(hidden).toEqual(await measure('可見標籤核取'));
    // 預設密度的 control-height 是 48px，方框 1.25rem。
    expect(hidden).toEqual({ rowHeight:48, boxWidth:20, boxHeight:20 });
  });

  test('the replaceable text samples, including the hidden label, have no serious or critical axe violations', async ({ page }, testInfo) => {
    const { violations, blocking } = await scan(page, 'section[aria-label="文字替換樣本"]');
    await testInfo.attach('axe-component-text.json', { body:JSON.stringify(violations, null, 2), contentType:'application/json' });
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });

  // 反向控制：標籤是空字串時方框沒有名稱，axe 必須回報，證明上面的掃描看得到方框。
  test('axe reports a hidden-label Checkbox whose label is empty', async ({ page }) => {
    await page.goto(`${origin}/?persist=0&samples=nameless`);
    const { blocking } = await scan(page, 'section[aria-label="缺名稱樣本"]');
    expect(blocking.map(finding => finding.id)).toContain('aria-toggle-field-name');
  });
});
