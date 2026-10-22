import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test('content loading uses approved suite assets and static images for reduced motion',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.goto('/components');
  await page.getByLabel('樣張狀態').selectOption('loading');
  const state=page.locator('.luca-content-state');
  await expect(state).toHaveAttribute('aria-busy','true');
  await expect(state).toContainText('元件展示載入中');
  const animation=state.locator('.luca-loading-animation');
  await expect(animation).toHaveAttribute('aria-hidden','true');
  await expect(animation).toHaveCSS('width','72px');
  for(const suite of ['vibrant','professional']){
    await page.getByLabel('風格套系').selectOption(suite);
    for(const mode of ['light','dark']){
      await page.getByLabel('明暗模式').selectOption(mode);
      for(const reduced of [false,true]){
        await page.emulateMedia({reducedMotion:reduced?'reduce':'no-preference'});
        const image=await animation.evaluate(el=>getComputedStyle(el).backgroundImage);
        const url=image.slice(5,-2);
        let bytes:Buffer;
        if(url.startsWith('data:')) bytes=Buffer.from(url.split(',')[1],'base64');
        else {
          const response=await page.request.get(url);
          expect(response.ok()).toBe(true);
          bytes=await response.body();
        }
        const expected=await readFile(new URL(`../packages/react/loading/${suite==='vibrant'?'tide':'square'}-${mode}.${reduced?'png':'gif'}`,import.meta.url));
        expect(bytes.equals(expected)).toBe(true);
        if(!reduced) expect(bytes.subarray(0,6).toString()).toMatch(/^GIF8[79]a$/);
        else expect(bytes.subarray(1,4).toString()).toBe('PNG');
      }
    }
  }
  for(const next of ['empty','error','success']){
    await page.getByLabel('樣張狀態').selectOption(next);
    if(next==='success') await expect(page.locator('.luca-content-state[aria-busy=true]')).toHaveCount(1);
    else await expect(page.locator('.luca-loading-animation')).toHaveCount(0);
  }
});
