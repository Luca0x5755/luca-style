# 資訊密度與元件外形可單獨覆寫，/foundations 加上切換

Blocked by: ISSUE-002

## Done when

- `ThemeProvider` 接受 `density`（`compact`／`standard`／`comfortable`）與 `shape`（`sharp`／`rounded`）。
- 沒有覆寫時，兩套風格套系的畫面與 0.1.0 相同（既有截圖或計算樣式比對）。（PR-STYLE-29）
- 覆寫 `density` 只改控制項高度、卡片內距、區塊間距、表格儲存格，色彩與外形不變；數值照前端規格 §5.4.1，各套系從自己的 standard 縮放。（PR-STYLE-30）
- 覆寫 `shape` 只改圓角、邊框寬度、指標卡左邊框、指標卡底色與陰影，色彩與密度不變；數值照前端規格 §5.4.2。（PR-STYLE-31）
- 樣張 `/foundations` 有密度與外形的切換，切換後畫面即時更新。
- 有測試逐一驗證「只改一個軸，其他軸的計算樣式不變」。

## Context

ADR 0005 把資訊密度與元件外形從風格套系拆出來，套系只提供預設值。具名等級的理由見 decision-log 2026-10-28。數值表在 [前端規格 §5.4.1 資訊密度、§5.4.2 元件外形](../05_frontend_spec.md)；`/foundations` 的切換見 §5.3.2；合約見 [架構 §3.3](../03_architecture_design.md)。

## Notes

- 等級數值寫進 DTCG（每套系 × 等級），由 Style Dictionary 產生 CSS；不要寫死在元件 CSS。
- 「沒有覆寫」時的 CSS 變數值必須與 0.1.0 完全相同，ISSUE-002 的快照比對要繼續通過。
- `/foundations` 的切換不納入截圖基準（§5.3.2）。
- 設計檔的密度與外形模式不在這張；ISSUE-004 只處理套系預設。
