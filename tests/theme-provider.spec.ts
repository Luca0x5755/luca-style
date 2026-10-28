import { test, expect, type Page } from '@playwright/test';
import { rm } from 'node:fs/promises';
import { themeInitScript } from '../packages/react/src/theme-init.js';
import type { Density, Shape } from '../packages/react/src/theme-types.js';
import { deriveAccent, type AccentInput } from '../packages/tokens/accent.js';
import { neutralsOf } from './tokens-helpers';
import { buildHarness, origin, serveHarness } from './theme-harness';

// 舊的 accent 寫法已移除（decision-log 2026-10-28）：若又能編譯，npm run typecheck 會因 @ts-expect-error 未被用到而失敗。
const acceptsAccent = (accent:AccentInput) => accent;
// @ts-expect-error 0.1.0 的單一色票 {primary, secondary, soft, ink}
acceptsAccent({primary:'#9A4C32', secondary:'#BD7454', soft:'#F7F1EB', ink:'#FFFFFF'});
// @ts-expect-error 0.1.0 的成對色票 {light: 色票, dark: 色票}
acceptsAccent({light:{primary:'#9A4C32'}, dark:{primary:'#E8A18B'}});
// 密度與外形只接受具名等級（decision-log 2026-10-28），不接受任意字串或倍率。
const acceptsLevels = (levels:{density?:Density; shape?:Shape}) => levels;
// @ts-expect-error 不在 compact／standard／comfortable 之內
acceptsLevels({density:'dense'});
// @ts-expect-error 外形不接受連續倍率
acceptsLevels({shape:1.5});

// 先以原始方法寫入種子值，再把 localStorage 的每次存取記到計數器；計數器在種子寫入後才從 0 開始。
async function seedAndCountStorage(page:Page, stored:string) {
  await page.addInitScript(value => {
    localStorage.setItem('luca-style-mode', value);
    const win = window as unknown as {storageAccess:number};
    win.storageAccess = 0;
    const storage = localStorage;
    Object.defineProperty(window, 'localStorage', {configurable:true, get() { win.storageAccess++; return storage; }});
    for (const method of ['getItem','setItem','removeItem','clear','key'] as const) {
      const original = Storage.prototype[method] as (...args:unknown[]) => unknown;
      Storage.prototype[method] = function(this:Storage, ...args:unknown[]) { win.storageAccess++; return original.apply(this, args); } as never;
    }
  }, stored);
}
const storageAccess = (page:Page) => page.evaluate(() => (window as unknown as {storageAccess:number}).storageAccess);
// 讀回儲存值；這次讀取本身會計數，故須在檢查計數器之後呼叫。
const storedValue = (page:Page) => page.evaluate(() => localStorage.getItem('luca-style-mode'));

test.describe('ThemeProvider', () => {
  let outDir:string;
  test.beforeAll(async () => { outDir = await buildHarness(); });
  test.afterAll(async () => { if (outDir) await rm(outDir, {recursive:true, force:true}); });

  for (const target of ['self','document']) {
    test(`persist={false} with target ${target} never reads or writes localStorage`, async ({page}) => {
      await page.emulateMedia({colorScheme:'light'});
      await seedAndCountStorage(page, 'dark');
      await serveHarness(page, outDir);
      await page.goto(`${origin}/?persist=0&target=${target}`);
      // 已存 dark 但系統為 light：顯示 light 代表沒有讀取儲存。
      await expect(page.getByLabel('目前明暗')).toHaveText('light');
      await expect(page.locator('[data-luca-theme]')).toHaveAttribute('data-mode', 'light');
      await page.getByRole('button', {name:'暗黑'}).click();
      await expect(page.getByLabel('目前明暗')).toHaveText('dark');
      await page.getByRole('button', {name:'跟隨系統'}).click();
      await expect(page.getByLabel('目前明暗')).toHaveText('light');
      expect(await storageAccess(page)).toBe(0);
      expect(await storedValue(page)).toBe('dark');
    });
  }

  test('target="document" themes <html> and clears it on unmount', async ({page}) => {
    await page.emulateMedia({colorScheme:'dark'});
    await serveHarness(page, outDir);
    await page.goto(`${origin}/?target=document`);
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-luca-theme', '');
    await expect(html).toHaveAttribute('data-suite', 'vibrant');
    await expect(html).toHaveAttribute('data-mode', 'dark');
    await expect(page.locator('[data-luca-theme]')).toHaveCount(1);
    // 只給日間主色、系統為暗黑：<html> 上是推算出的暗黑主色。
    const expectedDark = deriveAccent({light:'#9A4C32'}, 'dark', await neutralsOf('dark')).accent;
    expect(await html.evaluate(element => element.style.getPropertyValue('--accent'))).toBe(expectedDark);
    await page.getByRole('button', {name:'卸載'}).click();
    for (const name of ['data-luca-theme','data-suite','data-mode']) await expect(html).not.toHaveAttribute(name);
    expect(await html.evaluate(element => element.style.getPropertyValue('--accent'))).toBe('');
  });

  // ADR 0005：density、shape 有給才寫屬性；沒給就不寫，由套系區塊提供預設值。
  for (const target of ['self','document']) {
    test(`target ${target} writes data-density and data-shape only when given and clears them on unmount`, async ({page}) => {
      await serveHarness(page, outDir);
      const themed = page.locator(target === 'document' ? 'html' : '[data-luca-theme]');
      await page.goto(`${origin}/?persist=0&target=${target}`);
      await expect(themed).toHaveAttribute('data-suite', 'vibrant');
      for (const name of ['data-density','data-shape']) await expect(themed).not.toHaveAttribute(name);
      await page.goto(`${origin}/?persist=0&target=${target}&density=compact&shape=sharp`);
      await expect(themed).toHaveAttribute('data-density', 'compact');
      await expect(themed).toHaveAttribute('data-shape', 'sharp');
      await page.getByRole('button', {name:'卸載'}).click();
      if (target === 'document') for (const name of ['data-density','data-shape']) await expect(page.locator('html')).not.toHaveAttribute(name);
    });
  }

  // PR-STYLE-29～31：從元件樣本讀固定的計算樣式清單，依軸分組。期望值抄自前端規格 §5.4.1、§5.4.2 的表。
  type AxisStyles = {density:Record<string,string>; shape:Record<string,string>; color:Record<string,string>};
  const readAxes = (page:Page) => page.locator('[data-luca-theme]').evaluate(theme => {
    const style = (selector:string) => getComputedStyle(theme.querySelector(selector)!);
    const button = style('.luca-button-primary'), secondary = style('.luca-button-secondary'), input = style('.luca-input');
    const metric = style('.luca-metric'), table = style('.luca-table-region'), cell = style('.luca-table td'), state = style('.luca-content-state');
    return {
      density:{
        'button min-height':button.minHeight, 'input min-height':input.minHeight,
        'metric padding':metric.padding, 'content-state padding':state.padding, 'table-region padding':table.padding,
        'cell padding':`${cell.paddingTop} ${cell.paddingRight} ${cell.paddingBottom} ${cell.paddingLeft}`,
        'gap-section':getComputedStyle(theme).getPropertyValue('--gap-section').trim(),
      },
      shape:{
        'button radius':button.borderRadius, 'input radius':input.borderRadius, 'metric radius':metric.borderRadius, 'content-state radius':state.borderRadius,
        // Chromium 在 DPR 1 把 1.5px 邊框畫成 1px，計算樣式看不出差別，所以邊框寬度讀變數本身。
        'border-width':getComputedStyle(theme).getPropertyValue('--border-width').trim(),
        'metric border-left-width':metric.borderLeftWidth, 'metric background':metric.backgroundColor, 'metric shadow':metric.boxShadow,
      },
      color:{
        'theme background':getComputedStyle(theme).backgroundColor, 'theme text':getComputedStyle(theme).color,
        'button background':button.backgroundColor, 'button text':button.color, 'secondary text':secondary.color,
        'input border':input.borderTopColor, 'metric border':metric.borderTopColor, 'metric border-left':metric.borderLeftColor,
        'metric value':getComputedStyle(theme.querySelector('.luca-metric strong')!).color, 'cell border':cell.borderBottomColor,
        'state background':state.backgroundColor,
      },
    };
  }) as Promise<AxisStyles>;
  const densityTable = {
    vibrant:{compact:[40,16,24,8,8], standard:[48,24,32,12,8], comfortable:[56,32,48,16,12]},
    professional:{compact:[40,12,16,6,8], standard:[48,20,24,12,8], comfortable:[52,24,32,14,10]},
  } as const;
  const expectedDensity = ([height, padding, gap, block, inline]:readonly number[]) => ({
    'button min-height':`${height}px`, 'input min-height':`${height}px`,
    'metric padding':`${padding}px`, 'content-state padding':`${padding}px`, 'table-region padding':`${padding}px`,
    'cell padding':`${block}px ${inline}px ${block}px ${inline}px`, 'gap-section':`${gap / 16}rem`.replace(/^0\./, '.'),
  });
  // 指標卡底色：rounded 為柔和強調表面、sharp 為主要表面（§5.5.2 與中性色表）。
  const softSurface = {vibrant:{light:'rgb(227, 242, 240)', dark:'rgb(23, 54, 55)'}, professional:{light:'rgb(238, 237, 244)', dark:'rgb(45, 42, 59)'}} as const;
  const surface = {light:'rgb(255, 255, 255)', dark:'rgb(29, 36, 32)'} as const;
  const expectedShape = (shape:'rounded'|'sharp', suite:'vibrant'|'professional', mode:'light'|'dark') => shape === 'rounded'
    ? {'button radius':'16px', 'input radius':'16px', 'metric radius':'20px', 'content-state radius':'20px', 'border-width':'1px',
      'metric border-left-width':'1px', 'metric background':softSurface[suite][mode], 'metric shadow':'rgba(0, 0, 0, 0.03) 0px 4px 16px 0px'}
    : {'button radius':'3px', 'input radius':'3px', 'metric radius':'3px', 'content-state radius':'3px', 'border-width':'1.5px',
      'metric border-left-width':'3px', 'metric background':surface[mode], 'metric shadow':'none'};
  const suiteDefaults = {vibrant:{density:'standard', shape:'rounded'}, professional:{density:'standard', shape:'sharp'}} as const;
  async function openAxes(page:Page, mode:'light'|'dark', query:string) {
    await page.emulateMedia({colorScheme:mode, reducedMotion:'reduce'});
    await page.goto(`${origin}/?persist=0&accent=none&${query}`);
    await expect(page.getByLabel('目前明暗')).toHaveText(mode);
    return readAxes(page);
  }

  for (const suite of ['vibrant','professional'] as const) {
    for (const mode of ['light','dark'] as const) {
      test(`${suite}/${mode} without an override shows the suite default density and shape, the same as an explicit default`, async ({page}) => {
        await serveHarness(page, outDir);
        const unset = await openAxes(page, mode, `suite=${suite}`);
        expect(unset.density).toEqual(expectedDensity(densityTable[suite].standard));
        expect(unset.shape).toEqual(expectedShape(suiteDefaults[suite].shape, suite, mode));
        expect(await openAxes(page, mode, `suite=${suite}&density=${suiteDefaults[suite].density}&shape=${suiteDefaults[suite].shape}`)).toEqual(unset);
      });

      test(`${suite}/${mode} overriding density changes only density, to the §5.4.1 values`, async ({page}) => {
        await serveHarness(page, outDir);
        const unset = await openAxes(page, mode, `suite=${suite}`);
        for (const [level, values] of Object.entries(densityTable[suite])) {
          const got = await openAxes(page, mode, `suite=${suite}&density=${level}`);
          expect(got.density, level).toEqual(expectedDensity(values));
          expect(got.shape, level).toEqual(unset.shape);
          expect(got.color, level).toEqual(unset.color);
        }
      });

      test(`${suite}/${mode} overriding shape changes only shape, to the §5.4.2 values`, async ({page}) => {
        await serveHarness(page, outDir);
        const unset = await openAxes(page, mode, `suite=${suite}`);
        for (const level of ['rounded','sharp'] as const) {
          const got = await openAxes(page, mode, `suite=${suite}&shape=${level}`);
          expect(got.shape, level).toEqual(expectedShape(level, suite, mode));
          expect(got.density, level).toEqual(unset.density);
          expect(got.color, level).toEqual(unset.color);
        }
      });
    }
  }

  // 外形翻轉會換指標卡底色（professional + rounded 為柔和強調表面、vibrant + sharp 為主要表面），文字仍須達 4.5:1。
  for (const [suite, shape] of [['professional','rounded'],['vibrant','sharp']] as const) {
    for (const accent of ['none', JSON.stringify({light:'#9A4C32'})]) {
      test(`${suite} with shape ${shape}${accent === 'none' ? '' : ' and a project accent'} keeps metric text at 4.5:1 in both modes`, async ({page}) => {
        await serveHarness(page, outDir);
        for (const mode of ['light','dark'] as const) {
          await page.emulateMedia({colorScheme:mode, reducedMotion:'reduce'});
          await page.goto(`${origin}/?persist=0&suite=${suite}&shape=${shape}&accent=${encodeURIComponent(accent)}`);
          await expect(page.getByLabel('目前明暗')).toHaveText(mode);
          const contrasts = await page.locator('.luca-metric').evaluate(element => {
            const luminance = (color:string) => {
              const [r, g, b] = color.match(/[\d.]+/g)!.slice(0,3).map(Number).map(value => value / 255)
                .map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
              return r * .2126 + g * .7152 + b * .0722;
            };
            const background = luminance(getComputedStyle(element).backgroundColor);
            return [...element.querySelectorAll('small,h2,strong,p')].map(child => {
              const foreground = luminance(getComputedStyle(child).color);
              return (Math.max(background, foreground) + .05) / (Math.min(background, foreground) + .05);
            });
          });
          expect(contrasts.length).toBe(4);
          for (const contrast of contrasts) expect(contrast, `${mode} metric text contrast`).toBeGreaterThanOrEqual(4.5);
        }
      });
    }
  }

  // PR-STYLE-32、45、47：容器上的強調色變數就是同一份 deriveAccent 對目前明暗的結果，切換明暗即重算。
  const accentVariables = ['accent','accent-secondary','accent-soft','accent-hover','accent-pressed','focus-ring'] as const;
  const appliedAccent = (page:Page, target:string) => page.locator(target === 'document' ? 'html' : '[data-luca-theme]')
    .evaluate((element, names) => Object.fromEntries(names.map(name => [name, (element as HTMLElement).style.getPropertyValue(`--${name}`)])), [...accentVariables]);
  for (const target of ['self','document']) {
    for (const accent of [
      {light:'#9A4C32'},
      {light:'#9A4C32', dark:'#E8A18B', secondary:'#BD7454', soft:{light:'#F7F1EB', dark:'#382820'}},
      {light:'#275A83', soft:{dark:'#1B2A38'}},
    ] satisfies AccentInput[]) {
      test(`target ${target} applies the derived accent roles for ${JSON.stringify(accent)} in each mode`, async ({page}) => {
        await page.emulateMedia({colorScheme:'light'});
        await serveHarness(page, outDir);
        await page.goto(`${origin}/?persist=0&target=${target}&accent=${encodeURIComponent(JSON.stringify(accent))}`);
        for (const mode of ['light','dark'] as const) {
          await page.getByRole('button', {name:mode === 'light' ? '日間' : '暗黑'}).click();
          await expect(page.getByLabel('目前明暗')).toHaveText(mode);
          expect(await appliedAccent(page, target)).toEqual(deriveAccent(accent, mode, await neutralsOf(mode)));
        }
      });
    }
  }
});

// 只含首屏腳本的頁面：沒有 React、沒有外部資源，用來單獨驗證腳本字串本身。
async function openInitScriptPage(page:Page, script:string) {
  await page.route(`${origin}/**`, route => route.fulfill({contentType:'text/html', body:`<!doctype html><html><head><script>${script}</script></head><body></body></html>`}));
  await page.goto(`${origin}/`);
}

test.describe('themeInitScript', () => {
  // 已存 dark／light／無／垃圾值 × 系統 light／dark：明確選擇優先，其餘跟隨系統。
  for (const scenario of [
    {system:'light', stored:'dark', expected:'dark'},
    {system:'dark', stored:'dark', expected:'dark'},
    {system:'light', stored:'light', expected:'light'},
    {system:'dark', stored:'light', expected:'light'},
    {system:'light', stored:null, expected:'light'},
    {system:'dark', stored:null, expected:'dark'},
    {system:'light', stored:'purple', expected:'light'},
    {system:'dark', stored:'purple', expected:'dark'},
  ] as const) {
    test(`stored ${scenario.stored} with system ${scenario.system} marks <html> as ${scenario.expected} before anything else runs`, async ({browser}) => {
      const context = await browser.newContext({colorScheme:scenario.system});
      await context.addInitScript(value => { if (value) localStorage.setItem('luca-style-mode', value); }, scenario.stored);
      const page = await context.newPage();
      await openInitScriptPage(page, themeInitScript());
      const html = page.locator('html');
      await expect(html).toHaveAttribute('data-mode', scenario.expected);
      await expect(html).toHaveAttribute('data-luca-theme', '');
      await expect(html).toHaveAttribute('data-suite', 'vibrant');
      await context.close();
    });
  }

  test('suite option is written to <html>', async ({page}) => {
    await openInitScriptPage(page, themeInitScript({suite:'professional'}));
    await expect(page.locator('html')).toHaveAttribute('data-suite', 'professional');
  });

  test('falls back to the system setting when storage throws', async ({browser}) => {
    const context = await browser.newContext({colorScheme:'dark'});
    await context.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {configurable:true, get() { throw new DOMException('blocked', 'SecurityError'); }});
    });
    const page = await context.newPage();
    const errors:Error[] = [];
    page.on('pageerror', error => errors.push(error));
    await openInitScriptPage(page, themeInitScript());
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
    expect(errors).toEqual([]);
    await context.close();
  });

  test('is self-contained with no module imports', () => {
    expect(themeInitScript()).not.toMatch(/\bimport\b|\brequire\s*\(/);
  });
});
