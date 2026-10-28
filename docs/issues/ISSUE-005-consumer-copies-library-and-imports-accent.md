# 使用端可複製元件庫設計檔並匯入專案強調色

Blocked by: ISSUE-004, ISSUE-006

## Done when

- 有一個腳本（或 `apply-variables.js` 的參數），讀入使用端的強調色（`AccentInput` 格式），寫進複製出來的元件庫設計檔；推算方式與 `ThemeProvider` 相同。
- 用一組測試強調色跑一次：複製 `luca-style-library.fig` → 匯入 → 匯出 `C/Button`、`C/Select/Open` 等母版，畫面顯示該強調色（含滑過、按下、焦點框）。（PR-FILE-19）
- `docs/consumer-guide.md` 寫清楚兩件事：怎麼複製元件庫開始畫設計稿並匯入強調色；luca-style 更新後怎麼重新匯入設計變數（母版不會自動更新）。（PR-FILE-19）

## Context

ADR 0007 定了使用端設計稿從元件庫複製開始，設計變數可重新匯入；不做 OpenPencil 發布元件庫，也不做同步舊設計稿的腳本。強調色的推算規則由 ISSUE-006 實作，這裡重用同一套推算函式。見 [ADR 0007](../adr/0007-keep-one-component-library-design-file-without-pages.md)、[架構 §3.3](../03_architecture_design.md) 的 `AccentInput`、decision-log 2026-10-28「使用端設計稿從元件庫設計檔複製開始」。

## Notes

- 推算函式只能有一份：從 `@luca-style/react`（或 tokens 套件）匯出給腳本用，不要在腳本裡再寫一次。
- 匯入只覆寫強調色相關變數，不動語意狀態色（ADR 0002）。
- 兩個使用端專案的實際升級不在範圍內。
