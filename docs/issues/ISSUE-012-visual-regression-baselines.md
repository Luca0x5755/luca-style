# 樣張每頁 × 套系 × 明暗 × 寬度建立截圖基準

Blocked by: ISSUE-006, ISSUE-008, ISSUE-009, ISSUE-010

## Done when

- 一個 Playwright 測試對樣張每一頁 × 兩種風格套系 × 兩種明暗模式 × 寬度 1280／834／390 截圖，與基準比對；不符時測試失敗。（PR-STYLE-42）
- 基準圖用 Playwright 官方 Linux Docker 映像（版本與 `@playwright/test` 一致）產生，存進 repo。
- CI 用同一個映像比對。
- 有一個 npm script 透過 Docker 在本機更新基準，`docs/` 或 README 寫出用法。
- `/foundations` 的密度與外形切換不在基準內。

## Context

對標研究發現 luca-style 沒有截圖比對。CI 跑 Linux、本機是 Windows，字型渲染不同，所以基準一律在 Linux Docker 映像產生（2026-10-28 決定）。這張要等畫面相關議題都完成，否則基準會反覆重做。見 [ISSUE-001](ISSUE-001-design-system-0-2-0.md)、[架構 §3.1](../03_architecture_design.md) 的「品質檢查」列、[前端規格 §5.3](../05_frontend_spec.md)（狀態與寬度）。

## Notes

- repo 已有 `scripts/screenshots.mjs` 與 `scripts/verify-screenshots.mjs`；先看它們做什麼，能併就併，不要再多一套。
- 動畫、游標閃爍、時間等會造成不穩定的東西要關掉或遮罩。
- 截圖數量：頁數 × 2 × 2 × 3，注意 CI 時間；必要時分片。
