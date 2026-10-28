import { test, expect, type Page } from '@playwright/test';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { themeInitScript } from '../packages/react/src/theme-init.js';

// 假 origin：localStorage 需要真實 origin，about:blank 會拒絕存取。
const origin = 'http://harness.test';

// 以 vite 打包測試載具到暫存目錄；fileURLToPath 產生 Windows 也能用的絕對路徑。
async function buildHarness() {
  const outDir = await mkdtemp(join(tmpdir(), 'luca-theme-harness-'));
  try {
    await build({
      root:fileURLToPath(new URL('./fixtures/theme-harness/', import.meta.url)),
      base:'./', logLevel:'error', configFile:false,
      resolve:{alias:{'@luca-style/react':fileURLToPath(new URL('../packages/react/src/index.tsx', import.meta.url))}},
      build:{outDir, emptyOutDir:true},
    });
  } catch (error) {
    // 打包失敗時先清掉暫存目錄，再拋出原本的錯誤。
    await rm(outDir, {recursive:true, force:true});
    throw error;
  }
  return outDir;
}

// 由假 origin 提供打包後的載具檔案。
async function serveHarness(page:Page, outDir:string) {
  await page.route(`${origin}/**`, async route => {
    const path = new URL(route.request().url()).pathname;
    const file = join(outDir, path === '/' ? 'index.html' : path);
    // 不存在的檔案（例如 favicon）回 404，避免請求懸著變成逾時。
    const exists = await access(file).then(() => true, () => false);
    await (exists ? route.fulfill({path:file}) : route.fulfill({status:404}));
  });
}

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
    expect(await html.evaluate(element => element.style.getPropertyValue('--accent'))).toBe('#9A4C32');
    await page.getByRole('button', {name:'卸載'}).click();
    for (const name of ['data-luca-theme','data-suite','data-mode']) await expect(html).not.toHaveAttribute(name);
    expect(await html.evaluate(element => element.style.getPropertyValue('--accent'))).toBe('');
  });
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
