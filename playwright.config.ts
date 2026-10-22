import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', workers: 1,
  use: { viewport: {width:1280,height:1000} },
  projects: [
    // 預設專案：base 為 `/`，使用 4173 預覽。
    { name: 'default', testIgnore: /subpath\.spec/, use: { baseURL: 'http://127.0.0.1:4173' } },
    // 子路徑專案：以 `/luca-style/` base 建置，使用獨立的 4175 預覽。
    { name: 'subpath', testMatch: /subpath\.spec/, use: { baseURL: 'http://127.0.0.1:4175' } },
  ],
  webServer: [
    { command: 'npm run preview', url: 'http://127.0.0.1:4173', reuseExistingServer: false },
    // vite preview 在帶 base 時根路徑回 404，故以含 base 的網址判斷就緒。
    { command: 'npm run preview:subpath -w @luca-style/showcase', url: 'http://127.0.0.1:4175/luca-style/', reuseExistingServer: false, timeout: 180_000 },
  ],
});
