這個專案是「訂單操作」頁面，使用 Luca Style 設計系統的按鈕。開始前先讀專案根目錄的 `README.md`。

## 任務

把 Luca Style 的元件更新到新版。專案有一個本地改動（README 有說明），更新後必須還在。頁面要維持原本的樣子：儲存、取消，以及一個載入中的按鈕。

## 新版在哪裡

新版的套件是 `upgrade/` 資料夾裡的 `.tgz` 檔，用 `npm install ./upgrade/<檔名>` 安裝。

## 要求

- `npm run build` 要成功，輸出在 `dist/`，頁面從根路徑 `/` 開啟。
- 只能使用 `npm install <套件>`、`npm run build`、`npx tsc` 這三種指令；不要啟動開發伺服器。
- 完成並建置成功後結束，用幾句話說明做了什麼。
