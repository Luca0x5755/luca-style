---
"@luca-style/tokens": minor
"@luca-style/react": minor
---

首次發佈到 npm，版本為 0.3.0，兩個套件版本一致。0.x 期間不相容變更升次版號，以下是從 0.2.0 手動打包升級時要處理的項目。

不相容變更：

- 高度：`Button`、`Select`、`TextField` 單行時高度等於 `control-height`，不再是 50px；專案若依 50px 排版或寫死高度，要改用 `control-height`。
- `Select` 長值改為換行，不再顯示省略號；專案若依省略號限制單行高度，要自行處理。
- `TextField` 的輸入框（`.luca-input`）改為 `border-box`，寬度與高度含邊框與內距；專案依 `content-box` 算尺寸的覆寫要調整。
- `Button` 在 flex 列中不再收縮；需要收縮的版面要自行加 class。
- 導覽連結的樣式改由 `.luca-navigation-link`、`.luca-brand` 選取，特異度降為 (0,1,0)；原本是 `.luca-navigation a`、`.luca-navigation .luca-brand`，專案依舊選擇器的特異度覆寫的樣式要改寫。

相容性與模組變更：

- `@luca-style/react` 的 `react`、`react-dom` peer 從 `^19.0.0` 放寬為 `^18.0.0 || ^19.0.0`（ISSUE-007，18.3.1 實測，18.0 到 18.2 沒有逐版驗證）。
- `theme`、`controls`、`button`、`data-display` 四個模組開頭新增 `'use client'`，Next 伺服器元件可直接匯入套件入口。
- `themeInitScript` 改從不帶指令的 `theme-init` 匯出，匯入路徑不變。
- 純客戶端的 Vite 8 打包會出現可忽略的 `MODULE_LEVEL_DIRECTIVE` 警告，見 consumer-guide。

新增功能：

- `Navigation` 新增 `renderLink`，可傳入框架的連結元件（例如 `next/link`）。
- `Button` 新增 `render`（型別為 `ButtonLinkProps`），可渲染成連結。
- `StatusMessage` 新增 `label`，並匯出 `StatusMessageProps`。
- `ContentState` 新增 `retryLabel`。
- `Checkbox` 新增 `hideLabel`。
- `renderLink`、`render`、`label`、`retryLabel`、`hideLabel` 不給時輸出不變；`.luca-checkbox` 多了 `position:relative`。
