# 撰寫主題保真驗收腳本

## Done when

- `scripts/design/verify-themes.js`（進版控、繁中註解）以 `docs/mockup/themes/resolved.json` 為基準，比對兩個套系設計檔每個頁面 frame 在其模式下解析後的值。比對屬性包含填色、描邊、字型、字級、間距、內距、圓角。
- 全部一致結束碼為 0；任何不一致結束碼非 0，並列出 frame、節點路徑、屬性、期望值與實際值。
- 用故意改壞的副本證明會失敗：一個 Dark frame 被設回 Light 模式、一個變數值被改掉、一處綁定被移除。證明的指令與結果寫入 `docs/delivery-verification.md`。
- `scripts/design/verify-split.js` 新增檢查：同一頁面群組的 Light 與 Dark frame，顏色分布不得完全相同；相同時回報非零結束碼。並用移除變數後的副本（也就是目前損失內容的狀態）證明它會失敗。
- `docs/delivery-verification.md` 記錄每個套系至少各 2 個 Dark 與 2 個 Light 代表 frame 的匯出圖，並寫明「人眼抽查」仍需使用者確認，不聲稱像素比對。

## Context

規格見 [ISSUE-001](ISSUE-001-split-design-source-by-suite.md)，對應 PR-FILE-12、PR-FILE-13。先前的結構驗收以 `components.fig` 為基準，而該基準本身已丟失主題，所以抓不到明暗模式遺失；本票補上這個缺口。

## Blocked by

ISSUE-009

## Notes

- 基準 `resolved.json` 由 ISSUE-007 從 `.pen` 擷取；`.pen` 在 ISSUE-006 之後會被刪除，所以不要讓腳本直接讀 `.pen`。
- 用離線 `openpencil eval` 讀檔，解析使用 `figma.graph.resolveColorVariableForNode(nodeId, variableId)` 及相關的 `resolveNumberVariableForNode`、`resolveStringVariableForNode`。
- 浮點比較容忍 1/255 以內的差異；存檔重讀會產生約 1e-8 的誤差。
- 母版一致性比對 `scripts/design/check-masters.js` 要重跑，確認綁定後兩檔母版仍相同（必要時擴充它比對綁定）。
