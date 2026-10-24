# 綁定變數到節點並設定各頁面 frame 的模式

## Done when

- `scripts/design/apply-bindings.js`（進版控、繁中註解）依 `docs/mockup/themes/bindings.json`，把變數綁到兩個套系設計檔的節點（填色、描邊、字型、字級、間距、內距、圓角、效果）以及 22 個母版。
- 每個頁面 frame 的模式依其名稱設定：名稱含 `Light` 或 `Dark` 設 `mode`；含 `Desktop`、`Tablet` 或 `Mobile` 設 `device`。
- 腳本可重跑，重跑不產生重複綁定。
- 以離線 CLI 匯出 `Home/Vibrant/Light/Desktop/Success` 與 `Home/Vibrant/Dark/Desktop/Success` 兩張圖：Dark 圖的頁面底色、導覽列、按鈕、文字都是深色主題的顏色，Light 圖維持淺色。圖放在 `test-results/` 之外的暫存區，並在 `docs/delivery-verification.md` 記錄指令。
- 兩個檔案的節點數仍低於 10,000，並用 MCP `set_fill` 驗證仍可編輯。
- 沒有節點同時帶有固定顏色與變數綁定（綁定後固定值要被覆蓋為解析值，而不是遺留矛盾）。

## Context

規格見 [ISSUE-001](ISSUE-001-split-design-source-by-suite.md)，對應 PR-FILE-11。追蹤子彈已驗證：`figma.bindVariable(nodeId, 'fills/0/color', variableId)` 與 `figma.graph.updateNode(frameId, { variableModes: { [collectionId]: modeId } })` 存檔重讀後仍在，離線匯出能正確畫出 Dark 底色。

## Blocked by

ISSUE-008

## Notes

- 節點對應規則見 ISSUE-007 的 Notes。`.pen` 與 `.fig` 的節點展開程度不同，以 frame 名稱加索引路徑對應。
- 母版內的綁定會被實例繼承，母版先綁；實例上與母版不同的覆寫另外綁。
- App 內屬性面板顯示的「已解析值」是預設模式的值，不是 frame 實際使用的值；判斷以 `fills` 實際值與匯出圖為準。
- OpenPencil App 的 `export_image` 以 id 匯出會失敗，驗收圖一律用離線 `openpencil export <檔> --node <id> -o <圖>`。App 與離線的節點 id 載入後可能差 1，先用 `find_nodes` 或離線查詢確認 id。
- 離線 `openpencil eval -o` 無法保存「新增文字節點」等變更（會報 `Missing bound variable`），本票只綁定既有節點，不新增節點。
