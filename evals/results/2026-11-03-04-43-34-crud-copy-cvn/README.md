# 評測專案

Vite、React 19 與 TypeScript 的空白專案。依賴已經裝好，`npm run build` 會先做型別檢查，再輸出到 `dist/`。

這個專案使用 Luca Style 設計系統，元件的原始碼已經複製到 `src/luca-style/`：入口是 `src/luca-style/index.tsx`，樣式是 `src/luca-style/styles.css`，字體與載入動畫的資源在 `src/fonts/`、`src/loading/`。這些檔案屬於本專案，可以直接閱讀與修改。設計變數（CSS 變數）來自已安裝的 `@luca-style/tokens`（`import '@luca-style/tokens/css'`），元件依賴的 `@base-ui/react` 也已安裝。專案根目錄的 `DESIGN.md` 與 `llms.txt` 是設計系統的說明。
