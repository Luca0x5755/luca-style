import { test, expect } from '@playwright/test';
import { baselineName, visualModes, visualPages, visualSuites, visualWidths } from './visual-matrix';

// 截圖基準比對（PR-STYLE-42）：每一頁 × 套系 × 明暗 × 寬度，只拍 Success 狀態。
// 只在官方 Linux Docker 映像內執行（visual 專案）；基準存於 tests/__screenshots__/。
// 設計基礎頁的密度與外形切換維持預設值，不屬於基準。
for (const path of visualPages) {
  for (const suite of visualSuites) {
    for (const mode of visualModes) {
      for (const width of visualWidths) {
        test(`screenshot ${path} ${suite}/${mode} ${width}px matches the baseline`, async ({ page }) => {
          await page.setViewportSize({ width, height: 1000 });
          // 減少動態，避免切換主題的轉場中途被截到。
          await page.emulateMedia({ reducedMotion: 'reduce' });
          await page.goto(path);
          await page.getByLabel('風格套系').selectOption(suite);
          await page.getByLabel('明暗模式').selectOption(mode);
          const html = page.locator('html');
          await expect(html).toHaveAttribute('data-suite', suite);
          await expect(html).toHaveAttribute('data-mode', mode);
          await expect(html).toHaveCSS('color-scheme', mode);
          await expect(page.getByLabel('樣張狀態')).toHaveValue('success');
          // 停用動畫、轉場與游標閃爍，並等字體載入完成，再移除焦點（焦點環會進畫面）。
          await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' });
          await page.evaluate(async () => { await document.fonts.ready; });
          await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
          await expect(page).toHaveScreenshot(`${baselineName(path, suite, mode, width)}.png`, { fullPage: true, animations: 'disabled', caret: 'hide' });
        });
      }
    }
  }
}
