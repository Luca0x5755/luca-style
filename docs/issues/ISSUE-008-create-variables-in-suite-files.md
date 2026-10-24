# 在兩個套系設計檔建立變數集合與模式

## Done when

- `scripts/design/apply-variables.js`（進版控、繁中註解）讀取 `docs/mockup/themes/variables.json`，在兩個套系設計檔各建立變數集合與模式。
- `suite` 軸不建模式：每個檔案只套用自己那一套的值。`mode` 有 Light 與 Dark 兩個模式；`device` 有 Desktop、Tablet、Mobile 三個模式（只有用到的變數需要）。
- 每個檔案中，變數名稱、型別與每個模式的值，與 `variables.json` 逐筆一致。
- 腳本可重跑，重跑後不產生重複的集合或變數。
- 用離線 `openpencil eval` 重新讀檔，列出每個變數在每個模式的值，結果寫進 `docs/delivery-verification.md`。
- 兩個檔案的節點數仍低於 10,000，並用 MCP `set_fill` 驗證仍可編輯。

## Context

規格見 [ISSUE-001](ISSUE-001-split-design-source-by-suite.md)，對應 PR-FILE-10。追蹤子彈已驗證：`figma.createVariableCollection`、`figma.graph.addMode`、`figma.createVariable`、`figma.setVariableValue` 可建立變數，存檔重讀後仍在。

## Blocked by

ISSUE-007

## Notes

- 已驗證的呼叫方式：`createVariableCollection(name)` 傳回含預設模式的集合；`graph.renameMode(collectionId, modeId, name)`；`graph.addMode(collectionId, newModeId, name)`；`createVariable(name, 'COLOR', collectionId, {r,g,b,a})`；`setVariableValue(variableId, modeId, value)`。顏色用 0 到 1 的浮點數。
- 變數值依 `variables.json`，不要自己重算顏色。
- 2 個以上依 `device` 軸的數值變數、字串變數（字型）與布林變數的型別名稱對應：`FLOAT`、`STRING`、`BOOLEAN`。
- 本機 Windows 的兩處 CLI 修補見先前切檔腳本 `scripts/design/split-by-suite.js` 檔頭。
- 不要在 App 內做這件事；App 的 `bind_variable` 一次只能綁一個節點，離線腳本才能批次做。
