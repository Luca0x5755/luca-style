import { test, expect } from '@playwright/test';
import { cssRgb, neutralsOf } from './tokens-helpers';

// 某明暗模式的頁面底色 bg，換成瀏覽器計算樣式的 rgb() 寫法；期望值跟著設計變數原始檔走，不寫死色碼。
// 原始檔是否等於 PR-STYLE-48 由 tokens-snapshot.spec 把關。兩個模式各讀一次。
const bg = { light: cssRgb((await neutralsOf('light')).bg), dark: cssRgb((await neutralsOf('dark')).bg) };
const bgOf = (mode: 'light' | 'dark') => bg[mode];

// PR-STYLE-51：React 掛載前、外部 CSS 尚未到達時，首屏底色就是該明暗模式的 bg。
test('document background resolves the theme before application assets load', async ({browser}) => {
  for (const scenario of [
    {system:'light',stored:'dark',expected:'dark'},
    {system:'dark',stored:'light',expected:'light'},
    {system:'dark',stored:null,expected:'dark'},
    {system:'light',stored:null,expected:'light'},
  ] as const) {
    const context = await browser.newContext({colorScheme:scenario.system});
    await context.addInitScript(value => {
      if (value) localStorage.setItem('luca-style-mode',value);
    },scenario.stored);
    const page = await context.newPage();
    await page.route('**/*',route => ['script','stylesheet'].includes(route.request().resourceType()) ? route.abort() : route.continue());
    for (const path of ['/','/foundations','/templates/product']) {
      await page.goto(path);
      // React 未掛載（#root 為空），以下屬性全由 <head> 內的首屏腳本設定。
      await expect(page.locator('#root')).toBeEmpty();
      await expect(page.locator('html')).toHaveAttribute('data-luca-theme','');
      await expect(page.locator('html')).toHaveAttribute('data-suite','vibrant');
      await expect(page.locator('html')).toHaveAttribute('data-mode',scenario.expected);
      await expect(page.locator('html')).toHaveCSS('background-color',bgOf(scenario.expected));
      await expect(page.locator('html')).toHaveCSS('color-scheme',scenario.expected);
    }
    await context.close();
  }
});

test('first-paint script runs in <head> before any stylesheet', async ({request}) => {
  const html = await (await request.get('/')).text();
  // 找出讀取偏好鍵的行內 <script>（沒有 src 屬性）。
  const script = html.search(/<script>[^<]*luca-style-mode/);
  const head = html.indexOf('</head>');
  const stylesheet = html.indexOf('rel="stylesheet"');
  expect(script).toBeGreaterThan(-1);
  expect(stylesheet).toBeGreaterThan(-1);
  expect(script).toBeLessThan(head);
  expect(script).toBeLessThan(stylesheet);
});

test('a preference stored by 0.1.0 still applies and is written back in the same format', async ({browser}) => {
  const context = await browser.newContext({colorScheme:'light'});
  // 0.1.0 的格式：鍵 luca-style-mode、值為純字串。
  await context.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('luca-style-mode','dark'); sessionStorage.setItem('seeded','1'); } });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.getByLabel('明暗模式')).toHaveValue('dark');
  await expect(page.locator('html')).toHaveAttribute('data-mode','dark');
  await page.getByLabel('明暗模式').selectOption('light');
  expect(await page.evaluate(() => localStorage.getItem('luca-style-mode'))).toBe('light');
  await page.getByLabel('明暗模式').selectOption('system');
  expect(await page.evaluate(() => localStorage.getItem('luca-style-mode'))).toBeNull();
  await context.close();
});

test('showcase themes the whole document through ThemeProvider', async ({page}) => {
  await page.emulateMedia({colorScheme:'light'});
  await page.goto('/');
  const html = page.locator('html');
  await expect(page.locator('[data-luca-theme]')).toHaveCount(1);
  await expect(html).toHaveAttribute('data-luca-theme','');
  await page.getByLabel('明暗模式').selectOption('dark');
  await expect(html).toHaveAttribute('data-mode','dark');
  await expect(html).toHaveCSS('background-color',bgOf('dark'));
  await expect(html).toHaveCSS('color-scheme','dark');
  await page.getByLabel('明暗模式').selectOption('light');
  await expect(html).toHaveCSS('background-color',bgOf('light'));
  await expect(html).toHaveCSS('color-scheme','light');
  await page.getByLabel('風格套系').selectOption('professional');
  await expect(html).toHaveAttribute('data-suite','professional');
});

test('project accent override keeps metric text readable in both suites and modes', async ({page}) => {
  await page.goto('/templates/product');
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.getByLabel('檢視專案強調色覆寫').check();
  for (const suite of ['vibrant','professional']) {
    await page.getByLabel('風格套系').selectOption(suite);
    for (const mode of ['dark','light']) {
      await page.getByLabel('明暗模式').selectOption(mode);
      const metric = page.getByRole('article',{name:'本月累計'});
      const contrasts = await metric.evaluate(element => {
        const luminance = (color:string) => {
          const channels = color.match(/[\d.]+/g)!.slice(0,3).map(Number).map(value => {
            const channel = value / 255;
            return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
          });
          return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
        };
        const background = luminance(getComputedStyle(element).backgroundColor);
        return [...element.querySelectorAll('small,h2,strong,p')].map(child => {
          const foreground = luminance(getComputedStyle(child).color);
          return (Math.max(background,foreground) + .05) / (Math.min(background,foreground) + .05);
        });
      });
      for (const contrast of contrasts) expect(contrast,`${suite}/${mode} metric text contrast`).toBeGreaterThanOrEqual(4.5);
    }
  }
  await page.screenshot({path:'test-results/accent-override-light.png',fullPage:true});
  await page.getByLabel('風格套系').selectOption('vibrant');
  await page.getByLabel('明暗模式').selectOption('dark');
  await page.screenshot({path:'test-results/accent-override-dark.png',fullPage:true});
});
test('mode follows live system changes and retains a manual preference', async ({page, context}) => {
  await page.emulateMedia({colorScheme:'dark'});
  await page.goto('/');
  await expect(page.locator('[data-luca-theme]')).toHaveAttribute('data-mode','dark');
  await expect(page.locator('html')).toHaveCSS('background-color',bgOf('dark'));
  await page.emulateMedia({colorScheme:'light'});
  await expect(page.locator('[data-luca-theme]')).toHaveAttribute('data-mode','light');
  await expect(page.locator('html')).toHaveCSS('background-color',bgOf('light'));
  await page.getByLabel('明暗模式').selectOption('dark');
  const reopened = await context.newPage();
  await reopened.goto('/');
  await expect(reopened.getByLabel('明暗模式')).toHaveValue('dark');
  await expect(reopened.locator('[data-luca-theme]')).toHaveAttribute('data-mode','dark');
  await reopened.getByRole('navigation',{name:'主要導覽'}).getByRole('link',{name:'設計基礎',exact:true}).click();
  await expect(reopened.locator('html')).toHaveCSS('background-color',bgOf('dark'));
  await reopened.getByLabel('明暗模式').selectOption('system');
  await reopened.emulateMedia({colorScheme:'light'});
  await expect(reopened.locator('[data-luca-theme]')).toHaveAttribute('data-mode','light');
});

test('four theme combinations expose approved colors, density and shape', async ({page}) => {
  await page.goto('/');
  for (const suite of ['vibrant','professional']) {
    await page.getByLabel('風格套系').selectOption(suite);
    for(const mode of ['light','dark']) {
      await page.getByLabel('明暗模式').selectOption(mode);
      const primary = page.getByRole('button',{name:'探索設計基礎 →'});
      await expect(primary).toHaveCSS('background-color', suite === 'vibrant' ? mode === 'light' ? 'rgb(20, 127, 130)' : 'rgb(100, 194, 188)' : mode === 'light' ? 'rgb(98, 92, 131)' : 'rgb(171, 164, 215)');
      await expect(primary).toHaveCSS('border-radius', suite === 'vibrant' ? '16px':'3px');
      await expect(page.locator('aside')).toHaveCSS('padding',suite === 'vibrant' ? '24px':'20px');
      await expect(page.getByRole('article',{name:'讓每一份進展都清楚'})).toHaveCSS('border-left-width',suite === 'vibrant' ? '1px':'3px');
    }
  }
});

test('project accent override preserves status colors and reduced motion cancels transitions', async ({page}) => {
  await page.goto('/');
  await page.getByLabel('明暗模式').selectOption('light');
  await page.getByLabel('檢視專案強調色覆寫').check();
  await expect(page.getByRole('button',{name:'探索設計基礎 →'})).toHaveCSS('background-color','rgb(154, 76, 50)');
  for (const suite of ['vibrant','professional']) {
    await page.getByLabel('風格套系').selectOption(suite);
    for (const mode of ['light','dark']) {
      await page.getByLabel('明暗模式').selectOption(mode);
      const colors = suite === 'vibrant'
        ? mode === 'light' ? ['rgb(35, 115, 84)','rgb(136, 96, 24)','rgb(178, 68, 69)'] : ['rgb(126, 212, 171)','rgb(234, 198, 120)','rgb(242, 156, 150)']
        : mode === 'light' ? ['rgb(53, 104, 88)','rgb(128, 96, 31)','rgb(163, 75, 92)'] : ['rgb(147, 198, 178)','rgb(219, 194, 139)','rgb(221, 163, 178)'];
      for (const [i,label] of ['成功 · 已儲存','警告 · 請確認','錯誤 · 請重試'].entries()) {
        await expect(page.getByText(label,{exact:true})).toHaveCSS('color',colors[i]);
      }
    }
  }
  await page.emulateMedia({reducedMotion:'no-preference'});
  await expect(page.getByRole('button',{name:'探索設計基礎 →'})).toHaveCSS('transition-duration','0.12s, 0.12s, 0.12s');
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect(page.getByRole('button',{name:'探索設計基礎 →'})).toHaveCSS('transition-duration','0s');
});
