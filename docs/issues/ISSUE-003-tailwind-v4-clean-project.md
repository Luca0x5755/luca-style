# 讓 Tailwind v4 乾淨專案不寫色彩對應就能用 Luca 角色

## Done when

- ISSUE-002 的腳本也會驗證 Vite + Tailwind v4 乾淨專案。
- 專案只加 Luca 提供的 CSS 設定，不寫色彩對應，所有 Luca 角色的 class 都會產生規則，包括 `border-success/40` 這類透明度寫法（`PR-ADOPT-04`）。
- 依文件的方式載入 CSS 後，傳給元件的 class 能生效，Luca 元件樣式不被 preflight 蓋掉（`PR-ADOPT-05` 的 v4 部分）。
- 承諾已移入 `docs/capabilities/design-system.md`。

## Context

規格見 `docs/issues/ISSUE-001-npm-publish-readiness.md`。決策紀錄訂的做法是：Luca CSS 維持不分層，v4 專案在 `@import` 時才放進圖層。這個做法還沒實測。

## Blocked by

Blocked by: ISSUE-002

## Notes

- 圖層做法沒過時，換一個做法，並把結果記進 `docs/decision-log.md`。不要放寬承諾。
- 所有做法都失敗時，把票標成 STALLED，交由擁有者決定。
- v4 用 `tailwind-merge` 3.x。
