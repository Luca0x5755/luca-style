import {test,expect} from '@playwright/test';
test('a plan can be created from the product template and appears in recent items',async({page})=>{
  await page.goto('/templates/product');
  const form=page.getByRole('form',{name:'建立計畫'});
  await form.getByRole('button',{name:'建立計畫',exact:true}).click();
  await expect(form.getByLabel('計畫名稱')).toHaveAccessibleDescription('請輸入計畫名稱。');
  await form.getByLabel('計畫名稱').fill('週末的新計畫');
  await form.getByRole('button',{name:'建立計畫',exact:true}).click();
  await expect(page.getByRole('table',{name:'近期項目'}).getByRole('cell',{name:'週末的新計畫 個人計畫',exact:true})).toBeVisible();
  await expect(form.getByRole('status')).toHaveText('成功 · 計畫已建立，已加入近期項目。');
});

test('product state samples retain navigation and column context and retry restores data',async({page})=>{
 await page.goto('/templates/product');
 for(const state of ['loading','empty','error']){
  await page.getByLabel('樣張狀態').selectOption(state);
  await expect(page.getByRole('navigation',{name:'主要導覽'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'把今天，安排得剛剛好。'})).toBeVisible();
  for(const name of ['項目','日期','數值']) await expect(page.getByRole('columnheader',{name,exact:true})).toBeVisible();
  await expect(page.getByRole('cell',{name:'每月規劃',exact:true})).toHaveCount(0);
  await expect(page.getByRole(state==='error'?'alert':'status')).toBeVisible();
 }
 await page.getByRole('button',{name:'重試',exact:true}).click();
 await expect(page.getByRole('cell',{name:'每月規劃',exact:true})).toBeVisible();
 await expect(page.getByRole('form',{name:'建立計畫'})).toBeVisible();
});

test('product remains readable and operable in every suite mode and width',async({page})=>{
 await page.goto('/templates/product');
 for(const suite of ['vibrant','professional']){
  await page.getByLabel('風格套系').selectOption(suite);
  for(const mode of ['light','dark']){
   await page.getByLabel('明暗模式').selectOption(mode);
   for(const width of [1280,834,390]){
    await page.setViewportSize({width,height:1000});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const form=page.getByRole('form',{name:'建立計畫'});
    await form.getByLabel('計畫名稱').fill(`${suite}-${mode}-${width}`);
    await form.getByRole('button',{name:'建立計畫',exact:true}).click();
    await expect(form.getByRole('status')).toBeVisible();
    await expect(page.getByRole('cell',{name:`${suite}-${mode}-${width} 個人計畫`,exact:true})).toBeVisible();
    const value=page.getByRole('cell',{name:'+12,480.00',exact:true});
    const dataColor=await value.locator('span').evaluate(el=>getComputedStyle(el).color);
    const statusColor=await form.getByRole('status').evaluate(el=>getComputedStyle(el).color);
    expect(dataColor).not.toBe(statusColor);
    await expect(page.getByRole('img',{name:/本週進展/})).toBeVisible();
    if((suite==='vibrant'&&mode==='light'&&width===1280)||(suite==='professional'&&mode==='dark'&&width===390)) await page.screenshot({path:`test-results/product-${suite}-${mode}-${width}.png`,fullPage:true});
   }
  }
 }
 await page.getByRole('navigation',{name:'主要導覽'}).getByRole('link',{name:'共用元件'}).click();
 await expect(page.getByRole('heading',{name:'導覽、指標與表格'})).toBeVisible();
 await expect(page.getByRole('navigation',{name:'範例導覽'})).toBeVisible();
 await expect(page.getByRole('table',{name:'表格示例'})).toBeVisible();
});

test('created plans retain the chosen category in recent items',async({page})=>{
 await page.goto('/templates/product');
 const form=page.getByRole('form',{name:'建立計畫'});
 await form.getByLabel('計畫名稱').fill('團隊練球');
 // Select 改為自訂選單（ISSUE-009），不再是原生 select：點欄位開啟後點選項。
 await form.getByLabel('計畫分類').click();
 await page.getByRole('option',{name:'團隊活動'}).click();
 await form.getByRole('button',{name:'建立計畫',exact:true}).click();
 await expect(page.getByRole('row').filter({hasText:'團隊練球'})).toContainText('團隊活動');
});
