import {test,expect} from '@playwright/test';

test('Home describes deliveries and provides every showcase entry',async({page})=>{
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'從規則，到完整畫面'})).toBeVisible();
 for(const [name,path,title] of [['查看共用元件','/components','共用元件'],['查看產品範本','/templates/product','把今天，安排得剛剛好。'],['查看介紹頁範本','/templates/intro','為重要的事， 留出清楚的空間。']]){
  await page.goto('/');
  await page.getByRole('link',{name,exact:true}).click();
  await expect(page).toHaveURL(new RegExp(`${path}$`));
  await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();
 }
});

test('intro primary action brings the value explanation into keyboard focus',async({page})=>{
 await page.goto('/templates/intro');
 await page.getByRole('button',{name:'了解設計 →'}).click();
 await expect(page.getByRole('heading',{name:'好設計，讓重要的事更容易被看見'})).toBeFocused();
 await page.getByRole('link',{name:'查看完整範本 →'}).click();
 await expect(page.getByRole('heading',{name:'把今天，安排得剛剛好。'})).toBeVisible();
});

test('editorial four states preserve page context and recover through retry',async({page})=>{
 for(const route of ['/','/templates/intro']){
  await page.goto(route);
  for(const state of ['loading','empty','error']){
   await page.getByLabel('樣張狀態').selectOption(state);
   await expect(page.getByRole('navigation',{name:'主要導覽'})).toBeVisible();
   await expect(page.getByRole('heading',{level:1})).toBeVisible();
   await expect(page.getByRole('link',{name:'返回設計系統入口',exact:true})).toBeVisible();
   await expect(page.getByRole(state==='error'?'alert':'status')).toContainText(state==='loading'?'介紹內容載入中':state==='empty'?'介紹內容尚未提供':'介紹內容無法載入');
   await expect(page.getByRole('article',{name:'讓每一份進展都清楚'})).toHaveCount(0);
  }
  await page.getByRole('button',{name:'重試',exact:true}).click();
  await expect(page.getByRole('article',{name:'讓每一份進展都清楚'})).toBeVisible();
 }
});

test('editorial pages preserve typography and layout in both suites modes and three widths',async({page},testInfo)=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 for(const route of ['/','/templates/intro']){
  await page.goto(route);
  for(const suite of ['vibrant','professional']){
   await page.getByLabel('風格套系').selectOption(suite);
   for(const mode of ['light','dark']){
    await page.getByLabel('明暗模式').selectOption(mode);
    for(const width of [1280,834,390]){
     await page.setViewportSize({width,height:1000});
     expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
     await expect(page.getByRole('heading',{level:1})).toHaveCSS('font-size',width===1280?'56px':width===834?'44px':'32px');
     await expect(page.getByRole('article',{name:'讓每一份進展都清楚'})).toBeVisible();
     await expect(page.getByRole('link',{name:'查看產品範本',exact:true})).toBeVisible();
     if((suite==='vibrant'&&mode==='light')||(suite==='professional'&&mode==='dark')) await page.screenshot({path:testInfo.outputPath(`${route==='/'?'home':'intro'}-${suite}-${mode}-${width}.png`),fullPage:true});
     for(const state of ['loading','empty','error']){
      await page.getByLabel('樣張狀態').selectOption(state);
      await expect(page.getByRole(state==='error'?'alert':'status')).toBeVisible();
      await expect(page.getByRole('navigation',{name:'主要導覽'})).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      if(suite==='professional'&&mode==='dark'&&width===390) await page.screenshot({path:testInfo.outputPath(`${route==='/'?'home':'intro'}-${state}-390.png`),fullPage:true});
     }
     await page.getByRole('button',{name:'重試',exact:true}).click();
    }
   }
  }
 }
});
