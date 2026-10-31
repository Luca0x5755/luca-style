import { defineConfig } from '@playwright/test';

// 截圖比對（visual 專案）只在 Docker 的官方 Linux 映像內執行（PW_VISUAL=1，見 scripts/visual-docker.mjs 與 pages.yml）。
// 本機 Windows 與 CI 的字型渲染不同，所以不進預設的 `npm test`；兩組設定互斥。
const visualOnly = process.env.PW_VISUAL === '1';
const preview = { command: 'npm run preview', url: 'http://127.0.0.1:4173', reuseExistingServer: false };

export default defineConfig({
  testDir: './tests', workers: 1,
  use: { viewport: {width:1280,height:1000} },
  // 基準圖統一放 tests/__screenshots__/，檔名不帶平台後綴（基準只在 Linux 映像產生）。
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
  projects: visualOnly ? [
    // 視覺專案：只比對 visual.spec，沿用 4173 預覽（需先 npm run build）。
    // 旗標關閉次像素抗鋸齒與字形微調，與 scripts/screenshots.mjs 一致，避免原生選單文字有像素差異。
    { name: 'visual', testMatch: /visual\.spec/, use: { baseURL: 'http://127.0.0.1:4173', launchOptions: { args: ['--disable-lcd-text', '--font-render-hinting=none', '--disable-font-subpixel-positioning', '--disable-gpu'] } } },
  ] : [
    // 預設專案：base 為 `/`，使用 4173 預覽。
    { name: 'default', testIgnore: /(subpath|pages|visual|state-overview)\.spec/, use: { baseURL: 'http://127.0.0.1:4173' } },
    // 子路徑專案：以 `/luca-style/` base 建置，使用獨立的 4175 預覽。
    { name: 'subpath', testMatch: /subpath\.spec/, use: { baseURL: 'http://127.0.0.1:4175' } },
    // Pages 專案：build:pages 的靜態輸出，由模擬 GitHub Pages 的伺服器在 4176 提供。
    { name: 'pages', testMatch: /pages\.spec/, use: { baseURL: 'http://127.0.0.1:4176' } },
    // 開發專案：狀態總覽頁只在開發環境開放，所以改連 4178 的 vite 開發伺服器。
    { name: 'dev', testMatch: /state-overview\.spec/, use: { baseURL: 'http://127.0.0.1:4178' } },
  ],
  // 視覺專案只需 4173 預覽，不付 subpath／pages 兩次建置的成本。
  webServer: visualOnly ? [preview] : [
    preview,
    // vite preview 在帶 base 時根路徑回 404，故以含 base 的網址判斷就緒。
    { command: 'npm run preview:subpath -w @luca-style/showcase', url: 'http://127.0.0.1:4175/luca-style/', reuseExistingServer: false, timeout: 180_000 },
    // 實際執行 build:pages 再以模擬 Pages 的伺服器提供；就緒判斷用含 base 的網址。
    { command: 'npm run build:pages && node scripts/serve-pages.mjs apps/showcase/dist-pages --base /luca-style/ --port 4176', url: 'http://127.0.0.1:4176/luca-style/', reuseExistingServer: false, timeout: 180_000 },
    { command: 'npm run dev -w @luca-style/showcase -- --port 4178 --strictPort', url: 'http://127.0.0.1:4178', reuseExistingServer: false },
  ],
});
