# 為 Navigation 新增 brandHref

Blocked by: none

## Done when

- 未提供 `brandHref` 時，`Navigation` 的品牌連結仍是 `/`。
- 提供 `brandHref="/luca-style/"` 時，品牌連結指向該值。
- 既有使用端不需修改程式即可升級。
- [使用端接入文件](../consumer-guide.md)說明 `brandHref` 的用途與預設值。
- Playwright 涵蓋預設與自訂兩種情況；`npm run test:consumer` 通過。

## Context

規格見 [ISSUE-001](ISSUE-001-github-pages-readme.md)，承諾 PR-STYLE-20，並支援 PR-STYLE-18。`Navigation` 的品牌連結寫死 `href="/"`（`packages/react/src/data-display.tsx`），使用端部署在子路徑（例如 GitHub Pages 的 `/luca-style/`）時，點品牌會回到網域根目錄。本票修正公開元件，不涉及樣張路由。

## Blocked by

nothing

## Notes

- 屬性名稱固定為 `brandHref`，型別為可選字串，預設 `/`；型別隨 `@luca-style/react` 公開匯出。
- 這是向下相容的 API 擴充，不需要 ADR；決策已記於 `docs/decision-log.md`。
- 測試要驗證 `href` 屬性值，不是只驗證元素存在。
