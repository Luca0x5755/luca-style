import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', workers: 1,
  use: { viewport: {width:1280,height:1000} },
  projects: [
    // 預設專案：base 為 `/`，使用 4173 預覽。
    { name: 'default', testIgnore: /(subpath|pages)\.spec/, use: { baseURL: 'http://127.0.0.1:4173' } },
    // 子路徑專案：以 `/luca-style/` base 建置，使用獨立的 4175 預覽。
    { name: 'subpath', testMatch: /subpath\.spec/, use: { baseURL: 'http://127.0.0.1:4175' } },
    // Pages 專案：build:pages 的靜態輸出，由模擬 GitHub Pages 的伺服器在 4176 提供。
    { name: 'pages', testMatch: /pages\.spec/, use: { baseURL: 'http://127.0.0.1:4176' } },
  ],
  webServer: [
    { command: 'npm run preview', url: 'http://127.0.0.1:4173', reuseExistingServer: false },
    // vite preview 在帶 base 時根路徑回 404，故以含 base 的網址判斷就緒。
    { command: 'npm run preview:subpath -w @luca-style/showcase', url: 'http://127.0.0.1:4175/luca-style/', reuseExistingServer: false, timeout: 180_000 },
    // 實際執行 build:pages 再以模擬 Pages 的伺服器提供；就緒判斷用含 base 的網址。
    { command: 'npm run build:pages && node scripts/serve-pages.mjs apps/showcase/dist-pages --base /luca-style/ --port 4176', url: 'http://127.0.0.1:4176/luca-style/', reuseExistingServer: false, timeout: 180_000 },
  ],
});
