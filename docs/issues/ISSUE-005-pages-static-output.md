# 建置後產生 Pages 靜態輸出

Blocked by: ISSUE-003, ISSUE-004

## Done when

- 以 base 建置並執行新的 `build:pages` 後，`dist` 內有五個路由各自的 `index.html`（例如 `foundations/index.html`、`templates/product/index.html`）與 `404.html`。
- 用模擬 GitHub Pages 行為的靜態伺服器驗證（檔案存在回 200，不存在回 `404.html` 的內容與 404 狀態）：
  - 五個路由的深層網址直接開啟與重新整理皆回 200，並顯示對應頁面。
  - 不存在的網址回 404，並顯示找不到頁面。
- 一般的 `npm run build` 與本機預覽行為不變。

## Context

規格見 [ISSUE-001](ISSUE-001-github-pages-readme.md)，承諾 PR-STYLE-16、PR-STYLE-17（HTTP 狀態部分）。GitHub Pages 不支援 SPA 回退，直接開啟深層網址會得到 404。只把 `index.html` 複製成 `404.html` 會讓有效頁面以 404 回應，因此改為每個路由各產生一份頁面，另保留 404 頁給打錯的網址。

## Blocked by

ISSUE-003 — 需要 base 建置。ISSUE-004 — `404.html` 要顯示找不到頁面。

## Notes

- 不能用 `vite preview` 驗證：它對任何路徑都回 200 並回退到首頁。
- 路由清單只維護一份；用測試比對該清單與 `apps/showcase/src/main.tsx` 的路由是否一致，避免新增路由時漏產頁面。
- 產生腳本放在 `scripts/`；`build:pages` 在根 `package.json` 提供。
- 模擬 Pages 的伺服器可以是測試內的小型 Node 伺服器，使用獨立 port。
- 未列於路由表的路徑不產生頁面檔，由 `404.html` 處理。
