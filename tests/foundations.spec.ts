import {test, expect} from '@playwright/test';

test('foundations presents token rules and explains status versus business data', async ({page}) => {
  await page.goto('/foundations');
  await expect(page.getByRole('heading',{name:'色彩，是有意義的角色'})).toBeVisible();
  await expect(page.getByText('操作結果使用成功、警告與錯誤角色。交易漲跌等業務資料色由使用端專案獨立定義。',{exact:true})).toBeVisible();
  await expect(page.locator('[data-color="accent"] code')).toHaveText('#147F82');
  await page.getByLabel('風格套系').selectOption('professional');
  await page.getByLabel('明暗模式').selectOption('dark');
  await expect(page.locator('[data-color="accent"] code')).toHaveText('#ABA4D7');
  await expect(page.locator('[data-color="success"] code')).toHaveText('#93C6B2');
  await expect(page.getByText('0.1875rem',{exact:true})).toHaveCount(2);
});

test('state samples retain section context and retry restores rules', async ({page}) => {
  await page.goto('/foundations');
  for(const state of ['loading','empty','error']) {
    await page.getByLabel('樣張狀態').selectOption(state);
    await expect(page.getByRole('heading',{name:'設計基礎',exact:true})).toBeVisible();
    await expect(page.getByRole('heading',{name:'文字，保留清楚的層次'})).toBeVisible();
    await expect(page.getByLabel('風格套系')).toBeVisible();
    await expect(page.getByLabel('明暗模式')).toBeVisible();
    await expect(page.locator('[data-type="body"]')).toHaveCount(0);
    await expect(page.getByRole(state === 'error' ? 'alert' : 'status')).toBeVisible();
  }
  await page.getByRole('button',{name:'重試',exact:true}).click();
  await expect(page.getByLabel('樣張狀態')).toHaveValue('success');
  await expect(page.locator('[data-type="body"]')).toBeVisible();
});

test('proposal A remains readable across breakpoints and all font roles load locally', async ({page}) => {
  const fontResponses:string[]=[];
  page.on('response', r=>{if(r.url().endsWith('.ttf') && r.status()===200)fontResponses.push(r.url());});
  await page.goto('/foundations');
  for(const width of [390,599,600,834,1023,1024,1280]) {
    await page.setViewportSize({width,height:1000});
    const sizes = width < 600 ? [32,24,20,18,16,16,14,12] : width < 1024 ? [44,28,22,18,16,16,14,12] : [56,32,24,18,16,16,14,12];
    const keys = ['hero','title','section','card','body','control','secondary','helper'];
    const weights = [700,700,600,600,400,500,400,500];
    const heights = [1.2,1.3,1.4,1.5,1.75,1.5,1.6,1.5];
    for (const [i,key] of keys.entries()) {
      const actual=await page.locator(`[data-type="${key}"]`).evaluate(e=>{const s=getComputedStyle(e);return {size:parseFloat(s.fontSize),weight:Number(s.fontWeight),height:parseFloat(s.lineHeight)};});
      expect(actual.size).toBe(sizes[i]);
      expect(actual.weight).toBe(weights[i]);
      expect(actual.height).toBeCloseTo(sizes[i]*heights[i],1);
    }
    await expect(page.getByLabel('樣張狀態')).toHaveCSS('font-size','16px');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
  const loaded = await page.evaluate(async()=>{
    await Promise.all([document.fonts.load('400 16px Inter','English'),document.fonts.load('400 16px "Noto Sans TC"','中文'),document.fonts.load('600 32px "IBM Plex Mono"','128,640')]);
    return ['16px Inter','16px "Noto Sans TC"','600 32px "IBM Plex Mono"'].every(f=>document.fonts.check(f));
  });
  expect(loaded).toBe(true);
  expect(fontResponses.some(url=>url.includes('NotoSansTC'))).toBe(true);
  expect(fontResponses.some(url=>url.includes('Inter-'))).toBe(true);
  expect(fontResponses.some(url=>url.includes('IBMPlexMono-SemiBold'))).toBe(true);
  for(const family of ['Inter','Noto Sans TC','IBM Plex Mono']) {
    const response=await page.request.get(await page.getByRole('link',{name:`${family} OFL`,exact:true}).getAttribute('href') as string);
    expect(response.ok()).toBe(true);
    expect(await response.text()).toContain('SIL OPEN FONT LICENSE Version 1.1');
  }
});

test('foundation samples use each approved palette and suite density without shrinking text', async ({page}) => {
  await page.goto('/foundations');
  for(const suite of ['vibrant','professional']) {
    await page.getByLabel('風格套系').selectOption(suite);
    for(const mode of ['light','dark']) {
      await page.getByLabel('明暗模式').selectOption(mode);
      const accent = suite === 'vibrant' ? mode === 'light' ? '#147F82' : '#64C2BC' : mode === 'light' ? '#625C83' : '#ABA4D7';
      await expect(page.locator('[data-color="accent"] code')).toHaveText(accent);
      await expect(page.locator('[data-color="success"] code')).toHaveText(suite === 'vibrant' ? mode === 'light' ? '#237354' : '#7ED4AB' : mode === 'light' ? '#356858' : '#93C6B2');
      const shape=page.locator('.shape-demo');
      await expect(shape).toHaveCSS('padding',suite === 'vibrant' ? '24px' : '20px');
      await expect(shape).toHaveCSS('border-radius',suite === 'vibrant' ? '20px' : '3px');
      await expect(page.locator('.foundations')).toHaveCSS('row-gap',suite === 'vibrant' ? '32px' : '24px');
      await expect(page.getByText(/短而克制：回饋 120ms、一般切換 180ms、區塊進出 240ms/)).toBeVisible();
    }
  }
  const heights=await page.locator('.space-bar').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).height));
  expect(heights).toEqual(['4px','8px','12px','16px','24px','32px','48px','64px']);
});

test('project accent preview keeps baseline palette swatches consistent with their labels', async ({page}) => {
  await page.goto('/foundations');
  await page.getByLabel('明暗模式').selectOption('light');
  await page.getByLabel('檢視專案強調色覆寫').check();
  await expect(page.locator('[data-color="accent"] code')).toHaveText('#147F82');
  await expect(page.locator('[data-color="accent"] .color-chip')).toHaveCSS('background-color','rgb(20, 127, 130)');
  await expect(page.locator('[data-color="accent-secondary"] .color-chip')).toHaveCSS('background-color','rgb(223, 130, 109)');
  await expect(page.locator('[data-color="accent-soft"] .color-chip')).toHaveCSS('background-color','rgb(227, 242, 240)');
  await expect(page.getByText('色票顯示套系原始值；專案強調色覆寫僅供比較操作元件。',{exact:true})).toBeVisible();
});
