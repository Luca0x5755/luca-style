# 在總覽頁並排呈現產品範本的四種狀態

Blocked by: none

## Done when

- 開發環境開啟 `/dev/state-overview`，同一頁看到 `/templates/product` 的 Loading、Empty、Error、Success。
- 四格使用 `@luca-style/react` 公開元件和假資料，不需要後端。
- `Product` 要呈現的狀態由外部（props 或網址參數）傳入，元件不自己保存。
- `npm run build` 和 `npm run build:pages` 的輸出不含此頁，開啟 `/dev/state-overview` 時顯示找不到頁面。
- `/templates/product` 的「樣張狀態」選單照常可用，`npm test` 全過。

## Context

這是狀態總覽頁的第一個切片，兌現 PR-REVIEW-01、02、05、06。規格見 `docs/issues/ISSUE-001-state-overview-page.md`，頁面定義見 `docs/05_frontend_spec.md` §5.2、§5.3.7，決策背景見 ADR 0009。這張票只求四格並排跑通，切換控制屬於 ISSUE-003。

## Notes

- `apps/showcase/src/route-table.json` 維持 5 條，也不放寬 `tests/pages-routes.spec.ts`。該測試用 `route === '…'` 比對 `apps/showcase/src/main.tsx`，所以開發路由不能用這個寫法判斷。
- `apps/showcase/src/product.tsx:8` 目前把狀態放在元件內部。現有多支測試依賴「樣張狀態」選單（`getByLabel('樣張狀態')`），選單要留在外層包裝元件。
- 表單輸入等其他內部狀態可以留在元件內；只有要呈現的四態改由外部傳入。
- 驗證要跑在正式建置上：不只確認開發環境開得到，也要確認建置輸出不含此頁。
