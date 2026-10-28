# 專案強調色從主色推算整組角色，焦點框改為雙圈

Blocked by: ISSUE-002

## Done when

- `ThemeProvider` 的 `accent` 接受 `AccentInput`（只有 `light` 必填）。`dark`、`soft` 沒給時由系統推算；`secondary` 沒給時沿用主色，不產生新色相。（PR-STYLE-32、PR-STYLE-47）
- 滑過、按下色由主色推算：OKLCH 色相不變，日間變深、暗黑變亮，滑過位移 0.05、按下位移 0.10。（PR-STYLE-45）
- 風格套系預設色的滑過、按下色在建置時算好，寫進 tokens 輸出；套系的主色、點綴色、柔和底色仍是人工設計值。（PR-STYLE-32）
- 所有元件的焦點框為雙圈：內圈 2px 表面色、外圈 2px 主色；焦點框與底色對比至少 3:1。（PR-STYLE-46）
- 有一個測試對多組強調色（含極亮、極暗）檢查：推算出的角色在日間與暗黑都通過現有文字對比門檻。（PR-STYLE-33）
- 舊的 `accent` 寫法（`{primary, secondary, soft, ink}`、`{light, dark}` 物件）已移除；升級說明的草稿寫在本議題 Notes 供 ISSUE-014 使用。
- 樣張既有測試通過。

## Context

選色頁上已決定：滑過與按下用 OKLCH 明度位移；焦點框用雙圈；日間主色必填、其餘選填；沒給點綴色就沿用主色。套系預設色在建置時算，專案強調色由 `ThemeProvider` 用 JavaScript 算（不用 CSS 相對色彩語法），對比檢查才能在測試中跑。見 [ISSUE-001](ISSUE-001-design-system-0-2-0.md) Decisions、[架構 §3.3](../03_architecture_design.md)、[前端規格 §5.5.2](../05_frontend_spec.md)、decision-log 2026-10-28。

## Notes

- **不保留舊寫法**（2026-10-28 決定）：0.x 版、兩個使用端專案都沒用 `accent`。在升級說明寫清楚新舊對照即可。
- 推算函式要匯出給 ISSUE-005 的設計檔匯入腳本重用。
- 位移後若對比不夠，要有明確的處理（例如再加深／加亮到過門檻），並在測試中覆蓋。
- 焦點框只改樣式，不換元件底層；Base UI 遷移在 ISSUE-009、ISSUE-010。
