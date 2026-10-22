# 讓樣張路由與連結支援部署 base path

Blocked by: ISSUE-002

## Done when

- 以 `vite build --base=/luca-style/` 建置後，在 `/luca-style/` 下：
  - 導覽列與頁面內連結可切換設計系統入口、設計基礎、共用元件、產品介面範本、介紹頁範本五個路由。
  - 品牌連結回到 `/luca-style/`（使用 ISSUE-002 的 `brandHref`）。
  - 頁首麵包屑只顯示不含 base 的路由，例如 `/foundations`。
- 本機開發與預覽在 `/` 下行為不變，既有 Playwright 全部通過。
- 新增子路徑測試：以 `/luca-style/` base 建置、在獨立 port 預覽，從入口開始經導覽切換五個路由並檢查各頁標題。

## Context

規格見 [ISSUE-001](ISSUE-001-github-pages-readme.md)，承諾 PR-STYLE-15（子路徑切換部分）、PR-STYLE-18；路由見[前端規格 §5.2](../05_frontend_spec.md)。樣張目前以 `window.location.pathname === '/foundations'` 比對路由，連結也都是根路徑絕對網址，無法部署在 GitHub Pages 的子路徑。這是整組工作的 tracer bullet：先證明子路徑下五個路由可用，再往上加 404 頁與部署。

## Blocked by

ISSUE-002 — 品牌連結需要 `brandHref`。

## Notes

- 路由比對（`apps/showcase/src/main.tsx`）、連結（`editorial.tsx`、`product.tsx`）與 `window.location.assign` 都要經過 `import.meta.env.BASE_URL` 組出；不得寫死 `/luca-style/`。
- 比對前先去掉 base，使程式內部仍用 `/foundations` 這類路徑。
- `Navigation` 的 `currentPath` 也要用去掉 base 的路徑，`aria-current` 才會正確。
- base 只在部署建置時設定；不採相對 base `./`，pathname 比對難以處理。
- `vite preview` 對任何深層網址都回退到首頁，不能用來驗證 PR-STYLE-16；那由 ISSUE-005 處理。本票的測試從入口經導覽切換，不直接開深層網址。
- 子路徑測試使用與現有測試不同的 port，避免與 4173 衝突；Playwright 設定目前是單一 `webServer`，需評估新增專案或獨立設定檔。
