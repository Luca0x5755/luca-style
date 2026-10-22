// 產生 README 用的樣張截圖：docs/images/ 下入口頁兩套風格各日間、暗黑共 4 張。
// 自行建置並以獨立埠（4177）提供，不與 4173／4175／4176 的測試伺服器衝突；不屬於 npm test。
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('../', import.meta.url));
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('請透過 npm run screenshots 執行');
const port = 4177;
const outDir = join(root, 'docs', 'images');
// 套系與明暗模式的組合；select 的值對應樣張頁的選單。
const shots = [
  { name: 'vibrant-light', suite: 'vibrant', mode: 'light' },
  { name: 'vibrant-dark', suite: 'vibrant', mode: 'dark' },
  { name: 'professional-light', suite: 'professional', mode: 'light' },
  { name: 'professional-dark', suite: 'professional', mode: 'dark' },
];

const build = spawnSync(process.execPath, [npmCli, 'run', 'build'], { cwd: root, encoding: 'utf8' });
if (build.status !== 0) throw new Error(`建置失敗\n${build.stdout}\n${build.stderr}`);

const server = spawn(process.execPath, [join(root, 'scripts', 'serve-pages.mjs'), join(root, 'apps', 'showcase', 'dist'), '--port', String(port)], { stdio: ['ignore', 'pipe', 'inherit'] });
let browser;
try {
  // 等伺服器印出就緒訊息；埠被占用時行程會結束並使此處失敗。
  await new Promise((done, reject) => {
    const timer = setTimeout(() => reject(new Error('截圖伺服器啟動逾時')), 15_000);
    server.once('exit', code => { clearTimeout(timer); reject(new Error(`截圖伺服器提前結束（${code}），埠 ${port} 可能被占用`)); });
    server.stdout.on('data', () => { clearTimeout(timer); done(); });
  });
  await mkdir(outDir, { recursive: true });
  browser = await chromium.launch({ args: ['--disable-lcd-text', '--font-render-hinting=none', '--disable-font-subpixel-positioning', '--disable-gpu'] }); // 關閉次像素抗鋸齒與字形微調，避免原生選單文字在各次執行間有像素差異
  // 四張都穩定後才一起寫檔，避免中途失敗時 docs/images/ 變成新舊混版。
  const results = [];
  for (const shot of shots) {
    // 每張用全新 context，避免先前選擇的模式被記住而影響結果；停用動畫與減少動態。
    const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, reducedMotion: 'reduce', colorScheme: 'light' });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/`);
    // 先停用動畫與轉場，再切換選單，避免主題切換的轉場中途被截到。
    await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' });
    await page.getByLabel('風格套系').selectOption(shot.suite);
    await page.getByLabel('明暗模式').selectOption(shot.mode);
    // 切換後才用到的字形會在下一次排版時才請求，故先等兩個影格，再等字體載入完成並移除焦點。
    await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
    await page.evaluate(async () => { await document.fonts.ready; });
    // 原生選單的文字可能以字體載入前的排版結果繪出；暫時隱藏再還原，強制依已載入字體重排。
    await page.evaluate(() => {
      for (const select of document.querySelectorAll('select')) {
        select.style.display = 'none';
        void select.offsetHeight;
        select.style.display = '';
      }
    });
    await page.evaluate(() => (document.activeElement)?.blur());
    // 原生選單文字偶爾在剛切換後數個影格內仍有像素變動；連續兩張完全相同才視為穩定並寫檔。
    let previous = await page.screenshot();
    let settled = false;
    for (let attempt = 0; attempt < 20 && !settled; attempt++) {
      await page.waitForTimeout(100);
      const current = await page.screenshot();
      settled = current.equals(previous);
      previous = current;
    }
    if (!settled) throw new Error(`${shot.name} 畫面未能穩定`);
    results.push({ name: shot.name, bytes: previous });
    await context.close();
  }
  for (const { name, bytes } of results) {
    await writeFile(join(outDir, `${name}.png`), bytes);
    console.log(`已產生 docs/images/${name}.png`);
  }
} finally {
  // 瀏覽器關閉失敗也必須終止伺服器，否則 4177 埠會被殘留行程占用。
  try { await browser?.close(); } finally {
    server.removeAllListeners('exit');
    const closed = new Promise(done => server.once('exit', done));
    const alive = server.exitCode === null && server.signalCode === null;
    server.kill();
    if (alive) await closed;
  }
}
