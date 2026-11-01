import { test, expect, type Page } from '@playwright/test';
import { devOrigin, openCell, warmUpOverview } from './state-overview-cell';
import { overviewBaselineName, overviewCells, type OverviewCell } from './visual-matrix';

// 狀態總覽頁的截圖基準（PR-REVIEW-08）：只在官方 Linux Docker 映像內執行（visual 專案）。
// 外殼會依視窗縮放各格，所以拍頂層的格內文件；寬度由視窗決定，834 不需要控制項。
// 總覽頁只在開發環境開放，所以連 4178。基準只和開發伺服器的畫面比對，不跨到 4173 的正式建置。
test.use({ baseURL: devOrigin });

test.beforeAll(async ({ browser }) => {
  test.setTimeout(180_000);
  await warmUpOverview(browser);
});

const screenshotOptions = { fullPage: true, animations: 'disabled', caret: 'hide' } as const;
// 停用動畫、轉場與游標閃爍，再移除焦點（焦點環會進畫面）；與 visual.spec 相同。
async function freeze(page: Page) {
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' });
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
}

for (const cell of overviewCells) {
  const { state, suite, mode, width } = cell;
  test(`screenshot overview ${state} ${suite}/${mode} ${width}px matches the baseline`, async ({ page }) => {
    await openCell(page, cell);
    await freeze(page);
    await expect(page).toHaveScreenshot(`${overviewBaselineName(cell)}.png`, screenshotOptions);
  });
}

// 自我測試排在上面的迴圈之後，所以第一次產生基準時圖已經存在。
// 用 .not 而不是接住例外：基準不存在時 .not 會失敗，接住例外則會把路徑寫錯當成通過；.not 也不會改寫基準。
const success: OverviewCell = { state: 'success', suite: 'vibrant', mode: 'light', width: 1280 };

test('overview screenshot self-test: changing the page after a match stops it matching', async ({ page }) => {
  await openCell(page, success);
  await freeze(page);
  const name = `${overviewBaselineName(success)}.png`;
  await expect(page).toHaveScreenshot(name, screenshotOptions);
  await page.locator('.page-title').evaluate(title => { title.textContent = '不應該出現在基準裡的標題'; });
  await expect(page).not.toHaveScreenshot(name, screenshotOptions);
});

test('overview screenshot self-test: another state does not match a state baseline', async ({ page }) => {
  await openCell(page, success);
  await freeze(page);
  await expect(page).not.toHaveScreenshot(`${overviewBaselineName({ ...success, state: 'loading' })}.png`, screenshotOptions);
});
