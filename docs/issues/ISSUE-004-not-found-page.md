# 新增找不到頁面

Blocked by: ISSUE-003

## Done when

- 未列於[前端規格 §5.2](../05_frontend_spec.md) 的路徑顯示 §5.3.6 的找不到頁面，不再顯示入口頁內容；`/` 仍是入口頁。
- 頁面顯示請求的路徑，主要行動「返回設計系統入口」連回入口。
- 導覽、套系與明暗模式切換保留。
- 「樣張狀態」選單可切換 Success、Loading、Empty、Error 四態，文案與 `components.pen` 的 `NotFound/*` frame 一致：
  - Loading：正在確認這個網址對應的頁面。
  - Empty：這個網址沒有可顯示的內容，可以先回到設計系統入口。
  - Error：頁面內容無法載入。請重試，或回到設計系統入口。（含重試）
- Playwright 涵蓋未知路徑顯示、四態、返回入口，以及 390／834／1280px 無水平溢出。
- 對照 `docs/mockup/components.pen` 的 `NotFound/<套系>/<模式>/<裝置>/<狀態>`，至少檢查活力日間桌面與專業暗黑手機的 Success，各狀態各一個樣本。

## Context

規格見 [ISSUE-001](ISSUE-001-github-pages-readme.md)，承諾 PR-STYLE-17（畫面部分）；頁面規格為[前端規格 §5.3.6](../05_frontend_spec.md)。樣張目前對不認得的路徑直接顯示入口頁內容，訪客在錯的網址上看不出自己打錯了。HTTP 404 狀態由 ISSUE-005 負責，本票只做畫面。

## Blocked by

ISSUE-003 — 判斷「未列於路由表」必須在去掉 base 之後進行。

## Notes

- 沿用 `apps/showcase/src/editorial.tsx` 的四態寫法與 `ContentState`，不另立新模式。
- 只使用既有公開元件，不新增共用元件。
- `.pen` 只能透過 Pencil 工具讀取，不可用 Read 或 Grep 開啟。
- 頁面應用相同的語意角色 `role="status"`／`role="alert"` 與既有四態一致。
