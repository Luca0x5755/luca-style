import type { Page } from '@playwright/test';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

// ThemeProvider 測試載具（tests/fixtures/theme-harness）的打包與提供，theme-provider.spec 與 select.spec 共用。

// 假 origin：localStorage 需要真實 origin，about:blank 會拒絕存取。
export const origin = 'http://harness.test';

// 以 vite 打包測試載具到暫存目錄；fileURLToPath 產生 Windows 也能用的絕對路徑。
export async function buildHarness() {
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
export async function serveHarness(page:Page, outDir:string) {
  await page.route(`${origin}/**`, async route => {
    const path = new URL(route.request().url()).pathname;
    const file = join(outDir, path === '/' ? 'index.html' : path);
    // 不存在的檔案（例如 favicon）回 404，避免請求懸著變成逾時。
    const exists = await access(file).then(() => true, () => false);
    await (exists ? route.fulfill({path:file}) : route.fulfill({status:404}));
  });
}
