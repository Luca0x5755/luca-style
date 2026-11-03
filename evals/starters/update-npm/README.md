# 評測專案

Vite、React 19 與 TypeScript 的專案。依賴已經裝好，`npm run build` 會先做型別檢查，再輸出到 `dist/`。

專案使用 Luca Style 設計系統，`@luca-style/tokens` 與 `@luca-style/react` 已經安裝（0.2.0）。`src/local-button.tsx` 是專案自己的本地改動：包住套件的 `Button`，替每個按鈕加上 `data-local-change="orders"`，頁面的按鈕都用它。這個本地改動不能丟。

新版的套件放在 `upgrade/`。
