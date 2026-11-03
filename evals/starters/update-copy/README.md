# 評測專案

Vite、React 19 與 TypeScript 的專案。依賴已經裝好，`npm run build` 會先做型別檢查，再輸出到 `dist/`。

專案使用 Luca Style 設計系統，元件的原始碼已經複製到 `src/luca-style/`（舊版，0.2.0），這些檔案屬於本專案。專案的本地改動在 `src/luca-style/button.tsx`：每個按鈕都帶 `data-local-change="orders"`。這個本地改動不能丟。

新版的原始碼放在 `upgrade/react-src/`。
