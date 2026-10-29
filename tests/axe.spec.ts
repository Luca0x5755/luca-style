import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { routeTable } from './route-table';

// 掃描目前頁面，依 PR-STYLE-41 分級：serious、critical 擋下，其餘只列報告。
type Finding = { id: string; impact: string; help: string; targets: string[] };
const blockingImpacts = new Set(['serious', 'critical']);

async function scan(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  // 只留可讀的欄位，失敗訊息才看得懂是哪條規則、哪個節點。
  const findings: Finding[] = results.violations.map(v => ({
    id: v.id, impact: v.impact ?? 'unknown', help: v.help, targets: v.nodes.map(n => n.target.join(' ')),
  }));
  return {
    violations: results.violations,
    blocking: findings.filter(f => blockingImpacts.has(f.impact)),
    reported: findings.filter(f => !blockingImpacts.has(f.impact)),
  };
}

// 頁面清單取自路由表，再加一條不在表內的路徑代表「找不到頁面」（前端規格 §5.2、§5.3.6）。
const notFoundPath = '/axe-unlisted-path';
const pagesToScan = [...routeTable, notFoundPath];
const suites = ['vibrant', 'professional'] as const;
const modes = ['light', 'dark'] as const;

test('the not-found probe path is not a listed route', () => {
  expect(routeTable).not.toContain(notFoundPath);
});

for (const path of pagesToScan) {
  for (const suite of suites) {
    for (const mode of modes) {
      test(`axe ${path} ${suite}/${mode} has no serious or critical violations`, async ({ page }, testInfo) => {
        // 關閉轉場，避免掃到切換途中的中間色而誤報對比。
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto(path);
        await page.getByLabel('風格套系').selectOption(suite);
        await page.getByLabel('明暗模式').selectOption(mode);
        const html = page.locator('html');
        await expect(html).toHaveAttribute('data-suite', suite);
        await expect(html).toHaveAttribute('data-mode', mode);
        // 等整頁配色實際套用（color-scheme 由該組設計變數決定）才掃描。
        await expect(html).toHaveCSS('color-scheme', mode);
        // 本議題只檢查 Success 狀態。
        await expect(page.getByLabel('樣張狀態')).toHaveValue('success');
        const { violations, blocking, reported } = await scan(page);
        const pageName = path === '/' ? 'root' : path.replace(/\W+/g, '-').replace(/^-/, '');
        await testInfo.attach(`axe-${pageName}-${suite}-${mode}.json`, {
          body: JSON.stringify(violations, null, 2), contentType: 'application/json',
        });
        // minor、moderate 只列在報告，不讓測試失敗。
        if (reported.length) console.log(`[axe] ${path} ${suite}/${mode} 列報告：${reported.map(f => `${f.id}(${f.impact}) ${f.targets.join(' | ')}`).join('; ')}`);
        expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
      });
    }
  }
}

test('axe self-test: injected critical violations block and a moderate one is only reported', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('main')).toBeAttached();
  await page.evaluate(() => {
    document.querySelector('main')!.insertAdjacentHTML('beforeend', '<button data-axe-probe></button><img data-axe-probe src="data:,">');
    // 放在所有 landmark 之外的內容，axe 以 region 規則回報為 moderate。
    document.body.insertAdjacentHTML('beforeend', '<p data-axe-probe>landmark 之外的內容</p>');
  });
  const { blocking, reported } = await scan(page);
  const probe = (list: Finding[], id: string) => list.find(v => v.id === id);
  expect(probe(blocking, 'button-name')?.impact).toBe('critical');
  expect(probe(blocking, 'image-alt')?.impact).toBe('critical');
  // 鎖住 axe 對 region 的實際評級；評級若改變，本測試會失敗而不是默默翻轉。
  expect(probe(reported, 'region')?.impact).toBe('moderate');
  expect(probe(blocking, 'region')).toBeUndefined();
});
