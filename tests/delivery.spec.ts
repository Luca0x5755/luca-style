import {test,expect} from '@playwright/test';

for (const [route,title,successName] of [
  ['/foundations','設計基礎','文字，保留清楚的層次'],
  ['/components','共用元件','示範設定'],
  ['/templates/product','把今天，安排得剛剛好。','建立計畫'],
]) {
  test(`${route} preserves context and restores content in every theme and width`,async({page})=>{
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.goto(route);
    for(const suite of ['vibrant','professional']) {
      await page.getByLabel('風格套系').selectOption(suite);
      for(const mode of ['light','dark']) {
        await page.getByLabel('明暗模式').selectOption(mode);
        for(const width of [1280,834,390]) {
          await page.setViewportSize({width,height:1000});
          for(const state of ['success','loading','empty','error']) {
            await page.getByLabel('樣張狀態').selectOption(state);
            await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();
            await expect(page.getByRole('navigation',{name:'主要導覽'})).toBeVisible();
            await expect(page.getByLabel('風格套系')).toHaveValue(suite);
            await expect(page.locator('[data-luca-theme]')).toHaveAttribute('data-mode',mode);
            if(state !== 'success') await expect(page.getByRole(state==='error'?'alert':'status')).toBeVisible();
            expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
          }
          await page.getByRole('button',{name:'重試',exact:true}).click();
          await expect(page.getByLabel('樣張狀態')).toHaveValue('success');
          await expect(page.getByRole(route==='/foundations'?'heading':'form',{name:successName,exact:true})).toBeVisible();
        }
      }
    }
  });
}
