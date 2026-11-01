import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { scan } from './axe-scan';
import { cellQuery, openCell, overviewPath, warmUpOverview } from './state-overview-cell';
import { overviewCells } from './visual-matrix';

// 狀態總覽頁的 axe（PR-REVIEW-09）：跑在 `dev` 專案，所以在 npm test 內。
// 48 種組合直接掃格內文件；外殼另外掃，因為專案負責人實際用的是它。
const expectNoBlocking = async (page: Page, testInfo: TestInfo, name: string) => {
  const { violations, blocking, reported } = await scan(page);
  await testInfo.attach(`axe-${name}.json`, { body: JSON.stringify(violations, null, 2), contentType: 'application/json' });
  // minor、moderate 只列在報告，不讓測試失敗。
  if (reported.length) console.log(`[axe] ${name} 列報告：${reported.map(f => `${f.id}(${f.impact}) ${f.targets.join(' | ')}`).join('; ')}`);
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
};
// 連結要等格子呈現完成才出現，所以四個都在時，iframe 才都已顯示、掃得到內容。
const expectShellReady = async (page: Page) => {
  for (const state of ['Loading', 'Empty', 'Error', 'Success']) await expect(page.getByRole('link', { name: `開原尺寸 · ${state}`, exact: true })).toBeVisible();
  await page.waitForLoadState('networkidle');
};

test.beforeAll(async ({ browser }) => {
  test.setTimeout(180_000);
  await warmUpOverview(browser);
});

for (const cell of overviewCells) {
  const { state, suite, mode, width } = cell;
  test(`axe overview cell ${state} ${suite}/${mode} ${width}px has no serious or critical violations`, async ({ page }, testInfo) => {
    await openCell(page, cell);
    await expectNoBlocking(page, testInfo, `overview-${state}-${suite}-${mode}-${width}`);
  });
}

// 外殼的 ThemeProvider 沒有套系參數，切換只改各格網址；各格的組合已由上面掃過，所以外殼只看它自己會變的部分。
for (const widthChoice of ['desktop', 'mobile']) {
  test(`axe overview shell at the ${widthChoice} width with all four cells ready has no serious or critical violations`, async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(overviewPath);
    await page.getByLabel('寬度').selectOption(widthChoice);
    await expectShellReady(page);
    await expectNoBlocking(page, testInfo, `shell-${widthChoice}`);
  });
}

test('axe overview shell on a dark device has no serious or critical violations', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
  await page.goto(overviewPath);
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
  await expectShellReady(page);
  await expectNoBlocking(page, testInfo, 'shell-dark-device');
});

test('axe overview single-cell view has no serious or critical violations', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${overviewPath}?${new URLSearchParams({ cell: cellQuery({ state: 'success', suite: 'vibrant', mode: 'light' }), width: 'mobile' })}`);
  await expect(page.frameLocator('iframe').locator('.product-page')).toBeVisible();
  await page.waitForLoadState('networkidle');
  await expectNoBlocking(page, testInfo, 'single-cell');
});

test('axe overview self-test: a critical violation in a cell document blocks', async ({ page }) => {
  await openCell(page, { state: 'success', suite: 'vibrant', mode: 'light', width: 1280 });
  await page.locator('main').evaluate(main => main.insertAdjacentHTML('beforeend', '<button data-axe-probe></button>'));
  const { blocking } = await scan(page);
  expect(blocking.find(f => f.id === 'button-name')?.impact).toBe('critical');
});

// 沒有這條的話，外殼掃描可能只掃到切換控制，下面這些格子都沒進去。
test('axe overview self-test: a critical violation inside a cell blocks the shell scan', async ({ page }) => {
  await page.goto(overviewPath);
  await expectShellReady(page);
  await page.getByRole('region', { name: 'Success', exact: true }).frameLocator('iframe').locator('main').evaluate(main => main.insertAdjacentHTML('beforeend', '<button data-axe-probe></button>'));
  const { blocking } = await scan(page);
  const finding = blocking.find(f => f.id === 'button-name');
  expect(finding?.impact).toBe('critical');
  expect(finding?.targets.join(' ')).toContain('iframe[title="Success"]');
});
