import { test, expect } from '@playwright/test';
import { rm } from 'node:fs/promises';
import { buildHarness, origin, serveHarness } from './theme-harness';

// PR-STYLE-57、58：Navigation 接專案的連結元件，Button 可渲染成連結。測試載具從 @luca-style/react 匯入。

test.describe('links on the test harness', () => {
  let outDir = '';
  test.beforeAll(async () => { outDir = await buildHarness(); });
  test.afterAll(async () => { if (outDir) await rm(outDir, { recursive:true, force:true }); });
  test.beforeEach(async ({ page }) => {
    await serveHarness(page, outDir);
    await page.goto(`${origin}/?persist=0`);
  });

  // 經過 Base UI Button 時，<a> 會被加上按鈕才有的 type="button"；連結寫法不能帶它。
  test('a Button rendered as a link keeps link semantics with an href and no button type', async ({ page }) => {
    const samples = page.getByRole('region', { name:'連結樣本' });
    for (const [name, href] of [['元素連結', '#element-link'], ['函式連結', '#function-link']]) {
      const link = samples.getByRole('link', { name });
      await expect(link).toHaveAttribute('href', href);
      await expect(link).not.toHaveAttribute('type');
      await expect(link).not.toHaveAttribute('role');
      await expect(samples.getByRole('button', { name })).toHaveCount(0);
    }
  });

  // Space 不觸發是連結的行為；被做成 role="button" 時 Space 也會觸發。
  test('a Button rendered as a link is reached with Tab, Enter follows it and Space does not', async ({ page }) => {
    const samples = page.getByRole('region', { name:'連結樣本' });
    const clicks = samples.getByLabel('連結點擊次數');
    let expected = 0;
    for (const [name, hash] of [['元素連結', '#element-link'], ['函式連結', '#function-link']]) {
      const link = samples.getByRole('link', { name });
      await link.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await expect(link).toBeFocused();
      await page.keyboard.press('Space');
      expect(new URL(page.url()).hash).not.toBe(hash);
      // 接著按 Enter 當屏障：Space 若晚一步觸發，計數會多加 1。
      await page.keyboard.press('Enter');
      expected += 1;
      await expect(clicks).toHaveText(String(expected));
      await expect(page).toHaveURL(new RegExp(`${hash}$`));
    }
  });

  // 點擊前在 window 放標記：整頁重載會清掉它。
  for (const how of ['click', 'Enter'] as const) {
    test(`Navigation routes through the project link on ${how} without a full reload and keeps aria-current`, async ({ page }) => {
      const nav = page.getByRole('navigation', { name:'路由導覽' });
      await page.evaluate(() => { (window as unknown as {marker:string}).marker = 'kept'; });
      const follow = async (name:string) => {
        const link = nav.getByRole('link', { name, exact:true });
        if (how === 'click') await link.click();
        else { await link.focus(); await page.keyboard.press('Enter'); }
      };
      for (const [name, path] of [['第一頁', '/first'], ['第二頁', '/second'], ['路由品牌', '/']]) {
        await follow(name);
        await expect(page).toHaveURL(`${origin}${path}`);
        expect(await page.evaluate(() => (window as unknown as {marker?:string}).marker)).toBe('kept');
        const current = nav.locator('[aria-current=page]');
        // 品牌連結不屬於選單項目，回到首頁時沒有目前頁面。
        if (path === '/') await expect(current).toHaveCount(0);
        else { await expect(current).toHaveCount(1); await expect(current).toHaveText(name); }
      }
      // 專案連結元件加上的 class 留在三個連結上，Luca 的 class 也還在。
      await expect(nav.locator('a.project-link')).toHaveCount(3);
      await expect(nav.getByRole('link', { name:'路由品牌' })).toHaveClass(/\bluca-brand\b/);
    });
  }

  // 外觀與同 variant 的原生 Button 相同，且沒有連結底線。
  test('a Button rendered as a link looks like the native Button of the same variant, without underline', async ({ page }) => {
    const properties = ['display', 'alignItems', 'justifyContent', 'boxSizing', 'height', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderTopStyle', 'borderTopColor', 'borderTopLeftRadius',
      'backgroundColor', 'color', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'cursor', 'textDecorationLine'] as const;
    const styleOf = (locator:ReturnType<typeof page.getByRole>) => locator.evaluate((node, names) => Object.fromEntries(names.map(name => [name, getComputedStyle(node)[name as 'color']])), properties as readonly string[]);
    const samples = page.getByRole('region', { name:'連結樣本' });
    const natives = page.getByRole('region', { name:'元件樣本' });
    for (const [link, native] of [['元素連結', '主要按鈕'], ['函式連結', '次要按鈕']]) {
      const linkStyle = await styleOf(samples.getByRole('link', { name:link }));
      expect(linkStyle.textDecorationLine).toBe('none');
      expect(linkStyle).toEqual(await styleOf(natives.getByRole('button', { name:native })));
    }
  });
});
