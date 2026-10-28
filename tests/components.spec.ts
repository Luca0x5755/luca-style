import {test, expect} from '@playwright/test';

test('form validation is linked and keyboard submission reports an operation result', async ({page}) => {
  await page.goto('/components');
  const form=page.getByRole('form',{name:'示範設定'});
  await form.getByRole('button',{name:'儲存設定',exact:true}).click();
  const name=form.getByLabel('計畫名稱',{exact:true});
  await expect(name).toBeFocused();
  await expect(name).toHaveAttribute('aria-invalid','true');
  await expect(name).toHaveAccessibleDescription('請輸入計畫名稱。');
  await name.fill('週末羽球');
  await name.press('Tab');
  await expect(form.getByLabel('通知頻率')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Tab');
  await expect(form.getByRole('checkbox',{name:'我已確認設定'})).toBeFocused();
  await page.keyboard.press('Space');
  await page.keyboard.press('Tab');
  await expect(form.getByRole('button',{name:'儲存設定',exact:true})).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(form.getByRole('button',{name:'儲存中…'})).toBeDisabled();
  await expect(name).toBeDisabled();
  await expect(form.getByRole('status')).toHaveText('成功 · 設定已儲存。');
  await expect(name).toBeEnabled();
});

test('operation failure can be retried without losing editable values', async ({page}) => {
  await page.goto('/components');
  const form=page.getByRole('form',{name:'示範設定'});
  await form.getByLabel('計畫名稱',{exact:true}).fill('保留我的設定');
  await form.getByRole('button',{name:'儲存設定',exact:true}).click();
  await expect(form.getByRole('checkbox',{name:'我已確認設定'})).toBeFocused();
  await expect(form.getByRole('checkbox',{name:'我已確認設定'})).toHaveAccessibleDescription('請先確認設定。');
  await form.getByRole('checkbox',{name:'我已確認設定'}).check();
  await form.getByRole('checkbox',{name:'模擬儲存失敗'}).check();
  await form.getByRole('button',{name:'儲存設定',exact:true}).click();
  await expect(form.getByRole('alert')).toHaveText('錯誤 · 儲存失敗，請重試。');
  await expect(form.getByLabel('計畫名稱',{exact:true})).toHaveValue('保留我的設定');
  await form.getByRole('checkbox',{name:'模擬儲存失敗'}).uncheck();
  await form.getByRole('button',{name:'儲存設定',exact:true}).click();
  await expect(form.getByRole('status')).toHaveText('成功 · 設定已儲存。');
});

test('page state samples retain controls and error retry restores component content', async ({page}) => {
  await page.goto('/components');
  for(const state of ['loading','empty','error']) {
    await page.getByLabel('樣張狀態').selectOption(state);
    await expect(page.getByRole('heading',{name:'共用元件',exact:true})).toBeVisible();
    await expect(page.getByLabel('風格套系')).toBeEnabled();
    await expect(page.getByLabel('明暗模式')).toBeEnabled();
    await expect(page.getByRole('form',{name:'示範設定'})).toHaveCount(0);
    await expect(page.getByRole(state === 'error' ? 'alert' : 'status')).toBeVisible();
  }
  await page.getByRole('button',{name:'重試',exact:true}).click();
  await expect(page.getByRole('form',{name:'示範設定'})).toBeVisible();
  const states=page.getByRole('region',{name:'內容狀態'});
  await states.getByRole('button',{name:'重試',exact:true}).click();
  await expect(states.getByRole('heading',{name:'內容已重新載入'})).toBeVisible();
});

test('component samples remain operable across suite mode and width combinations', async ({page}) => {
  await page.goto('/components');
  for(const suite of ['vibrant','professional']) {
    await page.getByLabel('風格套系').selectOption(suite);
    for(const mode of ['light','dark']) {
      await page.getByLabel('明暗模式').selectOption(mode);
      for(const width of [1280,834,390]) {
        await page.setViewportSize({width,height:1000});
        const form=page.getByRole('form',{name:'示範設定'});
        await form.getByLabel('計畫名稱',{exact:true}).fill(`${suite} ${mode} ${width}`);
        await expect(form.getByLabel('計畫名稱',{exact:true})).toHaveCSS('font-size','16px');
        expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        await expect(page.getByRole('button',{name:'暫不可用',exact:true})).toBeDisabled();
        await expect(page.getByRole('button',{name:'處理中…',exact:true})).toBeDisabled();
        await expect(page.getByLabel('停用欄位')).toBeDisabled();
        await expect(page.getByRole('checkbox',{name:'已停用的通知'})).toBeDisabled();
      }
    }
  }
  const interactive=page.getByRole('button',{name:'移入或聚焦',exact:true});
  // 滑過改用推算的 accent-hover（PR-STYLE-45），焦點框為雙圈（PR-STYLE-46）；細節見 focus-ring.spec。
  await interactive.hover();
  await expect(interactive).toHaveCSS('filter','none');
  await interactive.focus();
  await expect(interactive).toHaveCSS('outline-width','2px');
  await page.getByLabel('聚焦欄位').focus();
  await expect(page.getByLabel('聚焦欄位')).toHaveCSS('outline-width','2px');
});

test('Navigation brand link defaults to root and follows brandHref when provided', async ({page}) => {
  await page.goto('/components');
  await expect(page.getByRole('navigation',{name:'範例導覽'}).locator('.luca-brand')).toHaveAttribute('href','/');
  await expect(page.getByRole('navigation',{name:'子路徑導覽'}).locator('.luca-brand')).toHaveAttribute('href','/luca-style/');
});
