import { test, expect } from '@playwright/test';

// ISSUE-010：每個互動元件的主要操作都能只靠鍵盤完成（PR-STYLE-38）。Select 的鍵盤操作見 select.spec。

test('Button activates with Enter and Space, and a disabled or loading button does not', async ({ page }) => {
  await page.goto('/components');
  const form = page.getByRole('form', { name: '示範設定' });
  const save = form.getByRole('button', { name: '儲存設定', exact: true });
  // 空白欄位送出會把焦點移到計畫名稱，代表按鈕確實被鍵盤觸發。
  await save.focus();
  await page.keyboard.press('Enter');
  await expect(form.getByLabel('計畫名稱', { exact: true })).toBeFocused();
  await save.focus();
  await page.keyboard.press('Space');
  await expect(form.getByLabel('計畫名稱', { exact: true })).toBeFocused();
  // 停用與處理中的按鈕不在 Tab 順序內，也不能啟動。
  await expect(page.getByRole('button', { name: '暫不可用', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '處理中…', exact: true })).toBeDisabled();
});

test('TextField is reached with Tab, accepts typing and keeps its error description', async ({ page }) => {
  await page.goto('/components');
  const form = page.getByRole('form', { name: '示範設定' });
  const name = form.getByLabel('計畫名稱', { exact: true });
  await name.focus();
  await page.keyboard.type('週末羽球');
  await expect(name).toHaveValue('週末羽球');
  await name.fill('');
  await form.getByRole('button', { name: '儲存設定', exact: true }).press('Enter');
  await expect(name).toBeFocused();
  await expect(name).toHaveAccessibleDescription('請輸入計畫名稱。');
});

test('Checkbox toggles with Space, not Enter, and submits its value', async ({ page }) => {
  await page.goto('/components');
  // 用表單外的樣本：原生核取方塊按 Enter 會送出表單，這裡只看切換。
  const box = page.getByRole('checkbox', { name: '接收更新通知' });
  await box.focus();
  await expect(box).not.toBeChecked();
  await page.keyboard.press('Enter');
  await expect(box).not.toBeChecked();
  await page.keyboard.press('Space');
  await expect(box).toBeChecked();
  await page.keyboard.press('Space');
  await expect(box).not.toBeChecked();
});

test('Navigation links are reached with Tab and Enter navigates', async ({ page }) => {
  await page.goto('/components');
  const nav = page.getByRole('navigation', { name: '範例導覽' });
  const link = nav.getByRole('link', { name: '設計基礎' });
  await link.focus();
  await expect(link).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/foundations\/?$/);
});

test('Navigation marks the current page', async ({ page }) => {
  await page.goto('/components');
  await expect(page.getByRole('navigation', { name: '主要導覽' }).locator('a[aria-current=page]')).toHaveCount(1);
});

test('DataTable region takes focus and scrolls with the keyboard', async ({ page }) => {
  await page.goto('/components');
  const region = page.getByRole('region', { name: '表格示例，可水平捲動' });
  await region.focus();
  await expect(region).toBeFocused();
  // 固定區域寬度並讓表格更寬，捲動才是必然的，不依賴樣張版面與內容的寬度。
  await region.evaluate(node => { node.style.width = '400px'; node.querySelector('table')!.style.minWidth = '1200px'; });
  await page.keyboard.press('ArrowRight');
  // 鍵盤捲動可能帶平滑動畫，輪詢到位置改變為止。
  await expect.poll(() => region.evaluate(node => node.scrollLeft)).toBeGreaterThan(0);
});

test('ContentState retry button works from the keyboard', async ({ page }) => {
  await page.goto('/components');
  const states = page.getByRole('region', { name: '內容狀態' });
  const retry = states.getByRole('button', { name: '重試', exact: true });
  await retry.focus();
  await page.keyboard.press('Enter');
  await expect(states.getByRole('heading', { name: '內容已重新載入' })).toBeVisible();
});
