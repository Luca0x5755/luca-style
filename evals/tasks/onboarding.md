這個專案是一個乾淨的 Vite、React 19、TypeScript 與 Tailwind CSS v3 專案，依賴已經裝好。請把 Luca Style 設計系統接入這個專案。

只能參考 `docs/consumer-guide.md` 這一份文件，照它接入。

這個設計系統還沒有發佈到 npm，所以文件裡的 npm 安裝指令請改用打包檔：兩個套件的 `.tgz` 在 `packs/` 資料夾，用 `npm install ./packs/<檔名>` 安裝。

## 要求

- CSS 入口維持 `src/index.css`，`src/main.tsx` 要匯入它。
- 接好後，`src/main.tsx` 的頁面要用 Luca Style 的主題與元件（例如 `ThemeProvider`、`Button`）。
- `npm run build` 要成功。
- 只能使用 `npm install <套件>`、`npm run build`、`npx tsc` 這三種指令；不要啟動開發伺服器。
- 完成並建置成功後結束，用幾句話說明做了什麼。
