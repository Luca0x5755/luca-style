# 讓 Tailwind v3 乾淨專案不寫色彩對應就能用 Luca 角色

## Done when

- 一支由 npm script 啟動的腳本會打包兩個套件、安裝到 repo 外的乾淨 Vite + Tailwind v3 專案、建置，再用瀏覽器檢查。
- 專案只加 Luca 提供的 preset，不寫色彩對應，所有 Luca 角色的 class 都會產生規則，包括 `border-ok/40` 這類透明度寫法（`PR-ADOPT-03`）。
- 依文件的順序載入 CSS 後，傳給元件的 class 能生效，Luca 元件樣式不被 preflight 蓋掉（`PR-ADOPT-05` 的 v3 部分）。
- 新增角色而 preset 沒跟上時，檢查會失敗。
- 承諾已移入 `docs/capabilities/design-system.md`。

## Context

這是 `docs/issues/ISSUE-001-npm-publish-readiness.md` 的第一條完整路徑，後續的乾淨專案都用這支腳本。路線見 `docs/adr/0010-ship-components-through-npm-and-copy-page-templates.md`。

## Blocked by

Blocked by: none

## Notes

- 參考 `scripts/verify-consumer.mjs`：它已做到打包、安裝、建置和瀏覽器檢查。
- Luca CSS 不分層。P0 試裝時，載入順序錯誤讓既有頁面改變（60 張中有 18 張）。
- Tailwind v3 要搭配 `tailwind-merge` v2.6，3.x 只支援 v4。
- 乾淨專案要從打包檔安裝，不能用 workspace 連結，否則驗不到實際發佈的內容。
